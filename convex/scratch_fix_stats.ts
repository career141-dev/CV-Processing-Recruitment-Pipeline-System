// @ts-nocheck
import { internalMutation } from "./_generated/server";

export const recomputeJobStats = internalMutation({
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").collect();
    let updatedCount = 0;

    for (const job of jobs) {
      const applications = await ctx.db.query("applications")
        .withIndex("by_job_active", (q) => q.eq("jobId", job._id))
        .collect();

      const stageCounts = {};
      let totalApplications = 0;

      for (const app of applications) {
        if (!app.isActive) continue; 
        totalApplications++;
        const stage = app.currentStage;
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      }

      await ctx.db.patch(job._id, {
        totalApplications,
        stageCounts
      });
      
      updatedCount++;
    }

    return { success: true, updatedCount };
  }
});
