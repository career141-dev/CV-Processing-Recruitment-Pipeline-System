import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Query job & candidate details needed for Excel row sync
 */
export const getShortlistForExcelSync = internalQuery({
  args: {
    jobId: v.id("jobs"),
    applicationIds: v.optional(v.array(v.id("applications"))),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    let apps = await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();

    // Filter to selected applications if provided, otherwise filter to shortlisted/active pipeline
    if (args.applicationIds && args.applicationIds.length > 0) {
      const idSet = new Set(args.applicationIds);
      apps = apps.filter((a) => idSet.has(a._id));
    } else {
      apps = apps.filter(
        (a) =>
          a.currentStage === "ta_shortlist" ||
          a.currentStage === "second_shortlist" ||
          a.currentStage === "interview" ||
          a.currentStage === "offer" ||
          a.currentStage === "placed" ||
          a.taShortlistStatus === "shortlisted"
      );
    }

    const rows = [];
    for (let idx = 0; idx < apps.length; idx++) {
      const app = apps[idx];
      const candidate = app.candidateId ? await ctx.db.get(app.candidateId) : null;

      let recruiterName = "TA Team";
      if (app.taShortlistById) {
        const user = await ctx.db.get(app.taShortlistById);
        if (user) recruiterName = user.fullName;
      }

      const candidateName = app.candidateName || candidate?.fullName || "Candidate";
      const currentCompany = candidate?.currentEmployer || "—";
      const role = candidate?.currentJobTitle || candidate?.currentTitle || app.candidateTitle || job.title;
      const currentDesignation = role && role !== "Candidate" ? role : "—";
      const experience = app.candidateExperience ?? candidate?.totalExperienceYears ?? 0;

      // Notice period
      let notice = (app as any).candidateNoticePeriodText || candidate?.noticePeriod || "";
      if (!notice) {
        const days = app.candidateNoticePeriodDays ?? candidate?.noticePeriodDays;
        if (days !== undefined && days !== null) {
          if (days === 0) notice = "Immediately";
          else if (days === 14) notice = "2 weeks";
          else if (days <= 21) notice = `${days} days`;
          else if (days <= 35) notice = "1 month";
          else if (days <= 65) notice = "2 months";
          else if (days <= 95) notice = "3 months";
          else notice = `${Math.round(days / 30)} months`;
        } else if (candidate?.availability) {
          notice = candidate.availability;
        } else {
          notice = "Negotiable";
        }
      }

      // Salary formatting
      const formatSalaryString = (val?: number, currency?: string) => {
        if (!val) return null;
        if (val >= 1000) return `${Math.round(val / 1000)}k gross`;
        return `${val} gross`;
      };

      const currentRemuneration =
        (app as any).candidateCurrentRemunerationText ||
        (candidate as any)?.currentRemunerationText ||
        formatSalaryString(app.candidateCurrentSalary || candidate?.currentSalary, candidate?.currentSalaryCurrency) ||
        "—";

      const expectedRemuneration =
        (app as any).candidateExpectedRemunerationText ||
        (candidate as any)?.expectedRemunerationText ||
        formatSalaryString(app.candidateExpectedSalary || candidate?.expectedSalary, candidate?.expectedSalaryCurrency) ||
        "—";

      // Notes
      let notesText = app.notes || (app as any).executiveSummary || (candidate as any)?.executiveSummary || "";
      if (!notesText && app.aiMatchExplanation) {
        notesText = app.aiMatchExplanation;
      }
      if (!notesText) {
        const parts: string[] = [];
        if (currentDesignation !== "—" && experience > 0) {
          parts.push(`${currentDesignation}, with ${experience}+ years of experience${currentCompany !== "—" ? ` at ${currentCompany}` : ""}.`);
        } else if (experience > 0) {
          parts.push(`Experienced professional with ${experience}+ years in the industry.`);
        }
        if (candidate?.skills && candidate.skills.length > 0) {
          parts.push(`Strong expertise in ${candidate.skills.slice(0, 6).join(", ")}.`);
        }
        if (candidate?.educationDegree) {
          parts.push(`Holds ${candidate.educationDegree}${candidate.educationInstitution ? ` from ${candidate.educationInstitution}` : ""}.`);
        }
        notesText = parts.length > 0 ? parts.join(" ") : "Shortlisted candidate for review.";
      }

      rows.push({
        no: idx + 1,
        applicationId: app._id,
        candidateId: app.candidateId,
        dateShortlisted: app.taShortlistAt
          ? new Date(app.taShortlistAt).toISOString().split("T")[0]
          : new Date(typeof app.createdAt === "number" ? app.createdAt : Date.now())
              .toISOString()
              .split("T")[0],
        candidateName,
        role,
        email: app.candidateEmail || candidate?.email || "N/A",
        phone: app.candidatePhone || candidate?.phone || "N/A",
        experienceYears: experience ? `${experience} yrs` : "N/A",
        matchScore: app.aiMatchScore ? `${Math.round(app.aiMatchScore)}%` : "N/A",
        stage: app.currentStage,
        shortlistedBy: recruiterName,
        notes: notesText,
        sharepointRowSyncedAt: app.sharepointRowSyncedAt,
        // 8-column properties:
        notice,
        currentCompany,
        currentDesignation,
        currentRemuneration,
        expectedRemuneration,
      });
    }

    return {
      job: {
        _id: job._id,
        title: job.title,
        clientName: job.clientName,
        sharepointExcelUrl: job.sharepointExcelUrl,
        sharepointExcelFileId: job.sharepointExcelFileId,
        sharepointExcelLastSyncedAt: job.sharepointExcelLastSyncedAt,
      },
      candidates: rows,
    };
  },
});

/**
 * Mutation to mark synced applications and update job sync timestamp
 */
export const recordSharepointSyncSuccess = internalMutation({
  args: {
    jobId: v.id("jobs"),
    applicationIds: v.array(v.id("applications")),
    sharepointExcelUrl: v.optional(v.string()),
    sharepointExcelFileId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const appId of args.applicationIds) {
      await ctx.db.patch(appId, { sharepointRowSyncedAt: now });
    }

    const jobPatch: Record<string, any> = {
      sharepointExcelLastSyncedAt: now,
    };
    if (args.sharepointExcelUrl) jobPatch.sharepointExcelUrl = args.sharepointExcelUrl;
    if (args.sharepointExcelFileId) jobPatch.sharepointExcelFileId = args.sharepointExcelFileId;

    await ctx.db.patch(args.jobId, jobPatch);
  },
});

/**
 * Update SharePoint Excel URL on a Job (called from frontend settings)
 */
export const updateJobSharepointExcelUrl = mutation({
  args: {
    jobId: v.id("jobs"),
    sharepointExcelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      sharepointExcelUrl: args.sharepointExcelUrl.trim(),
    });
    return { success: true };
  },
});

/**
 * Query SharePoint Excel settings for a Job
 */
export const getJobSharepointExcelConfig = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    return {
      sharepointExcelUrl: job.sharepointExcelUrl || null,
      sharepointExcelFileId: job.sharepointExcelFileId || null,
      sharepointExcelLastSyncedAt: job.sharepointExcelLastSyncedAt || null,
    };
  },
});
