import { internalMutation, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";

export const fixAiMatchExplanation = internalAction({
  handler: async (ctx) => {
    // We need to fetch apps using runQuery in an action, or just use a mutation to queue them.
    // Let's use a mutation to queue them, or just do it right here since actions can runQueries.
    const apps = await ctx.runQuery(internal.scratch_fix_cv.getFailedApps);
    let fixed = 0;
    for (const app of apps) {
      await ctx.runMutation(internal.scratch_fix_cv.resetAppScore, { appId: app._id });
      await ctx.scheduler.runAfter(0, api.cvs.cvScoringActions.processCvScoring, {
        candidateId: app.candidateId,
        jobId: app.jobId,
      });
      fixed++;
    }
    return { fixed };
  },
});

import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getFailedApps = internalQuery({
  handler: async (ctx) => {
    const apps = await ctx.db.query("applications").collect();
    return apps.filter(app => app.aiMatchExplanation === "Failed to connect to the scoring service.");
  }
});

export const resetAppScore = internalMutation({
  args: { appId: v.id("applications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.appId, {
      aiMatchScore: undefined,
      aiMatchExplanation: undefined
    });
  }
});
