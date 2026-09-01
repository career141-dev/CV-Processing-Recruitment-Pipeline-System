import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

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
      phase: "discovery",
      totalMessages: args.totalMessages,
      scannedMessages: 0,
      totalAttachments: 0,
      classifiedHighConfidence: 0,
      flaggedNeedsReview: 0,
      skippedLowConfidence: 0,
      llmCallsCount: 0,
      discoveredTotalEmails: 0,
      discoveredAttachmentEmails: 0,
      targetAttachmentEmails: 0,
      processedAttachmentEmails: 0,
      currentFolderIndex: 0,
      lastHeartbeatAt: now,
      currentStage: "Discovering attachment-bearing emails in mailbox...",
      dryRun: args.dryRun,
      userId: args.userId,
      startedAt: now,
      recentLogs: [
        {
          timestamp: now,
          message: `Started mailbox discovery for ${args.mailboxEmail} (folder: ${args.folder}, dryRun: ${args.dryRun})`,
          type: "info",
        },
      ],
    });
    return jobId;
  },
});

/**
 * Updates scan progress, counters, phase, and stage.
 */
export const updateScanProgress = internalMutation({
  args: {
    jobId: v.id("mailboxScanJobs"),
    phase: v.optional(
      v.union(
        v.literal("discovery"),
        v.literal("extracting"),
        v.literal("done"),
        v.literal("error"),
        v.literal("stopped"),
        v.literal("paused")
      )
    ),
    scannedMessages: v.optional(v.number()),
    totalMessages: v.optional(v.number()),
    totalAttachments: v.optional(v.number()),
    classifiedHighConfidence: v.optional(v.number()),
    flaggedNeedsReview: v.optional(v.number()),
    skippedLowConfidence: v.optional(v.number()),
    llmCallsCount: v.optional(v.number()),
    discoveredTotalEmails: v.optional(v.number()),
    discoveredAttachmentEmails: v.optional(v.number()),
    targetAttachmentEmails: v.optional(v.number()),
    processedAttachmentEmails: v.optional(v.number()),
    currentStage: v.optional(v.string()),
    nextCursorUrl: v.optional(v.string()),
    currentFolderIndex: v.optional(v.number()),
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

    const patch: any = {
      lastHeartbeatAt: Date.now(),
    };
    if (args.phase !== undefined) patch.phase = args.phase;
    if (args.scannedMessages !== undefined) patch.scannedMessages = args.scannedMessages;
    if (args.totalMessages !== undefined) patch.totalMessages = args.totalMessages;
    if (args.totalAttachments !== undefined) patch.totalAttachments = args.totalAttachments;
    if (args.classifiedHighConfidence !== undefined) patch.classifiedHighConfidence = args.classifiedHighConfidence;
    if (args.flaggedNeedsReview !== undefined) patch.flaggedNeedsReview = args.flaggedNeedsReview;
    if (args.skippedLowConfidence !== undefined) patch.skippedLowConfidence = args.skippedLowConfidence;
    if (args.llmCallsCount !== undefined) patch.llmCallsCount = args.llmCallsCount;
    if (args.discoveredTotalEmails !== undefined) patch.discoveredTotalEmails = args.discoveredTotalEmails;
    if (args.discoveredAttachmentEmails !== undefined) patch.discoveredAttachmentEmails = args.discoveredAttachmentEmails;
    if (args.targetAttachmentEmails !== undefined) patch.targetAttachmentEmails = args.targetAttachmentEmails;
    if (args.processedAttachmentEmails !== undefined) patch.processedAttachmentEmails = args.processedAttachmentEmails;
    if (args.currentStage !== undefined) patch.currentStage = args.currentStage;
    if (args.nextCursorUrl !== undefined) patch.nextCursorUrl = args.nextCursorUrl;
    if (args.currentFolderIndex !== undefined) patch.currentFolderIndex = args.currentFolderIndex;

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
    phase: v.optional(
      v.union(
        v.literal("discovery"),
        v.literal("extracting"),
        v.literal("done"),
        v.literal("error"),
        v.literal("stopped"),
        v.literal("paused")
      )
    ),
    errorMessage: v.optional(v.string()),
    currentStage: v.optional(v.string()),
    nextCursorUrl: v.optional(v.string()),
    currentFolderIndex: v.optional(v.number()),
    discoveredTotalEmails: v.optional(v.number()),
    discoveredAttachmentEmails: v.optional(v.number()),
    targetAttachmentEmails: v.optional(v.number()),
    processedAttachmentEmails: v.optional(v.number()),
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
      lastHeartbeatAt: Date.now(),
    };

    if (args.phase !== undefined) patch.phase = args.phase;
    if (args.status === "done" || args.status === "error" || args.status === "stopped") {
      patch.completedAt = Date.now();
      if (args.status === "done") patch.phase = "done";
      if (args.status === "error") patch.phase = "error";
      if (args.status === "stopped") patch.phase = "stopped";
    }
    if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage;
    if (args.currentStage !== undefined) patch.currentStage = args.currentStage;
    if (args.nextCursorUrl !== undefined) patch.nextCursorUrl = args.nextCursorUrl;
    if (args.currentFolderIndex !== undefined) patch.currentFolderIndex = args.currentFolderIndex;
    if (args.discoveredTotalEmails !== undefined) patch.discoveredTotalEmails = args.discoveredTotalEmails;
    if (args.discoveredAttachmentEmails !== undefined) patch.discoveredAttachmentEmails = args.discoveredAttachmentEmails;
    if (args.targetAttachmentEmails !== undefined) patch.targetAttachmentEmails = args.targetAttachmentEmails;
    if (args.processedAttachmentEmails !== undefined) patch.processedAttachmentEmails = args.processedAttachmentEmails;

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
 * Public mutation to request stopping, pausing, resuming or resetting a scan job from the UI.
 */
export const requestJobControl = mutation({
  args: {
    jobId: v.id("mailboxScanJobs"),
    action: v.union(
      v.literal("pause"),
      v.literal("resume"),
      v.literal("stop"),
      v.literal("reset")
    ),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Scan job not found");

    if (args.action === "stop" || args.action === "reset") {
      await ctx.db.patch(args.jobId, {
        status: "stopped",
        completedAt: Date.now(),
        currentStage: "Scan stopped by user.",
        lastHeartbeatAt: Date.now(),
        recentLogs: [
          ...(job.recentLogs || []),
          {
            timestamp: Date.now(),
            message: `Scan job ${args.action === "reset" ? "reset" : "stopped"} by user.`,
            type: "warning",
          },
        ].slice(-50),
      });
      return { success: true, status: "stopped" };
    } else if (args.action === "pause") {
      await ctx.db.patch(args.jobId, {
        status: "paused",
        currentStage: "Scan paused.",
        lastHeartbeatAt: Date.now(),
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
        lastHeartbeatAt: Date.now(),
        recentLogs: [
          ...(job.recentLogs || []),
          {
            timestamp: Date.now(),
            message: "Scan job resumed by user.",
            type: "info",
          },
        ].slice(-50),
      });

      // Schedule continuation of background scan
      await ctx.scheduler.runAfter(
        0,
        (internal as any).communications.emailBackfill.executeMailboxScanBackground,
        {
          jobId: args.jobId,
          mailboxEmail: job.mailboxEmail,
          folder: job.folder,
          dryRun: job.dryRun,
          maxMessages: job.totalMessages || 250,
          targetAttachmentEmails: job.targetAttachmentEmails || job.totalMessages || 250,
          processedAttachmentEmails: job.processedAttachmentEmails || job.scannedMessages || 0,
          folderIndex: job.currentFolderIndex ?? 0,
          nextCursorUrl: job.nextCursorUrl,
          scannedMessages: job.scannedMessages || 0,
          totalAttachments: job.totalAttachments || 0,
          classifiedHighConfidence: job.classifiedHighConfidence || 0,
          flaggedNeedsReview: job.flaggedNeedsReview || 0,
          skippedLowConfidence: job.skippedLowConfidence || 0,
          llmCallsCount: job.llmCallsCount || 0,
        }
      );

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
 * Public query: Gets persistent scan checkpoint for a mailbox + folder.
 */
export const getMailboxCheckpoint = query({
  args: {
    mailboxEmail: v.string(),
    folder: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.mailboxEmail.toLowerCase().trim();
    return await ctx.db
      .query("mailboxCheckpoints")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxEmail", cleanEmail).eq("folder", args.folder)
      )
      .first();
  },
});

/**
 * Internal mutation: Saves/updates persistent checkpoint with discovered counts and pagination cursor.
 */
export const saveMailboxCheckpoint = internalMutation({
  args: {
    mailboxEmail: v.string(),
    folder: v.string(),
    totalDiscoveredAttachmentEmails: v.optional(v.number()),
    totalDiscoveredEmails: v.optional(v.number()),
    totalExtractedCount: v.optional(v.number()),
    nextCursorUrl: v.optional(v.string()),
    currentFolderIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.mailboxEmail.toLowerCase().trim();
    const existing = await ctx.db
      .query("mailboxCheckpoints")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxEmail", cleanEmail).eq("folder", args.folder)
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        totalDiscoveredAttachmentEmails:
          args.totalDiscoveredAttachmentEmails ?? existing.totalDiscoveredAttachmentEmails,
        totalDiscoveredEmails:
          args.totalDiscoveredEmails ?? existing.totalDiscoveredEmails,
        totalExtractedCount:
          args.totalExtractedCount ?? existing.totalExtractedCount,
        nextCursorUrl: args.nextCursorUrl !== undefined ? args.nextCursorUrl : existing.nextCursorUrl,
        currentFolderIndex:
          args.currentFolderIndex !== undefined ? args.currentFolderIndex : existing.currentFolderIndex,
        lastExtractedAt: now,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("mailboxCheckpoints", {
        mailboxEmail: cleanEmail,
        folder: args.folder,
        totalDiscoveredAttachmentEmails: args.totalDiscoveredAttachmentEmails ?? 0,
        totalDiscoveredEmails: args.totalDiscoveredEmails ?? 0,
        totalExtractedCount: args.totalExtractedCount ?? 0,
        nextCursorUrl: args.nextCursorUrl,
        currentFolderIndex: args.currentFolderIndex ?? 0,
        lastDiscoveredAt: now,
        lastExtractedAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Public mutation: Resets persistent checkpoint to start scan over from the beginning.
 */
export const resetMailboxCheckpoint = mutation({
  args: {
    mailboxEmail: v.string(),
    folder: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.mailboxEmail.toLowerCase().trim();
    const existing = await ctx.db
      .query("mailboxCheckpoints")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxEmail", cleanEmail).eq("folder", args.folder)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { success: true, reset: true };
    }
    return { success: true, reset: false };
  },
});
