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

    return {
      totalCvUploads: sysStat?.totalCvUploads || 0,
      totalCandidates: sysStat?.totalCandidates || 0,
      recentCvUploadsChecked: recentCvUploads.length,
      recentCvUploadsWithoutCandidate: noCand,
      recentResumes: resumeStats,
      recentTokenLogs: recentTokenLogs.map(l => ({
        taskType: l.taskType,
        model: l.model,
        success: l.success,
        error: l.error,
        timestamp: l.timestamp,
      })),
    };
  }
});
