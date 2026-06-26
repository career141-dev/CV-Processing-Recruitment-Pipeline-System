// convex/pipeline/stages.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireUser, requireJobAssignment } from "../lib/permissions";

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

    await ctx.db.patch(args.applicationId, {
      currentStage: "ta_shortlist",
      stageHistory: [...(entry.stageHistory ?? []), {
        stage: "ta_shortlist",
        enteredAt: new Date().toISOString(),
        changedBy: user._id,
        note: args.note,
      }],
      taShortlistStatus: "shortlisted",
      taShortlistById: user._id,
      taShortlistAt: Date.now(),
      lastStageChangedAt: Date.now(),
    });
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

    if (entry.currentStage !== "director_review") {
      throw new Error("Candidate is not at Director Review stage");
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
  },
});
