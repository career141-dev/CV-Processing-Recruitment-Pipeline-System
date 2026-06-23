// V8 runtime — mutations and queries for Workable import tracking
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";

export const createImportJob = internalMutation({
  args: {
    userId: v.string(),
    totalCandidates: v.number(),
    subdomain: v.optional(v.string()),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("workableImports", {
      status: "running",
      totalCandidates: args.totalCandidates,
      imported: 0,
      skipped: 0,
      failed: 0,
      userId: args.userId,
      startedAt: new Date().toISOString(),
      subdomain: args.subdomain,
      apiKey: args.apiKey,
    });
  },
});

export const updateImportJob = internalMutation({
  args: {
    importId: v.id("workableImports"),
    imported: v.optional(v.number()),
    skipped: v.optional(v.number()),
    deduplicated: v.optional(v.number()),
    failed: v.optional(v.number()),
    totalCandidates: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal("running"), v.literal("done"), v.literal("error"), v.literal("stopped"))
    ),
    errorMessage: v.optional(v.string()),
    lastCursor: v.optional(v.string()),
    subdomain: v.optional(v.string()),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { importId, ...rest } = args;
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(rest)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(importId, patch);
  },
});

export const getImportJob = internalQuery({
  args: { importId: v.id("workableImports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.importId);
  },
});

export const getLatestImportJob = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("workableImports").order("desc").first();
  },
});

export const insertCvUpload = internalMutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("cvUploads", {
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      source: "Workable",
      uploadedBy: args.userId,
      status: "pending",
    });
  },
});

export const findCandidateByWorkableId = internalQuery({
  args: { workableCandidateId: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("candidates")
      .withIndex("by_workableCandidateId", (q) =>
        q.eq("workableCandidateId", args.workableCandidateId)
      )
      .first();
    return entry ?? null;
  },
});

export const clearImportHistory = mutation({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("workableImports").take(100);
    for (const job of jobs) {
      await ctx.db.delete(job._id);
    }
    return { deleted: jobs.length };
  },
});
