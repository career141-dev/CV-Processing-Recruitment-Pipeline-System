import { query, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { requireUser, requireJobAssignment } from "../lib/permissions";
import { checkAndAdvanceFollowUp, updateFollowUpFlags, initiateFollowUpOutreach } from "../pipeline/followUpHelper";
import { syncCandidateOverallStatus } from "../candidates/candidates";
import { adjustJobStageStat } from "../jobs/stats";
import { adjustGlobalStat } from "../stats/statsHelper";
export const getApplicationsByCandidateId = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", args.candidateId))
      .collect();
  }
});

export const triggerManualAiCall = mutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    // 1. Create AI call record
    const callId = await ctx.db.insert("aiCalls", {
      candidateId: args.candidateId,
      applicationId: args.applicationId,
      jobId: args.jobId,
      triggerType: "manual_ta_trigger",
      callStatus: "in_progress",
      callScriptUsed: "initial_screening",
      companyHidden: false,
      calledAt: Date.now(),
      followUpTriggered: false,
      attempts: 1,
      firstAttemptAt: Date.now(),
      attemptNumber: 1
    });

    // 2. Schedule ElevenLabs call
    await ctx.scheduler.runAfter(0, internal.integrations.elevenlabs.triggerIntakeCall, {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      jobId: args.jobId,
    });

    // 3. Log event
    await ctx.db.insert("pipelineEvents", {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      jobId: args.jobId,
      eventType: "ai_call_triggered",
      actorType: "user",
      createdAt: Date.now(),
      notes: "Manual AI call triggered"
    });

    return callId;
  }
});

export const getByJobId = query({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    let actualJobId = ctx.db.normalizeId("jobs", args.jobId);
    if (!actualJobId) {
      const job = await ctx.db.query("jobs").withIndex("by_keyword", q => q.eq("keyword", args.jobId)).first();
      if (!job) return [];
      actualJobId = job._id;
    }

    const rawApps = await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", actualJobId!))
      .collect();

    const applications = rawApps.filter(app => app.isActive !== false);

    const enriched = (await Promise.all(applications.map(async (app) => {
      const dbCandidate = await ctx.db.get(app.candidateId);
      
      const cvUploadId = dbCandidate?.cvUploadId || app.candidateCvUploadId;
      if (cvUploadId) {
        const cvUpload = await ctx.db.get(cvUploadId as any);
        if (cvUpload && (cvUpload as any).isMissingMigrationFile) {
          return null; // Hide candidates that are pending migration
        }
      }

      let candidateObj: any = dbCandidate ? {
        ...dbCandidate,
        fullName: dbCandidate.fullName || app.candidateName || "Unknown Candidate",
        email: dbCandidate.email || app.candidateEmail,
        phone: dbCandidate.phone || app.candidatePhone,
        currentTitle: dbCandidate.currentJobTitle || dbCandidate.currentTitle || app.candidateTitle,
        totalExperienceYears: dbCandidate.totalExperienceYears ?? app.candidateExperience,
        cvUploadId: cvUploadId,
        currentSalary: dbCandidate.currentSalary ?? app.candidateCurrentSalary,
        expectedSalary: dbCandidate.expectedSalary ?? app.candidateExpectedSalary,
        noticePeriodDays: dbCandidate.noticePeriodDays ?? app.candidateNoticePeriodDays,
      } : {
        _id: app.candidateId,
        fullName: app.candidateName ?? "Unknown Candidate",
        email: app.candidateEmail,
        phone: app.candidatePhone,
        currentTitle: app.candidateTitle,
        totalExperienceYears: app.candidateExperience,
        cvUploadId: cvUploadId,
        currentSalary: app.candidateCurrentSalary,
        expectedSalary: app.candidateExpectedSalary,
        noticePeriodDays: app.candidateNoticePeriodDays,
      };

      return {
        ...app,
        candidate: candidateObj,
        cv: app.cvFileName ? { fileName: app.cvFileName } : (cvUploadId ? { storageId: cvUploadId } : null),
      };
    }))).filter(Boolean);

    return enriched;

    return enriched;
  },
});

