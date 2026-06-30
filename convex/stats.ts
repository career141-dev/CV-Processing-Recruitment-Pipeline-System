import { query } from "./_generated/server";
import { v } from "convex/values";
// Force sync
export const getSystemStats = query({
  args: {},
  handler: async (ctx) => {
    // For small/medium sets, collecting is fine.
    const candidates = await ctx.db.query("candidates").collect();
    const cvUploads = await ctx.db.query("cvUploads").collect();
    
    return {
      candidatesCount: candidates.length,
      cvUploadsCount: cvUploads.length,
    };
  },
});

export const getIngestionStats = query({
  args: {},
  handler: async (ctx) => {
    // We will collect cvUploads to calculate channel stats
    const allUploads = await ctx.db.query("cvUploads").order("desc").collect();
    
    // Group by source
    const statsBySource: Record<string, { todayCount: number; lastReceived: number | null }> = {};
    
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const activeUploads = [];
    const failedUploads = [];
    const recentDone = [];

    for (const upload of allUploads) {
      const source = upload.source || "Manual";
      
      if (!statsBySource[source]) {
        statsBySource[source] = { todayCount: 0, lastReceived: null };
      }
      
      if (statsBySource[source].lastReceived === null || upload._creationTime > statsBySource[source].lastReceived!) {
        statsBySource[source].lastReceived = upload._creationTime;
      }
      
      if (upload._creationTime >= startOfToday) {
        statsBySource[source].todayCount++;
      }
      
      if (upload.status === "failed") {
        failedUploads.push(upload);
      } else if (upload.status === "uploaded" || upload.status === "processing") {
        activeUploads.push(upload);
      } else if (upload.status === "done" && recentDone.length < 50) {
        recentDone.push(upload);
      }
    }
    
    return {
      statsBySource,
      activeUploads,
      failedUploads,
      recentDone
    };
  },
});

export const getRecentChannelLogs = query({
  args: { channelType: v.string() },
  handler: async (ctx, args) => {
    const logs = await ctx.db.query("ingestionLog")
      .withIndex("by_channel_time", q => q.eq("channelType", args.channelType as any))
      .order("desc")
      .take(20);
      
    return logs.map(l => ({
      _id: l._id,
      candidateName: l.candidateName,
      rawSender: l.rawSender,
      stage: l.stage || l.routingStatus,
      errorMessage: l.errorMessage,
      receivedAt: l.receivedAt || l._creationTime,
    }));
  }
});
