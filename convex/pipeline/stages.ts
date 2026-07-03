// convex/pipeline/stages.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireUser, requireJobAssignment } from "../lib/permissions";
import { internal } from "../_generated/api";
import { syncCandidateOverallStatus } from "../candidates";

export const moveToTAShortlist = mutation({
  args: { applicationId: v.id("applications"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.applicationId);
    if (!entry) throw new Error("Pipeline entry not found");

    // ROLE GUARD: Admin, TA_MGR, SR_TA, or assigned Recruiter
    await requireJobAssignment(ctx, entry.jobId, ["primary_recruiter", "supporting_recruiter"]);

    if (entry.currentStage !== "new_cvs") {
      throw new Error("Can only shortlist from Stage 1 (New CVs)");
    }

    const user = await requireUser(ctx);
    const now = Date.now();

    const isPathTwo = entry.sourceChannel !== "database";

    if (isPathTwo) {
      // PATH 2 — New CV: shortlist AND immediately auto-trigger the AI call
      // Stage jumps directly to ai_call; the TA does not need to manually dial
      await ctx.db.patch(args.applicationId, {
        currentStage: "ai_call",
        stageHistory: [
          ...(entry.stageHistory ?? []),
          {
            stage: "ta_shortlist",
            enteredAt: new Date().toISOString(),
            changedBy: user._id,
            note: args.note,
          },
          {
            stage: "ai_call",
            enteredAt: new Date().toISOString(),
            changedBy: user._id,
            note: "AI call auto-triggered on TA shortlist confirm.",
          },
        ],
        taShortlistStatus: "shortlisted",
        taShortlistById: user._id,
        taShortlistAt: now,
        lastStageChangedAt: now,
        aiCallStatus: "scheduled",
      });

      // Insert aiCalls record and schedule ElevenLabs outbound call
      const callId = await ctx.db.insert("aiCalls", {
        candidateId: entry.candidateId,
        applicationId: args.applicationId,
        jobId: entry.jobId,
        triggeredBy: user._id,
        triggerType: "automatic_new_applicant",
        callStatus: "scheduled",
        callScriptUsed: "initial_screening",
        companyHidden: false,
        calledAt: now,
        firstAttemptAt: now,
        attemptNumber: 1,
        followUpTriggered: false,
      });

      await ctx.db.patch(args.applicationId, { aiCallId: callId as any });

      await ctx.scheduler.runAfter(0, internal.integrations.elevenlabs.triggerIntakeCall, {
        applicationId: args.applicationId,
        candidateId: entry.candidateId,
        jobId: entry.jobId,
      });

      await ctx.db.insert("pipelineEvents", {
        applicationId: args.applicationId,
        candidateId: entry.candidateId,
        jobId: entry.jobId,
        eventType: "ai_call_triggered",
        fromStage: "new_cvs",
        toStage: "ai_call",
        actorType: "user",
        actorId: user._id,
        notes: "AI call auto-triggered on TA shortlist confirm (Path 2).",
        createdAt: now,
      });
    } else {
      // PATH 1 — Matched Candidate: just mark TA shortlisted, TA will call manually
      await ctx.db.patch(args.applicationId, {
        currentStage: "ta_shortlist",
        stageHistory: [
          ...(entry.stageHistory ?? []),
          {
            stage: "ta_shortlist",
            enteredAt: new Date().toISOString(),
            changedBy: user._id,
            note: args.note,
          },
        ],
        taShortlistStatus: "shortlisted",
        taShortlistById: user._id,
        taShortlistAt: now,
        lastStageChangedAt: now,
      });
    }
    await syncCandidateOverallStatus(ctx, entry.candidateId);
  },
});

