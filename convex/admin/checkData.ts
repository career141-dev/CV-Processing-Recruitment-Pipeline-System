import { query } from "../_generated/server";
export const checkDb = query({
  handler: async (ctx) => {
    const sysStat = await ctx.db.query("systemStats")
      .withIndex("by_singletonKey", q => q.eq("singletonKey", "global_stats"))
      .first();

    const recentCvUploads = await ctx.db.query("cvUploads").order("desc").take(50);
    const noCand = recentCvUploads.filter(u => !u.candidateId).length;

    return {
      totalCvUploads: sysStat?.totalCvUploads || 0,
      totalCandidates: sysStat?.totalCandidates || 0,
      recentCvUploadsChecked: recentCvUploads.length,
      recentCvUploadsWithoutCandidate: noCand,
      maxCvUploadsForOneCandidate: 1,
      maxCandidateDetails: null,
    };
  }
});
