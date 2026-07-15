import { v } from "convex/values";
import { action, query } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { logLLMUsage } from "../lib/llm";
import { extractSearchRequirements, buildSearchTerms, type SearchRequirements } from "../lib/jdParser";
import { scoreCandidateAgainstRequirements, selectLlmPool, scoreWithLLM, distinct, type ScoredCandidate } from "../cvs/cvScoring";

export const searchCandidates = query({
  args: {
    query: v.string(),
    industry: v.optional(v.string()),
    seniority: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.query.trim()) return [];

    const limit = args.limit ?? 20;

    const searchWithFilters = (
      index: "search_skills" | "search_title" | "search_summary",
      field: "skills" | "currentJobTitle" | "summary"
    ) =>
      ctx.db.query("candidates").withSearchIndex(index, (q: any) => {
        return q.search(field, args.query);
      }).take(limit);

    const [titleResults, summaryResults, resumeResults] = await Promise.all([
      searchWithFilters("search_title", "currentJobTitle"),
      searchWithFilters("search_summary", "summary"),
      ctx.db.query("candidateResumes").withSearchIndex("search_text", (q: any) => q.search("rawText", args.query)).take(limit)
    ]);

    const textResults = [];
    for (const res of resumeResults) {
      const candidate = await ctx.db.get(res.candidateId);
      if (candidate) textResults.push(candidate);
    }

    // Weighted scoring: title match > text match > summary match
    const weight = new Map<string, number>();
    for (const cv of titleResults) weight.set(cv._id, (weight.get(cv._id) ?? 0) + 100);
    for (const cv of textResults) weight.set(cv._id, (weight.get(cv._id) ?? 0) + 50);
    for (const cv of summaryResults) weight.set(cv._id, (weight.get(cv._id) ?? 0) + 30);

    const seen = new Set<string>();
    const merged: typeof textResults = [];
    for (const cv of [...titleResults, ...textResults, ...summaryResults]) {
      if (!seen.has(cv._id)) {
        seen.add(cv._id);
        merged.push(cv);
      }
    }
    
    // Apply optional simple filters in memory (Removed strict industry and seniority filters as they drop valid candidates due to enum mismatch. Let the LLM handle matching.)
    let filtered = merged;

    filtered.sort((a, b) => (weight.get(b._id) ?? 0) - (weight.get(a._id) ?? 0));
    return filtered.slice(0, limit);
  },
});

type SearchInterpretation = {
  searchText: string;
  industry?: string;
  seniority?: string;
  minYears?: number;
  interpretation: string;
  keywords: string[];
};

