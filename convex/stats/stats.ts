import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireRole } from "../lib/permissions";
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
    const failedRetryUploads = [];
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
      } else if (upload.status === "failed_retry") {
        failedRetryUploads.push(upload);
      } else if (upload.status === "uploaded" || upload.status === "processing" || upload.status === "queued") {
        activeUploads.push(upload);
      } else if ((upload.status === "done" || upload.status === "processed") && recentDone.length < 50) {
        recentDone.push(upload);
      }
    }
    
    return {
      statsBySource,
      activeUploads,
      failedUploads,
      failedRetryUploads,
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
    const cached = await ctx.db.query("dashboardStatsCache")
      .withIndex("by_singletonKey", q => q.eq("singletonKey", "global_dashboard_stats"))
      .first();

    if (cached) {
      return cached.data;
    }

    // Fallback: If cache not populated yet, compute live
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

export const updateDashboardStatsCache = internalMutation({
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

    const statsData = {
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

    const existing = await ctx.db.query("dashboardStatsCache")
      .withIndex("by_singletonKey", q => q.eq("singletonKey", "global_dashboard_stats"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        data: statsData,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("dashboardStatsCache", {
        singletonKey: "global_dashboard_stats",
        data: statsData,
        updatedAt: Date.now(),
      });
    }
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

// =========================================================================
// NVIDIA API Token Monitoring & Cost Analytics
// =========================================================================

// Helper to calculate estimated NVIDIA credit costs based on token count & model type
export function calculateNvidiaCredits(model: string, promptTokens: number, completionTokens: number): number {
  const modelName = model.toLowerCase();
  
  // 1. Embeddings: $0.07 / million tokens
  if (modelName.includes("embed") || modelName.includes("bge")) {
    return (promptTokens + completionTokens) * (0.07 / 1_000_000);
  }
  
  // 2. Chat/Instruction LLMs (Nemotron-70B, Llama-3.1-70B): $2.66 / million tokens
  if (modelName.includes("8b")) {
    return (promptTokens + completionTokens) * (0.18 / 1_000_000);
  }
  
  // Default to Llama-3.1-70B rate ($2.66 / 1M tokens)
  return (promptTokens + completionTokens) * (2.66 / 1_000_000);
}

/**
 * Internal mutation to record an NVIDIA API call.
 * Can be called from Convex actions running in Node.js runtime.
 */
export const logNvidiaCallMutation = internalMutation({
  args: {
    taskType: v.string(),
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
    cvUploadId: v.optional(v.id("cvUploads")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("nvidiaTokenLogs", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

/**
 * Query to fetch aggregated metrics for the dashboard cards and charts.
 */
export const getTokenMetrics = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "ta_manager", "senior_ta"]);

    // Limit to last 7 days (which matches the chart scope) to drastically reduce I/O spikes
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const allLogs = await ctx.db
      .query("nvidiaTokenLogs")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", sevenDaysAgo))
      .collect();

    let totalTokens = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCredits = 0;
    let successfulCalls = 0;
    
    let totalCvExtractionsCount = 0;
    let cvExtractionCredits = 0;

    // Task breakdowns
    const taskBreakdown: Record<string, { tokens: number; credits: number; count: number }> = {};

    for (const log of allLogs) {
      totalTokens += log.totalTokens;
      totalPromptTokens += log.promptTokens;
      totalCompletionTokens += log.completionTokens;
      
      const cost = calculateNvidiaCredits(log.model, log.promptTokens, log.completionTokens);
      totalCredits += cost;

      if (log.success) {
        successfulCalls++;
      }

      // Track CV Extractions specifically
      if (log.taskType === "cv_structuring" && log.success) {
        totalCvExtractionsCount++;
        cvExtractionCredits += cost;
      }

      // Update task breakdown
      if (!taskBreakdown[log.taskType]) {
        taskBreakdown[log.taskType] = { tokens: 0, credits: 0, count: 0 };
      }
      taskBreakdown[log.taskType].tokens += log.totalTokens;
      taskBreakdown[log.taskType].credits += cost;
      taskBreakdown[log.taskType].count += 1;
    }

    const successRate = allLogs.length > 0 ? (successfulCalls / allLogs.length) * 100 : 100;
    const avgCostPerCv = totalCvExtractionsCount > 0 ? (cvExtractionCredits / totalCvExtractionsCount) : 0;

    // Daily credits charting data (Last 7 days)
    const dailyDataMap = new Map<string, { date: string; totalCost: number; cvExtractionCost: number }>();
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Initialize map with last 7 days
    for (let i = 6; i >= 0; i--) {
      const dateStr = new Date(now - i * oneDayMs).toISOString().split("T")[0];
      dailyDataMap.set(dateStr, { date: dateStr, totalCost: 0, cvExtractionCost: 0 });
    }

    for (const log of allLogs) {
      const logDateStr = new Date(log.timestamp).toISOString().split("T")[0];
      if (dailyDataMap.has(logDateStr)) {
        const current = dailyDataMap.get(logDateStr)!;
        const cost = calculateNvidiaCredits(log.model, log.promptTokens, log.completionTokens);
        
        current.totalCost += cost;
        if (log.taskType === "cv_structuring") {
          current.cvExtractionCost += cost;
        }
        
        dailyDataMap.set(logDateStr, current);
      }
    }

    return {
      overall: {
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
        totalCredits,
        totalRequests: allLogs.length,
        successRate,
      },
      cvExtraction: {
        totalCvExtractionsCount,
        cvExtractionCredits,
        avgCostPerCv,
      },
      taskBreakdown,
      dailyChartData: Array.from(dailyDataMap.values()),
    };
  },
});

/**
 * Query to fetch recent logs with linked CV filename details.
 */
export const getRecentTokenLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "ta_manager", "senior_ta"]);
    const limit = args.limit ?? 100;

    const logs = await ctx.db
      .query("nvidiaTokenLogs")
      .order("desc")
      .take(limit);

    // Fetch related CV info for linked logs
    const results = [];
    for (const log of logs) {
      let fileName: string | undefined = undefined;
      let candidateName: string | undefined = undefined;
      
      if (log.cvUploadId) {
        const cv = await ctx.db.get(log.cvUploadId);
        if (cv) {
          fileName = cv.fileName;
          // IMPORTANT: Do NOT fetch the Candidate record here using ctx.db.get(cv.candidateId)
          // It causes a massive 100+ MB I/O spike because it pulls the candidate's rawText and vector embeddings into memory.
          // Instead, fallback to using the CV file name as the candidate name for logging purposes.
          candidateName = cv.fileName;
        }
      }

      const cost = calculateNvidiaCredits(log.model, log.promptTokens, log.completionTokens);

      results.push({
        ...log,
        fileName,
        candidateName,
        estimatedCost: cost,
      });
    }

    return results;
  },
});

/**
 * Mutation to clear all token logs (restricted to admins & TA managers).
 */
export const clearAllTokenLogs = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "ta_manager"]);

    const logs = await ctx.db.query("nvidiaTokenLogs").collect();
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    return { success: true, count: logs.length };
  },
});
