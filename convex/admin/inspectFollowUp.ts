import { mutation, query } from "../_generated/server";

export const moveToFollowUpStage = mutation({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").collect();
    const targetJob = jobs.find((j) => j.title === "Follow-up Test");

    const apps = await ctx.db.query("applications").collect();
    const targetApp = apps.find((a) => a.jobId === targetJob?._id);

    if (targetApp) {
      await ctx.db.patch(targetApp._id, {
        currentStage: "follow_up",
        lastStageChangedAt: Date.now(),
        followUpEnteredAt: Date.now(),
      });
      return { success: true, appId: targetApp._id, newStage: "follow_up" };
    }
    return { success: false, error: "No target app found" };
  },
});

export const inspectJobAndApp = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").collect();
    const targetJob = jobs.find((j) => j.title === "Follow-up Test");

    const apps = await ctx.db.query("applications").collect();
    const targetApp = apps.find((a) => a.jobId === targetJob?._id);

    return {
      jobTitle: targetJob?.title,
      jobStatus: targetJob?.status,
      appStage: targetApp?.currentStage,
      nextFollowUpScheduledAtIso: targetApp?.nextFollowUpScheduledAt ? new Date(targetApp.nextFollowUpScheduledAt).toISOString() : null,
      nowIso: new Date().toISOString(),
    };
  },
});
