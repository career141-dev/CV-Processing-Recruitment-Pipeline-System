import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { normalizeExcelShareUrl } from "./excelUrlHelper";

// ─────────────────────────────────────────────────────────────────────────────
// MUTATION: Connect / Update Master Sheet Link for a Job
// ─────────────────────────────────────────────────────────────────────────────
export const updateJobMasterSheetConfig = mutation({
  args: {
    jobId: v.id("jobs"),
    excelMasterSheetUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const rawUrl = args.excelMasterSheetUrl.trim();
    if (!rawUrl) {
      throw new Error("Please enter a valid OneDrive or SharePoint link.");
    }

    const { cleanUrl, embedUrl } = normalizeExcelShareUrl(rawUrl);

    // Save initial config to the job
    await ctx.db.patch(args.jobId, {
      excelMasterSheetUrl: cleanUrl,
      excelMasterSheetEmbedUrl: embedUrl,
      excelMasterSheetSyncStatus: "idle",
      excelMasterSheetError: undefined,
      updatedAt: new Date().toISOString(),
    });

    // Schedule background Graph action to resolve file details
    await ctx.scheduler.runAfter(0, internal.integrations.excelSync.resolveMasterSheet, {
      jobId: args.jobId,
      excelMasterSheetUrl: cleanUrl,
    });

    return { success: true, embedUrl };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MUTATION: Disconnect / Remove Master Sheet from a Job
// ─────────────────────────────────────────────────────────────────────────────
export const removeJobMasterSheetConfig = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      excelMasterSheetUrl: undefined,
      excelMasterSheetEmbedUrl: undefined,
      excelMasterSheetDriveId: undefined,
      excelMasterSheetItemId: undefined,
      excelMasterSheetName: undefined,
      excelMasterSheetLastSyncedAt: undefined,
      excelMasterSheetSyncStatus: undefined,
      excelMasterSheetError: undefined,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MUTATION: Trigger Batch Sync All Shortlisted Candidates (from UI)
// ─────────────────────────────────────────────────────────────────────────────
export const triggerSyncAllShortlisted = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal.integrations.excelSync.syncAllShortlistedForJob, {
      jobId: args.jobId,
    });
    return { success: true };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// QUERY: Get Job Master Sheet Details for UI
// ─────────────────────────────────────────────────────────────────────────────
export const getJobMasterSheetDetails = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    return {
      excelMasterSheetUrl: job.excelMasterSheetUrl,
      excelMasterSheetEmbedUrl: job.excelMasterSheetEmbedUrl,
      excelMasterSheetName: job.excelMasterSheetName,
      excelMasterSheetLastSyncedAt: job.excelMasterSheetLastSyncedAt,
      excelMasterSheetSyncStatus: job.excelMasterSheetSyncStatus ?? "idle",
      excelMasterSheetError: job.excelMasterSheetError,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL QUERY: Get Job Master Sheet Details for Background Actions
// ─────────────────────────────────────────────────────────────────────────────
export const getInternalJobMasterSheetDetails = internalQuery({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    return {
      excelMasterSheetUrl: job.excelMasterSheetUrl,
      excelMasterSheetEmbedUrl: job.excelMasterSheetEmbedUrl,
      excelMasterSheetDriveId: job.excelMasterSheetDriveId,
      excelMasterSheetItemId: job.excelMasterSheetItemId,
      excelMasterSheetName: job.excelMasterSheetName,
      excelMasterSheetLastSyncedAt: job.excelMasterSheetLastSyncedAt,
      excelMasterSheetSyncStatus: job.excelMasterSheetSyncStatus ?? "idle",
      excelMasterSheetError: job.excelMasterSheetError,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL MUTATION: Update Drive Item details from Graph resolution
// ─────────────────────────────────────────────────────────────────────────────
export const updateMasterSheetDriveDetails = internalMutation({
  args: {
    jobId: v.id("jobs"),
    driveId: v.optional(v.string()),
    itemId: v.optional(v.string()),
    name: v.optional(v.string()),
    syncStatus: v.union(v.literal("idle"), v.literal("syncing"), v.literal("synced"), v.literal("error")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      excelMasterSheetDriveId: args.driveId,
      excelMasterSheetItemId: args.itemId,
      excelMasterSheetName: args.name,
      excelMasterSheetSyncStatus: args.syncStatus,
      excelMasterSheetError: args.error,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL MUTATION: Update sync status and timestamp
// ─────────────────────────────────────────────────────────────────────────────
export const setExcelSyncStatus = internalMutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(v.literal("idle"), v.literal("syncing"), v.literal("synced"), v.literal("error")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patchData: any = {
      excelMasterSheetSyncStatus: args.status,
      excelMasterSheetError: args.error,
    };
    if (args.status === "synced") {
      patchData.excelMasterSheetLastSyncedAt = Date.now();
    }
    await ctx.db.patch(args.jobId, patchData);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL MUTATION: Mark Application as Synced to Excel
// ─────────────────────────────────────────────────────────────────────────────
export const markApplicationExcelSynced = internalMutation({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.applicationId, {
      excelSyncedAt: Date.now(),
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL QUERY: Get Candidate Application details for Excel Sync
// ─────────────────────────────────────────────────────────────────────────────
export const getCandidateForExcelSync = internalQuery({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) return null;

    let candidateName = app.candidateName || "";
    let candidateEmail = app.candidateEmail || "";
    let candidatePhone = app.candidatePhone || "";
    let role = app.candidateTitle || "";
    let experience = app.candidateExperience ?? 0;

    if (app.candidateId) {
      const candidate = await ctx.db.get(app.candidateId);
      if (candidate) {
        if (!candidateName) candidateName = candidate.fullName || "";
        if (!candidateEmail) candidateEmail = candidate.email || "";
        if (!candidatePhone) candidatePhone = candidate.phone || "";
        if (!role) role = candidate.currentTitle || "";
        if (!experience && candidate.totalExperienceYears) experience = candidate.totalExperienceYears;
      }
    }

    let recruiterName = "TA Team";
    if (app.taShortlistById) {
      const user = await ctx.db.get(app.taShortlistById);
      if (user) recruiterName = user.fullName;
    }

    return {
      applicationId: app._id,
      candidateName,
      candidateEmail,
      candidatePhone,
      role,
      experience,
      aiMatchScore: app.aiMatchScore ?? null,
      currentStage: app.currentStage,
      shortlistedAt: app.taShortlistAt ?? app.lastStageChangedAt ?? Date.now(),
      recruiterName,
      taStatus: app.masterSheetStatus || "Shortlisted",
      interviewDate: app.masterSheetInterviewDate || "",
      notes: app.masterSheetNotes || app.notes || "",
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// QUERY: Get Master Sheet Grid Data (for in-app interactive spreadsheet)
// ─────────────────────────────────────────────────────────────────────────────
export const getMasterSheetGridData = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const shortlistStages = [
      "ta_shortlist",
      "second_shortlist",
      "director_shortlist",
      "client_review",
      "interview",
      "offer",
      "placed",
    ];

    const apps = await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();

    const shortlisted = apps.filter((a) => shortlistStages.includes(a.currentStage));

    const rows = [];
    for (const app of shortlisted) {
      let candidateName = app.candidateName || "";
      let candidateEmail = app.candidateEmail || "";
      let candidatePhone = app.candidatePhone || "";
      let role = app.candidateTitle || "";
      let experience = app.candidateExperience ?? 0;
      let avatarUrl = "";
      let cvFileId = app.cvFileId;

      if (app.candidateId) {
        const candidate = await ctx.db.get(app.candidateId);
        if (candidate) {
          if (!candidateName) candidateName = candidate.fullName || "";
          if (!candidateEmail) candidateEmail = candidate.email || "";
          if (!candidatePhone) candidatePhone = candidate.phone || "";
          if (!role) role = candidate.currentTitle || "";
          if (!experience && candidate.totalExperienceYears) experience = candidate.totalExperienceYears;
          if (!cvFileId && candidate.cvUploadId) cvFileId = candidate.cvUploadId;
        }
      }

      let recruiterName = "TA Team";
      if (app.taShortlistById) {
        const user = await ctx.db.get(app.taShortlistById);
        if (user) recruiterName = user.fullName;
      }

      rows.push({
        applicationId: app._id,
        candidateId: app.candidateId,
        candidateName,
        candidateEmail,
        candidatePhone,
        role,
        experience,
        aiMatchScore: app.aiMatchScore ?? null,
        currentStage: app.currentStage,
        shortlistedAt: app.taShortlistAt ?? app.lastStageChangedAt ?? (typeof app.createdAt === "number" ? app.createdAt : Date.now()),
        recruiterName,
        taStatus: app.masterSheetStatus || "Shortlisted",
        interviewDate: app.masterSheetInterviewDate || "",
        taNotes: app.masterSheetNotes || app.notes || "",
        excelSyncedAt: app.excelSyncedAt,
        avatarUrl,
        cvFileId,
      });
    }

    // Sort descending by shortlist date
    rows.sort((a, b) => b.shortlistedAt - a.shortlistedAt);
    return rows;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MUTATION: Update Candidate Master Sheet Cell (Inline edit in Career141)
// ─────────────────────────────────────────────────────────────────────────────
export const updateCandidateMasterSheetCell = mutation({
  args: {
    applicationId: v.id("applications"),
    field: v.union(v.literal("status"), v.literal("interviewDate"), v.literal("notes")),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    const patch: any = {};
    if (args.field === "status") {
      patch.masterSheetStatus = args.value;
    } else if (args.field === "interviewDate") {
      patch.masterSheetInterviewDate = args.value;
    } else if (args.field === "notes") {
      patch.masterSheetNotes = args.value;
    }

    await ctx.db.patch(args.applicationId, patch);

    // Schedule background update to SharePoint Excel file
    await ctx.scheduler.runAfter(1000, internal.integrations.excelSync.syncCandidateToMasterSheet, {
      jobId: app.jobId,
      applicationId: args.applicationId,
    });

    return { success: true };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL QUERY: Get all shortlisted candidates for a job
// ─────────────────────────────────────────────────────────────────────────────
export const getShortlistedCandidatesForJob = internalQuery({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    // Stages that represent shortlisted or advanced candidates
    const shortlistStages = [
      "ta_shortlist",
      "second_shortlist",
      "director_shortlist",
      "client_review",
      "interview",
      "offer",
      "placed",
    ];

    const apps = await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();

    const shortlisted = apps.filter((a) => shortlistStages.includes(a.currentStage));

    const results = [];
    for (const app of shortlisted) {
      let candidateName = app.candidateName || "";
      let candidateEmail = app.candidateEmail || "";
      let candidatePhone = app.candidatePhone || "";
      let role = app.candidateTitle || "";
      let experience = app.candidateExperience ?? 0;

      if (app.candidateId) {
        const candidate = await ctx.db.get(app.candidateId);
        if (candidate) {
          if (!candidateName) candidateName = candidate.fullName || "";
          if (!candidateEmail) candidateEmail = candidate.email || "";
          if (!candidatePhone) candidatePhone = candidate.phone || "";
          if (!role) role = candidate.currentTitle || "";
          if (!experience && candidate.totalExperienceYears) experience = candidate.totalExperienceYears;
        }
      }

      let recruiterName = "TA Team";
      if (app.taShortlistById) {
        const user = await ctx.db.get(app.taShortlistById);
        if (user) recruiterName = user.fullName;
      }

      results.push({
        applicationId: app._id,
        candidateName,
        candidateEmail,
        candidatePhone,
        role,
        experience,
        aiMatchScore: app.aiMatchScore ?? null,
        currentStage: app.currentStage,
        shortlistedAt: app.taShortlistAt ?? app.lastStageChangedAt ?? (typeof app.createdAt === "number" ? app.createdAt : Date.now()),
        recruiterName,
        notes: app.notes || "",
      });
    }

    return results;
  },
});
