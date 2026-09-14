import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export const getShortlistForExport = internalQuery({
  args: {
    jobId: v.id("jobs"),
    selectedApplicationIds: v.optional(v.array(v.id("applications"))),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    let apps = await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();

    if (args.selectedApplicationIds && args.selectedApplicationIds.length > 0) {
      const selectedSet = new Set(args.selectedApplicationIds);
      apps = apps.filter((a) => selectedSet.has(a._id));
    } else {
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
      apps = apps.filter(
        (a) =>
          shortlistedStages.includes(a.currentStage) ||
          a.taShortlistStatus === "shortlisted"
      );
    }

    const recruiter = job.primaryRecruiterId
      ? await ctx.db.get(job.primaryRecruiterId)
      : null;
    const recruiterName = recruiter ? recruiter.fullName : "Recruiter";

    const candidates = await Promise.all(
      apps.map(async (app) => {
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
          notes: (app as any).notes || (app as any).masterSheetNotes || "",
          masterSheetStatus: (app as any).masterSheetStatus || "Shortlisted",
        };
      })
    );

    return {
      job: {
        _id: job._id,
        title: job.title,
        clientName: job.clientName,
      },
      candidates,
    };
  },
});