export const directorApprove = mutation({
  args: { applicationId: v.id("applications"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.applicationId);
    if (!entry) throw new Error("Pipeline entry not found");

    // ROLE GUARD: Admin OR assigned Director for this specific job
    const user = await requireUser(ctx);
    if (user.role !== "admin") {
      await requireJobAssignment(ctx, entry.jobId, ["director"]);
    }

    if (entry.currentStage !== "director_shortlist") {
      throw new Error("Candidate is not at Director Shortlist stage");
    }

    await ctx.db.patch(args.applicationId, {
      currentStage: "client_review",
      stageHistory: [...(entry.stageHistory ?? []), {
        stage: "client_review",
        enteredAt: new Date().toISOString(),
        changedBy: user._id,
        note: args.note ?? "Director approved",
      }],
      directorReviewId: user._id,
      lastStageChangedAt: Date.now(),
    });
    await syncCandidateOverallStatus(ctx, entry.candidateId);
  },
});

export const rejectCandidate = mutation({
  args: { applicationId: v.id("applications"), reason: v.string() },
  handler: async (ctx, { applicationId, reason }) => {
    const entry = await ctx.db.get(applicationId);
    if (!entry) throw new Error("Application not found");

    // Can be rejected by Recruiter or higher
    await requireJobAssignment(ctx, entry.jobId, ["primary_recruiter", "supporting_recruiter"]);
    const user = await requireUser(ctx);

    await ctx.db.patch(applicationId, {
      currentStage: "rejected",
      taRejectionReason: reason,
      taShortlistStatus: entry.currentStage === "new_cvs" ? "rejected" : entry.taShortlistStatus,
      lastStageChangedAt: Date.now(),
      stageHistory: [...(entry.stageHistory ?? []), {
        stage: "rejected",
        enteredAt: new Date().toISOString(),
        changedBy: user._id,
        note: reason,
      }],
    });
    await syncCandidateOverallStatus(ctx, entry.candidateId);
  },
});

export const setPipelineStage = mutation({
  args: { 
    applicationId: v.id("applications"), 
    newStage: v.string(), // "new_cvs" | "ta_shortlist" | "interview" | "offer" | "placed" | "rejected" | etc
    note: v.optional(v.string()) 
  },
  handler: async (ctx, { applicationId, newStage, note }) => {
    const entry = await ctx.db.get(applicationId);
    if (!entry) throw new Error("Application not found");

    // Recruiter or higher
    await requireJobAssignment(ctx, entry.jobId, ["primary_recruiter", "supporting_recruiter", "director"]);
    const user = await requireUser(ctx);

    await ctx.db.patch(applicationId, {
      currentStage: newStage as any,
      lastStageChangedAt: Date.now(),
      stageHistory: [...(entry.stageHistory ?? []), {
        stage: newStage,
        enteredAt: new Date().toISOString(),
        changedBy: user._id,
        note: note,
      }],
    });
    await syncCandidateOverallStatus(ctx, entry.candidateId);
  },
});

export const directorReject = mutation({
  args: { applicationId: v.id("applications"), reason: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.applicationId);
    if (!entry) throw new Error("Pipeline entry not found");

    const user = await requireUser(ctx);
    if (user.role !== "admin") {
      await requireJobAssignment(ctx, entry.jobId, ["director"]);
    }

    if (entry.currentStage !== "director_shortlist") {
      throw new Error("Candidate is not at Director Shortlist stage");
    }

    await ctx.db.patch(args.applicationId, {
      currentStage: "rejected",
      taRejectionReason: args.reason,
      rejectedFromStage: "director_shortlist",
      lastStageChangedAt: Date.now(),
      stageHistory: [...(entry.stageHistory ?? []), {
        stage: "rejected",
        enteredAt: new Date().toISOString(),
        changedBy: user._id,
        note: args.reason,
      }],
    });

    await ctx.db.insert("pipelineEvents", {
      applicationId: args.applicationId,
      candidateId: entry.candidateId,
      jobId: entry.jobId,
      eventType: "rejected",
      fromStage: "director_shortlist",
      toStage: "rejected",
      actorType: "user",
      actorId: user._id,
      notes: args.reason,
      createdAt: Date.now(),
    });
    await syncCandidateOverallStatus(ctx, entry.candidateId);
  },
});

