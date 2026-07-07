import { mutation } from "../_generated/server";

export default mutation({
  handler: async (ctx) => {
    // 1. Find the candidate
    const candidate = await ctx.db.query("candidates")
      .filter(q => q.eq(q.field("email"), "sanjaysanjeev2000@gmail.com"))
      .first();

    if (!candidate) {
      return { message: "Candidate not found. They might have been already deleted!" };
    }

    const candId = candidate._id;

    // 2. Delete the CV Upload
    if (candidate.cvUploadId) {
      const cv = await ctx.db.get(candidate.cvUploadId);
      if (cv) {
        await ctx.db.delete(cv._id);
      }
    }

    // 3. Delete all applications
    const apps = await ctx.db.query("applications")
      .withIndex("by_candidateId", q => q.eq("candidateId", candId))
      .collect();
      
    for (const app of apps) {
      await ctx.db.delete(app._id);
    }

    // 4. Delete the candidate
    await ctx.db.delete(candId);
    
    // 5. Delete any ingestion logs associated with the candidate's CV
    if (candidate.cvUploadId) {
      const logs = await ctx.db.query("ingestionLog")
        .filter(q => q.eq(q.field("cvFileId"), candidate.cvUploadId))
        .collect();
      for (const log of logs) {
        await ctx.db.delete(log._id);
      }
    }
    
    return { message: "Successfully deleted Sanjeev's records!" };
  }
});
