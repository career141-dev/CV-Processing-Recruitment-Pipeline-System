import { mutation } from "./_generated/server";

export const testTeleport = mutation({
  handler: async (ctx) => {
    const apps = await ctx.db.query("applications")
      .withIndex("by_candidateId", q => q.eq("candidateId", "j97b2dp6ak1gr2jed3gh8wbnz9898acr" as any))
      .collect();
      
    if (apps.length === 0) return "No applications found";
    
    const job = await ctx.db.get(apps[0].jobId);
    if (!job) return "Job not found";
    
    return `Job Title: ${job.title}\nJob ID: ${job._id}\nCompany: ${job.companyName || 'Not specified'}`;
  }
});
