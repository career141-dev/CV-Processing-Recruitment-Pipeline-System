import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";

/**
 * Query to check whether a CV with the given SHA-256 hash already exists in cvUploads.
 */
export const checkCvDuplicateByHash = query({
  args: {
    fileHash: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.fileHash) return false;
    const existing = await ctx.db
      .query("cvUploads")
      .withIndex("by_fileHash", (q) => q.eq("fileHash", args.fileHash))
      .first();
    return !!existing;
  },
});

/**
 * Creates a new mailbox scanning job record.
 */
export const createScanJob = mutation({
  args: {
    mailboxEmail: v.string(),
    folder: v.string(),
    dryRun: v.boolean(),
    mode: v.optional(v.union(v.literal("manual"), v.literal("background"))),
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
      deduplicatedCount: 0,
      llmCallsCount: 0,
      discoveredTotalEmails: 0,
      discoveredAttachmentEmails: 0,
      targetAttachmentEmails: 0,
      processedAttachmentEmails: 0,
      currentFolderIndex: 0,
      lastHeartbeatAt: now,
      currentStage: "Discovering attachment-bearing emails in mailbox...",
      dryRun: args.dryRun,
      mode: args.mode || "manual",
      userId: args.userId,
      startedAt: now,
      recentLogs: [
        {
          timestamp: now,
          message: `Started mailbox discovery for ${args.mailboxEmail} (folder: ${args.folder}, mode: ${args.mode || "manual"}, dryRun: ${args.dryRun})`,
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
export const updateScanProgress = mutation({
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
    deduplicatedCount: v.optional(v.number()),
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
    if (args.deduplicatedCount !== undefined) patch.deduplicatedCount = args.deduplicatedCount;
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
export const setScanJobStatus = mutation({
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
    scannedMessages: v.optional(v.number()),
    totalAttachments: v.optional(v.number()),
    classifiedHighConfidence: v.optional(v.number()),
    flaggedNeedsReview: v.optional(v.number()),
    skippedLowConfidence: v.optional(v.number()),
    deduplicatedCount: v.optional(v.number()),
    llmCallsCount: v.optional(v.number()),
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
    if (args.scannedMessages !== undefined) patch.scannedMessages = args.scannedMessages;
    if (args.totalAttachments !== undefined) patch.totalAttachments = args.totalAttachments;
    if (args.classifiedHighConfidence !== undefined) patch.classifiedHighConfidence = args.classifiedHighConfidence;
    if (args.flaggedNeedsReview !== undefined) patch.flaggedNeedsReview = args.flaggedNeedsReview;
    if (args.skippedLowConfidence !== undefined) patch.skippedLowConfidence = args.skippedLowConfidence;
    if (args.deduplicatedCount !== undefined) patch.deduplicatedCount = args.deduplicatedCount;
    if (args.llmCallsCount !== undefined) patch.llmCallsCount = args.llmCallsCount;

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

      // Update persistent checkpoint with latest progress immediately
      const cleanEmail = job.mailboxEmail.toLowerCase().trim();
      const existing = await ctx.db
        .query("mailboxCheckpoints")
        .withIndex("by_mailbox_folder", (q) =>
          q.eq("mailboxEmail", cleanEmail).eq("folder", job.folder)
        )
        .first();

      if (existing) {
        const latestCount = job.processedAttachmentEmails || job.scannedMessages || existing.totalExtractedCount;
        await ctx.db.patch(existing._id, {
          totalExtractedCount: latestCount,
          nextCursorUrl: job.nextCursorUrl || existing.nextCursorUrl,
          currentFolderIndex: job.currentFolderIndex ?? existing.currentFolderIndex,
          lastExtractedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

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
 * Query to check if job was cancelled or paused.
 */
export const checkJobStatus = query({
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
    folder: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.mailboxEmail.toLowerCase().trim();
    const folder = args.folder || "all";
    return await ctx.db
      .query("mailboxCheckpoints")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxEmail", cleanEmail).eq("folder", folder)
      )
      .first();
  },
});

/**
 * Public mutation: Saves/updates persistent checkpoint with discovered counts and pagination cursor.
 */
export const saveMailboxCheckpoint = mutation({
  args: {
    mailboxEmail: v.string(),
    folder: v.optional(v.string()),
    totalDiscoveredAttachmentEmails: v.optional(v.number()),
    totalDiscoveredEmails: v.optional(v.number()),
    totalExtractedCount: v.optional(v.number()),
    nextCursorUrl: v.optional(v.string()),
    currentFolderIndex: v.optional(v.number()),
    checkpoint: v.optional(v.any()),
    lastProcessedMessageId: v.optional(v.string()),
    lastProcessedReceivedAt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.mailboxEmail.toLowerCase().trim();
    const folder = args.folder || "inbox";
    const existing = await ctx.db
      .query("mailboxCheckpoints")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxEmail", cleanEmail).eq("folder", folder)
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
        folder: folder,
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

/**
 * Public query: Gets count of unparsed / unextracted candidates safely via index.
 */
export const getUnextractedCandidatesCount = query({
  args: {},
  handler: async (ctx) => {
    const unparsed = await ctx.db
      .query("candidates")
      .withIndex("by_isParsed", (q) => q.eq("isParsed", false))
      .take(100);

    return unparsed.length;
  },
});

/**
 * Public mutation: Requeues extraction for unextracted candidate stubs.
 */
export const reparseAllUnextractedCandidates = mutation({
  args: {},
  handler: async (ctx) => {
    const unparsedCandidates = await ctx.db
      .query("candidates")
      .withIndex("by_isParsed", (q) => q.eq("isParsed", false))
      .take(50);

    let requeued = 0;
    const processedUploadIds = new Set<string>();

    for (const candidate of unparsedCandidates) {
      if (!candidate.cvUploadId) continue;
      const upload = await ctx.db.get(candidate.cvUploadId);
      if (!upload || (!upload.s3Key && !upload.storageId)) continue;

      processedUploadIds.add(upload._id);

      await ctx.db.patch(upload._id, {
        status: "pending",
        isHealAttempted: false,
        errorMessage: undefined,
        candidateId: candidate._id,
      });

      await ctx.scheduler.runAfter(requeued * 2000, api.cvs.cvExtraction.processCvExtraction, {
        storageId: upload.storageId as any,
        s3Key: upload.s3Key,
        storageProvider: upload.storageProvider || "r2",
        fileType: upload.fileType || "pdf",
        sourceChannel: upload.source || candidate.sourceChannel || "Email",
        uploadedBy: upload.uploadedBy || "System Healing",
        cvUploadId: upload._id,
      });

      requeued++;
    }

    return { success: true, requeuedCount: requeued };
  },
});

/**
 * Public mutation: Starts or resumes a mailbox scan job instantaneously in the background.
 */
export const startMailboxScan = mutation({
  args: {
    mailboxEmail: v.string(),
    folder: v.optional(v.string()),
    maxMessages: v.number(),
    dryRun: v.boolean(),
    mode: v.optional(v.union(v.literal("manual"), v.literal("background"))),
    forceRediscovery: v.optional(v.boolean()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const targetEmail = args.mailboxEmail.toLowerCase().trim();
    const folder = args.folder || "all";
    const maxMessages = args.maxMessages;
    const isDryRun = args.dryRun;
    const runMode = args.mode || "manual";
    const forceRediscovery = Boolean(args.forceRediscovery);
    const now = Date.now();

    // Check if there is an active persistent checkpoint
    const checkpoint = await ctx.db
      .query("mailboxCheckpoints")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxEmail", targetEmail).eq("folder", folder)
      )
      .first();

    const hasCheckpoint =
      !forceRediscovery &&
      checkpoint &&
      checkpoint.totalDiscoveredAttachmentEmails > 0 &&
      checkpoint.totalDiscoveredAttachmentEmails - checkpoint.totalExtractedCount > 0;

    if (hasCheckpoint) {
      const currentExtracted = checkpoint.totalExtractedCount;
      const totalDiscovered = checkpoint.totalDiscoveredAttachmentEmails;
      const remaining = totalDiscovered - currentExtracted;
      const batchSize = maxMessages === -1 ? remaining : Math.min(maxMessages, remaining);
      const targetGoal = currentExtracted + batchSize;

      const jobId = await ctx.db.insert("mailboxScanJobs", {
        mailboxEmail: targetEmail,
        folder,
        status: "running",
        phase: "extracting",
        totalMessages: targetGoal,
        scannedMessages: currentExtracted,
        totalAttachments: 0,
        classifiedHighConfidence: 0,
        flaggedNeedsReview: 0,
        skippedLowConfidence: 0,
        deduplicatedCount: 0,
        llmCallsCount: 0,
        discoveredTotalEmails: checkpoint.totalDiscoveredEmails || totalDiscovered,
        discoveredAttachmentEmails: totalDiscovered,
        targetAttachmentEmails: targetGoal,
        processedAttachmentEmails: currentExtracted,
        currentFolderIndex: checkpoint.currentFolderIndex ?? 0,
        nextCursorUrl: checkpoint.nextCursorUrl,
        lastHeartbeatAt: now,
        currentStage: `Resuming from checkpoint: Extracting #${currentExtracted + 1} to #${targetGoal} of ${totalDiscovered} attachment emails...`,
        dryRun: isDryRun,
        mode: runMode,
        userId: args.userId,
        startedAt: now,
        recentLogs: [
          {
            timestamp: now,
            message: `Resumed from checkpoint (${runMode} mode): Previously extracted ${currentExtracted}/${totalDiscovered}. Extracting next batch of ${batchSize} attachment emails.`,
            type: "info",
          },
        ],
      });

      // Schedule Phase 2 extraction starting directly from cursor in the background
      await ctx.scheduler.runAfter(
        0,
        (internal as any).communications.emailBackfill.executeMailboxScanBackground,
        {
          jobId,
          mailboxEmail: targetEmail,
          folder,
          dryRun: isDryRun,
          maxMessages: targetGoal,
          targetAttachmentEmails: targetGoal,
          processedAttachmentEmails: currentExtracted,
          folderIndex: checkpoint.currentFolderIndex ?? 0,
          nextCursorUrl: checkpoint.nextCursorUrl,
          scannedMessages: currentExtracted,
        }
      );

      return { success: true, jobId, resumed: true };
    }

    // Fresh Discovery Scan
    const jobId = await ctx.db.insert("mailboxScanJobs", {
      mailboxEmail: targetEmail,
      folder,
      status: "running",
      phase: "discovery",
      totalMessages: 0,
      scannedMessages: 0,
      totalAttachments: 0,
      classifiedHighConfidence: 0,
      flaggedNeedsReview: 0,
      skippedLowConfidence: 0,
      deduplicatedCount: 0,
      llmCallsCount: 0,
      discoveredTotalEmails: 0,
      discoveredAttachmentEmails: 0,
      targetAttachmentEmails: 0,
      processedAttachmentEmails: 0,
      currentFolderIndex: 0,
      lastHeartbeatAt: now,
      currentStage: "Discovering attachment-bearing emails in mailbox...",
      dryRun: isDryRun,
      mode: runMode,
      userId: args.userId,
      startedAt: now,
      recentLogs: [
        {
          timestamp: now,
          message: `Started mailbox discovery for ${targetEmail} (folder: ${folder}, mode: ${runMode}, dryRun: ${isDryRun})`,
          type: "info",
        },
      ],
    });

    // Schedule Phase 1 Discovery in the background
    await ctx.scheduler.runAfter(
      0,
      (internal as any).communications.emailBackfill.executeMailboxDiscoveryPhase,
      {
        jobId,
        mailboxEmail: targetEmail,
        folder,
        dryRun: isDryRun,
        maxMessages,
      }
    );

    return { success: true, jobId, resumed: false };
  },
});

/**
 * Public reactive query: Gets currently active background scan job for Ingestion Monitor.
 */
export const getActiveBackgroundScan = query({
  args: {
    mailboxEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = (args.mailboxEmail || "cv@career141.com").toLowerCase().trim();
    const active = await ctx.db
      .query("mailboxScanJobs")
      .withIndex("by_mailbox", (q) => q.eq("mailboxEmail", email))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "running"),
          q.eq(q.field("mode"), "background")
        )
      )
      .first();
    return active;
  },
});