export const aiSearch = action({
  args: {
    query: v.string(),
    industry: v.optional(v.string()),
    seniority: v.optional(v.string()),
    minExperience: v.optional(v.number()),
    maxExperience: v.optional(v.number()),
    location: v.optional(v.string()),
    education: v.optional(v.array(v.string())),
    sources: v.optional(v.array(v.string())),
    customFilters: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    interpretation: SearchInterpretation;
    results: {
      candidateId: string;
      score: number;
      reason: string;
      breakdown?: {
        title: string;
        skills: string;
        experience: string;
        location: string;
        industry: string;
      };
    }[];
  }> => {
    const fetchLimit = 100;
    const isQueryEmpty = !args.query || !args.query.trim();

    let parsedReq: SearchRequirements;
    if (isQueryEmpty) {
      parsedReq = {
        title: "",
        alternativeTitles: [],
        occupationSynonyms: [],
        requiredSkills: [],
        preferredSkills: [],
        minYearsExperience: args.minExperience ?? null,
        industry: args.industry ?? null,
        seniority: args.seniority ?? null,
        location: args.location ?? null,
        education: null,
        summary: "Filter-only candidate search",
        keywords: [],
        languages: [],
        clientCompany: null,
        clientContactEmail: null,
        salaryRange: null,
      };
    } else {
      parsedReq = await extractSearchRequirements(args.query, "natural_language");
    }

    const effectiveReq: SearchRequirements = {
      ...parsedReq,
      industry: args.industry ?? parsedReq.industry,
      seniority: args.seniority ?? parsedReq.seniority,
      location: args.location ?? parsedReq.location,
      minYearsExperience: args.minExperience ?? parsedReq.minYearsExperience,
    };

    const interp: SearchInterpretation = {
      searchText: isQueryEmpty ? "Filter Search" : [effectiveReq.title, ...effectiveReq.alternativeTitles, ...effectiveReq.requiredSkills.slice(0, 4)].filter(Boolean).join(" "),
      industry: effectiveReq.industry ?? undefined,
      seniority: effectiveReq.seniority ?? undefined,
      minYears: effectiveReq.minYearsExperience ?? undefined,
      interpretation: effectiveReq.summary,
      keywords: effectiveReq.keywords,
    };

    // 1. Embed query with a fallback
    let queryEmbedding: number[] | null = null;
    if (!isQueryEmpty) {
      try {
        const { embedText } = await import("./agent2.js");
        queryEmbedding = await embedText(args.query, "query");
      } catch (err) {
        console.error("NVIDIA embedding call failed, falling back to keyword-only search:", err);
        queryEmbedding = null;
      }
    }

    // 2. Run vector search only if embedding succeeded
    let vectorResults: { _id: Id<"candidateResumes">; _score: number }[] = [];
    if (queryEmbedding) {
      vectorResults = await ctx.vectorSearch("candidateResumes", "vector_index_candidates", {
        vector: queryEmbedding,
        limit: fetchLimit,
      });
    }

    // 3. Batched document fetch, with score attached
    type ScoredCandidateDoc = Doc<"candidates"> & { vectorScore?: number };

    const scoreById = new Map(vectorResults.map((r) => [r._id, r._score]));

    let vectorCandidates: ScoredCandidateDoc[] = [];
    if (vectorResults.length) {
      const mapped = await ctx.runQuery(internal.matching.queries.getCandidatesByResumeIds, {
        resumeIds: vectorResults.map((r) => r._id),
      });
      vectorCandidates = mapped.map((item: any) => ({
        ...item.candidate,
        vectorScore: scoreById.get(item.resumeId)
      }));
    }

    // Extract query terms for keyword search if query is empty
    const filterTerms: string[] = [];
    if (args.location) filterTerms.push(args.location);
    if (args.seniority) filterTerms.push(args.seniority);
    if (args.customFilters) filterTerms.push(...args.customFilters);
    if (args.education) filterTerms.push(...args.education);

    // 4. Keyword search batches
    let searchBatches: ScoredCandidateDoc[][] = [];
    if (!isQueryEmpty) {
      const searchTerms = buildSearchTerms(effectiveReq, args.query);
      searchBatches = await Promise.all([
        ctx.runQuery(api.matching.search.searchCandidates, { query: args.query, industry: interp.industry, seniority: interp.seniority, limit: fetchLimit }),
        ...searchTerms.slice(0, 5).filter((term) => term !== args.query).map((term) =>
          ctx.runQuery(api.matching.search.searchCandidates, { query: term, industry: interp.industry, seniority: interp.seniority, limit: fetchLimit })
        ),
        ...interp.keywords.slice(0, 2).map((kw) =>
          ctx.runQuery(api.matching.search.searchCandidates, { query: kw, limit: 12 })
        ),
      ]);
    } else if (filterTerms.length > 0) {
      searchBatches = await Promise.all(
        filterTerms.slice(0, 5).map((term) =>
          ctx.runQuery(api.matching.search.searchCandidates, { query: term, limit: fetchLimit })
        )
      );
    }

    // 5. Merge and deduplicate
    const seen = new Set<Id<"candidates">>();
    const rawResults: ScoredCandidateDoc[] = [];

    for (const cand of vectorCandidates) {
      if (!seen.has(cand._id)) {
        seen.add(cand._id);
        rawResults.push(cand);
      }
    }

    for (const batch of searchBatches.flat()) {
      if (batch && !seen.has(batch._id)) {
        seen.add(batch._id);
        rawResults.push(batch);
      }
    }

    // Fallback: If no results found and query is empty, query recently active candidates
    let finalRawResults = rawResults;
    if (finalRawResults.length === 0 && isQueryEmpty) {
      finalRawResults = await ctx.runQuery(internal.matching.queries.getRecentCandidates, { limit: 100 });
    }

    if (finalRawResults.length === 0) {
      return { interpretation: interp, results: [] };
    }

    const applyFiltersStrictly = (candidatesList: ScoredCandidateDoc[]) => {
      let list = candidatesList;
      if (args.location) {
        const searchLoc = args.location.toLowerCase().trim();
        if (searchLoc) {
          list = list.filter((c) => {
            const dbLoc = (c.location || "").toLowerCase();
            if (searchLoc === "remote") {
              return (
                dbLoc.includes("remote") ||
                dbLoc.includes("wfh") ||
                dbLoc.includes("home") ||
                dbLoc.includes("work from home")
              );
            }
            return dbLoc.includes(searchLoc);
          });
        }
      }

      if (args.seniority) {
        const searchSeniority = args.seniority.toLowerCase().trim();
        list = list.filter((c) => {
          const dbLevel = (c.seniorityLevel || "").toLowerCase();
          const currentTitle = (c.currentJobTitle || c.currentTitle || "").toLowerCase();
          const histTitles = (c.jobHistory || []).map((h) => (h.title || "").toLowerCase());
          const allTitles = [currentTitle, ...histTitles];

          if (searchSeniority === "senior") {
            return (
              dbLevel.includes("senior") ||
              dbLevel.includes("snr") ||
              allTitles.some((t) => t.includes("senior") || t.includes("snr") || t.includes("sr "))
            );
          }
          if (searchSeniority === "lead") {
            return (
              dbLevel.includes("lead") ||
              dbLevel.includes("principal") ||
              dbLevel.includes("executive") ||
              allTitles.some((t) =>
                t.includes("lead") ||
                t.includes("principal") ||
                t.includes("head") ||
                t.includes("manager") ||
                t.includes("director") ||
                t.includes("vp") ||
                t.includes("chief") ||
                t.includes("cto") ||
                t.includes("ceo") ||
                t.includes("coo")
              )
            );
          }
          return true;
        });
      }

      if (args.minExperience !== undefined) {
        list = list.filter((c) => {
          const exp = c.totalExperienceYears ?? c.yearsOfExperience;
          if (exp === undefined || exp === null) return true;
          return exp >= args.minExperience!;
        });
      }

      if (args.maxExperience !== undefined) {
        list = list.filter((c) => {
          const exp = c.totalExperienceYears ?? c.yearsOfExperience;
          if (exp === undefined || exp === null) return true;
          return exp <= args.maxExperience!;
        });
      }

      if (args.education && args.education.length > 0) {
        list = list.filter((c) => {
          const degrees = [
            c.educationDegree || "",
            ...(c.education || []).map((edu: any) => edu.degree || ""),
          ].map((d) => d.toLowerCase());

          return args.education!.some((edu) => {
            if (edu === "Bachelor") {
              return degrees.some(
                (degree) =>
                  degree.includes("bachelor") ||
                  degree.includes("bsc") ||
                  degree.includes("ba") ||
                  degree.includes("b.tech") ||
                  degree.includes("b.e.") ||
                  degree.includes("b.a.") ||
                  degree.includes("b.s.")
              );
            }
            if (edu === "Masters") {
              return degrees.some(
                (degree) =>
                  degree.includes("master") ||
                  degree.includes("msc") ||
                  degree.includes("ma") ||
                  degree.includes("mba") ||
                  degree.includes("m.tech") ||
                  degree.includes("m.s.") ||
                  degree.includes("m.phil")
              );
            }
            return degrees.some((degree) => degree.includes(edu.toLowerCase()));
          });
        });
      }

      if (args.sources && args.sources.length > 0) {
        list = list.filter((c) => {
          const source = (c.sourceChannel || c.firstSourceChannel || "").toLowerCase();
          return args.sources!.some((s) => {
            const filterSrc = s.toLowerCase();
            if (filterSrc === "whatsapp") {
              return source === "whatsapp" || source === "meta_campaign";
            }
            return source === filterSrc;
          });
        });
      }

      if (args.customFilters && args.customFilters.length > 0) {
        list = list.filter((c) => {
          const skills = (c.skills || []).map((s) =>
            (typeof s === "string" ? s : (s as any).value || "").toLowerCase()
          );
          const certs = (c.certifications || []).map((cert) => cert.toLowerCase());
          const summary = (c.summary || "").toLowerCase();
          const fullName = (c.fullName || "").toLowerCase();
          const rawText = (c.rawText || "").toLowerCase();

          return args.customFilters!.every((filter) => {
            const search = filter.toLowerCase().trim();
            if (!search) return true;
            return (
              skills.some((s) => s.includes(search)) ||
              certs.some((cert) => cert.includes(search)) ||
              summary.includes(search) ||
              fullName.includes(search) ||
              rawText.includes(search)
            );
          });
        });
      }

      return list;
    };

    // Apply strict filtering first
    let filteredResults = applyFiltersStrictly(finalRawResults);

    // Progressive Narrowing Fallback:
    // If strict filtering yields zero candidates, fallback to raw results
    // and let the heuristic matching engine score and sort them.
    if (filteredResults.length === 0) {
      console.log("Strict filters returned 0 candidates. Falling back to progressive soft match.");
      filteredResults = finalRawResults;
    }

    const topCandidates = filteredResults.slice(0, 30);

    const ranked = topCandidates
      .map((cv: (typeof finalRawResults)[0], index: number) => scoreCandidateAgainstRequirements(cv as any, effectiveReq, index))
      .sort((a: ScoredCandidate, b: ScoredCandidate) =>
        (b.titleScore - a.titleScore) ||
        (b.skillScore - a.skillScore) ||
        (b.experienceScore - a.experienceScore) ||
        (b.overallScore - a.overallScore)
      );

    // LLM-based re-scoring for top candidates (skip if query is empty)
    let finalRanked: typeof ranked = [];
    if (!isQueryEmpty) {
      const llmPool = selectLlmPool(ranked);
      const llmScored = await Promise.all(
        llmPool.map(async (cv) => {
          const llmScore = await scoreWithLLM(cv.cv, effectiveReq);
          return { ...cv, llmScore };
        })
      );

      finalRanked = llmScored
        .sort((a, b) =>
          (Number(b.llmScore?.score ?? 0) - Number(a.llmScore?.score ?? 0)) ||
          ((b.cv as any).vectorScore ?? 0) - ((a.cv as any).vectorScore ?? 0) || // Tie-breaker 1: Vector score
          (b.overallScore - a.overallScore) ||                                   // Tie-breaker 2: Heuristics
          (a.locationStatus === "match" ? 1 : 0) - (b.locationStatus === "match" ? 1 : 0)
        );
    } else {
      // Filter-only search: skip LLM and sort by overall score
      finalRanked = ranked.sort((a, b) => b.overallScore - a.overallScore);
    }

    const results = finalRanked
      .slice(0, args.limit ?? 20)
      .filter((item) => item.overallScore >= 20 || item.titleScore >= 40)
      .map((item) => {
        // Calculate breakdown categories
        const titleMatch = item.titleScore >= 90 ? "strong match" : item.titleScore >= 70 ? "partial match" : "loose match";
        const skillsMatch = item.skillScore >= 80 ? "strong match" : item.skillScore >= 50 ? "partial match" : "loose match";
        
        let expMatch = "not specified";
        if (effectiveReq.minYearsExperience != null) {
          const exp = (item.cv as any).yearsOfExperience ?? (item.cv as any).totalExperienceYears;
          if (exp == null) expMatch = "not specified";
          else if (exp >= effectiveReq.minYearsExperience) expMatch = "meets target";
          else expMatch = "below range";
        }
        
        const locMatch = item.locationStatus === "match" ? "match" 
          : item.locationStatus === "different" ? "different" 
          : "not specified";
          
        const indMatch = item.industryScore === 100 ? "match" : "different";

        return {
          candidateId: item.cv._id,
          score: item.overallScore,
          reason: item.reason,
          breakdown: {
            title: titleMatch,
            skills: skillsMatch,
            experience: expMatch,
            location: locMatch,
            industry: indMatch
          }
        };
      });

    return { interpretation: interp, results };
  },
});