// All applications for a single candidate, joined with job details
export const getByCandidate = query({
  args: { candidateId: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let validId = ctx.db.normalizeId("candidates", args.candidateId);
    if (!validId) {
      const upload = await ctx.db.get(args.candidateId as any);
      if (upload && (upload as any).candidateId) {
        validId = (upload as any).candidateId;
      }
    }
    if (!validId) return [];

    const applications = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", validId!))
      .collect();

    return await Promise.all(
      applications.map(async (app) => {
        const job = await ctx.db.get(app.jobId);
        return {
          ...app,
          jobTitle: job?.title ?? "Unknown Job",
          clientName: job?.clientName ?? "",
        };
      })
    );
  },
});

// Unresponsive candidates for a specific job (to show inside the Follow-up tab)
export const getUnresponsiveForJob = query({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    let actualJobId = ctx.db.normalizeId("jobs", args.jobId);
    if (!actualJobId) {
      const jobRecord = await ctx.db
        .query("jobs")
        .withIndex("by_keyword", (q) => q.eq("keyword", args.jobId))
        .first();
      if (!jobRecord) return [];
      actualJobId = jobRecord._id;
    }

    const applications = await ctx.db
      .query("applications")
      .withIndex("by_job_stage", (q) => q.eq("jobId", actualJobId!).eq("currentStage", "unresponsive"))
      .collect();

    const now = Date.now();

    // Cache the job fetch — all applications are for the same job
    const job = await ctx.db.get(actualJobId);
    const jobTitle = job?.title ?? "Unknown Job";

    return await Promise.all(
      applications.map(async (app) => {
        // Use denormalized data first, fallback to scalar-only candidate fetch
        let candidateName = app.candidateName;
        let candidatePhone = app.candidatePhone;
        let candidateEmail = app.candidateEmail;
        let currentSalary = app.candidateCurrentSalary;
        let expectedSalary = app.candidateExpectedSalary;
        let noticePeriodDays = app.candidateNoticePeriodDays;
        let cvUploadId = app.candidateCvUploadId;

        if (!candidateName) {
          const candidate = await ctx.db.get(app.candidateId);
          if (candidate) {
            candidateName = candidate.fullName;
            candidatePhone = candidate.phone;
            candidateEmail = candidate.email;
            currentSalary = candidate.currentSalary;
            expectedSalary = candidate.expectedSalary;
            noticePeriodDays = candidate.noticePeriodDays;
            cvUploadId = candidate.cvUploadId;
          }
        }

        // Compute which fields are still missing
        const missingFields: string[] = [];
        const hasCV = app.followUpCvReceived === true ||
          (app.followUpCvReceived === undefined && (!!cvUploadId || !!app.cvFileId));
        const hasCurrentSalary = app.followUpCurrentSalary === true ||
          (app.followUpCurrentSalary === undefined && currentSalary !== undefined);
        const hasExpectedSalary = app.followUpExpectedSalary === true ||
          (app.followUpExpectedSalary === undefined && expectedSalary !== undefined);
        const hasNoticePeriod = app.followUpNoticePeriod === true ||
          (app.followUpNoticePeriod === undefined && noticePeriodDays !== undefined);

        if (!hasCV) missingFields.push("CV");
        if (!hasCurrentSalary) missingFields.push("Current Salary");
        if (!hasExpectedSalary) missingFields.push("Expected Salary");
        if (!hasNoticePeriod) missingFields.push("Notice Period");

        const daysUnresponsive = app.lastStageChangedAt
          ? Math.floor((now - app.lastStageChangedAt) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          applicationId: app._id,
          candidateId: app.candidateId,
          candidateName: candidateName ?? "Unknown",
          candidatePhone: candidatePhone ?? null,
          candidateEmail: candidateEmail ?? null,
          jobTitle,
          missingFields,
          daysUnresponsive,
          lastStageChangedAt: app.lastStageChangedAt,
          currentSalary,
          expectedSalary,
          noticePeriodDays,
          hasCurrentSalary,
          hasExpectedSalary,
          hasNoticePeriod,
        };
      })
    );
  },
});



