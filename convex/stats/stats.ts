import { query, mutation, action, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireRole } from "../lib/permissions";
import { api } from "../_generated/api";

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
  args: {
    dateRange: v.optional(v.string()),
    jobFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    let rangeCutoff = 0;
    if (args.dateRange === "This Week") {
      rangeCutoff = now - 7 * oneDay;
    } else if (args.dateRange === "Last 30 Days") {
      rangeCutoff = now - 30 * oneDay;
    } else if (args.dateRange === "This Month") {
      rangeCutoff = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    }

    const identity = await ctx.auth.getUserIdentity();

    let allJobs = await ctx.db.query('jobs').collect();
    if (args.jobFilter === "Active Jobs") {
      allJobs = allJobs.filter(j => j.status === 'active');
    } else if (args.jobFilter === "My Jobs" && identity) {
      const user = await ctx.db.query('users').withIndex('by_clerkUserId', q => q.eq('clerkUserId', identity.subject)).first();
      if (user) {
        allJobs = allJobs.filter(j => j.primaryRecruiterId === user._id);
      }
    }

    const filteredJobIds = new Set(allJobs.map(j => j._id));

    let allCandidates = await ctx.db.query('candidates').collect();
    if (rangeCutoff > 0) {
      allCandidates = allCandidates.filter(c => c._creationTime >= rangeCutoff);
    }

    let allUploads = await ctx.db.query('cvUploads').collect();
    if (rangeCutoff > 0) {
      allUploads = allUploads.filter(u => u._creationTime >= rangeCutoff);
    }

    let allApps = await ctx.db.query('applications').collect();
    if (args.jobFilter && args.jobFilter !== "All Jobs") {
      allApps = allApps.filter(a => filteredJobIds.has(a.jobId));
    }
    if (rangeCutoff > 0) {
      allApps = allApps.filter(a => a._creationTime >= rangeCutoff);
    }

    const currentOffset = 5.5 * 60 * 60 * 1000;
    const localTime = new Date(now + currentOffset);
    localTime.setUTCHours(0, 0, 0, 0);
    const startOfToday = localTime.getTime() - currentOffset;
    const startOfYesterday = startOfToday - oneDay;
    
    const sevenDaysAgo = now - 7 * oneDay;
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const startOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime();

    const totalCandidates = allCandidates.length;
    const candidatesThisWeek = allCandidates.filter(c => c._creationTime >= sevenDaysAgo).length;

    const cvsToday = allUploads.filter(u => u._creationTime >= startOfToday).length;
    const cvsYesterday = allUploads.filter(u => u._creationTime >= startOfYesterday && u._creationTime < startOfToday).length;

    const activeJobs = allJobs.filter(j => j.status === 'active').length;
    const jobsAddedThisWeek = allJobs.filter(j => j._creationTime >= sevenDaysAgo).length;

    const placedThisMonth = allApps.filter(a => a.currentStage === 'placed' && a._creationTime >= startOfMonth).length;
    const placedLastMonth = allApps.filter(a => a.currentStage === 'placed' && a._creationTime >= startOfLastMonth && a._creationTime < startOfMonth).length;

    const cvsVsYesterday = cvsToday - cvsYesterday;
    const placedVsLastMonth = placedThisMonth - placedLastMonth;

    return {
      candidates: {
        total: totalCandidates,
        trendText: `${candidatesThisWeek.toLocaleString()} this period`,
        trendType: 'up',
      },
      cvsToday: {
        total: cvsToday,
        trendText: `${Math.abs(cvsVsYesterday)} vs yesterday`,
        trendType: cvsVsYesterday > 0 ? 'up' : cvsVsYesterday < 0 ? 'down' : 'neutral',
      },
      activeJobs: {
        total: activeJobs,
        trendText: `${jobsAddedThisWeek} added this period`,
        trendType: jobsAddedThisWeek > 0 ? 'up' : 'neutral',
      },
      placedThisMonth: {
        total: placedThisMonth,
        trendText: `${Math.abs(placedVsLastMonth)} vs last month`,
        trendType: placedVsLastMonth > 0 ? 'up' : placedVsLastMonth < 0 ? 'down' : 'neutral',
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

  // 2. DeepSeek Models (V4-Pro & V4-Flash)
  if (modelName.includes("deepseek")) {
    if (modelName.includes("pro")) {
      return (promptTokens * 0.435 + completionTokens * 0.87) / 1_000_000;
    }
    // Default to DeepSeek V4-Flash rates (Standard input: $0.09/M, output: $0.18/M)
    return (promptTokens * 0.09 + completionTokens * 0.18) / 1_000_000;
  }

  // 3. Chat/Instruction LLMs (8B models): $0.18 / million tokens
  if (modelName.includes("8b")) {
    return (promptTokens + completionTokens) * (0.18 / 1_000_000);
  }

  // Default to Llama-3.1-70B rate ($0.40 / 1M tokens)
  return (promptTokens + completionTokens) * (0.40 / 1_000_000);
}

/**
 * Internal mutation to record an NVIDIA API call.
 * Denormalizes fileName at write-time and updates the rolling aggregate cache
 * so getTokenMetrics and getRecentTokenLogs never need to do N+1 joins or
 * full-table scans at read time.
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
    const now = Date.now();
    const cost = calculateNvidiaCredits(args.model, args.promptTokens, args.completionTokens);

    // --- 1. Denormalize fileName at write-time (1 read once, instead of 1 read per dashboard load) ---
    let fileName: string | undefined = undefined;
    if (args.cvUploadId) {
      const cv = await ctx.db.get(args.cvUploadId);
      if (cv) fileName = cv.fileName;
    }

    // Insert the log with the denormalized field
    await ctx.db.insert("nvidiaTokenLogs", {
      ...args,
      timestamp: now,
      fileName,
    });

    // --- 2. Update the all-time rolling singleton cache ---
    const SINGLETON_KEY = "global_token_stats";
    const existing = await ctx.db
      .query("tokenStatsCache")
      .withIndex("by_singletonKey", (q) => q.eq("singletonKey", SINGLETON_KEY))
      .first();

    const isCvExtraction = args.taskType === "cv_structuring" && args.success;
    const taskBreakdown: Record<string, { tokens: number; credits: number; count: number; promptTokens?: number; completionTokens?: number }> =
      (existing?.taskBreakdown as any) ?? {};
    if (!taskBreakdown[args.taskType]) {
      taskBreakdown[args.taskType] = { tokens: 0, credits: 0, count: 0, promptTokens: 0, completionTokens: 0 };
    }
    taskBreakdown[args.taskType].tokens += args.totalTokens;
    taskBreakdown[args.taskType].credits += cost;
    taskBreakdown[args.taskType].count += 1;
    taskBreakdown[args.taskType].promptTokens = (taskBreakdown[args.taskType].promptTokens ?? 0) + args.promptTokens;
    taskBreakdown[args.taskType].completionTokens = (taskBreakdown[args.taskType].completionTokens ?? 0) + args.completionTokens;

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalTokens: existing.totalTokens + args.totalTokens,
        totalPromptTokens: existing.totalPromptTokens + args.promptTokens,
        totalCompletionTokens: existing.totalCompletionTokens + args.completionTokens,
        totalCredits: existing.totalCredits + cost,
        successfulCalls: existing.successfulCalls + (args.success ? 1 : 0),
        totalRequests: existing.totalRequests + 1,
        totalCvExtractionsCount: existing.totalCvExtractionsCount + (isCvExtraction ? 1 : 0),
        cvExtractionCredits: existing.cvExtractionCredits + (isCvExtraction ? cost : 0),
        taskBreakdown,
      });
    } else {
      await ctx.db.insert("tokenStatsCache", {
        singletonKey: SINGLETON_KEY,
        totalTokens: args.totalTokens,
        totalPromptTokens: args.promptTokens,
        totalCompletionTokens: args.completionTokens,
        totalCredits: cost,
        successfulCalls: args.success ? 1 : 0,
        totalRequests: 1,
        totalCvExtractionsCount: isCvExtraction ? 1 : 0,
        cvExtractionCredits: isCvExtraction ? cost : 0,
        taskBreakdown,
      });
    }

    // --- 3. Update today's daily cost row for the 7-day chart ---
    const dateStr = new Date(now).toISOString().split("T")[0];
    const dailyRow = await ctx.db
      .query("dailyTokenStats")
      .withIndex("by_dateStr", (q) => q.eq("dateStr", dateStr))
      .first();

    if (dailyRow) {
      await ctx.db.patch(dailyRow._id, {
        totalCost: dailyRow.totalCost + cost,
        cvExtractionCost: dailyRow.cvExtractionCost + (args.taskType === "cv_structuring" ? cost : 0),
        promptTokens: (dailyRow.promptTokens ?? 0) + args.promptTokens,
        completionTokens: (dailyRow.completionTokens ?? 0) + args.completionTokens,
        cvPromptTokens: (dailyRow.cvPromptTokens ?? 0) + (args.taskType === "cv_structuring" ? args.promptTokens : 0),
        cvCompletionTokens: (dailyRow.cvCompletionTokens ?? 0) + (args.taskType === "cv_structuring" ? args.completionTokens : 0),
      });
    } else {
      await ctx.db.insert("dailyTokenStats", {
        dateStr,
        totalCost: cost,
        cvExtractionCost: args.taskType === "cv_structuring" ? cost : 0,
        promptTokens: args.promptTokens,
        completionTokens: args.completionTokens,
        cvPromptTokens: args.taskType === "cv_structuring" ? args.promptTokens : 0,
        cvCompletionTokens: args.taskType === "cv_structuring" ? args.completionTokens : 0,
      });
    }
  },
});

/**
 * Query to fetch aggregated metrics for the dashboard cards and charts.
 * Reads from the pre-computed cache — O(8 docs) instead of O(14,000+ logs).
 */
export const getTokenMetrics = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "ta_manager", "senior_ta"]);

    // --- 1. Read the all-time singleton cache (1 document read) ---
    const cache = await ctx.db
      .query("tokenStatsCache")
      .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "global_token_stats"))
      .first();

    const totalTokens = cache?.totalTokens ?? 0;
    const totalPromptTokens = cache?.totalPromptTokens ?? 0;
    const totalCompletionTokens = cache?.totalCompletionTokens ?? 0;
    const totalCredits = cache?.totalCredits ?? 0;
    const totalRequests = cache?.totalRequests ?? 0;
    const successfulCalls = cache?.successfulCalls ?? 0;
    const totalCvExtractionsCount = cache?.totalCvExtractionsCount ?? 0;
    const cvExtractionCredits = cache?.cvExtractionCredits ?? 0;
    const taskBreakdown = (cache?.taskBreakdown as Record<string, { tokens: number; credits: number; count: number }>) ?? {};

    const successRate = totalRequests > 0 ? (successfulCalls / totalRequests) * 100 : 100;
    const avgCostPerCv = totalCvExtractionsCount > 0 ? cvExtractionCredits / totalCvExtractionsCount : 0;

    // --- 2. Read the last 7 days of daily rows (7 document reads max) ---
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const dailyDataMap = new Map<
      string,
      {
        date: string;
        totalCost: number;
        cvExtractionCost: number;
        promptTokens: number;
        completionTokens: number;
        cvPromptTokens: number;
        cvCompletionTokens: number;
      }
    >();

    // Seed map with 7 days so days with zero activity still appear in the chart
    for (let i = 6; i >= 0; i--) {
      const dateStr = new Date(now - i * oneDayMs).toISOString().split("T")[0];
      dailyDataMap.set(dateStr, {
        date: dateStr,
        totalCost: 0,
        cvExtractionCost: 0,
        promptTokens: 0,
        completionTokens: 0,
        cvPromptTokens: 0,
        cvCompletionTokens: 0,
      });
    }

    // Overwrite with actual stored rows
    const sevenDaysAgoStr = new Date(now - 6 * oneDayMs).toISOString().split("T")[0];
    const dailyRows = await ctx.db
      .query("dailyTokenStats")
      .withIndex("by_dateStr", (q) => q.gte("dateStr", sevenDaysAgoStr))
      .collect();
    for (const row of dailyRows) {
      if (dailyDataMap.has(row.dateStr)) {
        dailyDataMap.set(row.dateStr, {
          date: row.dateStr,
          totalCost: row.totalCost,
          cvExtractionCost: row.cvExtractionCost,
          promptTokens: row.promptTokens ?? 0,
          completionTokens: row.completionTokens ?? 0,
          cvPromptTokens: row.cvPromptTokens ?? 0,
          cvCompletionTokens: row.cvCompletionTokens ?? 0,
        });
      }
    }

    return {
      overall: {
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
        totalCredits,
        totalRequests,
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
 * fileName is denormalized at write-time — zero N+1 joins at read-time.
 */
export const getRecentTokenLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "ta_manager", "senior_ta"]);
    const limit = args.limit ?? 20;

    const logs = await ctx.db
      .query("nvidiaTokenLogs")
      .order("desc")
      .take(limit);

    // fileName is already stored on the document — no per-row db.get() needed
    return logs.map((log) => ({
      ...log,
      candidateName: log.fileName, // alias for backwards compat with frontend
      estimatedCost: calculateNvidiaCredits(log.model, log.promptTokens, log.completionTokens),
    }));
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

