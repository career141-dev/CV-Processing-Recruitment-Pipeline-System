import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, requireJobAssignment } from "./lib/permissions";
import { checkAndAdvanceFollowUp } from "./pipeline/followUpHelper";

export const getByJobId = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const applications = await ctx.db
      .query("applications")
      .withIndex("by_job_active", (q) => q.eq("jobId", args.jobId).eq("isActive", true))
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
      }
      return existing._id;
    }

    const now = Date.now();
    const initialStage = args.sourceChannel === "database" ? "matched_candidates" : "new_cvs";
    
    return await ctx.db.insert("applications", {
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
  },
  handler: async (ctx, args) => {
    // 1. Update Candidate
    await ctx.db.patch(args.candidateId, {
      currentSalary: args.currentSalary,
      expectedSalary: args.expectedSalary,
      noticePeriodDays: args.noticePeriodDays,
    });

    // 2. Update Application and optionally auto-reject
    const appUpdates: any = {
      manualCallOutcome: args.outcome,
    };
    
    if (args.outcome === "Not Interested") {
      appUpdates.currentStage = "rejected";
      appUpdates.taRejectionReason = "Not Interested during initial call";
      appUpdates.lastStageChangedAt = Date.now();
    }

    await ctx.db.patch(args.applicationId, appUpdates);
    await checkAndAdvanceFollowUp(ctx, args.candidateId);
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

    // Insert aiCalls record — actual Twilio dial is handled by a separate outbound action
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
      followUpTriggered: false,
    });

    // Update application aiCallStatus
    await ctx.db.patch(args.applicationId, {
      aiCallStatus: "scheduled",
      aiCallId: callId,
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
    cvUploadId: v.optional(v.id("cvUploads")),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireJobAssignment(ctx, args.jobId, ["primary_recruiter", "supporting_recruiter"]);

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
    });

    // Create application directly at second_shortlist
    const applicationId = await ctx.db.insert("applications", {
      candidateId,
      jobId: args.jobId,
      sourceChannel: "headhunting",
      currentStage: "second_shortlist",
      loopIteration: 1,
      isActive: true,
      lastStageChangedAt: Date.now(),
      createdAt: Date.now(),
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
      createdAt: Date.now(),
    });

    return { candidateId, applicationId };
  },
});

export const removeApplication = mutation({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await ctx.db.delete(args.applicationId);
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

    // 1. Patch candidate
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

    // 3. Since candidate details updated, run Follow-up gate check if they happen to be in follow_up
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