export const directorRequestChanges = mutation({
  args: { applicationId: v.id("applications"), note: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.applicationId);
    if (!entry) throw new Error("Pipeline entry not found");

    const user = await requireUser(ctx);
    if (user.role !== "admin") {
      await requireJobAssignment(ctx, entry.jobId, ["director"]);
    }

    // Send back to TA Shortlist for review
    await ctx.db.patch(args.applicationId, {
      currentStage: "ta_shortlist",
      lastStageChangedAt: Date.now(),
      stageHistory: [...(entry.stageHistory ?? []), {
        stage: "ta_shortlist",
        enteredAt: new Date().toISOString(),
        changedBy: user._id,
        note: `Director requested changes: ${args.note}`,
      }],
    });

    await ctx.db.insert("pipelineEvents", {
      applicationId: args.applicationId,
      candidateId: entry.candidateId,
      jobId: entry.jobId,
      eventType: "director_request_changes",
      fromStage: "director_shortlist",
      toStage: "ta_shortlist",
      isBackwardMove: true,
      actorType: "user",
      actorId: user._id,
      notes: args.note,
      createdAt: Date.now(),
    });
    await syncCandidateOverallStatus(ctx, entry.candidateId);
  },
});

export const clientApprove = mutation({
  args: { applicationId: v.id("applications"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.applicationId);
    if (!entry) throw new Error("Pipeline entry not found");

    const user = await requireUser(ctx);
    // Admin, recruiter, or client contact can approve
    await requireJobAssignment(ctx, entry.jobId, ["primary_recruiter", "supporting_recruiter", "director", "client_contact"]);

    if (entry.currentStage !== "client_review") {
      throw new Error("Candidate is not at Client Review stage");
    }

    await ctx.db.patch(args.applicationId, {
      currentStage: "interview",
      lastStageChangedAt: Date.now(),
      stageHistory: [...(entry.stageHistory ?? []), {
        stage: "interview",
        enteredAt: new Date().toISOString(),
        changedBy: user._id,
        note: args.note ?? "Client approved — selected for interview",
      }],
    });
    await syncCandidateOverallStatus(ctx, entry.candidateId);
  },
});

export const clientHold = mutation({
  args: { applicationId: v.id("applications"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.applicationId);
    if (!entry) throw new Error("Pipeline entry not found");

    const user = await requireUser(ctx);
    await requireJobAssignment(ctx, entry.jobId, ["primary_recruiter", "supporting_recruiter", "director", "client_contact"]);

    if (entry.currentStage !== "client_review") {
      throw new Error("Candidate is not at Client Review stage");
    }

    // Stay at client_review but mark as held — we'll use a note in stageHistory
    await ctx.db.patch(args.applicationId, {
      lastStageChangedAt: Date.now(),
      stageHistory: [...(entry.stageHistory ?? []), {
        stage: "client_review",
        enteredAt: new Date().toISOString(),
        changedBy: user._id,
        note: `Client placed on hold: ${args.note ?? "No reason given"}`,
      }],
    });
    await syncCandidateOverallStatus(ctx, entry.candidateId);
  },
});

export const clientReject = mutation({
  args: { applicationId: v.id("applications"), reason: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.applicationId);
    if (!entry) throw new Error("Pipeline entry not found");

    const user = await requireUser(ctx);
    await requireJobAssignment(ctx, entry.jobId, ["primary_recruiter", "supporting_recruiter", "director", "client_contact"]);

    if (entry.currentStage !== "client_review") {
      throw new Error("Candidate is not at Client Review stage");
    }

    await ctx.db.patch(args.applicationId, {
      currentStage: "rejected",
      taRejectionReason: args.reason,
      rejectedFromStage: "client_review",
      lastStageChangedAt: Date.now(),
      stageHistory: [...(entry.stageHistory ?? []), {
        stage: "rejected",
        enteredAt: new Date().toISOString(),
        changedBy: user._id,
        note: args.reason,
      }],
    });

    await ctx.db.insert("pipelineEvents", {
      applicationId: args.applicationId,
      candidateId: entry.candidateId,
      jobId: entry.jobId,
      eventType: "rejected",
      fromStage: "client_review",
      toStage: "rejected",
      actorType: "user",
      actorId: user._id,
      notes: args.reason,
      createdAt: Date.now(),
    });
    await syncCandidateOverallStatus(ctx, entry.candidateId);
  },
});
