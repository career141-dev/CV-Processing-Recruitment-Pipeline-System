import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Creates a new mailbox scanning job record.
 */
export const createScanJob = internalMutation({
  args: {
    mailboxEmail: v.string(),
    folder: v.string(),
    dryRun: v.boolean(),
    userId: v.optional(v.string()),
    totalMessages: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const jobId = await ctx.db.insert("mailboxScanJobs", {
      mailboxEmail: args.mailboxEmail.toLowerCase().trim(),
      folder: args.folder,
      status: "running",
      totalMessages: args.totalMessages,
      scannedMessages: 0,
      totalAttachments: 0,
      classifiedHighConfidence: 0,
      flaggedNeedsReview: 0,
      skippedLowConfidence: 0,
      llmCallsCount: 0,
      currentStage: "Initializing mailbox scan...",
      dryRun: args.dryRun,
      userId: args.userId,
      startedAt: now,
      recentLogs: [
        {
          timestamp: now,
          message: `Started mailbox scan for ${args.mailboxEmail} (folder: ${args.folder}, dryRun: ${args.dryRun})`,
          type: "info",
        },
      ],
    });
    return jobId;
  },
});

/**
 * Updates scan progress, counters, and stage.
 */
export const updateScanProgress = internalMutation({
  args: {
    jobId: v.id("mailboxScanJobs"),
    scannedMessages: v.optional(v.number()),
    totalMessages: v.optional(v.number()),
    totalAttachments: v.optional(v.number()),
    classifiedHighConfidence: v.optional(v.number()),
    flaggedNeedsReview: v.optional(v.number()),
    skippedLowConfidence: v.optional(v.number()),
    llmCallsCount: v.optional(v.number()),
    currentStage: v.optional(v.string()),
    phase: v.optional(v.string()),
    targetAttachmentEmails: v.optional(v.number()),
    processedAttachmentEmails: v.optional(v.number()),
    logMessage: v.optional(
      v.object({
        message: v.string(),
        type: v.string(), // "info" | "success" | "warning" | "error"
      })
    ),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    const patch: any = {};
    if (args.scannedMessages !== undefined) patch.scannedMessages = args.scannedMessages;
    if (args.totalMessages !== undefined) patch.totalMessages = args.totalMessages;
    if (args.totalAttachments !== undefined) patch.totalAttachments = args.totalAttachments;
    if (args.classifiedHighConfidence !== undefined) patch.classifiedHighConfidence = args.classifiedHighConfidence;
    if (args.flaggedNeedsReview !== undefined) patch.flaggedNeedsReview = args.flaggedNeedsReview;
    if (args.skippedLowConfidence !== undefined) patch.skippedLowConfidence = args.skippedLowConfidence;
    if (args.llmCallsCount !== undefined) patch.llmCallsCount = args.llmCallsCount;
    if (args.currentStage !== undefined) patch.currentStage = args.currentStage;
    if (args.phase !== undefined) patch.phase = args.phase;
    if (args.targetAttachmentEmails !== undefined) patch.targetAttachmentEmails = args.targetAttachmentEmails;
    if (args.processedAttachmentEmails !== undefined) patch.processedAttachmentEmails = args.processedAttachmentEmails;

    if (args.logMessage) {
      const currentLogs = job.recentLogs || [];
      const updatedLogs = [
        ...currentLogs,
        {
          timestamp: Date.now(),
          message: args.logMessage.message,
          type: args.logMessage.type,
        },
      ].slice(-50); // Keep last 50 logs to avoid unbounded doc growth
      patch.recentLogs = updatedLogs;
    }

    await ctx.db.patch(args.jobId, patch);
  },
});

/**
 * Updates status of a scan job.
 */
