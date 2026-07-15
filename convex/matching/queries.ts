import { v } from "convex/values";
import { internalQuery, internalMutation } from "../_generated/server";

import type { Doc } from "../_generated/dataModel";

export const getCandidate = internalQuery({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.candidateId);
  },
});

export const getCandidatesBatch = internalQuery({
  args: { candidateIds: v.array(v.id("candidates")) },
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.candidateIds.map((id) => ctx.db.get(id))
    );
    return results.filter((c): c is Doc<"candidates"> => c !== null);
  },
});

export const getCandidatesByResumeIds = internalQuery({
  args: { resumeIds: v.array(v.id("candidateResumes")) },
  handler: async (ctx, args) => {
    // Parallel batch fetch instead of serial N+1 loop
    const resumes = await Promise.all(args.resumeIds.map((id) => ctx.db.get(id)));
    const candidateIds = resumes
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({ resumeId: r._id, candidateId: r.candidateId }));
    const candidates = await Promise.all(candidateIds.map(({ candidateId }) => ctx.db.get(candidateId)));
    const results = [];
    for (let i = 0; i < candidateIds.length; i++) {
      const candidate = candidates[i];
      if (candidate) results.push({ candidate, resumeId: candidateIds[i].resumeId });
    }
    return results;
  },
});

export const getCandidateResume = internalQuery({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    return await ctx.db.query("candidateResumes").withIndex("by_candidateId", (q: any) => q.eq("candidateId", args.candidateId)).first();
  },
});

export const getCandidateResumesBatch = internalQuery({
  args: { candidateIds: v.array(v.id("candidates")) },
  handler: async (ctx, args) => {
    const resumes = await Promise.all(
      args.candidateIds.map((id) => ctx.db.query("candidateResumes").withIndex("by_candidateId", (q: any) => q.eq("candidateId", id)).first())
    );
    return resumes.filter((r) => r !== null);
  },
});

export const updateCandidateEmbedding = internalMutation({
  args: { 
    candidateId: v.id("candidates"),
    embedding: v.array(v.number())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("candidateResumes")
      .withIndex("by_candidateId", (q: any) => q.eq("candidateId", args.candidateId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { embedding: args.embedding });
    } else {
      await ctx.db.insert("candidateResumes", {
        candidateId: args.candidateId,
        rawText: "",
        embedding: args.embedding,
      });
    }
  },
});

export const updateJobEmbedding = internalMutation({
  args: { 
    jobId: v.id("jobs"),
    embedding: v.array(v.number())
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      embedding: args.embedding,
    });
  },
});

export const getRecentCandidates = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("candidates")
      .order("desc")
      .take(args.limit);
  },
});

export const getCandidateResumesMissingEmbeddings = internalQuery({
  args: { limit: v.number(), cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let currentCursor = args.cursor ?? null;
    const missing: any[] = [];
    let isDone = false;

    // Scan up to 3 pages (300 resumes max) to keep execution limits safe
    for (let i = 0; i < 3; i++) {
      const page: any = await ctx.db.query("candidateResumes").paginate({
        numItems: 100,
        cursor: currentCursor,
      });

      const pageMissing = page.page.filter((r: any) => !r.embedding || r.embedding.length === 0);
      missing.push(...pageMissing);
      currentCursor = page.continueCursor;
      isDone = page.isDone;

      if (missing.length >= args.limit || isDone) {
        break;
      }
    }

    return {
      missing: missing.slice(0, args.limit),
      continueCursor: currentCursor,
      isDone,
    };
  },
});

export const getApplicationsByJobIdInternal = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applications")
      .withIndex("by_job_active", (q) => q.eq("jobId", args.jobId).eq("isActive", true))
      .collect();
  },
});
