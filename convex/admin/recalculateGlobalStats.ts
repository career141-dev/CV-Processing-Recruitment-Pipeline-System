import { mutation } from "../_generated/server";

export const run = mutation({
  handler: async (ctx) => {
    // 1. Recount Global Stats
    const candidates = await ctx.db.query("candidates").collect();
    const uploads = await ctx.db.query("cvUploads").collect();
    const applications = await ctx.db.query("applications").collect();
    const jobs = await ctx.db.query("jobs").filter(q => q.eq(q.field("status"), "active")).collect();
    
    let sysStat = await ctx.db.query("systemStats")
      .withIndex("by_singletonKey", (q: any) => q.eq("singletonKey", "global_stats"))
      .first();
      
    if (sysStat) {
      await ctx.db.patch(sysStat._id, {
        totalCandidates: candidates.length,
        totalCvUploads: uploads.length,
        totalApplications: applications.length,
        activeJobsCount: jobs.length,
      });
    }
    
    // 2. Recount Daily Stats for Today
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    
    // Set start of today in milliseconds
    const startOfToday = new Date(todayStr + "T00:00:00Z").getTime();
    
    const uploadsToday = uploads.filter(u => u._creationTime >= startOfToday);
    const candidatesToday = candidates.filter(c => c._creationTime >= startOfToday);
    const applicationsToday = applications.filter(a => a._creationTime >= startOfToday);
    const jobsToday = jobs.filter(j => j._creationTime >= startOfToday);
    
    let dailyStat = await ctx.db.query("dailyStats")
      .withIndex("by_dateStr", (q: any) => q.eq("dateStr", todayStr))
      .first();
      
    if (dailyStat) {
      await ctx.db.patch(dailyStat._id, {
        newCvUploads: uploadsToday.length,
        newCandidates: candidatesToday.length,
        newApplications: applicationsToday.length,
        newJobs: jobsToday.length,
      });
    } else {
      await ctx.db.insert("dailyStats", {
        dateStr: todayStr,
        newCvUploads: uploadsToday.length,
        newCandidates: candidatesToday.length,
        newApplications: applicationsToday.length,
        newJobs: jobsToday.length,
        placements: 0,
        cvsBySource: {},
      });
    }
    
    return {
      message: "Recalculated global and daily stats",
      uploadsToday: uploadsToday.length,
      candidatesToday: candidatesToday.length
    };
  }
});
