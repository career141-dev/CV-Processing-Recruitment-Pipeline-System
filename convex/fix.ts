import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const TABLES = [
  "users", "jobs", "jobChannels", "job_assets", "custom_filters",
  "saved_filters", "match_scores", "pipeline_health_reports",
  "cvUploads", "candidates", "applications", "pipelineEvents",
  "aiCalls", "communications", "directorReviews", "clientReviews",
  "interviews", "offers", "placements", "rejectionLoopEvents",
  "ingestionLog", "esaRecords", "documents", "workableImports",
  "herculesImports",
] as const;

export const clearDatabase = mutation({
  args: {},
  handler: async (ctx) => {
    const counts: Record<string, number> = {};

    // 1. Delete all storage files from cvUploads that have storageId
    const uploads = await ctx.db.query("cvUploads").collect();
    const storageIds = uploads
      .map((u) => u.storageId)
      .filter((id): id is Id<"_storage"> => !!id);
    for (const sid of storageIds) {
      try { await ctx.storage.delete(sid); } catch { }
    }
    counts.storageDeleted = storageIds.length;

    // 2. Clear every table
    for (const table of TABLES) {
      let deleted = 0;
      const docs = await ctx.db.query(table as any).collect();
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
        deleted++;
      }
      counts[table] = deleted;
    }

    return counts;
  }
});

export const resetErroredCVs = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("cvUploads").collect();
    let count = 0;
    for (const upload of all) {
      if (upload.status === "processed" && upload.errorMessage && upload.errorMessage.includes("pdf-parse")) {
        await ctx.db.patch(upload._id, { status: "failed" });
        count++;
      }
      if (upload.status === "processing") {
        await ctx.db.patch(upload._id, { status: "failed", errorMessage: "Stuck in processing" });
        count++;
      }
    }
    return count;
  }
});
