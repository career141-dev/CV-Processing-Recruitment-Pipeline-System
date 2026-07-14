import { query } from "../_generated/server";
export const checkDb = query({
  handler: async (ctx) => {
    const cvUploads = await ctx.db.query("cvUploads").collect();
    const candidates = await ctx.db.query("candidates").collect();
    const noCand = cvUploads.filter(u => !u.candidateId).length;
    
    // Group cvUploads by candidateId
    const groups: Record<string, number> = {};
    for (const u of cvUploads) {
      if (u.candidateId) {
        groups[u.candidateId] = (groups[u.candidateId] || 0) + 1;
      }
    }
    const maxGroup = Math.max(...Object.values(groups), 0);
    const maxGroupCandidateId = Object.keys(groups).find(k => groups[k] === maxGroup);
    
    let maxCandidateDetails = null;
    if (maxGroupCandidateId) {
       maxCandidateDetails = await ctx.db.get(maxGroupCandidateId as any);
    }

    return {
      totalCvUploads: cvUploads.length,
      totalCandidates: candidates.length,
      cvUploadsWithoutCandidate: noCand,
      maxCvUploadsForOneCandidate: maxGroup,
      maxCandidateDetails,
    };
  }
});
