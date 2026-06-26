import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { api } from "./_generated/api";
import { extractSearchRequirements, buildSearchTerms, type SearchRequirements } from "./lib/jdParser";
import { scoreCandidateAgainstRequirements, selectLlmPool, scoreWithLLM, distinct, type ScoredCandidate } from "./cvs/cvScoring";

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
    const fetchLimit = (args.limit ?? 20) * 2;
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

    const searchTerms = buildSearchTerms(effectiveReq, args.query);
    const searchBatches = await Promise.all([
      ctx.runQuery(api.search.searchCandidates, { query: args.query, industry: interp.industry, seniority: interp.seniority, limit: fetchLimit }),
      ...searchTerms.slice(0, 7).filter((term) => term !== args.query).map((term) =>
        ctx.runQuery(api.search.searchCandidates, { query: term, industry: interp.industry, seniority: interp.seniority, limit: fetchLimit })
      ),
      ...interp.keywords.slice(0, 3).map((kw) =>
        ctx.runQuery(api.search.searchCandidates, { query: kw, limit: 12 })
      ),
    ]);

    const seen = new Set<string>();
    const rawResults: typeof searchBatches[0] = [];
    for (const batch of searchBatches.flat()) {
      if (!seen.has(batch._id)) {
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
        (b.overallScore - a.overallScore) ||
        (a.locationStatus === "match" ? 1 : 0) - (b.locationStatus === "match" ? 1 : 0)
      );

    const results = finalRanked
      .slice(0, args.limit ?? 20)
      .filter((item) => item.missingRequired.length === 0)
      .filter((item) => item.overallScore >= 35 || item.titleScore >= 55)
      .map((item) => ({
        candidateId: item.cv._id,
        score: item.overallScore,
        reason: item.reason,
      }));

    return { interpretation: interp, results };
  },
});