// Chronological event log for a candidate (newest first)
export const getCandidateTimeline = query({
  args: { candidateId: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let validId = ctx.db.normalizeId("candidates", args.candidateId);
    if (!validId) {
      const upload = await ctx.db.get(args.candidateId as any);
      if (upload && (upload as any).candidateId) {
        validId = (upload as any).candidateId;
      }
    }
    if (!validId) return [];

    const events = await ctx.db
      .query("pipelineEvents")
      .withIndex("by_candidate", (q) => q.eq("candidateId", validId!))
      .order("desc")
      .collect();

    // Cache job lookups to avoid N+1 reads
    const jobCache = new Map<string, string>();
    return await Promise.all(
      events.map(async (e) => {
        let jobTitle = jobCache.get(e.jobId);
        if (jobTitle === undefined) {
          const job = await ctx.db.get(e.jobId);
          jobTitle = job?.title ?? "Unknown Job";
          jobCache.set(e.jobId, jobTitle);
        }
        return { ...e, jobTitle };
      })
    );
  },
});

// AI call log for a candidate (newest first)
export const getCandidateAiCalls = query({
  args: { candidateId: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let validId = ctx.db.normalizeId("candidates", args.candidateId);
    if (!validId) {
      const upload = await ctx.db.get(args.candidateId as any);
      if (upload && (upload as any).candidateId) {
        validId = (upload as any).candidateId;
      }
    }
    if (!validId) return [];

    const calls = await ctx.db
      .query("aiCalls")
      .withIndex("by_candidate", (q) => q.eq("candidateId", validId!))
      .order("desc")
      .collect();

    // Cache job lookups to avoid N+1 reads
    const jobCache = new Map<string, string>();
    return await Promise.all(
      calls.map(async (call) => {
        let jobTitle = jobCache.get(call.jobId);
        if (jobTitle === undefined) {
          const job = await ctx.db.get(call.jobId);
          jobTitle = job?.title ?? "Unknown Job";
          jobCache.set(call.jobId, jobTitle);
        }
        return { ...call, jobTitle };
      })
    );
  },
});

export const createApplication = mutation({
  args: {
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    cvFileId: v.optional(v.id("cvUploads")),
    sourceChannel: v.string(),
    metaCampaignId: v.optional(v.string()),
    metaSourceUrl: v.optional(v.string()),
    metaSourceId: v.optional(v.string()),
    metaHeadline: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if application already exists for this candidate and job
    const existing = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", args.candidateId))
      .filter((q) => q.eq(q.field("jobId"), args.jobId))
      .first();

    if (existing) {
      let updates: any = {};
      
      if (existing.currentStage === "new_cvs" && args.sourceChannel === "database") {
        updates.currentStage = "matched_candidates" as any;
        updates.lastStageChangedAt = Date.now();
      }
      
      if (args.cvFileId && existing.cvFileId !== args.cvFileId) {
        updates.cvFileId = args.cvFileId;
      }

      // ALWAYS sync the latest denormalized candidate data to the application
      const candidate = await ctx.db.get(args.candidateId);
      if (candidate) {
        updates.candidateName = candidate.fullName || undefined;
        updates.candidateEmail = candidate.email || undefined;
        updates.candidatePhone = candidate.phone || undefined;
        updates.candidateTitle = candidate.currentJobTitle || undefined;
        updates.candidateExperience = candidate.totalExperienceYears || undefined;
        updates.candidateCurrentSalary = candidate.currentSalary || undefined;
        updates.candidateExpectedSalary = candidate.expectedSalary || undefined;
        updates.candidateNoticePeriodDays = candidate.noticePeriodDays || undefined;
      }
      
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
        
        if (updates.currentStage) {
          await adjustJobStageStat(ctx, args.jobId, existing.currentStage, updates.currentStage);
          await syncCandidateOverallStatus(ctx, args.candidateId);
          
          if (existing.sourceChannel === "whatsapp" && updates.currentStage === "matched_candidates") {
            await ctx.runMutation(internal.meta.trigger.triggerMetaEventIfEligible, {
              applicationId: existing._id,
              eventName: "QualifiedLead"
            });
          }
        }
        
        if (updates.cvFileId && candidate) {
          await updateFollowUpFlags(ctx, existing._id, candidate);
          await checkAndAdvanceFollowUp(ctx, args.candidateId);
        }
      }
      return existing._id;
    }

    const now = Date.now();
    const initialStage = args.sourceChannel === "database" ? "matched_candidates" : "new_cvs";
    
    // Fetch candidate to populate denormalized fields
    const candidate = await ctx.db.get(args.candidateId);
    
    const appId = await ctx.db.insert("applications", {
      candidateId: args.candidateId,
      jobId: args.jobId,
      cvFileId: args.cvFileId,
      sourceChannel: args.sourceChannel,
      candidateName: candidate?.fullName,
      candidateEmail: candidate?.email,
      candidatePhone: candidate?.phone,
      candidateTitle: candidate?.currentTitle || candidate?.currentJobTitle,
      candidateExperience: candidate?.totalExperienceYears || candidate?.yearsOfExperience,
      candidateCvUploadId: candidate?.cvUploadId,
      candidateCurrentSalary: candidate?.currentSalary,
      candidateExpectedSalary: candidate?.expectedSalary,
      candidateNoticePeriodDays: candidate?.noticePeriodDays,
      currentStage: initialStage as any,
      loopIteration: 1,
      isActive: true,
      lastStageChangedAt: now,
      createdAt: now,
      metaCampaignId: args.metaCampaignId,
      metaAdId: args.metaSourceId, // Store sourceId as AdId
      metaConversionSentFor: [],
    });
    
    await adjustJobStageStat(ctx, args.jobId, null, initialStage as any, true);
    await adjustGlobalStat(ctx, "new_application");
    await syncCandidateOverallStatus(ctx, args.candidateId);
    
    // Trigger Meta Conversions API
    if (args.sourceChannel === "whatsapp") {
      const eventName = initialStage === "matched_candidates" ? "QualifiedLead" : "Lead";
      await ctx.runMutation(internal.meta.trigger.triggerMetaEventIfEligible, {
        applicationId: appId,
        eventName: eventName
      });
    }

    return appId;
  },
});