export const parseNLQuery = action({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) throw new Error("NVIDIA_API_KEY not set.");

    const FILTER_SCHEMA = {
      skills: ["string"],
      minYearsExperience: "number",
      maxYearsExperience: "number",
      location: "string",
      currentJobTitle: "string",
      seniority: "Junior | Mid | Senior | Lead | Director",
    };

    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nvidia/llama-3.1-nemotron-70b-instruct",
        messages: [{
          role: "user",
          content: `Extract search filters from this query as JSON: "${args.query}"\nSchema: ${JSON.stringify(FILTER_SCHEMA)}\nRespond ONLY with valid JSON. Do not add markdown backticks.`
        }],
        max_tokens: 500,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      await logLLMUsage(
        ctx,
        "jd_matching",
        "nvidia/llama-3.1-nemotron-70b-instruct",
        0,
        0,
        false,
        `NVIDIA API Error: ${response.status} ${errorText}`
      );
      throw new Error("NVIDIA API failed");
    }
    
    const data = await response.json();
    
    // Log successful token usage
    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;
    await logLLMUsage(
      ctx,
      "jd_matching",
      "nvidia/llama-3.1-nemotron-70b-instruct",
      promptTokens,
      completionTokens,
      true
    );

    try {
      let content = data.choices[0].message.content;
      // Strip markdown code blocks if any
      content = content.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse NVIDIA response:", e);
      return {};
    }
  }
});