export const logNvidiaCallsBatchMutation = internalMutation({
  args: {
    logs: v.array(
      v.object({
        taskType: v.string(),
        model: v.string(),
        promptTokens: v.number(),
        completionTokens: v.number(),
        success: v.boolean(),
        error: v.optional(v.string()),
        cvUploadId: v.optional(v.id("cvUploads")),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.logs.length === 0) return;

    const now = Date.now();
    const dateStr = new Date(now).toISOString().split("T")[0];

    // --- 1. Load rolling cache singletons to update them in one go ---
    const SINGLETON_KEY = "global_token_stats";
    const existingCache = await ctx.db
      .query("tokenStatsCache")
      .withIndex("by_singletonKey", (q) => q.eq("singletonKey", SINGLETON_KEY))
      .first();

    const dailyRow = await ctx.db
      .query("dailyTokenStats")
      .withIndex("by_dateStr", (q) => q.eq("dateStr", dateStr))
      .first();

    // Accumulators for this batch
    let batchTotalTokens = 0;
    let batchPromptTokens = 0;
    let batchCompletionTokens = 0;
    let batchCredits = 0;
    let batchSuccessfulCalls = 0;
    let batchCvExtractionsCount = 0;
    let batchCvExtractionCredits = 0;
    let batchCvPromptTokens = 0;
    let batchCvCompletionTokens = 0;
    const batchTaskBreakdown: Record<string, { tokens: number; credits: number; count: number; promptTokens: number; completionTokens: number }> = {};

    for (const log of args.logs) {
      const cost = calculateNvidiaCredits(log.model, log.promptTokens, log.completionTokens);
      const totalTokens = log.promptTokens + log.completionTokens;

      // Point read the CV file name at write-time if cvUploadId is provided
      let fileName: string | undefined = undefined;
      if (log.cvUploadId) {
        const cv = await ctx.db.get(log.cvUploadId);
        if (cv) fileName = cv.fileName;
      }

      // Insert log row
      await ctx.db.insert("nvidiaTokenLogs", {
        taskType: log.taskType,
        model: log.model,
        promptTokens: log.promptTokens,
        completionTokens: log.completionTokens,
        totalTokens,
        success: log.success,
        error: log.error,
        cvUploadId: log.cvUploadId,
        timestamp: now,
        fileName,
      });

      // Accumulate
      batchTotalTokens += totalTokens;
      batchPromptTokens += log.promptTokens;
      batchCompletionTokens += log.completionTokens;
      batchCredits += cost;
      if (log.success) {
        batchSuccessfulCalls++;
        if (log.taskType === "cv_structuring") {
          batchCvExtractionsCount++;
          batchCvExtractionCredits += cost;
          batchCvPromptTokens += log.promptTokens;
          batchCvCompletionTokens += log.completionTokens;
        }
      }

      if (!batchTaskBreakdown[log.taskType]) {
        batchTaskBreakdown[log.taskType] = { tokens: 0, credits: 0, count: 0, promptTokens: 0, completionTokens: 0 };
      }
      batchTaskBreakdown[log.taskType].tokens += totalTokens;
      batchTaskBreakdown[log.taskType].credits += cost;
      batchTaskBreakdown[log.taskType].count += 1;
      batchTaskBreakdown[log.taskType].promptTokens += log.promptTokens;
      batchTaskBreakdown[log.taskType].completionTokens += log.completionTokens;
    }

    // --- 2. Update all-time rolling singleton cache ---
    const taskBreakdown: Record<string, { tokens: number; credits: number; count: number; promptTokens?: number; completionTokens?: number }> =
      (existingCache?.taskBreakdown as any) ?? {};
    for (const [taskType, delta] of Object.entries(batchTaskBreakdown)) {
      if (!taskBreakdown[taskType]) {
        taskBreakdown[taskType] = { tokens: 0, credits: 0, count: 0, promptTokens: 0, completionTokens: 0 };
      }
      taskBreakdown[taskType].tokens += delta.tokens;
      taskBreakdown[taskType].credits += delta.credits;
      taskBreakdown[taskType].count += delta.count;
      taskBreakdown[taskType].promptTokens = (taskBreakdown[taskType].promptTokens ?? 0) + delta.promptTokens;
      taskBreakdown[taskType].completionTokens = (taskBreakdown[taskType].completionTokens ?? 0) + delta.completionTokens;
    }

    if (existingCache) {
      await ctx.db.patch(existingCache._id, {
        totalTokens: existingCache.totalTokens + batchTotalTokens,
        totalPromptTokens: existingCache.totalPromptTokens + batchPromptTokens,
        totalCompletionTokens: existingCache.totalCompletionTokens + batchCompletionTokens,
        totalCredits: existingCache.totalCredits + batchCredits,
        successfulCalls: existingCache.successfulCalls + batchSuccessfulCalls,
        totalRequests: existingCache.totalRequests + args.logs.length,
        totalCvExtractionsCount: existingCache.totalCvExtractionsCount + batchCvExtractionsCount,
        cvExtractionCredits: existingCache.cvExtractionCredits + batchCvExtractionCredits,
        taskBreakdown,
      });
    } else {
      await ctx.db.insert("tokenStatsCache", {
        singletonKey: SINGLETON_KEY,
        totalTokens: batchTotalTokens,
        totalPromptTokens: batchPromptTokens,
        totalCompletionTokens: batchCompletionTokens,
        totalCredits: batchCredits,
        successfulCalls: batchSuccessfulCalls,
        totalRequests: args.logs.length,
        totalCvExtractionsCount: batchCvExtractionsCount,
        cvExtractionCredits: batchCvExtractionCredits,
        taskBreakdown,
      });
    }

    // --- 3. Update daily cost row ---
    const batchCvExtractionCreditsAll = args.logs
      .filter((l) => l.taskType === "cv_structuring" && l.success)
      .reduce((sum, l) => sum + calculateNvidiaCredits(l.model, l.promptTokens, l.completionTokens), 0);

    if (dailyRow) {
      await ctx.db.patch(dailyRow._id, {
        totalCost: dailyRow.totalCost + batchCredits,
        cvExtractionCost: dailyRow.cvExtractionCost + batchCvExtractionCreditsAll,
        promptTokens: (dailyRow.promptTokens ?? 0) + batchPromptTokens,
        completionTokens: (dailyRow.completionTokens ?? 0) + batchCompletionTokens,
        cvPromptTokens: (dailyRow.cvPromptTokens ?? 0) + batchCvPromptTokens,
        cvCompletionTokens: (dailyRow.cvCompletionTokens ?? 0) + batchCvCompletionTokens,
      });
    } else {
      await ctx.db.insert("dailyTokenStats", {
        dateStr,
        totalCost: batchCredits,
        cvExtractionCost: batchCvExtractionCreditsAll,
        promptTokens: batchPromptTokens,
        completionTokens: batchCompletionTokens,
        cvPromptTokens: batchCvPromptTokens,
        cvCompletionTokens: batchCvCompletionTokens,
      });
    }
  },
});

export const logNvidiaCallMutationPublic = mutation({
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
    await requireRole(ctx, ["admin"]);
    return "Use the internal mutation instead";
  },
});

export const getTokenMetricsAction = action({
  args: {},
  handler: async (ctx): Promise<any> => {
    return await ctx.runQuery(api.stats.stats.getTokenMetrics);
  },
});

export const getRecentTokenLogsAction = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runQuery(api.stats.stats.getRecentTokenLogs, { limit: args.limit });
  },
});

