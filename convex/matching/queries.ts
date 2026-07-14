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
    const results = [];
    for (const id of args.resumeIds) {
      const resume = await ctx.db.get(id);
      if (resume) {
        const candidate = await ctx.db.get(resume.candidateId);
        if (candidate) {
          results.push({ candidate, resumeId: resume._id });
        }
      }
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
