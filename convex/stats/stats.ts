import { query, mutation, action, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireRole } from "../lib/permissions";
import { api, internal } from "../_generated/api";

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

    // Query bounded lists via by_status index — zero full-table scan, instant O(1) reads
    const activeUploads = await ctx.db.query("cvUploads").withIndex("by_status", q => q.eq("status", "processing")).take(20);
    const queuedUploads = await ctx.db.query("cvUploads").withIndex("by_status", q => q.eq("status", "queued")).take(20);
    const uploadedList  = await ctx.db.query("cvUploads").withIndex("by_status", q => q.eq("status", "uploaded")).take(20);
    const failedUploads = await ctx.db.query("cvUploads").withIndex("by_status", q => q.eq("status", "failed")).take(20);
    const failedRetryUploads = await ctx.db.query("cvUploads").withIndex("by_status", q => q.eq("status", "failed_retry")).take(20);
    const recentDone = await ctx.db.query("cvUploads").withIndex("by_status", q => q.eq("status", "processed")).take(30);

    const activeCombined = [...activeUploads, ...queuedUploads, ...uploadedList];

    const statsBySource: Record<string, { todayCount: number; lastReceived: number | null }> = {};

    if (dailyStat && dailyStat.cvsBySource) {
      for (const [source, count] of Object.entries(dailyStat.cvsBySource)) {
        statsBySource[source] = { todayCount: count, lastReceived: null };
      }
    }

    const allRecent = [...activeCombined, ...failedUploads, ...failedRetryUploads, ...recentDone];
    for (const upload of allRecent) {
      const source = upload.source || "Manual";
      if (!statsBySource[source]) {
        statsBySource[source] = { todayCount: 0, lastReceived: null };
      }
      if (statsBySource[source].lastReceived === null) {
        statsBySource[source].lastReceived = upload._creationTime;
      }
    }

    return {
      statsBySource,
      activeUploads: activeCombined,
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

/**
 * ONE-TIME BACKFILL — call once from an admin action to seed systemStats
 * with the real historical counts from all existing documents.
 *
 * After this runs, future inserts/deletes are tracked incrementally by
 * adjustGlobalStat(), so this only needs to run once.
 */
// Internal — no auth check, called by CLI or cron
export const backfillSystemStatsInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    // TEMPORARILY DISABLED to reduce DB load
    return { totalCandidates: 0, totalCvUploads: 0, totalApplications: 0, activeJobsCount: 0 };
  },
});

/**
 * Public version — admin only, callable from the dashboard Settings UI.
 * Inlines the same paginated counting logic as the internal mutation to avoid
 * circular type reference issues with ctx.runMutation(internal...).
 */
export const backfillSystemStats = mutation({
  args: {},
  handler: async (ctx): Promise<{
    totalCandidates: number;
    totalCvUploads: number;
    totalApplications: number;
    activeJobsCount: number;
  }> => {
    await requireRole(ctx, ["admin"]);
    // TEMPORARILY DISABLED to reduce DB load
    return { totalCandidates: 0, totalCvUploads: 0, totalApplications: 0, activeJobsCount: 0 };
  },
});

