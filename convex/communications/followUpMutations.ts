import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const scheduleDynamicFollowUp = internalMutation({
  args: {
    applicationId: v.id("applications"),
    nextActionTimeHours: v.number(),
    messageBody: v.string(),
  },
  handler: async (ctx, args) => {
    const nextTimeMs = Date.now() + (args.nextActionTimeHours * 60 * 60 * 1000);
    const app = await ctx.db.get(args.applicationId);
    
    await ctx.db.patch(args.applicationId, {
      nextFollowUpScheduledAt: nextTimeMs,
      nextFollowUpMessage: args.messageBody,
      followUpState: {
        lastContactDay: app?.followUpState?.lastContactDay ?? 0,
        firstChannelUsed: app?.followUpState?.firstChannelUsed ?? "whatsapp",
        replyChannel: "whatsapp",
      },
    });
    console.log(`[Follow-Up] Scheduled next AI message for application ${args.applicationId} in ${args.nextActionTimeHours} hours.`);
  },
});

export const resetFollowUpApp = internalMutation({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.applicationId, {
      currentStage: "follow_up",
      followUpAttemptCount: 0,
      nextFollowUpScheduledAt: Date.now(),
    });
    console.log(`[Follow-Up] Reset application ${args.applicationId} for follow-up evaluation.`);
  },
});

export const resetToNewCvs = internalMutation({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.applicationId, {
      currentStage: "new_cvs",
      lastStageChangedAt: Date.now(),
      followUpAttemptCount: 0,
      nextFollowUpScheduledAt: undefined,
      nextFollowUpMessage: undefined,
      flaggedForTaReview: false,
      taReviewReason: undefined,
      stageHistory: [
        {
          stage: "new_cvs",
          enteredAt: new Date().toISOString(),
          changedBy: "system",
        },
      ],
    });
    console.log(`[Pipeline] Reset application ${args.applicationId} back to New CVs stage.`);
  },
});

export const flagForTaReview = internalMutation({
  args: {
    applicationId: v.id("applications"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.applicationId, {
      flaggedForTaReview: true,
      taReviewReason: args.reason,
      nextFollowUpScheduledAt: undefined, // Pause automated nudging completely
      nextFollowUpMessage: undefined,
    });

    const app = await ctx.db.get(args.applicationId);
    if (app) {
      await ctx.db.insert("pipelineEvents", {
        applicationId: args.applicationId,
        candidateId: app.candidateId,
        jobId: app.jobId,
        eventType: "flagged_for_ta_review",
        fromStage: app.currentStage,
        toStage: app.currentStage,
        actorType: "system",
        notes: `Flagged for TA Review: ${args.reason}`,
        createdAt: Date.now(),
      });
    }

    console.log(`[Follow-Up] Application ${args.applicationId} flagged for TA review (${args.reason}). Automated follow-up paused.`);
  },
});

export const clearTaReviewFlag = internalMutation({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.applicationId, {
      flaggedForTaReview: false,
      taReviewReason: undefined,
    });
    console.log(`[Follow-Up] Cleared TA review flag for application ${args.applicationId}.`);
  },
});
