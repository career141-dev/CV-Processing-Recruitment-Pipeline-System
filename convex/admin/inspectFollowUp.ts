import { query } from "../_generated/server";

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
      jobMaxFollowUpDays: targetJob?.maxFollowUpDays,
      appStage: targetApp?.currentStage,
      nextFollowUpScheduledAt: targetApp?.nextFollowUpScheduledAt,
      nextFollowUpScheduledAtIso: targetApp?.nextFollowUpScheduledAt ? new Date(targetApp.nextFollowUpScheduledAt).toISOString() : null,
      nowIso: new Date().toISOString(),
      isDue: targetApp?.nextFollowUpScheduledAt ? Date.now() >= targetApp.nextFollowUpScheduledAt : false,
    };
  },
});
