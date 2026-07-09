import { v } from "convex/values";
import { action, query } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
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
      index: "search_text" | "search_skills" | "search_title" | "search_summary",
      field: "rawText" | "skills" | "currentJobTitle" | "summary"
    ) =>
      ctx.db.query("candidates").withSearchIndex(index, (q) => {
        return q.search(field, args.query);
      }).take(limit);

    const [textResults, titleResults, summaryResults] = await Promise.all([
      searchWithFilters("search_text", "rawText"),
      searchWithFilters("search_title", "currentJobTitle"),
      searchWithFilters("search_summary", "summary"),
    ]);

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
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    interpretation: SearchInterpretation;
    results: { candidateId: string; score: number; reason: string }[];
  }> => {
    const fetchLimit = 100;
    const parsedReq = await extractSearchRequirements(args.query, "natural_language");
    const effectiveReq: SearchRequirements = {
      ...parsedReq,
      industry: args.industry ?? parsedReq.industry,
      seniority: args.seniority ?? parsedReq.seniority,
    };

    const interp: SearchInterpretation = {
      searchText: [effectiveReq.title, ...effectiveReq.alternativeTitles, ...effectiveReq.requiredSkills.slice(0, 4)].filter(Boolean).join(" "),
      industry: effectiveReq.industry ?? undefined,
      seniority: effectiveReq.seniority ?? undefined,
      minYears: effectiveReq.minYearsExperience ?? undefined,
      interpretation: effectiveReq.summary,
      keywords: effectiveReq.keywords,
    };

    // 1. Embed query with a fallback
    let queryEmbedding: number[] | null = null;
    try {
      const { embedText } = await import("./agent2.js");
      queryEmbedding = await embedText(args.query, "query");
    } catch (err) {
      console.error("NVIDIA embedding call failed, falling back to keyword-only search:", err);
      queryEmbedding = null;
    }

    // 2. Run vector search only if embedding succeeded
    let vectorResults: { _id: Id<"candidates">; _score: number }[] = [];
    if (queryEmbedding) {
      vectorResults = await ctx.vectorSearch("candidates", "vector_index_candidates", {
        vector: queryEmbedding,
        limit: fetchLimit,
      });
    }

    // 3. Batched document fetch, with score attached
    type ScoredCandidateDoc = Doc<"candidates"> & { vectorScore?: number };

    const scoreById = new Map(vectorResults.map((r) => [r._id, r._score]));

    const vectorCandidates: ScoredCandidateDoc[] = vectorResults.length
      ? (
          await ctx.runQuery(internal.matching.queries.getCandidatesBatch, {
            candidateIds: vectorResults.map((r) => r._id),
          })
        ).map((c) => ({ ...c, vectorScore: scoreById.get(c._id) }))
      : [];

    // 4. Keyword search batches
    const searchTerms = buildSearchTerms(effectiveReq, args.query);
    const searchBatches = await Promise.all([
      ctx.runQuery(api.matching.search.searchCandidates, { query: args.query, industry: interp.industry, seniority: interp.seniority, limit: fetchLimit }),
      ...searchTerms.slice(0, 7).filter((term) => term !== args.query).map((term) =>
        ctx.runQuery(api.matching.search.searchCandidates, { query: term, industry: interp.industry, seniority: interp.seniority, limit: fetchLimit })
      ),
      ...interp.keywords.slice(0, 3).map((kw) =>
        ctx.runQuery(api.matching.search.searchCandidates, { query: kw, limit: 12 })
      ),
    ]);

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

    if (rawResults.length === 0) {
      return { interpretation: interp, results: [] };
    }

    const topCandidates = rawResults.slice(0, 30);

    const ranked = topCandidates
      .map((cv: (typeof rawResults)[0], index: number) => scoreCandidateAgainstRequirements(cv as any, effectiveReq, index))
      .sort((a: ScoredCandidate, b: ScoredCandidate) =>
        (b.titleScore - a.titleScore) ||
        (b.skillScore - a.skillScore) ||
        (b.experienceScore - a.experienceScore) ||
        (b.overallScore - a.overallScore)
      );

    // LLM-based re-scoring for top candidates
    const llmPool = selectLlmPool(ranked);
    const llmScored = await Promise.all(
      llmPool.map(async (cv) => {
        const llmScore = await scoreWithLLM(cv.cv, effectiveReq);
        return { ...cv, llmScore };
      })
    );

    const finalRanked = llmScored
      .sort((a, b) =>
        (b.llmScore - a.llmScore) ||
        ((b.cv as any).vectorScore ?? 0) - ((a.cv as any).vectorScore ?? 0) || // Tie-breaker 1: Vector score
        (b.overallScore - a.overallScore) ||                                   // Tie-breaker 2: Heuristics
        (a.locationStatus === "match" ? 1 : 0) - (b.locationStatus === "match" ? 1 : 0)
      );

    const results = finalRanked
      .slice(0, args.limit ?? 20)
      .filter((item) => item.overallScore >= 20 || item.titleScore >= 40)
      .map((item) => ({
        candidateId: item.cv._id,
        score: item.overallScore,
        reason: item.reason,
      }));

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

    if (!response.ok) throw new Error("NVIDIA API failed");
    
    const data = await response.json();
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
    const results = await ctx.vectorSearch("candidates", "vector_index_candidates", {
      vector: queryEmbedding,
      limit: args.limit ?? 100,
    });

    // 3. Return IDs and scores
    return results.map(r => ({
      candidateId: r._id,
      matchScore: Math.round(r._score * 100),
      matchReason: `Semantic match based on vector similarity (${(r._score * 100).toFixed(1)}%)`,
    }));
  }
});

import { mutation } from "../_generated/server";
export const bulkAddToPipeline = mutation({
  args: {
    candidateIds: v.array(v.id("candidates")),
    jobId: v.id("jobs"),
    sourceChannel: v.string(),
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
          currentStage: "new_cvs",
          loopIteration: 0,
          isActive: true,
          createdAt: Date.now(),
          lastStageChangedAt: Date.now(),
        });
      }
    }
  }
});
