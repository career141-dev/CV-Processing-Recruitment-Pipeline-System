import { v } from "convex/values";
import { mutation } from "../_generated/server";

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