export const getDashboardStats = query({
  args: {
    dateRange: v.optional(v.string()),
    jobFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const currentOffset = 5.5 * 60 * 60 * 1000; // IST offset

    // ── 1. TRUE TOTALS — O(1) singleton read, zero table scan ──────────
    const sysStat = await ctx.db
      .query("systemStats")
      .withIndex("by_singletonKey", q => q.eq("singletonKey", "global_stats"))
      .first();

    const totalCandidates  = sysStat?.totalCandidates  ?? 0;
    const totalCvUploads   = sysStat?.totalCvUploads   ?? 0;
    const activeJobsCount  = sysStat?.activeJobsCount  ?? 0;

    // ── 2. DAILY STATS — read last 60 days from dailyStats cache ───────
    // dailyStats is a small table (max 365 rows/year) — safe to take(60)
    const dailyStats = await ctx.db.query("dailyStats").order("desc").take(60);

    const localTime = new Date(now + currentOffset);
    localTime.setUTCHours(0, 0, 0, 0);
    const todayStr     = new Date(localTime.getTime()).toISOString().split("T")[0];
    const yesterdayStr = new Date(localTime.getTime() - oneDay).toISOString().split("T")[0];
    const sevenDaysAgoStr  = new Date(localTime.getTime() - 7 * oneDay).toISOString().split("T")[0];
    const startOfMonthStr  = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString().split("T")[0];
    const startOfLastMonthStr = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
      .toISOString().split("T")[0];

    let cvsToday          = 0;
    let cvsYesterday      = 0;
    let candidatesInPeriod = 0;
    let jobsAddedThisWeek = 0;
    let placedThisMonth   = 0;
    let placedLastMonth   = 0;

    for (const d of dailyStats) {
      // CVs today / yesterday
      if (d.dateStr === todayStr)     cvsToday     += (d.newCvUploads  || 0);
      if (d.dateStr === yesterdayStr) cvsYesterday += (d.newCvUploads  || 0);

      // Period candidates (based on dateRange filter)
      let periodCutoff = "";
      if (args.dateRange === "This Week")      periodCutoff = sevenDaysAgoStr;
      else if (args.dateRange === "Last 30 Days") periodCutoff = new Date(now - 30 * oneDay).toISOString().split("T")[0];
      else if (args.dateRange === "This Month")   periodCutoff = startOfMonthStr;

      if (!periodCutoff || d.dateStr >= periodCutoff) {
        candidatesInPeriod += (d.newCandidates || 0);
      }

      // Jobs added this week
      if (d.dateStr >= sevenDaysAgoStr) {
        jobsAddedThisWeek += (d.newJobs || 0);
      }

      // Placements this month vs last month
      if (d.dateStr >= startOfMonthStr) {
        placedThisMonth += (d.placements || 0);
      } else if (d.dateStr >= startOfLastMonthStr) {
        placedLastMonth += (d.placements || 0);
      }
    }

    // ── 3. ACTIVE JOBS — indexed read, not a full scan ──────────────────
    // Use cached count first; fall back to a bounded index read
    let activeJobs = activeJobsCount;
    if (activeJobs === 0) {
      // Only do this if cache is stale/zero — bounded to 500 jobs max
      const jobRows = await ctx.db.query("jobs")
        .withIndex("by_status", q => q.eq("status", "active"))
        .take(500);
      activeJobs = jobRows.length;
    }

    const cvsVsYesterday    = cvsToday - cvsYesterday;
    const placedVsLastMonth = placedThisMonth - placedLastMonth;

    return {
      candidates: {
        total: totalCandidates,
        trendText: `${candidatesInPeriod.toLocaleString()} this period`,
        trendType: "up" as const,
      },
      cvsToday: {
        total: cvsToday,
        trendText: `${Math.abs(cvsVsYesterday)} vs yesterday`,
        trendType: (cvsVsYesterday > 0 ? "up" : cvsVsYesterday < 0 ? "down" : "neutral") as "up" | "down" | "neutral",
      },
      activeJobs: {
        total: activeJobs,
        trendText: `${jobsAddedThisWeek} added this period`,
        trendType: (jobsAddedThisWeek > 0 ? "up" : "neutral") as "up" | "neutral",
      },
      placedThisMonth: {
        total: placedThisMonth,
        trendText: `${Math.abs(placedVsLastMonth)} vs last month`,
        trendType: (placedVsLastMonth > 0 ? "up" : placedVsLastMonth < 0 ? "down" : "neutral") as "up" | "down" | "neutral",
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

    const dailyStats = await ctx.db.query("dailyStats").withIndex("by_dateStr").order("desc").take(60);

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
      .withIndex("by_occurredAt")
      .order("desc")
      .take(5);

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

export function calculateLLMCost(model: string, promptTokens: number, completionTokens: number, provider?: string): number {
  const modelName = model.toLowerCase();

  // 1. Free tier models (:free suffix)
  if (modelName.endsWith(":free") || modelName.includes(":free")) {
    return 0;
  }

  // 2. Embeddings: $0.07 / million tokens
  if (modelName.includes("embed") || modelName.includes("bge")) {
    return (promptTokens + completionTokens) * (0.07 / 1_000_000);
  }

  // 3. DeepSeek Models (DeepSeek V4-Flash, DeepSeek V3, DeepSeek R1)
  if (modelName.includes("deepseek")) {
    if (modelName.includes("r1") || modelName.includes("pro")) {
      return (promptTokens * 0.55 + completionTokens * 2.19) / 1_000_000;
    }
    // Default to DeepSeek V4-Flash rates (Input: $0.14/M, Output: $0.28/M)
    return (promptTokens * 0.14 + completionTokens * 0.28) / 1_000_000;
  }

  // 4. Llama 3.3 70B Paid model ($0.12/1M input, $0.30/1M output)
  if (modelName.includes("llama-3.3-70b")) {
    return (promptTokens * 0.12 + completionTokens * 0.30) / 1_000_000;
  }

  // 5. 8B models: $0.18 / 1M tokens
  if (modelName.includes("8b")) {
    return (promptTokens + completionTokens) * (0.18 / 1_000_000);
  }

  // Default to Llama-3.1-70B rate ($0.40 / 1M tokens)
  return (promptTokens + completionTokens) * (0.40 / 1_000_000);
}

export const calculateNvidiaCredits = calculateLLMCost;

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
    provider: v.optional(v.string()),
    sourceChannel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const resolvedProvider = args.provider || (args.taskType === "cv_vision_ocr" || args.taskType === "embedding" || args.model.includes("nvidia") ? "nvidia" : "openrouter");
    const cost = calculateLLMCost(args.model, args.promptTokens, args.completionTokens, resolvedProvider);

    // --- 1. Denormalize fileName and sourceChannel at write-time ---
    let fileName: string | undefined = undefined;
    let sourceChannel: string | undefined = args.sourceChannel;
    if (args.cvUploadId) {
      const cv = await ctx.db.get(args.cvUploadId);
      if (cv) {
        fileName = cv.fileName;
        if (!sourceChannel) sourceChannel = cv.source;
      }
    }

    // Insert the log with denormalized fields
    await ctx.db.insert("nvidiaTokenLogs", {
      ...args,
      provider: resolvedProvider,
      timestamp: now,
      fileName,
      sourceChannel,
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

export const syncWorkableTokenLogs = mutation({
  args: {},
  handler: async (ctx) => {
    // Limit to 300 recent logs to prevent Convex read operation timeout
    const logs = await ctx.db.query("nvidiaTokenLogs").order("desc").take(300);
    let denormalizedCount = 0;

    for (const log of logs) {
      if (!log.sourceChannel && log.cvUploadId) {
        const cv = await ctx.db.get(log.cvUploadId);
        if (cv) {
          const isWorkable = cv.source === "Workable" || (cv.fileName && cv.fileName.toLowerCase().includes("workable"));
          const srcChannel = isWorkable ? "Workable" : (cv.source || undefined);
          await ctx.db.patch(log._id, { sourceChannel: srcChannel, fileName: cv.fileName });
          denormalizedCount++;
        }
      }
    }

    return {
      success: true,
      message: `Successfully synchronized ${denormalizedCount} token logs.`,
      patchedCount: denormalizedCount,
    };
  },
});

export const getDeepSeekExtractionStats = query({
  args: {},
  handler: async (ctx) => {
    const candidates = await ctx.db.query("candidates").collect();
    
    const candidatesBySource: Record<string, number> = {};
    let parsedCandidatesCount = 0;
    for (const c of candidates) {
      const src = (c as any).source || "Manual";
      candidatesBySource[src] = (candidatesBySource[src] || 0) + 1;
      if (c.isParsed) parsedCandidatesCount++;
    }

    const tokenLogs = await ctx.db.query("nvidiaTokenLogs").collect();
    let deepseekCallsCount = 0;
    let deepseekSuccessfulCalls = 0;
    let deepseekCvStructuringCount = 0;
    let workableDeepseekCount = 0;

    for (const log of tokenLogs) {
      const modelLower = (log.model || "").toLowerCase();
      if (modelLower.includes("deepseek")) {
        deepseekCallsCount++;
        if (log.success) {
          deepseekSuccessfulCalls++;
          if (log.taskType === "cv_structuring") {
            deepseekCvStructuringCount++;
            const srcLower = (log.sourceChannel || "").toLowerCase();
            const fileLower = (log.fileName || "").toLowerCase();
            if (srcLower.includes("workable") || fileLower.includes("workable")) {
              workableDeepseekCount++;
            }
          }
        }
      }
    }

    const cvUploads = await ctx.db.query("cvUploads").collect();
    const uploadsByStatus: Record<string, number> = {};
    const uploadsBySource: Record<string, number> = {};
    for (const u of cvUploads) {
      const st = u.status || "unknown";
      const src = u.source || "unknown";
      uploadsByStatus[st] = (uploadsByStatus[st] || 0) + 1;
      uploadsBySource[src] = (uploadsBySource[src] || 0) + 1;
    }

    return {
      totalCandidatesInDb: candidates.length,
      parsedCandidatesCount,
      candidatesBySource,
      deepseekLogs: {
        totalCallsCount: deepseekCallsCount,
        successfulCalls: deepseekSuccessfulCalls,
        cvStructuringSuccessCount: deepseekCvStructuringCount,
        workableCvStructuringCount: workableDeepseekCount,
      },
      cvUploads: {
        totalCount: cvUploads.length,
        byStatus: uploadsByStatus,
        bySource: uploadsBySource,
      },
    };
  },
});

export const getCanonicalDeepSeekCandidatesCount = query({
  args: {},
  handler: async (ctx) => {
    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_extractionModel", (q) => q.eq("extractionModel", "deepseek/deepseek-v4-flash"))
      .collect();

    return {
      extractionModel: "deepseek/deepseek-v4-flash",
      candidateCount: candidates.length,
      sampleCandidateIds: candidates.slice(0, 5).map((c) => c._id),
    };
  },
});

export const getCanonicalDeepSeekTokenLogsCount = query({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db
      .query("nvidiaTokenLogs")
      .order("desc")
      .take(1000);

    const deepseekLogs = logs.filter(
      (l) =>
        (l.model || "").toLowerCase().includes("deepseek") &&
        l.taskType === "cv_structuring" &&
        l.success === true
    );

    const distinctUploadIds = new Set<string>();
    const distinctCandidateIds = new Set<string>();

    for (const log of deepseekLogs) {
      if (log.cvUploadId) {
        distinctUploadIds.add(log.cvUploadId);
      }
    }

    for (const uploadId of Array.from(distinctUploadIds)) {
      const cv: any = await ctx.db.get(uploadId as any);
      if (cv && cv.candidateId) {
        distinctCandidateIds.add(cv.candidateId);
      }
    }

    return {
      totalLogRows: deepseekLogs.length,
      distinctCvUploadsCount: distinctUploadIds.size,
      distinctCandidatesCount: distinctCandidateIds.size,
    };
  },
});

export const getExtractionCountByModel = query({
  args: { model: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const targetModel = args.model ?? "deepseek/deepseek-v4-flash";
    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_extractionModel", (q) => q.eq("extractionModel", targetModel))
      .collect();

    return {
      model: targetModel,
      count: candidates.length,
    };
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

    // Compute dedicated metrics for DeepSeek, Gemma 4, and NVIDIA Embeddings across recent logs (capped to 500 max to prevent query timeout)
    const allLogs = await ctx.db
      .query("nvidiaTokenLogs")
      .order("desc")
      .take(500);
    
    let dsPromptTokens = 0, dsCompTokens = 0, dsCalls = 0, dsSuccess = 0, dsCvCount = 0, dsCost = 0;
    let workablePromptTokens = 0, workableCompTokens = 0, workableCalls = 0, workableSuccess = 0, workableCvCount = 0, workableCost = 0;
    let gemmaPromptTokens = 0, gemmaCompTokens = 0, gemmaCalls = 0, gemmaSuccess = 0, gemmaCvCount = 0;
    let embedPromptTokens = 0, embedCalls = 0, embedSuccess = 0, embedCost = 0;

    for (const log of allLogs) {
      const modelLower = (log.model || "").toLowerCase();
      const pTokens = log.promptTokens || 0;
      const cTokens = log.completionTokens || 0;
      const srcLower = (log.sourceChannel || "").toLowerCase();
      const fileLower = (log.fileName || "").toLowerCase();
      const isWorkable = srcLower.includes("workable") || fileLower.includes("workable");

      if (modelLower.includes("deepseek")) {
        dsPromptTokens += pTokens;
        dsCompTokens += cTokens;
        dsCalls++;
        if (log.success) {
          dsSuccess++;
          if (log.taskType === "cv_structuring") {
            dsCvCount++;
          }
        }
        const callCost = calculateLLMCost(log.model, pTokens, cTokens, log.provider || "openrouter");
        dsCost += callCost;

        if (isWorkable) {
          workablePromptTokens += pTokens;
          workableCompTokens += cTokens;
          workableCalls++;
          if (log.success) {
            workableSuccess++;
            if (log.taskType === "cv_structuring") workableCvCount++;
          }
          workableCost += callCost;
        }
      } else if (modelLower.includes("gemma")) {
        gemmaPromptTokens += pTokens;
        gemmaCompTokens += cTokens;
        gemmaCalls++;
        if (log.success) {
          gemmaSuccess++;
          if (log.taskType === "cv_vision_ocr" || log.taskType === "cv_structuring") {
            gemmaCvCount++;
          }
        }
      } else if (log.taskType === "embedding" || modelLower.includes("embed")) {
        embedPromptTokens += pTokens;
        embedCalls++;
        if (log.success) embedSuccess++;
        embedCost += calculateLLMCost(log.model, pTokens, cTokens, "nvidia");
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
      openrouterDeepseek: {
        totalTokens: dsPromptTokens + dsCompTokens,
        promptTokens: dsPromptTokens,
        completionTokens: dsCompTokens,
        totalCost: dsCost,
        candidatesAddedCount: dsCvCount,
        totalCalls: dsCalls,
        successCalls: dsSuccess,
      },
      workableDeepseek: {
        totalTokens: workablePromptTokens + workableCompTokens,
        promptTokens: workablePromptTokens,
        completionTokens: workableCompTokens,
        totalCost: workableCost,
        candidatesAddedCount: workableCvCount,
        totalCalls: workableCalls,
        successCalls: workableSuccess,
      },
      openrouterGemma: {
        totalTokens: gemmaPromptTokens + gemmaCompTokens,
        promptTokens: gemmaPromptTokens,
        completionTokens: gemmaCompTokens,
        totalCost: 0,
        candidatesAddedCount: gemmaCvCount,
        totalCalls: gemmaCalls,
        successCalls: gemmaSuccess,
      },
      nvidiaEmbedding: {
        totalTokens: embedPromptTokens,
        totalCost: embedCost,
        totalCalls: embedCalls,
        successCalls: embedSuccess,
      },
      deepseekMetrics: {
        totalTokens: dsPromptTokens + dsCompTokens,
        promptTokens: dsPromptTokens,
        completionTokens: dsCompTokens,
        totalCost: dsCost,
        totalCalls: dsCalls,
        successCalls: dsSuccess,
        cvExtractionsCount: dsCvCount,
      },
      taskBreakdown,
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
    const limit = args.limit ?? 100;

    const logs = await ctx.db
      .query("nvidiaTokenLogs")
      .order("desc")
      .take(limit);

    // fileName is already stored on the document — no per-row db.get() needed
    return logs.map((log) => ({
      ...log,
      provider: log.provider || (log.taskType === "embedding" || log.model.includes("nvidia") ? "nvidia" : "openrouter"),
      candidateName: log.fileName, // alias for backwards compat with frontend
      estimatedCost: calculateLLMCost(log.model, log.promptTokens, log.completionTokens, log.provider),
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
        provider: v.optional(v.string()),
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
      const resolvedProvider = log.provider || (log.taskType === "embedding" || log.model.includes("nvidia") ? "nvidia" : "openrouter");
      const cost = calculateLLMCost(log.model, log.promptTokens, log.completionTokens, resolvedProvider);
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
        provider: resolvedProvider,
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

async function writeStatsHelper(ctx: any, args: { totalCandidates: number; totalCvUploads: number; totalApplications: number; activeJobsCount: number }) {
  let sysStat = await ctx.db
    .query("systemStats")
    .withIndex("by_singletonKey", (q: any) => q.eq("singletonKey", "global_stats"))
    .first();

  if (sysStat) {
    await ctx.db.patch(sysStat._id, {
      totalCandidates: args.totalCandidates,
      totalCvUploads: args.totalCvUploads,
      totalApplications: args.totalApplications,
      activeJobsCount: args.activeJobsCount,
    });
  } else {
    await ctx.db.insert("systemStats", {
      singletonKey: "global_stats",
      totalCandidates: args.totalCandidates,
      totalCvUploads: args.totalCvUploads,
      totalApplications: args.totalApplications,
      activeJobsCount: args.activeJobsCount,
    });
  }
}

// Mutation to write values back to the systemStats singleton
export const saveSystemStats = internalMutation({
  args: {
    totalCandidates: v.number(),
    totalCvUploads: v.number(),
    totalApplications: v.number(),
    activeJobsCount: v.number(),
  },
  handler: async (ctx, args) => {
    await writeStatsHelper(ctx, args);
  },
});

// The safe, action-based backfill runner
export const runSafeBackfill = action({
  args: {},
  handler: async (ctx): Promise<{
    totalCandidates: number;
    totalCvUploads: number;
    totalApplications: number;
    activeJobsCount: number;
  }> => {
    console.log("Starting safe dashboard stats backfill...");
    const limit = 2000;

    // 1. Count Candidates
    let totalCandidates = 0;
    let candidateCursor: string | null = null;
    while (true) {
      const page: any = await ctx.runQuery(internal.stats.statsQueries.getCandidatesPage, {
        cursor: candidateCursor,
        limit,
      });
      totalCandidates += page.count || 0;
      if (page.isDone) break;
      candidateCursor = page.continueCursor;
    }
    console.log(`Candidates count complete: ${totalCandidates}`);

    // 2. Count CV Uploads
    let totalCvUploads = 0;
    let cvUploadCursor: string | null = null;
    while (true) {
      const page: any = await ctx.runQuery(internal.stats.statsQueries.getCvUploadsPage, {
        cursor: cvUploadCursor,
        limit,
      });
      totalCvUploads += page.count || 0;
      if (page.isDone) break;
      cvUploadCursor = page.continueCursor;
    }
    console.log(`CV Uploads count complete: ${totalCvUploads}`);

    // 3. Count Applications
    let totalApplications = 0;
    let appCursor: string | null = null;
    while (true) {
      const page: any = await ctx.runQuery(internal.stats.statsQueries.getApplicationsPage, {
        cursor: appCursor,
        limit,
      });
      totalApplications += page.count || 0;
      if (page.isDone) break;
      appCursor = page.continueCursor;
    }
    console.log(`Applications count complete: ${totalApplications}`);

    // 4. Count Active Jobs
    let activeJobsCount = 0;
    let jobCursor: string | null = null;
    while (true) {
      const page: any = await ctx.runQuery(internal.stats.statsQueries.getJobsPage, {
        cursor: jobCursor,
        limit,
      });
      activeJobsCount += page.activeCount || 0;
      if (page.isDone) break;
      jobCursor = page.continueCursor;
    }
    console.log(`Active Jobs count complete: ${activeJobsCount}`);

    // Save counts back to singleton
    await ctx.runMutation(internal.stats.stats.saveSystemStats, {
      totalCandidates,
      totalCvUploads,
      totalApplications,
      activeJobsCount,
    });

    console.log("Safe backfill execution completed successfully.");
    return {
      totalCandidates,
      totalCvUploads,
      totalApplications,
      activeJobsCount,
    };
  },
});

// Direct fast mutation backfill option
export const runDirectBackfill = mutation({
  args: {},
  handler: async (ctx) => {
    const candidates = await ctx.db.query("candidates").collect();
    const cvUploads = await ctx.db.query("cvUploads").collect();
    const apps = await ctx.db.query("applications").collect();
    const jobs = await ctx.db.query("jobs").collect();

    const totalCandidates = candidates.length;
    const totalCvUploads = cvUploads.length;
    const totalApplications = apps.length;
    const activeJobsCount = jobs.filter(j => j.status === "active").length;

    await writeStatsHelper(ctx, {
      totalCandidates,
      totalCvUploads,
      totalApplications,
      activeJobsCount,
    });

    return {
      totalCandidates,
      totalCvUploads,
      totalApplications,
      activeJobsCount,
    };
  },
});

/**
 * Live, real-time status query for Direct Upload / Manual Extraction Queue Card.
 * Returns exact live counts of queued, extracting, extracted, and failed CVs.
 */
export const getDirectUploadLiveStatus = query({
  args: {},
  handler: async (ctx) => {
    // 1. Queued CVs waiting in R2 (status: "uploaded") — bounded to 1,000 per query tick
    const uploadedList = await ctx.db
      .query("cvUploads")
      .withIndex("by_status", (q) => q.eq("status", "uploaded"))
      .take(1000);

    // 2. Currently Extracting CVs (status: "processing")
    const processingList = await ctx.db
      .query("cvUploads")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .take(1000);

    // 3. Failed / Cancelled Uploads
    const failedList = await ctx.db
      .query("cvUploads")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .take(1000);

    const cancelledList = await ctx.db
      .query("cvUploads")
      .withIndex("by_status", (q) => q.eq("status", "cancelled"))
      .take(1000);

    const failedRetryList = await ctx.db
      .query("cvUploads")
      .withIndex("by_status", (q) => q.eq("status", "failed_retry"))
      .take(1000);

    // 4. Latest processed/extracted item for live timestamp
    const latestProcessed = await ctx.db
      .query("cvUploads")
      .withIndex("by_status", (q) => q.eq("status", "processed"))
      .order("desc")
      .first();

    const sysStat = await ctx.db
      .query("systemStats")
      .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "global_stats"))
      .first();

    const totalExtractedCandidates = sysStat?.totalCandidates || 0;
    const totalUploads = sysStat?.totalCvUploads || 0;
    const failedCount = failedList.length + cancelledList.length + failedRetryList.length;

    return {
      queuedCount: uploadedList.length,
      extractingCount: processingList.length,
      extractedCandidatesCount: totalExtractedCandidates,
      totalUploadsCount: totalUploads,
      failedCount,
      lastExtractedAt: latestProcessed?._creationTime || null,
      lastExtractedFileName: latestProcessed?.fileName || null,
    };
  },
});



