import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { api } from "../_generated/api";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.float64(),
    fileType: v.string(),
    source: v.optional(v.string()),
    campaignLabel: v.optional(v.string()),
    assignToJob: v.optional(v.string()),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("cvUploads", {
      storageId: args.storageId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: args.fileType,
      source: args.source,
      campaignLabel: args.campaignLabel,
      assignToJob: args.assignToJob,
      uploadedBy: args.uploadedBy,
      status: "uploaded",
    });
  },
});

export const queueManualExtraction = mutation({
  args: {
    cvUploadId: v.id("cvUploads"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    sourceChannel: v.string(),
    uploadedBy: v.string(),
    batchId: v.optional(v.id("ingestionBatches")),
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

    await ctx.scheduler.runAfter(0, api.cvs.cvExtraction.processCvExtraction, {
      storageId: args.storageId,
      fileType: args.fileType,
      sourceChannel: args.sourceChannel,
      uploadedBy: args.uploadedBy,
      cvUploadId: args.cvUploadId,
      batchId: args.batchId,
      logId,
    });

    return logId;
  },
});

export const clearAll = mutation({
  handler: async (ctx) => {
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
    for (const id of args.storageIds) {
      await ctx.storage.delete(id);
    }
    return args.storageIds.length;
  },
});