export const setScanJobStatus = internalMutation({
  args: {
    jobId: v.id("mailboxScanJobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("done"),
      v.literal("error"),
      v.literal("stopped")
    ),
    errorMessage: v.optional(v.string()),
    currentStage: v.optional(v.string()),
    phase: v.optional(v.string()),
    logMessage: v.optional(
      v.object({
        message: v.string(),
        type: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    const patch: any = {
      status: args.status,
    };

    if (args.status === "done" || args.status === "error" || args.status === "stopped") {
      patch.completedAt = Date.now();
    }
    if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage;
    if (args.currentStage !== undefined) patch.currentStage = args.currentStage;

    if (args.logMessage) {
      const currentLogs = job.recentLogs || [];
      patch.recentLogs = [
        ...currentLogs,
        {
          timestamp: Date.now(),
          message: args.logMessage.message,
          type: args.logMessage.type,
        },
      ].slice(-50);
    }

    await ctx.db.patch(args.jobId, patch);
  },
});

/**
 * Public mutation to request stopping or pausing a scan job from the UI.
 */
export const requestJobControl = mutation({
  args: {
    jobId: v.id("mailboxScanJobs"),
    action: v.union(v.literal("pause"), v.literal("resume"), v.literal("stop")),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Scan job not found");

    if (args.action === "stop") {
      await ctx.db.patch(args.jobId, {
        status: "stopped",
        completedAt: Date.now(),
        currentStage: "Scan stopped by user.",
        recentLogs: [
          ...(job.recentLogs || []),
          {
            timestamp: Date.now(),
            message: "Scan job cancelled/stopped by user request.",
            type: "warning",
          },
        ].slice(-50),
      });
      return { success: true, status: "stopped" };
    } else if (args.action === "pause") {
      await ctx.db.patch(args.jobId, {
        status: "paused",
        currentStage: "Scan paused.",
        recentLogs: [
          ...(job.recentLogs || []),
          {
            timestamp: Date.now(),
            message: "Scan job paused by user.",
            type: "warning",
          },
        ].slice(-50),
      });
      return { success: true, status: "paused" };
    } else if (args.action === "resume") {
      await ctx.db.patch(args.jobId, {
        status: "running",
        currentStage: "Resuming scan...",
        recentLogs: [
          ...(job.recentLogs || []),
          {
            timestamp: Date.now(),
            message: "Scan job resumed by user.",
            type: "info",
          },
        ].slice(-50),
      });
      return { success: true, status: "running" };
    }
  },
});

/**
 * Public reactive query: Returns the latest scan job for a mailbox or general latest.
 */
export const getLatestScanJob = query({
  args: {
    mailboxEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.mailboxEmail) {
      const cleanEmail = args.mailboxEmail.toLowerCase().trim();
      return await ctx.db
        .query("mailboxScanJobs")
        .withIndex("by_mailbox", (q) => q.eq("mailboxEmail", cleanEmail))
        .order("desc")
        .first();
    }

    return await ctx.db
      .query("mailboxScanJobs")
      .withIndex("by_startedAt")
      .order("desc")
      .first();
  },
});

/**
 * Public query: Gets a specific scan job by ID.
 */
export const getScanJob = query({
  args: {
    jobId: v.id("mailboxScanJobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

/**
 * Public query: Lists recent scan jobs for audit history.
 */
export const listScanJobs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    return await ctx.db
      .query("mailboxScanJobs")
      .withIndex("by_startedAt")
      .order("desc")
      .take(limit);
  },
});

/**
 * Internal query to check if job was cancelled or paused.
 */
export const checkJobStatus = internalQuery({
  args: {
    jobId: v.id("mailboxScanJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    return job?.status || "stopped";
  },
});

/**
 * Public query: Gets count of unextracted CV uploads.
 */
export const getUnextractedCandidatesCount = query({
  args: {},
  handler: async (ctx) => {
    const unextracted = await ctx.db
      .query("cvUploads")
      .withIndex("by_status", (q) => q.eq("status", "uploaded"))
      .take(1000);
    return unextracted.length;
  },
});

/**
 * Public query: Gets mailbox checkpoint for backfill progress tracking.
 */
export const getMailboxCheckpoint = query({
  args: {
    mailboxEmail: v.string(),
    folder: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.mailboxEmail.toLowerCase().trim();
    const checkpoint = await ctx.db
      .query("mailboxScanJobs")
      .withIndex("by_mailbox", (q) => q.eq("mailboxEmail", cleanEmail))
      .order("desc")
      .first();
    return checkpoint || null;
  },
});
