import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Creates or updates the test candidate with email from process.env.EMAIL_TEST_RECIPIENT
 * and places their application under 'Follow-up Test Job' in the 'new_cvs' stage.
 */
export const seedBinatTestCandidate = mutation({
  args: {
    stage: v.optional(v.string()), // defaults to "new_cvs"
  },
  handler: async (ctx, args) => {
    const targetEmail = process.env.EMAIL_TEST_RECIPIENT || "hipergrin@gmail.com";
    const senderEmail = process.env.MS_SENDER_EMAIL || process.env.OUTBOUND_EMAIL_SENDER || "job@career141.com";
    const targetStage = (args.stage || "new_cvs") as any;

    // 1. Find active user/recruiter
    const users = await ctx.db.query("users").collect();
    const activeUser = users.find((u) => u.isActive) || users[0];
    if (!activeUser) {
      throw new Error("No active user found in database to assign as primary recruiter.");
    }

    // 2. Find or create job "Follow-up Test"
    let jobs = await ctx.db.query("jobs").collect();
    let job = jobs.find((j) => j.title === "Follow-up Test" || j.title === "Follow-up Test Job" || j.keyword === "DEV-TEST");

    if (!job) {
      const jobId = await ctx.db.insert("jobs", {
        title: "Follow-up Test",
        clientName: "Career141 Systems",
        clientIndustry: "Technology",
        recruitmentType: "both",
        isConfidential: false,
        jobDescription: "Test job for dynamic AI email follow-up sequence verification.",
        requiredSkills: ["Next.js", "TypeScript", "Convex", "Node.js"],
        niceToHaveSkills: ["TailwindCSS", "AWS"],
        seniorityLevel: "senior_executive",
        experienceMinYears: 3,
        location: "Remote",
        keyword: "DEV-TEST",
        status: "active",
        primaryRecruiterId: activeUser._id,
        directorId: activeUser._id,
        directorReviewEnabled: false,
        clientReviewEnabled: false,
        esaCheckEnabled: false,
        rejectionLoopAction: "restart_from_new_cvs",
        headhuntingEnabled: false,
        agent3AfterDay7: "mark_unresponsive",
        agent5Trigger: "manual_only",
        agent5CallScript: "default",
        agent5NoAnswerAction: "notify_ta",
        enableEmailFollowUp: true,
        enableWhatsAppFollowUp: true,
        followUpInitialTemplate: "Hi {candidate_name},\n\nThank you for your interest in {job_title} at {company_name}.\n\nWe need the following details to proceed:\n{missing_fields}\n\nPlease reply at your earliest convenience.\n\nBest regards,\nTalent Acquisition",
        followUpSampleTemplate: "Hi {candidate_name},\n\nJust checking in regarding your application for {job_title}.\n\nWe are still missing:\n{missing_fields}\n\nPlease let us know when you can provide these details.\n\nBest regards,\nTalent Acquisition",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      job = (await ctx.db.get(jobId))!;
    }

    // Ensure job channel for senderEmail exists
    const existingChannel = await ctx.db
      .query("jobChannels")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .filter((q) => q.eq(q.field("channelType"), "email_campaign"))
      .first();

    if (!existingChannel) {
      await ctx.db.insert("jobChannels", {
        jobId: job._id,
        channelType: "email_campaign",
        isEnabled: true,
        emailInbox: senderEmail,
        cvCountToday: 0,
        cvCountTotal: 0,
        agentStatus: "active",
        createdAt: new Date().toISOString(),
      });
    }

    // 3. Find or create candidate with targetEmail
    let candidate = await ctx.db
      .query("candidates")
      .withIndex("by_email", (q) => q.eq("email", targetEmail))
      .first();

    if (!candidate) {
      const candidateId = await ctx.db.insert("candidates", {
        fullName: "Test Candidate",
        email: targetEmail,
        phone: "+94742625552",
        status: "active",
        overallStatus: targetStage,
        currentEmployer: "Career141",
        currentJobTitle: "Senior Software Engineer",
        currentTitle: "Senior Software Engineer",
        location: "Colombo, Sri Lanka",
        totalExperienceYears: 4,
        yearsOfExperience: 4,
        skills: ["TypeScript", "Next.js", "React", "Node.js", "Convex"],
        summary: "Test candidate for AI email follow-up pipeline automation.",
        isParsed: true,
      });
      candidate = (await ctx.db.get(candidateId))!;
    } else {
      await ctx.db.patch(candidate._id, {
        fullName: "Test Candidate",
        email: targetEmail,
        overallStatus: targetStage,
      });
    }

    // 4. Find or create application in targetStage (new_cvs)
    let app = await ctx.db
      .query("applications")
      .withIndex("by_candidate_job", (q) =>
        q.eq("candidateId", candidate._id).eq("jobId", job._id)
      )
      .first();

    const now = Date.now();
    if (!app) {
      const appId = await ctx.db.insert("applications", {
        candidateId: candidate._id,
        jobId: job._id,
        sourceChannel: "email",
        currentStage: targetStage,
        candidateName: candidate.fullName,
        candidateEmail: targetEmail,
        candidatePhone: candidate.phone,
        candidateTitle: candidate.currentTitle,
        candidateExperience: candidate.totalExperienceYears,
        aiMatchScore: 92,
        createdAt: now,
        lastStageChangedAt: now,
        followUpEnteredAt: now,
        isActive: true,
        loopIteration: 1,
        followUpAttemptCount: 0,
        followUpCvReceived: false,
        followUpCurrentSalary: false,
        followUpExpectedSalary: false,
        followUpNoticePeriod: false,
        stageHistory: [
          {
            stage: targetStage,
            enteredAt: new Date(now).toISOString(),
            changedBy: "system",
            note: "Seeded for test candidate email follow-up verification in new_cvs stage",
          },
        ],
      });
      app = (await ctx.db.get(appId))!;
    } else {
      await ctx.db.patch(app._id, {
        currentStage: targetStage,
        candidateEmail: targetEmail,
        lastStageChangedAt: now,
        followUpCvReceived: false,
        followUpCurrentSalary: false,
        followUpExpectedSalary: false,
        followUpNoticePeriod: false,
      });
    }

    console.log(
      `[Seed Test Candidate] Successfully seeded test candidate ${targetEmail} under job '${job.title}' (${job._id}) at stage '${targetStage}'`
    );

    return {
      success: true,
      jobId: job._id,
      candidateId: candidate._id,
      applicationId: app._id,
      candidateEmail: targetEmail,
      senderEmail,
      stage: targetStage,
    };
  },
});

export const seedFollowUpTestCandidate = seedBinatTestCandidate;

export const clearTestCandidateDetails = mutation({
  args: {},
  handler: async (ctx) => {
    const targetEmail = process.env.EMAIL_TEST_RECIPIENT || "hipergrin@gmail.com";

    // 1. Find candidate
    const candidate = await ctx.db
      .query("candidates")
      .withIndex("by_email", (q) => q.eq("email", targetEmail))
      .first();

    if (candidate) {
      // Clear profile fields
      await ctx.db.patch(candidate._id, {
        currentSalary: undefined,
        expectedSalary: undefined,
        noticePeriod: undefined,
        noticePeriodDays: undefined,
        cvUploadId: undefined,
      });

      // Find applications for candidate
      const apps = await ctx.db
        .query("applications")
        .withIndex("by_candidateId", (q) => q.eq("candidateId", candidate._id))
        .collect();

      for (const app of apps) {
        await ctx.db.patch(app._id, {
          followUpCvReceived: false,
          followUpCurrentSalary: false,
          followUpExpectedSalary: false,
          followUpNoticePeriod: false,
          followUpAttemptCount: 0,
          nextFollowUpScheduledAt: undefined,
          nextFollowUpMessage: undefined,
          customFollowUpAnswers: {},
          flaggedForTaReview: false,
          taReviewReason: undefined,
        });
      }
    }

    console.log(`[Clear Details] Successfully reset details and follow-up flags for ${targetEmail}`);
    return { success: true, email: targetEmail };
  },
});

export const removeBinatCandidate = mutation({
  args: {},
  handler: async (ctx) => {
    const candidates = await ctx.db.query("candidates").collect();
    let removedCount = 0;
    for (const c of candidates) {
      if (c.email === "binat@career141.com" || c.email === "binath@career141.com" || c.fullName === "Binat Test Candidate") {
        const apps = await ctx.db.query("applications").withIndex("by_candidateId", (q) => q.eq("candidateId", c._id)).collect();
        for (const app of apps) {
          await ctx.db.delete(app._id);
        }
        await ctx.db.delete(c._id);
        removedCount++;
      }
    }
    return { success: true, removedCount };
  },
});
