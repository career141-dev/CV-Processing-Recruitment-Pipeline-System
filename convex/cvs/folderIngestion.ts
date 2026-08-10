import { action, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";

export const uploadFolderCandidate = action({
  args: {
    fileName: v.string(),
    fileType: v.string(),
    base64Data: v.string(),
    uploadedBy: v.string(),
    sourceChannel: v.optional(v.string()),
    batchIndex: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ cvUploadId: string; s3Key: string; isSkipped?: boolean }> => {
    const sourceChannel = args.sourceChannel || "Manual Directory Import";

    // 0. Pre-check if this file was already uploaded in a previous import session
    const existingCheck = await ctx.runQuery(api.cvs.cvUploads.checkUploadedFile, {
      fileName: args.fileName,
      sourceChannel,
    });

    if (existingCheck.isUploaded && existingCheck.cvUploadId) {
      return {
        cvUploadId: existingCheck.cvUploadId,
        s3Key: existingCheck.s3Key || "",
        isSkipped: true,
      };
    }

    // 1. Upload CV buffer to Cloudflare R2 storage
    const s3Key: string = await ctx.runAction(internal.storage.r2.uploadBufferToR2, {
      fileName: args.fileName,
      contentType: args.fileType === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      base64Data: args.base64Data,
    });

    const fileSize = Math.round((args.base64Data.length * 3) / 4);

    // 2. Save cvUploads record
    const cvUploadId: any = await ctx.runMutation(api.cvs.cvUploads.saveUpload, {
      s3Key,
      storageProvider: "r2",
      fileName: args.fileName,
      fileSize,
      fileType: args.fileType,
      source: sourceChannel,
      uploadedBy: args.uploadedBy,
    });

    // 3. Queue background DeepSeek V4 Flash AI extraction
    const delayMs = (args.batchIndex ?? 0) * 500; // Paced 500ms delay per candidate in batch
    await ctx.runMutation(api.cvs.cvUploads.queueManualExtraction, {
      cvUploadId,
      s3Key,
      storageProvider: "r2",
      fileName: args.fileName,
      fileType: args.fileType,
      sourceChannel,
      uploadedBy: args.uploadedBy,
      delayMs,
    });

    return { cvUploadId, s3Key };
  },
});
