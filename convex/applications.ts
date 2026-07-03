import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireUser, requireJobAssignment } from "./lib/permissions";
import { checkAndAdvanceFollowUp, updateFollowUpFlags, initiateFollowUpOutreach } from "./pipeline/followUpHelper";
import { syncCandidateOverallStatus } from "./candidates";

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

    const applications = await ctx.db
      .query("applications")
      .withIndex("by_job_active", (q) => q.eq("jobId", actualJobId!).eq("isActive", true))
      .collect();

    // Enrich with candidate and cv details
    const enriched = await Promise.all(
      applications.map(async (app) => {
        const candidate = await ctx.db.get(app.candidateId);
        const cv = app.cvFileId ? await ctx.db.get(app.cvFileId) : null;
        return {
          ...app,
          candidate,
          cv,
        };
      })
    );

    return enriched;
  },
});

// All applications for a single candidate, joined with job details
export const getByCandidate = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const applications = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", args.candidateId))
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

// Chronological event log for a candidate (newest first)
export const getCandidateTimeline = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const events = await ctx.db
      .query("pipelineEvents")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .order("desc")
      .collect();

    return await Promise.all(
      events.map(async (e) => {
        const job = await ctx.db.get(e.jobId);
        return {
          ...e,
          jobTitle: job?.title ?? "Unknown Job",
        };
      })
    );
  },
});

// AI call log for a candidate (newest first)
export const getCandidateAiCalls = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const calls = await ctx.db
      .query("aiCalls")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .order("desc")
      .collect();

    return await Promise.all(
      calls.map(async (call) => {
        const job = await ctx.db.get(call.jobId);
        return {
          ...call,
          jobTitle: job?.title ?? "Unknown Job",
        };
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
  },
  handler: async (ctx, args) => {
    // Check if application already exists for this candidate and job
    const existing = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", args.candidateId))
      .filter((q) => q.eq(q.field("jobId"), args.jobId))
      .first();

    if (existing) {
      if (existing.currentStage === "new_cvs" && args.sourceChannel === "database") {
        await ctx.db.patch(existing._id, {
          currentStage: "matched_candidates" as any,
          lastStageChangedAt: Date.now(),
        });
        await syncCandidateOverallStatus(ctx, args.candidateId);
      }
      return existing._id;
    }

    const now = Date.now();
    const initialStage = args.sourceChannel === "database" ? "matched_candidates" : "new_cvs";
    
    const appId = await ctx.db.insert("applications", {
      candidateId: args.candidateId,
      jobId: args.jobId,
      cvFileId: args.cvFileId,
      sourceChannel: args.sourceChannel,
      currentStage: initialStage as any,
      loopIteration: 1,
      isActive: true,
      lastStageChangedAt: now,
      createdAt: now,
    });
    await syncCandidateOverallStatus(ctx, args.candidateId);
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
      await ctx.db.delete(args.applicationId);
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
    const calls = await ctx.db
      .query("aiCalls")
      .collect();
    return calls.find(c => c.twilioCallSid === args.twilioCallSid) ?? null;
  },
});

export const findAiCallByElevenLabsId = query({
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
    const calls = await ctx.db.query("aiCalls").collect();
    return calls.find(c => c.elevenlabsConversationId === args.conversationId) ?? null;
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
  },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.aiCallId);
    if (!call) throw new Error("AI call record not found");

    const updates: any = {
      callStatus: args.callStatus,
      ivrResponse: args.ivrResponse,
    };
    if (args.twilioCallSid) updates.twilioCallSid = args.twilioCallSid;
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
      await ctx.db.patch(applicationId, updates);
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