export const logManualCall = mutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    outcome: v.string(), // "Interested", "Not Interested", "No Answer"
    currentSalary: v.optional(v.number()),
    expectedSalary: v.optional(v.number()),
    noticePeriodDays: v.optional(v.number()),
    cvUploadId: v.optional(v.id("cvUploads")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Update candidate global profile
    const candidateUpdates: any = {};
    if (args.currentSalary !== undefined) candidateUpdates.currentSalary = args.currentSalary;
    if (args.expectedSalary !== undefined) candidateUpdates.expectedSalary = args.expectedSalary;
    if (args.noticePeriodDays !== undefined) candidateUpdates.noticePeriodDays = args.noticePeriodDays;
    if (args.cvUploadId) candidateUpdates.cvUploadId = args.cvUploadId;
    if (Object.keys(candidateUpdates).length > 0) {
      await ctx.db.patch(args.candidateId, candidateUpdates);
    }

    const candidate = await ctx.db.get(args.candidateId);

    // 2. Determine next stage based on outcome
    if (args.outcome === "Not Interested") {
      await ctx.db.patch(args.applicationId, {
        manualCallOutcome: args.outcome,
        currentStage: "rejected",
        taRejectionReason: "Not Interested during initial call",
        lastStageChangedAt: now,
      });
      await syncCandidateOverallStatus(ctx, args.candidateId);
      return;
    }

    // For "Interested" or "No Answer" — update per-application flags first
    await updateFollowUpFlags(ctx, args.applicationId, candidate);
    const updatedApp = await ctx.db.get(args.applicationId);

    const allComplete =
      updatedApp?.followUpCvReceived === true &&
      updatedApp?.followUpCurrentSalary === true &&
      updatedApp?.followUpExpectedSalary === true &&
      updatedApp?.followUpNoticePeriod === true;

    if (args.outcome === "Interested" && allComplete) {
      // All 4 fields captured on the first TA call — skip Follow-up, go straight to 2nd Shortlist
      await ctx.db.patch(args.applicationId, {
        manualCallOutcome: args.outcome,
        currentStage: "second_shortlist",
        lastStageChangedAt: now,
        stageHistory: [
          ...(updatedApp?.stageHistory ?? []),
          {
            stage: "second_shortlist",
            enteredAt: new Date().toISOString(),
            changedBy: "system" as any,
            note: "All 4 data points collected on first TA call — skipped Follow-up.",
          },
        ],
      });
    } else {
      // Incomplete — move to Follow-up and start 7-day clock
      const appBeforeUpdate = await ctx.db.get(args.applicationId);
      const alreadyInFollowUp = appBeforeUpdate?.currentStage === "follow_up";
      await ctx.db.patch(args.applicationId, {
        manualCallOutcome: args.outcome,
        currentStage: "follow_up",
        lastStageChangedAt: now,
        followUpEnteredAt: alreadyInFollowUp ? (appBeforeUpdate?.followUpEnteredAt ?? now) : now,
        stageHistory: [
          ...(updatedApp?.stageHistory ?? []),
          {
            stage: "follow_up",
            enteredAt: new Date().toISOString(),
            changedBy: "system" as any,
            note: `TA call logged (${args.outcome}) — missing data, entering Follow-up.`,
          },
        ],
      });
    }
    await syncCandidateOverallStatus(ctx, args.candidateId);
    if (args.outcome !== "Not Interested" && !allComplete) {
      await initiateFollowUpOutreach(ctx, args.applicationId);
    }
  },
});

