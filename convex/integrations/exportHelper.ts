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
      apps.map(async (app, idx) => {
        let candidateName = app.candidateName;
        let candidateEmail = app.candidateEmail;
        let candidatePhone = app.candidatePhone;
        let role = app.candidateTitle || "Candidate";
        let experience = app.candidateExperience || 0;
        let candidate = null;

        if (app.candidateId) {
          candidate = await ctx.db.get(app.candidateId);
          if (candidate) {
            candidateName = candidateName || candidate.fullName;
            candidateEmail = candidateEmail || candidate.email;
            candidatePhone = candidatePhone || candidate.phone;
            role = candidate.currentJobTitle || candidate.currentTitle || role;
            experience = experience || candidate.totalExperienceYears || 0;
          }
        }

        // 1. Resolve Company
        const currentCompany = candidate?.currentEmployer || "—";

        // 2. Resolve Designation
        const currentDesignation = role && role !== "Candidate" ? role : "—";

        // 3. Resolve Notice Period
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

        // 4. Helper to format salary
        const formatSalaryString = (val?: number, currency?: string) => {
          if (!val) return null;
          if (val >= 1000) {
            return `${Math.round(val / 1000)}k gross`;
          }
          return `${val} gross`;
        };

        // 5. Resolve Current Remuneration
        const currentRemuneration =
          (app as any).candidateCurrentRemunerationText ||
          (candidate as any)?.currentRemunerationText ||
          formatSalaryString(app.candidateCurrentSalary || candidate?.currentSalary, candidate?.currentSalaryCurrency) ||
          "—";

        // 6. Resolve Expected Remuneration
        const expectedRemuneration =
          (app as any).candidateExpectedRemunerationText ||
          (candidate as any)?.expectedRemunerationText ||
          formatSalaryString(app.candidateExpectedSalary || candidate?.expectedSalary, candidate?.expectedSalaryCurrency) ||
          "—";

        // 7. Resolve Executive Notes / Summary
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

        return {
          no: idx + 1,
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
          notes: notesText,
          masterSheetStatus: (app as any).masterSheetStatus || "Shortlisted",
          // Exact 8-column properties:
          name: candidateName || "Unknown Candidate",
          notice,
          currentCompany,
          currentDesignation,
          currentRemuneration,
          expectedRemuneration,
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
