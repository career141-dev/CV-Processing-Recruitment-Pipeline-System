import { query } from "../_generated/server";
import { v } from "convex/values";
// Force sync
export const getSystemStats = query({
  args: {},
  handler: async (ctx) => {
    const sysStat = await ctx.db.query("systemStats")
      .withIndex("by_singletonKey", q => q.eq("singletonKey", "global_stats"))
      .first();
    
    return {
      candidatesCount: sysStat?.totalCandidates || 0,
      cvUploadsCount: sysStat?.totalCvUploads || 0,
    };
  },
});

export const getIngestionStats = query({
  args: {},
  handler: async (ctx) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const dailyStat = await ctx.db.query("dailyStats")
      .withIndex("by_dateStr", q => q.eq("dateStr", todayStr))
      .first();
      
    // Fetch only recent uploads for active/failed lists and lastReceived timestamp
    const recentUploads = await ctx.db.query("cvUploads").order("desc").take(50);
    
    const statsBySource: Record<string, { todayCount: number; lastReceived: number | null }> = {};
    const activeUploads = [];
    const failedUploads = [];
    const recentDone = [];

    if (dailyStat && dailyStat.cvsBySource) {
      for (const [source, count] of Object.entries(dailyStat.cvsBySource)) {
        statsBySource[source] = { todayCount: count, lastReceived: null };
      }
    }

    for (const upload of recentUploads) {
      const source = upload.source || "Manual";
      if (!statsBySource[source]) {
        statsBySource[source] = { todayCount: 0, lastReceived: null };
      }
      
      if (statsBySource[source].lastReceived === null) {
        statsBySource[source].lastReceived = upload._creationTime;
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

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const sysStat = await ctx.db.query("systemStats")
      .withIndex("by_singletonKey", q => q.eq("singletonKey", "global_stats"))
      .first();

    const dailyStats = await ctx.db.query("dailyStats").order("desc").take(60);
    
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const sevenDaysAgoStr = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const thirtyDaysAgoStr = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let candidatesThisWeek = 0;
    let cvsToday = 0;
    let cvsYesterday = 0;
    let jobsAddedThisWeek = 0;
    let placedThisMonth = 0;
    let placedLastMonth = 0;

    for (const d of dailyStats) {
      if (d.dateStr >= sevenDaysAgoStr) {
        candidatesThisWeek += (d.newCandidates || 0);
        jobsAddedThisWeek += (d.newJobs || 0);
      }
      if (d.dateStr === todayStr) {
        cvsToday += (d.newCvUploads || 0);
      }
      if (d.dateStr === yesterdayStr) {
        cvsYesterday += (d.newCvUploads || 0);
      }
      if (d.dateStr >= thirtyDaysAgoStr) {
        placedThisMonth += (d.placements || 0);
      } else {
        placedLastMonth += (d.placements || 0);
      }
    }

    const cvsVsYesterday = cvsToday - cvsYesterday;
    const cvsTrendType = cvsVsYesterday > 0 ? "up" : cvsVsYesterday < 0 ? "down" : "neutral";

    const placedVsLastMonth = placedThisMonth - placedLastMonth;
    const placedTrendType = placedVsLastMonth > 0 ? "up" : placedVsLastMonth < 0 ? "down" : "neutral";

    return {
      candidates: {
        total: sysStat?.totalCandidates || 0,
        trendText: `${candidatesThisWeek.toLocaleString()} this week`,
        trendType: "up", 
      },
      cvsToday: {
        total: cvsToday,
        trendText: `${Math.abs(cvsVsYesterday)} vs yesterday`,
        trendType: cvsTrendType,
      },
      activeJobs: {
        total: sysStat?.activeJobsCount || 0,
        trendText: `${jobsAddedThisWeek} added this week`,
        trendType: jobsAddedThisWeek > 0 ? "up" : "neutral",
      },
      placedThisMonth: {
        total: placedThisMonth,
        trendText: `${Math.abs(placedVsLastMonth)} vs last month`,
        trendType: placedTrendType,
      },
    };
  }
});

export const getTeamActivity = query({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db.query("activityLog")
      .order("desc")
      .take(10);
      
    return logs.map(l => {
      // Determine icon based on action
      let iconUrl = "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/4d093c8c-cdbb-4660-939f-6f3503eaac6e";
      let iconBg = "bg-primary-container/15";
      
      const act = l.action.toLowerCase();
      if (act.includes("message") || act.includes("follow-up") || act.includes("email")) {
        iconUrl = "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/8c36ba61-0587-4268-b880-dce9a3287bdb";
        iconBg = "bg-[#00676326]";
      } else if (act.includes("cv") || act.includes("parse") || act.includes("system")) {
        iconUrl = "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/de0b9f00-82f3-40d7-9da7-6d8ddad2c10e";
        iconBg = "bg-[#6B1D3D26]";
      }
      
      // Calculate time string (e.g. "2 mins ago")
      const diffMs = Date.now() - new Date(l.occurredAt || l._creationTime).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      let timeStr = "Just now";
      if (diffDays > 0) timeStr = `${diffDays} days ago`;
      else if (diffHours > 0) timeStr = `${diffHours} hours ago`;
      else if (diffMins > 0) timeStr = `${diffMins} mins ago`;
      
      let text = `${l.actorName} ${l.action}`;
      if (l.metadata && l.metadata.details) {
        text += ` ${l.metadata.details}`;
      }
      
      return {
        id: l._id,
        iconBg,
        iconUrl,
        text,
        time: timeStr,
        isBold: true
      };
    });
  }
});