export const backfillTokenStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Reconstruct all-time tokenStatsCache and dailyTokenStats tables based on the full raw nvidiaTokenLogs
    const logs = await ctx.db.query("nvidiaTokenLogs").collect();

    let totalTokens = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCredits = 0;
    let successfulCalls = 0;
    let totalCvExtractionsCount = 0;
    let cvExtractionCredits = 0;

    const taskBreakdown: Record<
      string,
      { tokens: number; credits: number; count: number; promptTokens: number; completionTokens: number }
    > = {};

    const dailyMap = new Map<
      string,
      {
        totalCost: number;
        cvExtractionCost: number;
        promptTokens: number;
        completionTokens: number;
        cvPromptTokens: number;
        cvCompletionTokens: number;
      }
    >();

    for (const log of logs) {
      const cost = calculateNvidiaCredits(log.model, log.promptTokens, log.completionTokens);
      const total = log.promptTokens + log.completionTokens;

      totalTokens += total;
      totalPromptTokens += log.promptTokens;
      totalCompletionTokens += log.completionTokens;
      totalCredits += cost;

      if (log.success) {
        successfulCalls++;
        if (log.taskType === "cv_structuring") {
          totalCvExtractionsCount++;
          cvExtractionCredits += cost;
        }
      }

      // Task breakdown aggregation
      if (!taskBreakdown[log.taskType]) {
        taskBreakdown[log.taskType] = { tokens: 0, credits: 0, count: 0, promptTokens: 0, completionTokens: 0 };
      }
      taskBreakdown[log.taskType].tokens += total;
      taskBreakdown[log.taskType].credits += cost;
      taskBreakdown[log.taskType].count += 1;
      taskBreakdown[log.taskType].promptTokens += log.promptTokens;
      taskBreakdown[log.taskType].completionTokens += log.completionTokens;

      // Daily Stats aggregation
      const dateStr = new Date(log.timestamp).toISOString().split("T")[0];
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, {
          totalCost: 0,
          cvExtractionCost: 0,
          promptTokens: 0,
          completionTokens: 0,
          cvPromptTokens: 0,
          cvCompletionTokens: 0,
        });
      }
      const day = dailyMap.get(dateStr)!;
      day.totalCost += cost;
      day.promptTokens += log.promptTokens;
      day.completionTokens += log.completionTokens;

      if (log.taskType === "cv_structuring") {
        day.cvExtractionCost += cost;
        day.cvPromptTokens += log.promptTokens;
        day.cvCompletionTokens += log.completionTokens;
      }
    }

    // Save/Update tokenStatsCache
    const SINGLETON_KEY = "global_token_stats";
    const cacheRow = await ctx.db
      .query("tokenStatsCache")
      .withIndex("by_singletonKey", (q) => q.eq("singletonKey", SINGLETON_KEY))
      .first();

    if (cacheRow) {
      await ctx.db.patch(cacheRow._id, {
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
        totalCredits,
        successfulCalls,
        totalRequests: logs.length,
        totalCvExtractionsCount,
        cvExtractionCredits,
        taskBreakdown,
      });
    } else {
      await ctx.db.insert("tokenStatsCache", {
        singletonKey: SINGLETON_KEY,
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
        totalCredits,
        successfulCalls,
        totalRequests: logs.length,
        totalCvExtractionsCount,
        cvExtractionCredits,
        taskBreakdown,
      });
    }

    // Replace dailyTokenStats
    const oldDailies = await ctx.db.query("dailyTokenStats").collect();
    for (const d of oldDailies) {
      await ctx.db.delete(d._id);
    }

    for (const [dateStr, data] of dailyMap.entries()) {
      await ctx.db.insert("dailyTokenStats", {
        dateStr,
        totalCost: data.totalCost,
        cvExtractionCost: data.cvExtractionCost,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        cvPromptTokens: data.cvPromptTokens,
        cvCompletionTokens: data.cvCompletionTokens,
      });
    }

    console.log(`Successfully backfilled stats from ${logs.length} token logs.`);
    return { success: true, logCount: logs.length };
  },
});


export const getTodayInboxActivity = query({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const currentOffset = 5.5 * 60 * 60 * 1000;
    const localTime = new Date(now.getTime() + currentOffset);
    localTime.setUTCHours(0, 0, 0, 0);
    const startOfToday = localTime.getTime() - currentOffset;

    const recentUploads = await ctx.db.query('cvUploads').order('desc').take(500);
    const todaysUploads = recentUploads.filter(u => u._creationTime >= startOfToday);

    const counts: Record<string, number> = { email: 0, email_campaign: 0, linkedin: 0, whatsapp: 0, database: 0 };
    let total = 0;

    for (const upload of todaysUploads) {
      const src = upload.source || 'database';
      if (counts[src] !== undefined) counts[src]++;
      else counts[src] = 1;
      total++;
    }

    return { total, counts };
  }
});
