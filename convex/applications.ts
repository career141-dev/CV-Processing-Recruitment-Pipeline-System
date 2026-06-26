import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib/permissions";

export const getByJobId = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const applications = await ctx.db
      .query("applications")
      .withIndex("by_job_active", (q) => q.eq("jobId", args.jobId).eq("isActive", true))
      .collect();

    // Enrich with candidate and cv details
    const enriched = await Promise.all(
      applications.map(async (app) => {
        const candidate = await ctx.db.get(app.candidateId);
        const cv = app.cvFileId ? await ctx.db.get(app.cvFileId) : null;
        return {
          ...app,
          candidate,
          cv,
        };
      })
    );

    return enriched;
  },
});

// All applications for a single candidate, joined with job details
export const getByCandidate = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const applications = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", args.candidateId))
      .collect();

    return await Promise.all(
      applications.map(async (app) => {
        const job = await ctx.db.get(app.jobId);
        return {
          ...app,
          jobTitle: job?.title ?? "Unknown Job",
          clientName: job?.clientName ?? "",
        };
      })
    );
  },
});

// Chronological event log for a candidate (newest first)
export const getCandidateTimeline = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const events = await ctx.db
      .query("pipelineEvents")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .order("desc")
      .collect();

    return await Promise.all(
      events.map(async (e) => {
        const job = await ctx.db.get(e.jobId);
        return {
          ...e,
          jobTitle: job?.title ?? "Unknown Job",
        };
      })
    );
  },
});

// AI call log for a candidate (newest first)
export const getCandidateAiCalls = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const calls = await ctx.db
      .query("aiCalls")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .order("desc")
      .collect();

    return await Promise.all(
      calls.map(async (call) => {
        const job = await ctx.db.get(call.jobId);
        return {
          ...call,
          jobTitle: job?.title ?? "Unknown Job",
        };
      })
    );
  },
});

export const createApplication = mutation({
  args: {
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    cvFileId: v.optional(v.id("cvUploads")),
    sourceChannel: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if application already exists for this candidate and job
    const existing = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", args.candidateId))
      .filter((q) => q.eq(q.field("jobId"), args.jobId))
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("applications", {
      candidateId: args.candidateId,
      jobId: args.jobId,
      cvFileId: args.cvFileId,
      sourceChannel: args.sourceChannel,
      currentStage: "new_cvs",
      loopIteration: 1,
      isActive: true,
      lastStageChangedAt: now,
      createdAt: now,
    });
  },
});

export const removeApplication = mutation({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await ctx.db.delete(args.applicationId);
  }
});