export const rejectApplication = mutation({
  args: {
    applicationId: v.id("applications"),
    reason: v.string(),
    stage: v.optional(v.string()), // the stage they're being rejected from
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    const fromStage = args.stage ?? app.currentStage;

    await ctx.db.patch(args.applicationId, {
      currentStage: "rejected",
      taRejectionReason: args.reason,
      rejectedFromStage: fromStage,
      lastStageChangedAt: Date.now(),
    });

    // Write audit event
    await ctx.db.insert("pipelineEvents", {
      applicationId: args.applicationId,
      candidateId: app.candidateId,
      jobId: app.jobId,
      eventType: "rejected",
      fromStage,
      toStage: "rejected",
      actorType: "user",
      actorId: user._id,
      notes: args.reason,
      createdAt: Date.now(),
    });
    await syncCandidateOverallStatus(ctx, app.candidateId);
  },
});

export const triggerAiCall = mutation({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    await requireJobAssignment(ctx, app.jobId, ["primary_recruiter", "supporting_recruiter"]);

    // Insert aiCalls record
    const callId = await ctx.db.insert("aiCalls", {
      candidateId: app.candidateId,
      applicationId: args.applicationId,
      jobId: app.jobId,
      triggeredBy: user._id,
      triggerType: "manual_ta_trigger",
      callStatus: "scheduled",
      callScriptUsed: "default",
      companyHidden: false,
      calledAt: Date.now(),
      firstAttemptAt: Date.now(),
      attemptNumber: 1,
      followUpTriggered: false,
    });

    // Update application aiCallStatus
    await ctx.db.patch(args.applicationId, {
      aiCallStatus: "scheduled",
      aiCallId: callId,
    });

    // Schedule ElevenLabs trigger
    await ctx.scheduler.runAfter(0, internal.integrations.elevenlabs.triggerIntakeCall, {
      applicationId: args.applicationId,
      candidateId: app.candidateId,
      jobId: app.jobId,
    });

    await ctx.db.insert("pipelineEvents", {
      applicationId: args.applicationId,
      candidateId: app.candidateId,
      jobId: app.jobId,
      eventType: "ai_call_triggered",
      fromStage: app.currentStage,
      toStage: app.currentStage,
      actorType: "user",
      actorId: user._id,
      notes: "AI call manually triggered",
      createdAt: Date.now(),
    });

    return callId;
  },
});

