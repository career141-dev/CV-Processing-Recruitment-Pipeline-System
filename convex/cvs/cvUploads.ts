import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { mutation, internalQuery, internalMutation } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { adjustGlobalStat } from "../stats/statsHelper";
import { requireUser, requireFullAccess } from "../lib/permissions";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveUpload = mutation({
  args: {
    storageId: v.optional(v.id("_storage")),
    s3Key: v.optional(v.string()),
    storageProvider: v.optional(v.string()),
    fileName: v.string(),
    fileSize: v.float64(),
    fileType: v.string(),
    source: v.optional(v.string()),
    campaignLabel: v.optional(v.string()),
    assignToJob: v.optional(v.string()),
    uploadedBy: v.string(),
    batchId: v.optional(v.id("ingestionBatches")),
  },
  handler: async (ctx, args) => {
    const cvId = await ctx.db.insert("cvUploads", {
      storageId: args.storageId,
      s3Key: args.s3Key,
      storageProvider: args.storageProvider || (args.s3Key ? "r2" : "convex"),
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: args.fileType,
      source: args.source,
      campaignLabel: args.campaignLabel,
      assignToJob: args.assignToJob,
      uploadedBy: args.uploadedBy,
      batchId: args.batchId,
      status: "uploaded",
    });

    // @ts-ignore
    await adjustGlobalStat(ctx, "new_cv_upload", 1, { sourceChannel: args.source || "Manual" });
    return cvId;
  },
});

export const queueManualExtraction = mutation({
  args: {
    cvUploadId: v.id("cvUploads"),
    storageId: v.optional(v.id("_storage")),
    s3Key: v.optional(v.string()),
    storageProvider: v.optional(v.string()),
    fileName: v.string(),
    fileType: v.string(),
    sourceChannel: v.string(),
    uploadedBy: v.string(),
    batchId: v.optional(v.id("ingestionBatches")),
    isRetry: v.optional(v.boolean()),
    delayMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("ingestionLog", {
      channelType: "manual_upload",
      routingStatus: "routed",
      cvFileId: args.cvUploadId,
      receivedAt: Date.now(),
      batchId: args.batchId,
      stage: "queued",
      candidateName: args.fileName,
      rawSender: args.uploadedBy,
    } as any);

    await ctx.scheduler.runAfter(args.delayMs ?? 0, api.cvs.cvExtraction.processCvExtraction, {
      storageId: args.storageId,
      s3Key: args.s3Key,
      storageProvider: args.storageProvider,
      fileType: args.fileType,
      sourceChannel: args.sourceChannel,
      uploadedBy: args.uploadedBy,
      cvUploadId: args.cvUploadId,
      batchId: args.batchId,
      logId,
      isRetry: args.isRetry,
    });

    return logId;
  },
});

export const clearAll = mutation({
  handler: async (ctx) => {
    await requireFullAccess(ctx);
    const all = await ctx.db.query("cvUploads").collect();
    for (const doc of all) {
      await ctx.db.delete(doc._id);
    }
    return all.length;
  },
});

export const deleteStorageFiles = mutation({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    await requireFullAccess(ctx);
    for (const id of args.storageIds) {
      await ctx.storage.delete(id);
    }
    return args.storageIds.length;
  },
});

export const listUploadedInBatch = internalQuery({
  args: {
    batchId: v.id("ingestionBatches"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cvUploads")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .filter((q) => q.eq(q.field("status"), "uploaded"))
      .take(args.limit);
  },
});

export const checkUploadsStatus = internalQuery({
  args: {
    cvUploadIds: v.array(v.id("cvUploads")),
  },
  handler: async (ctx, args) => {
    const statuses = [];
    for (const id of args.cvUploadIds) {
      const upload = await ctx.db.get(id);
      statuses.push(upload ? upload.status : "failed");
    }
    return statuses;
  },
});

export const checkAndTriggerNextBatch = mutation({
  args: {
    batchId: v.id("ingestionBatches"),
  },
  handler: async (ctx, args) => {
    // Abort if batch is paused
    const batch = await ctx.db.get(args.batchId);
    if (batch?.paused) {
      console.log(`[checkAndTriggerNextBatch] Batch ${args.batchId} is paused. Aborting next trigger.`);
      return;
    }

    // Check if there are any cvUploads in this batch that are STILL "processing" or "queued" or "pending_retry"
    const processingUploads = await ctx.db
      .query("cvUploads")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "processing"),
          q.eq(q.field("status"), "queued"),
          q.eq(q.field("status"), "pending_retry")
        )
      )
      .collect();

    // If there are still uploads processing/queued in the CURRENT active chunk of the batch, do nothing.
    if (processingUploads.length > 0) {
      console.log(`[checkAndTriggerNextBatch] Batch ${args.batchId} has ${processingUploads.length} uploads still processing. Waiting.`);
      return;
    }

    // Atomically grab the next up to 15 uploads (VPS benchmark: 15 concurrent is safe ceiling)
    const nextUploads = await ctx.db
      .query("cvUploads")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .filter((q) => q.eq(q.field("status"), "uploaded"))
      .take(15);

    if (nextUploads.length === 0) {
      console.log(`[checkAndTriggerNextBatch] Batch ${args.batchId} is fully complete.`);
      return;
    }

    console.log(`[checkAndTriggerNextBatch] Triggering next ${nextUploads.length} uploads for batch ${args.batchId}`);

    // Mark them as queued atomically and schedule the extractions
    // For a batch of 10: run first 5 with 2s stagger, and next 5 with a 20s offset delay
    let index = 0;
    for (const upload of nextUploads) {
      await ctx.db.patch(upload._id, { status: "queued" });

      const logId = await ctx.db.insert("ingestionLog", {
        channelType: "manual_upload",
        routingStatus: "routed",
        cvFileId: upload._id,
        receivedAt: Date.now(),
        batchId: args.batchId,
        stage: "queued",
        candidateName: upload.fileName,
        rawSender: upload.uploadedBy,
      });

      const staggerDelayMs = index * 100;

      await ctx.scheduler.runAfter(staggerDelayMs, api.cvs.cvExtraction.processCvExtraction, {
        storageId: upload.storageId as Id<"_storage"> | undefined,
        s3Key: upload.s3Key,
        storageProvider: upload.storageProvider,
        fileType: upload.fileType,
        sourceChannel: upload.source || "Manual",
        uploadedBy: upload.uploadedBy,
        cvUploadId: upload._id,
        batchId: args.batchId,
        logId: logId,
        isRetry: false,
      });
      index++;
    }
  },
});

