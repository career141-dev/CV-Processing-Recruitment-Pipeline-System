import { v } from "convex/values";
import { query, mutation } from "../_generated/server";

// ─────────────────────────────────────────────────────────────────────────────
// QUERY: Fetch job spreadsheet data or generate default candidate rows
// ─────────────────────────────────────────────────────────────────────────────
export const getJobSpreadsheetData = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    // 1. Fetch all applications for this job (ordered by creation/stage)
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();

    // Filter to shortlisted or active stage candidates
    const shortlistedStages = [
      "ta_shortlist",
      "ai_call",
      "follow_up",
      "second_shortlist",
      "director_shortlist",
      "client_review",
      "interview",
      "offer",
      "placed",
    ];

    const shortlistedApps = apps.filter(
      (a) => shortlistedStages.includes(a.currentStage) || a.taShortlistStatus === "shortlisted"
    );

    // Fetch recruiter info
    const recruiter = job.primaryRecruiterId
      ? await ctx.db.get(job.primaryRecruiterId)
      : null;
    const recruiterName = recruiter ? recruiter.fullName : "Recruiter";

    const candidateRows = await Promise.all(
      shortlistedApps.map(async (app) => {
        let candidateName = app.candidateName;
        let candidateEmail = app.candidateEmail;
        let candidatePhone = app.candidatePhone;
        let role = app.candidateTitle || "Candidate";
        let experience = app.candidateExperience || 0;

        if (!candidateName || !candidateEmail) {
          const candidate = await ctx.db.get(app.candidateId);
          if (candidate) {
            candidateName = candidateName || candidate.fullName;
            candidateEmail = candidateEmail || candidate.email;
            candidatePhone = candidatePhone || candidate.phone;
            role = role || candidate.currentTitle || "Candidate";
            experience = experience || candidate.totalExperienceYears || 0;
          }
        }

        return {
          applicationId: app._id,
          candidateName: candidateName || "Unknown Candidate",
          candidateEmail: candidateEmail || "-",
          candidatePhone: candidatePhone || "-",
          role: role || "-",
          experience: experience || 0,
          aiMatchScore: app.aiMatchScore ?? null,
          currentStage: app.currentStage,
          shortlistedAt: app.taShortlistAt || app._creationTime,
          recruiterName,
          notes: (app as any).notes || "",
        };
      })
    );

    return {
      savedSpreadsheetData: job.masterSpreadsheetData || null,
      lastSavedAt: job.masterSpreadsheetLastSavedAt || null,
      lastSavedBy: job.masterSpreadsheetLastSavedBy || null,
      candidateRows,
      jobTitle: job.title,
      clientName: job.clientName,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MUTATION: Save entire workbook state to the job record
// ─────────────────────────────────────────────────────────────────────────────
export const saveJobSpreadsheetData = mutation({
  args: {
    jobId: v.id("jobs"),
    spreadsheetData: v.string(), // JSON string representing FortuneSheet workbook data
    savedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    await ctx.db.patch(args.jobId, {
      masterSpreadsheetData: args.spreadsheetData,
      masterSpreadsheetLastSavedAt: Date.now(),
      masterSpreadsheetLastSavedBy: args.savedBy || "Recruiter",
    });

    return { success: true, savedAt: Date.now() };
  },
});