export const createHeadhuntApplication = mutation({
  args: {
    jobId: v.id("jobs"),
    fullName: v.string(),
    currentSalary: v.number(),
    expectedSalary: v.number(),
    noticePeriodDays: v.number(),
    cvUploadId: v.id("cvUploads"),          // Hard-required: no follow-up chase at 2nd shortlist
    candidateConsent: v.boolean(),           // Must confirm awareness of opportunity
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireJobAssignment(ctx, args.jobId, ["primary_recruiter", "supporting_recruiter"]);

    // Hard gates — the 2nd Shortlist is the final validation point before Director review
    if (!args.candidateConsent) {
      throw new Error("Candidate consent is required for headhunted uploads.");
    }
    if (!args.currentSalary || !args.expectedSalary || !args.noticePeriodDays) {
      throw new Error("Current salary, expected salary, and notice period are required for headhunted uploads.");
    }

    // Create candidate record
    const candidateId = await ctx.db.insert("candidates", {
      fullName: args.fullName,
      email: args.email,
      phone: args.phone,
      currentSalary: args.currentSalary,
      expectedSalary: args.expectedSalary,
      noticePeriodDays: args.noticePeriodDays,
      firstSourceChannel: "headhunting",
      firstSourceJobId: args.jobId,
      firstSeenAt: Date.now(),
      lastUpdatedAt: Date.now(),
      overallStatus: "active",
      cvUploadId: args.cvUploadId,
      candidateConsent: true,
    });
    
    await adjustGlobalStat(ctx, "new_candidate");

    // Create application directly at second_shortlist with all flags set
    const now = Date.now();
    const applicationId = await ctx.db.insert("applications", {
      candidateId,
      jobId: args.jobId,
      cvFileId: args.cvUploadId,
      sourceChannel: "headhunting",
      currentStage: "second_shortlist",
      loopIteration: 1,
      isActive: true,
      lastStageChangedAt: now,
      createdAt: now,
      // Mark all follow-up flags as complete (headhunted candidates skip follow-up)
      followUpCvReceived: true,
      followUpCurrentSalary: true,
      followUpExpectedSalary: true,
      followUpNoticePeriod: true,
    });
    
    await adjustJobStageStat(ctx, args.jobId, null, "second_shortlist", true);
    await adjustGlobalStat(ctx, "new_application");

    // Log pipeline event
    await ctx.db.insert("pipelineEvents", {
      applicationId,
      candidateId,
      jobId: args.jobId,
      eventType: "headhunt_added",
      toStage: "second_shortlist",
      actorType: "user",
      actorId: user._id,
      notes: `Headhunt candidate added directly to 2nd Shortlist by ${user.fullName}`,
      createdAt: now,
    });

    await syncCandidateOverallStatus(ctx, candidateId);

    return { candidateId, applicationId };
  },
});

export const removeApplication = mutation({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const app = await ctx.db.get(args.applicationId);
    if (app) {
      await adjustJobStageStat(ctx, app.jobId, app.currentStage, app.currentStage, false, true);
      await ctx.db.delete(args.applicationId);
      await adjustGlobalStat(ctx, "deleted_application");
      await syncCandidateOverallStatus(ctx, app.candidateId);
    }
  }
});

export const updatePipelineCandidateDetails = mutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    field: v.union(v.literal("currentSalary"), v.literal("expectedSalary"), v.literal("noticePeriodDays")),
    value: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");
    
    // Permission: Recruiter or higher assigned to the job
    await requireJobAssignment(ctx, app.jobId, ["primary_recruiter", "supporting_recruiter"]);

    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) throw new Error("Candidate not found");

    // Capture old value
    const oldValue = candidate[args.field] !== undefined ? String(candidate[args.field]) : "—";
    const newValue = String(args.value);

    if (oldValue === newValue) return;

    // 1. Patch candidate global profile
    await ctx.db.patch(args.candidateId, {
      [args.field]: args.value,
    });

    // 2. Append history
    const history = app.salaryNoticeEditHistory || [];
    const newEntry = {
      field: args.field,
      oldValue,
      newValue,
      editedBy: user._id,
      editedAt: new Date().toISOString(),
    };

    await ctx.db.patch(args.applicationId, {
      salaryNoticeEditHistory: [...history, newEntry],
    });

    // 3. Update per-application follow-up flags with the fresh candidate data
    const updatedCandidate = await ctx.db.get(args.candidateId);
    if (updatedCandidate) {
      await updateFollowUpFlags(ctx, args.applicationId, updatedCandidate);
    }

    // 4. Since a field was updated, check if we can auto-advance from follow_up
    await checkAndAdvanceFollowUp(ctx, args.candidateId);
  },
});

// Twilio webhook helper: find aiCalls record by Twilio CallSid
export const findAiCallBySid = query({
  args: { twilioCallSid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiCalls")
      .withIndex("by_twilio", (q) => q.eq("twilioCallSid", args.twilioCallSid))
      .first();
  },
});

export const findAiCallByElevenLabsId = query({
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiCalls")
      .withIndex("by_elevenlabs", (q) => q.eq("elevenlabsConversationId", args.conversationId))
      .first();
  },
});