export const cancelAllRunningExtractions = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Immediately pause & fail active ingestion batches first (stops next batch triggers in < 5ms)
    const activeBatches = await ctx.db
      .query("ingestionBatches")
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
      .take(50);

    for (const batch of activeBatches) {
      await ctx.db.patch(batch._id, {
        status: "failed",
        paused: true,
        completedAt: Date.now(),
      });
    }

    // 2. Query bounded active uploads using by_status index (max 30 per status to guarantee < 150ms runtime)
    const queued = await ctx.db
      .query("cvUploads")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .take(30);

    const processing = await ctx.db
      .query("cvUploads")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .take(30);

    const pendingRetry = await ctx.db
      .query("cvUploads")
      .withIndex("by_status", (q) => q.eq("status", "pending_retry"))
      .take(30);

    const activeUploads = [...queued, ...processing, ...pendingRetry];

    let cancelledCount = 0;
    for (const upload of activeUploads) {
      await ctx.db.patch(upload._id, {
        status: "failed",
        errorMessage: "Cancelled by user",
      });
      cancelledCount++;
    }

    return { success: true, cancelledCount, batchesCancelled: activeBatches.length };
  },
});

export const recoverStuckUploads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stuck = await ctx.db
      .query("cvUploads")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .take(50);

    let count = 0;
    const sixtyMinutesAgo = Date.now() - 60 * 60 * 1000;
    for (const upload of stuck) {
      if (upload._creationTime < sixtyMinutesAgo) {
        await ctx.db.patch(upload._id, {
          status: "failed",
          errorMessage: "Process interrupted (Server restarted/crashed)",
        });
        
        // Also check if this upload is part of a batch
        if (upload.batchId) {
          // Trigger next batch evaluation
          await ctx.scheduler.runAfter(0, api.cvs.cvUploads.checkAndTriggerNextBatch, {
            batchId: upload.batchId as any,
          });
        }
        count++;
      }
    }
    return count;
  },
});

/**
 * Recovery Tool: Scans all cvUploads in Cloudflare R2 / Convex.
 * If a candidate profile was deleted from the candidates table,
 * this mutation re-enqueues extraction to restore the candidate profile!
 */
export const restoreAllCandidatesFromUploads = mutation({
  args: {},
  handler: async (ctx) => {
    // Process up to 100 uploads per iteration to stay within 1s mutation limits
    const uploadsChunk = await ctx.db.query("cvUploads").take(100);
    let requeued = 0;
    let checkedCount = 0;

    for (const upload of uploadsChunk) {
      checkedCount++;
      let candidateExists = false;
      if (upload.candidateId) {
        const cand = await ctx.db.get(upload.candidateId);
        if (cand) candidateExists = true;
      }

      if (!candidateExists) {
        await ctx.db.patch(upload._id, {
          status: "uploaded",
          candidateId: undefined,
        });

        // Trigger parallel extraction (100ms spread)
        await ctx.scheduler.runAfter(requeued * 100, api.cvs.cvExtraction.processCvExtraction, {
          storageId: upload.storageId as any,
          s3Key: upload.s3Key,
          storageProvider: upload.storageProvider,
          fileType: upload.fileType,
          sourceChannel: upload.source || "Recovery",
          uploadedBy: upload.uploadedBy,
          cvUploadId: upload._id,
        });

        requeued++;
      }
    }

    return { checkedCount, requeuedRestored: requeued };
  },
});

