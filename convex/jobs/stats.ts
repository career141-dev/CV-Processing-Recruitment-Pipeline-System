import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

/**
 * Adjusts the stageCounts on a job document when an application moves stages.
 * This eliminates the need for expensive polling/crons.
 */
export async function adjustJobStageStat(
  ctx: any,
  jobId: Id<"jobs">,
  oldStage: string | null,
  newStage: string,
  isNewApplication = false,
  isDeletedApplication = false
) {
  const job = await ctx.db.get(jobId);
  if (!job) return;

  const stageCounts = job.stageCounts || {};
  let totalApplications = job.totalApplications || 0;

  if (isNewApplication) {
    totalApplications += 1;
    stageCounts[newStage] = (stageCounts[newStage] || 0) + 1;
  } else if (isDeletedApplication) {
    totalApplications = Math.max(0, totalApplications - 1);
    if (oldStage && stageCounts[oldStage]) {
      stageCounts[oldStage] = Math.max(0, stageCounts[oldStage] - 1);
    }
  } else if (oldStage !== newStage) {
    // Moving between stages
    if (oldStage && stageCounts[oldStage]) {
      stageCounts[oldStage] = Math.max(0, stageCounts[oldStage] - 1);
    }
    stageCounts[newStage] = (stageCounts[newStage] || 0) + 1;
  }

  await ctx.db.patch(jobId, {
    stageCounts,
    totalApplications,
  });
}

// Optional: Wrap in an internal mutation if it needs to be called from an action.
export const adjustStats = internalMutation({
  args: {
    jobId: v.id("jobs"),
    oldStage: v.union(v.string(), v.null()),
    newStage: v.string(),
    isNewApplication: v.optional(v.boolean()),
    isDeletedApplication: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await adjustJobStageStat(
      ctx,
      args.jobId,
      args.oldStage,
      args.newStage,
      args.isNewApplication,
      args.isDeletedApplication
    );
  },
});
