// @ts-nocheck
import { internalMutation } from "./_generated/server";

export const recoverLinkedInCVs = internalMutation({
  handler: async (ctx) => {
    // 1. Find the job with keyword HOS432
    const jobs = await ctx.db.query("jobs").withIndex("by_keyword", q => q.eq("keyword", "HOS432")).collect();
    if (jobs.length === 0) {
      return { success: false, reason: "Job HOS432 not found" };
    }
    const targetJobId = jobs[0]._id;

    // 2. Find recent unassigned LinkedIn CVs from today
    const recentUploads = await ctx.db.query("cvUploads").order("desc").take(500);
    
    // Filter for CVs from linkedin that are unassigned and created in the last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    const unassignedLinkedInCVs = recentUploads.filter(cv => 
      cv.source === "linkedin" && 
      !cv.assignToJob && 
      cv._creationTime > oneDayAgo
    );

    // 3. Update them to point to the job
    let updatedCount = 0;
    for (const cv of unassignedLinkedInCVs) {
      await ctx.db.patch(cv._id, { assignToJob: targetJobId });
      
      // Also update the candidate if extraction already finished
      if (cv.candidateId) {
        // We have to add an application since it's a many-to-many relationship
        const existingLink = await ctx.db.query("applications")
          .withIndex("by_candidate_job", q => q.eq("candidateId", cv.candidateId!).eq("jobId", targetJobId))
          .first();
          
        if (!existingLink) {
          await ctx.db.insert("applications", {
            candidateId: cv.candidateId,
            jobId: targetJobId,
            currentStage: "new_cvs",
            sourceChannel: "linkedin",
            createdAt: Date.now(),
            lastStageChangedAt: Date.now(),
            loopIteration: 1,
            isActive: true
          });
        }
      }
      updatedCount++;
    }

    return { 
      success: true, 
      targetJobId, 
      updatedCount, 
      totalChecked: recentUploads.length 
    };
  }
});
