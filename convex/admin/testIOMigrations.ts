import { query } from "../_generated/server";

export const testIOMigrations = query({
  args: {},
  handler: async (ctx) => {
    // 1. Test getTokenMetrics
    const tokenMetrics = await ctx.db
      .query("tokenStatsCache")
      .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "global_token_stats"))
      .first();

    // 2. Test getRecentTokenLogs
    const recentTokenLogs = await ctx.db
      .query("nvidiaTokenLogs")
      .order("desc")
      .take(5);

    // 3. Test listCandidatesPaginated fallback removal
    const candidates = await ctx.db.query("candidates").order("desc").take(5);

    return {
      tokenMetricsSuccess: !!tokenMetrics,
      tokenMetricsData: tokenMetrics ? {
        totalTokens: tokenMetrics.totalTokens,
        totalCredits: tokenMetrics.totalCredits,
      } : null,
      recentTokenLogsSuccess: recentTokenLogs.length > 0,
      recentTokenLogsSample: recentTokenLogs.map(l => ({
        taskType: l.taskType,
        fileName: l.fileName, // verify denormalized field exists
      })),
      candidatesSuccess: candidates.length > 0,
      candidatesSample: candidates.map(c => ({
        id: c._id,
        hasSummary: Array.isArray(c.activeApplicationsSummary),
      }))
    };
  }
});
