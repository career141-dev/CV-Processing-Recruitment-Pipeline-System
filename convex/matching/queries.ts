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

export const updateCandidateEmbedding = internalMutation({
  args: { 
    candidateId: v.id("candidates"),
    embedding: v.array(v.number())
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.candidateId, {
      embedding: args.embedding,
    });
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
