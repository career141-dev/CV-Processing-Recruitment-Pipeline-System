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

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const thirtyDays = 30 * oneDay;

    // 1. CANDIDATES IN DATABASE
    const candidates = await ctx.db.query("candidates").collect();
    const totalCandidates = candidates.length;
    const candidatesThisWeek = candidates.filter(c => c._creationTime > now - oneWeek).length;

    // 2. CVS TODAY
    const cvs = await ctx.db.query("cvUploads").collect();
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const startOfYesterday = startOfToday - oneDay;
    const cvsToday = cvs.filter(c => c._creationTime >= startOfToday).length;
    const cvsYesterday = cvs.filter(c => c._creationTime >= startOfYesterday && c._creationTime < startOfToday).length;
    const cvsVsYesterday = cvsToday - cvsYesterday;
    const cvsTrendType = cvsVsYesterday > 0 ? "up" : cvsVsYesterday < 0 ? "down" : "neutral";

    // 3. ACTIVE JOBS
    const jobs = await ctx.db.query("jobs").withIndex("by_status", q => q.eq("status", "active")).collect();
    const activeJobsCount = jobs.length;
    const jobsAddedThisWeek = jobs.filter(j => j._creationTime > now - oneWeek).length;

    // 4. PLACED THIS MONTH
    const applications = await ctx.db.query("applications").collect(); // Assuming placements are applications with "placed" stage
    const placedApplications = applications.filter(a => a.currentStage === "placed");
    const placedThisMonth = placedApplications.filter(a => a.lastStageChangedAt > now - thirtyDays).length;
    const placedLastMonth = placedApplications.filter(a => a.lastStageChangedAt > now - 60 * oneDay && a.lastStageChangedAt <= now - thirtyDays).length;
    const placedVsLastMonth = placedThisMonth - placedLastMonth;
    const placedTrendType = placedVsLastMonth > 0 ? "up" : placedVsLastMonth < 0 ? "down" : "neutral";

    return {
      candidates: {
        total: totalCandidates,
        trendText: `${candidatesThisWeek.toLocaleString()} this week`,
        trendType: "up", // generally up
      },
      cvsToday: {
        total: cvsToday,
        trendText: `${Math.abs(cvsVsYesterday)} vs yesterday`,
        trendType: cvsTrendType,
      },
      activeJobs: {
        total: activeJobsCount,
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
