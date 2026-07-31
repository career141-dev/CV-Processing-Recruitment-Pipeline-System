import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";

export const processCvIngestion = mutation({
  args: {
    jobId: v.optional(v.id("jobs")),
    sourceChannel: v.string(),
    rawSender: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    s3Key: v.optional(v.string()),
    storageProvider: v.optional(v.string()),
    fileHash: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileSizeBytes: v.number(),
    metaCampaignId: v.optional(v.string()),
    metaSourceUrl: v.optional(v.string()),
    metaSourceId: v.optional(v.string()),
    metaHeadline: v.optional(v.string()),
    batchId: v.optional(v.id("ingestionBatches")),
    extractionDelayMs: v.optional(v.number()),
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
      .first();

    if (existingFile) {
      if (args.jobId && existingFile.candidateId) {
        const existingApp = await ctx.db.query("applications")
          .withIndex("by_candidateId", (q) => q.eq("candidateId", existingFile.candidateId!))
          .filter((q) => q.eq(q.field("jobId"), args.jobId))
          .first();

        const now = Date.now();
        const appId = await ctx.db.insert("applications", {
          candidateId: existingFile.candidateId,
          jobId: args.jobId,
          currentStage: "new_cvs",
          sourceChannel: args.sourceChannel,
          createdAt: now,
          isActive: true,
          lastStageChangedAt: now,
          loopIteration: 0,
          stageHistory: [{
            stage: "new_cvs",
            enteredAt: new Date(now).toISOString(),
            changedBy: "system",
          }],
        } as any);

        console.log(`[processCvIngestion] Linked existing candidate ${existingFile.candidateId} to new job ${args.jobId} (appId: ${appId})`);
        return { success: true, reason: "linked_existing_candidate", applicationId: appId, existingCandidateId: existingFile.candidateId };
      }

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
      s3Key: args.s3Key,
      storageProvider: args.storageProvider,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSizeBytes,
      fileHash: sha256,
      source: args.sourceChannel,
      campaignLabel: args.metaCampaignId,
      metaSourceUrl: args.metaSourceUrl,
      metaSourceId: args.metaSourceId,
      metaHeadline: args.metaHeadline,
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

    // 8. Check Channel Toggles for Pausing
    const configRow = await ctx.db.query("appSettings").withIndex("by_key", q => q.eq("key", "system")).first();
    const toggles = configRow?.channel_toggles;
    
    let isPaused = false;
    if (args.sourceChannel === "whatsapp" && toggles?.whatsappIngestion === false) isPaused = true;
    if ((args.sourceChannel === "email" || args.sourceChannel === "email_campaign") && toggles?.emailIngestion === false) isPaused = true;

    if (isPaused) {
      await ctx.db.patch(cvUploadId, { status: "paused" });
      await ctx.db.patch(logId, { stage: "paused" });
      console.log(`[processCvIngestion] Channel ${args.sourceChannel} is paused. CV ${cvUploadId} queued for later.`);
    } else {
      // Trigger Agent 1 (CV Parsing) with optional delay to prevent I/O and API spikes
      const delayMs = args.extractionDelayMs || 0;
      await ctx.scheduler.runAfter(delayMs, api.cvs.cvExtraction.processCvExtraction, {
        storageId: args.storageId,
        s3Key: args.s3Key,
        storageProvider: args.storageProvider,
        fileType: args.fileType,
        sourceChannel: args.sourceChannel,
        uploadedBy: "system",
        cvUploadId,
        batchId: args.batchId,
        logId: logId,
      });
    }

    return { success: true, cvUploadId };
  },
});