export const semanticSearch = action({
  args: { 
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Embed query
    const { embedText } = await import("./agent2.js");
    const queryEmbedding = await embedText(args.query);

    // 2. Vector search
    const results = await ctx.vectorSearch("candidateResumes", "vector_index_candidates", {
      vector: queryEmbedding,
      limit: args.limit ?? 100,
    });

    if (!results.length) return [];

    const mappedResumes = await ctx.runQuery(internal.matching.queries.getCandidatesByResumeIds, {
      resumeIds: results.map(r => r._id)
    });
    const resumeIdToCandidateId = new Map(mappedResumes.map((item: any) => [item.resumeId, item.candidate._id]));
    
    const mappedResults: any[] = results.map((r: any, i: number) => {
      const candidateId = resumeIdToCandidateId.get(r._id);
      return {
        candidateId,
        matchScore: Math.round(r._score * 100),
        matchReason: `Semantic match based on vector similarity (${(r._score * 100).toFixed(1)}%)`,
      };
    }).filter(r => !!r.candidateId);

    // 3. Return IDs and scores
    return mappedResults;
  }
});

import { mutation } from "../_generated/server";
export const bulkAddToPipeline = mutation({
  args: {
    candidateIds: v.array(v.id("candidates")),
    jobId: v.id("jobs"),
    sourceChannel: v.string(),
    stage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Basic bulk insert to applications
    for (const candidateId of args.candidateIds) {
      // Check existing
      const existing = await ctx.db.query("applications")
        .withIndex("by_candidate_job", q => q.eq("candidateId", candidateId).eq("jobId", args.jobId))
        .first();
        
      if (!existing) {
        await ctx.db.insert("applications", {
          candidateId,
          jobId: args.jobId,
          sourceChannel: args.sourceChannel,
          currentStage: (args.stage ?? "new_cvs") as any,
          loopIteration: 0,
          isActive: true,
          createdAt: Date.now(),
          lastStageChangedAt: Date.now(),
        });
      }
    }
  }
});
