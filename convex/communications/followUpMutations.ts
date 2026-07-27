import { internalMutation, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

export const scheduleDynamicFollowUp = internalMutation({
  args: {
    applicationId: v.id("applications"),
    nextActionTimeHours: v.number(),
    messageBody: v.string(),
  },
  handler: async (ctx, args) => {
    const nextTimeMs = Date.now() + (args.nextActionTimeHours * 60 * 60 * 1000);
    
    await ctx.db.patch(args.applicationId, {
      nextFollowUpScheduledAt: nextTimeMs,
      nextFollowUpMessage: args.messageBody,
    });
    console.log(`[Follow-Up] Scheduled next AI message for application ${args.applicationId} in ${args.nextActionTimeHours} hours.`);
  },
});
