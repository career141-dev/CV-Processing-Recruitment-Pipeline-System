import { internalMutation, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireRole } from "../lib/permissions";
import type { Id } from "../_generated/dataModel";

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
    // Access control: allow admin, ta_manager, or senior_ta
    await requireRole(ctx, ["admin", "ta_manager", "senior_ta"]);

    const allLogs = await ctx.db.query("nvidiaTokenLogs").collect();

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
          if (cv.candidateId) {
            const cand = await ctx.db.get(cv.candidateId);
            candidateName = cand?.fullName;
          }
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
