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
    for (const app of apps) {
      const candidate = await ctx.db.get(app.candidateId);

      let recruiterName = "TA Team";
      if (app.taShortlistById) {
        const user = await ctx.db.get(app.taShortlistById);
        if (user) recruiterName = user.fullName;
      }

      rows.push({
        applicationId: app._id,
        candidateId: app.candidateId,
        dateShortlisted: app.taShortlistAt
          ? new Date(app.taShortlistAt).toISOString().split("T")[0]
          : new Date(typeof app.createdAt === "number" ? app.createdAt : Date.now())
              .toISOString()
              .split("T")[0],
        candidateName: app.candidateName || candidate?.fullName || "Candidate",
        role: app.candidateTitle || job.title,
        email: app.candidateEmail || candidate?.email || "N/A",
        phone: app.candidatePhone || candidate?.phone || "N/A",
        experienceYears:
          app.candidateExperience !== undefined
            ? `${app.candidateExperience} yrs`
            : candidate?.totalExperienceYears !== undefined
              ? `${candidate.totalExperienceYears} yrs`
              : "N/A",
        matchScore: app.aiMatchScore ? `${Math.round(app.aiMatchScore)}%` : "N/A",
        stage: app.currentStage,
        shortlistedBy: recruiterName,
        notes: app.notes || app.manualCallOutcome || "",
        sharepointRowSyncedAt: app.sharepointRowSyncedAt,
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