// Twilio webhook helper: update call status + IVR response
export const updateAiCallStatus = mutation({
  args: {
    aiCallId: v.id("aiCalls"),
    callStatus: v.union(
      v.literal("scheduled"), v.literal("in_progress"), v.literal("completed"),
      v.literal("no_answer"), v.literal("failed"), v.literal("declined")
    ),
    ivrResponse: v.optional(v.union(
      v.literal("pressed_1_interested"), v.literal("pressed_2_declined"),
      v.literal("pressed_3_connect_recruiter"), v.literal("no_response")
    )),
    twilioCallSid: v.optional(v.string()),
    elevenLabsConversationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.aiCallId);
    if (!call) throw new Error("AI call record not found");

    const updates: any = {
      callStatus: args.callStatus,
      ivrResponse: args.ivrResponse,
    };
    if (args.twilioCallSid) updates.twilioCallSid = args.twilioCallSid;
    if (args.elevenLabsConversationId) updates.elevenLabsConversationId = args.elevenLabsConversationId;
    if (args.callStatus === "completed" || args.callStatus === "failed" || args.callStatus === "no_answer") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(args.aiCallId, updates);

    // Reflect status on the application record if linked
    if (call.applicationId) {
      await ctx.db.patch(call.applicationId, {
        aiCallStatus: args.callStatus,
        aiCallIvrResponse: args.ivrResponse,
      });
    }
  },
});

export const saveCustomQuestionAnswers = mutation({
  args: {
    aiCallId: v.id("aiCalls"),
    customQuestionAnswers: v.array(v.object({ question: v.string(), answer: v.string() })),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.aiCallId, { customQuestionAnswers: args.customQuestionAnswers });
  },
});

// ─── Per-application follow-up helpers ────────────────────────────────────────

/** Sets the timestamp when a candidate entered the Follow-up stage.
 *  Used by webhooks and mutations to start the precise 7-day clock. */
export const setFollowUpEnteredAt = mutation({
  args: {
    applicationId: v.id("applications"),
    enteredAt: v.number(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) return;
    // Only set if not already set (don't reset clock on re-entry signals)
    if (!app.followUpEnteredAt) {
      await ctx.db.patch(args.applicationId, { followUpEnteredAt: args.enteredAt });
    }
  },
});

/** Writes individual per-application follow-up completion flags.
 *  Called by ElevenLabs webhooks after a call captures partial data. */
export const setApplicationFlags = mutation({
  args: {
    applicationId: v.id("applications"),
    followUpCvReceived: v.optional(v.boolean()),
    followUpCurrentSalary: v.optional(v.boolean()),
    followUpExpectedSalary: v.optional(v.boolean()),
    followUpNoticePeriod: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { applicationId, ...flags } = args;
    const updates: Record<string, boolean> = {};
    if (flags.followUpCvReceived !== undefined) updates.followUpCvReceived = flags.followUpCvReceived;
    if (flags.followUpCurrentSalary !== undefined) updates.followUpCurrentSalary = flags.followUpCurrentSalary;
    if (flags.followUpExpectedSalary !== undefined) updates.followUpExpectedSalary = flags.followUpExpectedSalary;
    if (flags.followUpNoticePeriod !== undefined) updates.followUpNoticePeriod = flags.followUpNoticePeriod;
    if (Object.keys(updates).length > 0) {
      const app = await ctx.db.get(applicationId);
      if (!app) {
        console.warn(`[setApplicationFlags] App ${applicationId} not found, skipping.`);
        return;
      }
      
      await ctx.db.patch(applicationId, updates);
      
      // Now check if they should be auto-advanced
      await checkAndAdvanceFollowUp(ctx, app.candidateId);
    }
  },
});

export const getApplication = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const actualId = ctx.db.normalizeId("applications", args.id);
    if (!actualId) return null;
    return await ctx.db.get(actualId);
  },
});

export const rollbackFollowUpState = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app || !app.followUpState) return;

    const currentState = app.followUpState;
    if (currentState.lastContactDay >= 2) {
      await ctx.db.patch(args.applicationId, {
        followUpState: {
          ...currentState,
          lastContactDay: 1, // Reset to 1 so Day 2 re-triggers next hour
        }
      });
    }
  }
});




