import { mutation } from "./_generated/server";

export const stopAllRetryLoops = mutation({
  handler: async (ctx) => {
    // 1. Stop cvUploads
    const all = await ctx.db.query("cvUploads").collect();
    let count = 0;
    for (const doc of all) {
      if (doc.status === "failed" || doc.status === "paused" || doc.status === "processing") {
        await ctx.db.patch(doc._id, { status: "uploaded" });
        count++;
      }
    }

    // 2. Stop ingestionBatches
    const batches = await ctx.db.query("ingestionBatches").collect();
    let batchCount = 0;
    for (const batch of batches) {
      if (batch.status === "in_progress") {
        await ctx.db.patch(batch._id, { status: "failed" });
        batchCount++;
      }
    }

    // 3. Stop ingestionLogs
    const logs = await ctx.db.query("ingestionLog").collect();
    for (const log of logs) {
      if (log.stage !== "completed" && log.stage !== "failed") {
        await ctx.db.patch(log._id, { stage: "failed" });
      }
    }

    return `Stopped retry loops. Reset ${count} cvUploads. Failed ${batchCount} batches.`;
  }
});
