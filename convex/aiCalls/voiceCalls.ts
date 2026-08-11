import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { checkAndAdvanceFollowUp } from "../pipeline/followUpHelper";

export const recordVoiceCallSession = mutation({
  args: {
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    applicationId: v.optional(v.id("applications")),
    transcript: v.string(),
    durationSeconds: v.number(),
    currentSalary: v.optional(v.number()),
    expectedSalary: v.optional(v.number()),
    noticePeriodDays: v.optional(v.number()),
    noticePeriodText: v.optional(v.string()),
    customQuestionAnswers: v.optional(
      v.array(v.object({ question: v.string(), answer: v.string() }))
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Insert aiCalls record
    const callId = await ctx.db.insert("aiCalls", {
      candidateId: args.candidateId,
      jobId: args.jobId,
      applicationId: args.applicationId,
      callStatus: "completed",
      callDurationSeconds: args.durationSeconds,
      calledAt: now - args.durationSeconds * 1000,
      completedAt: now,
      transcript: args.transcript,
      currentSalary: args.currentSalary,
      expectedSalary: args.expectedSalary,
      noticePeriodDays: args.noticePeriodDays,
      customQuestionAnswers: args.customQuestionAnswers || [],
      callScriptUsed: "initial_screening",
      companyHidden: false,
      followUpTriggered: false,
      triggerType: "manual_ta_trigger",
    });

    // 2. Update candidate profile in Convex
    const candidatePatch: any = {
      lastUpdatedAt: now,
    };
    if (args.currentSalary !== undefined && args.currentSalary !== null) {
      candidatePatch.currentSalary = args.currentSalary;
    }
    if (args.expectedSalary !== undefined && args.expectedSalary !== null) {
      candidatePatch.expectedSalary = args.expectedSalary;
    }
    if (args.noticePeriodDays !== undefined && args.noticePeriodDays !== null) {
      candidatePatch.noticePeriodDays = args.noticePeriodDays;
    }
    if (args.noticePeriodText) {
      candidatePatch.noticePeriod = args.noticePeriodText;
    }

    await ctx.db.patch(args.candidateId, candidatePatch);

    // 3. Update application record if provided
    if (args.applicationId) {
      const appUpdates: any = {
        aiCallStatus: "completed",
      };
      if (args.currentSalary) {
        appUpdates.candidateCurrentSalary = args.currentSalary;
        appUpdates.followUpCurrentSalary = true;
      }
      if (args.expectedSalary) {
        appUpdates.candidateExpectedSalary = args.expectedSalary;
        appUpdates.followUpExpectedSalary = true;
      }
      if (args.noticePeriodDays) {
        appUpdates.candidateNoticePeriodDays = args.noticePeriodDays;
        appUpdates.followUpNoticePeriod = true;
      }
      if (args.customQuestionAnswers && args.customQuestionAnswers.length > 0) {
        const customMap: Record<string, string> = {};
        for (const item of args.customQuestionAnswers) {
          customMap[item.question] = item.answer;
        }
        appUpdates.customFollowUpAnswers = customMap;
      }

      await ctx.db.patch(args.applicationId, appUpdates);

      // Check if all follow-up requirements are satisfied and auto-advance
      await checkAndAdvanceFollowUp(ctx, args.candidateId);
    }

    return { success: true, callId };
  },
});
