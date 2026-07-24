import { query } from "../_generated/server";

export const checkDb = query({
  handler: async (ctx) => {
    const sysStat = await ctx.db.query("systemStats")
      .withIndex("by_singletonKey", q => q.eq("singletonKey", "global_stats"))
      .first();

    const recentCvUploads = await ctx.db.query("cvUploads").order("desc").take(50);
    const noCand = recentCvUploads.filter(u => !u.candidateId).length;

    const recentResumes = await ctx.db.query("candidateResumes").order("desc").take(10);
    const resumeStats = recentResumes.map(r => ({
      _id: r._id,
      candidateId: r.candidateId,
      rawTextLen: r.rawText ? r.rawText.length : 0,
      hasEmbeddingField: r.hasEmbedding,
      embeddingLength: r.embedding ? r.embedding.length : 0,
    }));

    const recentTokenLogs = await ctx.db.query("nvidiaTokenLogs")
      .order("desc")
      .take(10);

    const candidates = await ctx.db.query("candidates").collect();
    const workableCandidates = candidates.filter(c => (c as any).source === "Workable" || !!(c as any).workableCandidateId);

    const logs = await ctx.db.query("nvidiaTokenLogs").collect();
    const deepseekCvLogs = logs.filter(l => (l.model || "").toLowerCase().includes("deepseek") && l.taskType === "cv_structuring" && l.success);
    const workableDeepseekLogs = logs.filter(l => (l.model || "").toLowerCase().includes("deepseek") && l.taskType === "cv_structuring" && l.success && ((l.sourceChannel || "").toLowerCase().includes("workable") || (l.fileName || "").toLowerCase().includes("workable")));

    return {
      totalCandidatesInDatabase: candidates.length,
      candidatesFromWorkable: workableCandidates.length,
      totalDeepSeekCvExtractions: deepseekCvLogs.length,
      workableDeepSeekCvExtractions: workableDeepseekLogs.length,
      totalCvUploads: sysStat?.totalCvUploads || 0,
      recentCvUploadsChecked: recentCvUploads.length,
      recentCvUploadsWithoutCandidate: noCand,
      recentTokenLogs: recentTokenLogs.map(l => ({
        taskType: l.taskType,
        model: l.model,
        success: l.success,
        sourceChannel: l.sourceChannel,
        timestamp: l.timestamp,
      })),
    };
  }
});

export const getDeepSeekStats = query({
  handler: async (ctx) => {
    const candidates = await ctx.db.query("candidates").order("desc").take(300);
    
    const candidatesBySource: Record<string, number> = {};
    let parsedCandidatesCount = 0;
    for (const c of candidates) {
      const src = (c as any).source || "Manual";
      candidatesBySource[src] = (candidatesBySource[src] || 0) + 1;
      if (c.isParsed) parsedCandidatesCount++;
    }

    const tokenLogs = await ctx.db.query("nvidiaTokenLogs").order("desc").take(500);
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

    return {
      candidatesCheckedSample: candidates.length,
      parsedCandidatesCount,
      candidatesBySource,
      deepseekLogsRecent500: {
        totalCallsCount: deepseekCallsCount,
        successfulCalls: deepseekSuccessfulCalls,
        cvStructuringSuccessCount: deepseekCvStructuringCount,
        workableCvStructuringCount: workableDeepseekCount,
      },
    };
  },
});
