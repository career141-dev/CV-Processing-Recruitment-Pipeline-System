// @ts-nocheck
import { internalMutation } from "./_generated/server";

const HOS_JOB_ID = "m174y1n4x36av23dr3hegm43p98b2k9x";
const HOIT_JOB_ID = "m17abwpzg8ekcqq34e4kw5y6jx8b1p7r";

const IT_KEYWORDS = [
  "information technology", "head of it", "it manager", "it director",
  "cto", "chief technology", "chief information", "cio",
  "software", "developer", "engineer", "devops", "sysadmin",
  "system admin", "network", "infrastructure", "cloud",
  "database", "data engineer", "cybersecurity", "security",
  "erp", "sap", "it operations", "it support", "helpdesk",
  "web developer", "full stack", "frontend", "backend",
  "machine learning", "artificial intelligence", "data science",
  "it governance", "it service", "technical lead", "tech lead",
  "solution architect", "enterprise architect", "it architect",
  "qa", "quality assurance", "testing", "automation engineer",
  "platform engineer", "site reliability",
];

/**
 * Step 1: Link cvFileId to applications + backfill candidate details.
 * Uses candidate.cvUploadId to find the CV file (no table scan needed).
 */
export const step1_linkAndBackfill = internalMutation({
  handler: async (ctx) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_job_active", (q) => q.eq("jobId", HOS_JOB_ID))
      .collect();

    let linked = 0;
    let backfilled = 0;
    let noMatch = 0;

    for (const app of apps) {
      if (!app.isActive) continue;

      const candidate = await ctx.db.get(app.candidateId);
      if (!candidate) continue;

      const updates = {};

      // Link CV file if missing
      if (!app.cvFileId && candidate.cvUploadId) {
        const cv = await ctx.db.get(candidate.cvUploadId);
        if (cv) {
          updates.cvFileId = cv._id;
          updates.cvFileName = cv.fileName;
          linked++;
        } else {
          noMatch++;
        }
      } else if (!app.cvFileId) {
        noMatch++;
      }

      // Backfill candidate details
      if (candidate.fullName) updates.candidateName = candidate.fullName;
      if (candidate.email) updates.candidateEmail = candidate.email;
      if (candidate.phone) updates.candidatePhone = candidate.phone;
      if (candidate.currentJobTitle) updates.candidateTitle = candidate.currentJobTitle;
      if (candidate.totalExperienceYears !== undefined) updates.candidateExperience = candidate.totalExperienceYears;
      if (candidate.currentSalary !== undefined) updates.candidateCurrentSalary = candidate.currentSalary;
      if (candidate.expectedSalary !== undefined) updates.candidateExpectedSalary = candidate.expectedSalary;
      if (candidate.noticePeriodDays !== undefined) updates.candidateNoticePeriodDays = candidate.noticePeriodDays;

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(app._id, updates);
        backfilled++;
      }
    }

    return { linked, backfilled, noMatch, total: apps.length };
  },
});

/**
 * Step 2: Sort IT candidates from Sales job to IT job.
 */
export const step2_sortToIT = internalMutation({
  handler: async (ctx) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_job_active", (q) => q.eq("jobId", HOS_JOB_ID))
      .collect();

    let movedToIT = 0;
    let keptInSales = 0;
    let unparsed = 0;

    for (const app of apps) {
      if (!app.isActive) continue;

      const candidate = await ctx.db.get(app.candidateId);
      if (!candidate || !candidate.fullName) {
        unparsed++;
        continue;
      }

      const titleLower = (candidate.currentJobTitle || "").toLowerCase();
      const skillsStr = (candidate.skills || []).join(" ").toLowerCase();
      const combined = titleLower + " " + skillsStr;

      const isIT = IT_KEYWORDS.some((kw) => combined.includes(kw));

      if (isIT) {
        // Check if already has an app in the IT job
        const existingITApp = await ctx.db
          .query("applications")
          .withIndex("by_candidate_job", (q) =>
            q.eq("candidateId", app.candidateId).eq("jobId", HOIT_JOB_ID)
          )
          .first();

        if (!existingITApp) {
          await ctx.db.insert("applications", {
            candidateId: app.candidateId,
            jobId: HOIT_JOB_ID,
            cvFileId: app.cvFileId,
            cvFileName: app.cvFileName,
            sourceChannel: app.sourceChannel,
            candidateName: candidate.fullName,
            candidateEmail: candidate.email,
            candidatePhone: candidate.phone,
            candidateTitle: candidate.currentJobTitle,
            candidateExperience: candidate.totalExperienceYears,
            candidateCurrentSalary: candidate.currentSalary,
            candidateExpectedSalary: candidate.expectedSalary,
            candidateNoticePeriodDays: candidate.noticePeriodDays,
            currentStage: "new_cvs",
            createdAt: Date.now(),
            lastStageChangedAt: Date.now(),
            loopIteration: 1,
            isActive: true,
          });
        }

        // Deactivate from Sales job
        await ctx.db.patch(app._id, { isActive: false });

        // Update cvUpload to point to IT job
        if (app.cvFileId) {
          await ctx.db.patch(app.cvFileId, { assignToJob: HOIT_JOB_ID });
        }

        movedToIT++;
      } else {
        keptInSales++;
      }
    }

    return { movedToIT, keptInSales, unparsed, total: apps.length };
  },
});

/**
 * Step 3: Recompute totalApplications and stageCounts for both jobs.
 */
export const step3_recomputeStats = internalMutation({
  handler: async (ctx) => {
    const jobIds = [HOS_JOB_ID, HOIT_JOB_ID];
    const results = [];

    for (const jobId of jobIds) {
      const apps = await ctx.db
        .query("applications")
        .withIndex("by_job_active", (q) => q.eq("jobId", jobId))
        .collect();

      const stageCounts = {};
      let totalApplications = 0;

      for (const app of apps) {
        if (!app.isActive) continue;
        totalApplications++;
        const stage = app.currentStage;
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      }

      await ctx.db.patch(jobId, { totalApplications, stageCounts });
      results.push({ jobId, totalApplications, stageCounts });
    }

    return results;
  },
});
