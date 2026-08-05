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

export const updateCandidateEta = internalMutation({
  args: {
    applicationId: v.id("applications"),
    candidateEtaMs: v.number(),
    candidateEtaText: v.string(),
    waitingForCandidateEta: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.applicationId, {
      candidateEtaMs: args.candidateEtaMs,
      candidateEtaText: args.candidateEtaText,
      waitingForCandidateEta: args.waitingForCandidateEta,
      nextFollowUpScheduledAt: args.candidateEtaMs, // align schedule with ETA
    });
    console.log(`[Follow-Up] Set ETA for application ${args.applicationId} to ${args.candidateEtaText} (at ${args.candidateEtaMs})`);
  },
});
