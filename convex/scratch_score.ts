// @ts-nocheck
import { internalMutation, internalAction } from "./_generated/server";
import { api } from "./_generated/api";

const HOS_JOB_ID = "m174y1n4x36av23dr3hegm43p98b2k9x";
const HOIT_JOB_ID = "m17abwpzg8ekcqq34e4kw5y6jx8b1p7r";

/**
 * Fix IT apps that have no cvFileId pointing to their cvUpload.
 * Also fix cvUploads that still point to the old Sales job.
 */
export const fixITAppCvLinks = internalMutation({
  handler: async (ctx) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_job_active", (q) => q.eq("jobId", HOIT_JOB_ID))
      .collect();

    let fixed = 0;
    let alreadyOk = 0;

    for (const app of apps) {
      if (!app.isActive) continue;

      const candidate = await ctx.db.get(app.candidateId);
      if (!candidate) continue;

      const updates = {};

      // Link cvFileId from candidate if missing
      if (!app.cvFileId && candidate.cvUploadId) {
        const cv = await ctx.db.get(candidate.cvUploadId);
        if (cv) {
          updates.cvFileId = cv._id;
          updates.cvFileName = cv.fileName;
          // Make sure the cvUpload points to the IT job
          if (cv.assignToJob !== HOIT_JOB_ID) {
            await ctx.db.patch(cv._id, { assignToJob: HOIT_JOB_ID });
          }
        }
      } else if (app.cvFileId) {
        // CV is linked — make sure it points to IT job
        const cv = await ctx.db.get(app.cvFileId);
        if (cv && cv.assignToJob !== HOIT_JOB_ID) {
          await ctx.db.patch(cv._id, { assignToJob: HOIT_JOB_ID });
        }
      }

      // Also backfill any missing candidate fields
      if (candidate.fullName) updates.candidateName = candidate.fullName;
      if (candidate.email) updates.candidateEmail = candidate.email;
      if (candidate.phone) updates.candidatePhone = candidate.phone;
      if (candidate.currentJobTitle) updates.candidateTitle = candidate.currentJobTitle;
      if (candidate.totalExperienceYears !== undefined) updates.candidateExperience = candidate.totalExperienceYears;

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(app._id, updates);
        fixed++;
      } else {
        alreadyOk++;
      }
    }

    return { fixed, alreadyOk, total: apps.length };
  },
});

/**
 * Trigger AI scoring for all applications in both jobs that have no aiMatchScore.
 * Schedules them in batches to avoid overloading the system.
 */
export const triggerScoringForBothJobs = internalAction({
  handler: async (ctx) => {
    const jobIds = [HOS_JOB_ID, HOIT_JOB_ID];
    let totalQueued = 0;

    for (const jobId of jobIds) {
      const apps = await ctx.runQuery(
        // @ts-ignore
        async (ctx2) => {
          return await ctx2.db
            .query("applications")
            .withIndex("by_job_active", (q) => q.eq("jobId", jobId))
            .collect();
        }
      );
    }

    return { totalQueued };
  },
});

/**
 * Get all unscored application candidateIds for a job.
 */
export const getUnscoredApps = internalMutation({
  handler: async (ctx) => {
    const hosApps = await ctx.db
      .query("applications")
      .withIndex("by_job_active", (q) => q.eq("jobId", HOS_JOB_ID))
      .collect();

    const hoitApps = await ctx.db
      .query("applications")
      .withIndex("by_job_active", (q) => q.eq("jobId", HOIT_JOB_ID))
      .collect();

    const unscoredHOS = hosApps.filter(a => a.isActive && !a.aiMatchScore);
    const unscoredHOIT = hoitApps.filter(a => a.isActive && !a.aiMatchScore);

    // Schedule scoring for each — stagger by 500ms each to avoid overload
    let delay = 0;
    for (const app of unscoredHOIT) {
      await ctx.scheduler.runAfter(delay, api.cvs.cvScoringActions.processCvScoring, {
        candidateId: app.candidateId,
        jobId: HOIT_JOB_ID,
      });
      delay += 500;
    }

    for (const app of unscoredHOS.slice(0, 50)) { // first 50 to avoid timeout
      await ctx.scheduler.runAfter(delay, api.cvs.cvScoringActions.processCvScoring, {
        candidateId: app.candidateId,
        jobId: HOS_JOB_ID,
      });
      delay += 500;
    }

    return {
      queuedHOIT: unscoredHOIT.length,
      queuedHOS: Math.min(unscoredHOS.length, 50),
      totalHOS: unscoredHOS.length,
      message: "Scoring jobs queued. They will run in the background over the next few minutes.",
    };
  },
});
