import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";

export const processCvIngestion = mutation({
  args: {
    jobId: v.optional(v.id("jobs")),
    sourceChannel: v.string(),
    rawSender: v.optional(v.string()),
    storageId: v.id("_storage"),
    fileHash: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileSizeBytes: v.number(),
    metaCampaignId: v.optional(v.string()),
    batchId: v.optional(v.id("ingestionBatches")),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    // 1. Get job — must be active (only if jobId is provided)
    if (args.jobId) {
      const job = await ctx.db.get(args.jobId);
      if (!job || job.status !== "active") {
        await ctx.db.insert("ingestionLog", {
          jobId: args.jobId,
          channelType: args.sourceChannel as any,
          rawSender: args.rawSender,
          routingStatus: "unrouted",
          errorMessage: "Job not active",
          receivedAt: startTime,
          batchId: args.batchId,
          stage: "failed",
        } as any);
        return { success: false, reason: "job_not_active" };
      }
    }

    // 2. SHA-256 duplicate check (exact file)
    const sha256 = args.fileHash;

    const existingFile = await ctx.db.query("cvUploads")
      .withIndex("by_fileHash", (q) => q.eq("fileHash", sha256))
      .filter((q) => q.eq(q.field("assignToJob"), args.jobId))
      .first();

    if (existingFile) {
      await ctx.db.insert("ingestionLog", {
        jobId: args.jobId,
        channelType: args.sourceChannel as any,
        rawSender: args.rawSender,
        routingStatus: "duplicate_file",
        cvFileId: existingFile._id,
        receivedAt: startTime,
        batchId: args.batchId,
        stage: "failed",
      } as any);
      return { success: false, reason: "duplicate_file", existingFileId: existingFile._id };
    }

    // 4. Store file metadata in cvUploads
    const cvUploadId = await ctx.db.insert("cvUploads", {
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSizeBytes,
      fileHash: sha256,
      source: args.sourceChannel,
      campaignLabel: args.metaCampaignId,
      assignToJob: args.jobId,
      uploadedBy: "system",
      status: "pending",
    });

    // 6. Update channel CV counts (only if jobId is provided)
    if (args.jobId) {
      const channel = await ctx.db.query("jobChannels")
        .withIndex("by_job", (q) => q.eq("jobId", args.jobId!))
        .filter((q) => q.eq(q.field("channelType"), args.sourceChannel))
        .first();

      if (channel) {
        await ctx.db.patch(channel._id, {
          cvCountTotal: (channel.cvCountTotal ?? 0) + 1,
          cvCountToday: (channel.cvCountToday ?? 0) + 1,
          lastCvReceivedAt: startTime,
        });
      }
    }

    // 7. Log ingestion event
    const logId = await ctx.db.insert("ingestionLog", {
      jobId: args.jobId,
      channelType: args.sourceChannel as any,
      rawSender: args.rawSender,
      routingStatus: args.jobId ? "routed" : "unrouted",
      cvFileId: cvUploadId,
      metaCampaignId: args.metaCampaignId,
      processingTimeMs: Date.now() - startTime,
      receivedAt: startTime,
      processedAt: undefined, // Will be set when fully processed
      batchId: args.batchId,
      stage: "queued",
      candidateName: "Unknown — Pending Parse",
    } as any);

    // Trigger Agent 1 (CV Parsing) immediately using standard api
    await ctx.scheduler.runAfter(0, api.cvs.cvExtraction.processCvExtraction, {
      storageId: args.storageId,
      fileType: args.fileType,
      sourceChannel: args.sourceChannel,
      uploadedBy: "system",
      cvUploadId,
      batchId: args.batchId,
      logId: logId,
    });

    return { success: true, cvUploadId };
  },
});
