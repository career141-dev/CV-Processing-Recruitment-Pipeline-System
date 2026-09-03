import { v } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import { api } from "../_generated/api";
import { adjustJobStageStat } from "../jobs/stats";
import { syncCandidateOverallStatus } from "../candidates/candidates";

function isManualDirectoryChannel(channel: string | undefined | null): boolean {
  if (!channel) return false;
  const lower = channel.toLowerCase();
  return lower.includes("manual") || lower.includes("directory") || lower.includes("folder");
}

/**
 * Preview query: Counts all applications currently in 'new_cvs' that originate
 * from manual directory / folder uploads, grouped by job.
 */
export const previewManualDirectoryApps = query({
  args: {},
  handler: async (ctx) => {
    const appsInNewCvs = await ctx.db
      .query("applications")
      .withIndex("by_stage", (q) => q.eq("currentStage", "new_cvs"))
      .collect();

    const manualApps = appsInNewCvs.filter((a) => isManualDirectoryChannel(a.sourceChannel));

    const jobCounts: Record<string, { title: string; count: number }> = {};
    for (const app of manualApps) {
      const jId = String(app.jobId);
      if (!jobCounts[jId]) {
        const job = await ctx.db.get(app.jobId);
        jobCounts[jId] = {
          title: job?.title || "Unknown Job",
          count: 0,
        };
      }
      jobCounts[jId].count++;
    }

    return {
      totalInNewCvs: appsInNewCvs.length,
      stuckManualInNewCvs: manualApps.length,
      affectedJobsCount: Object.keys(jobCounts).length,
      jobsBreakdown: jobCounts,
    };
  },
});

/**
 * Batch mutation: Migrates up to `batchSize` stuck applications from 'new_cvs'
 * to 'matched_candidates', updating job stats and candidate statuses.
 */
export const migrateManualDirectoryAppsBatch = mutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.batchSize ?? 200;
    const now = Date.now();

    const appsInNewCvs = await ctx.db
      .query("applications")
      .withIndex("by_stage", (q) => q.eq("currentStage", "new_cvs"))
      .take(limit * 3); // Fetch a buffer to filter manual channels

    const toMigrate = appsInNewCvs
      .filter((a) => isManualDirectoryChannel(a.sourceChannel))
      .slice(0, limit);

    if (toMigrate.length === 0) {
      return {
        migratedCount: 0,
        isDone: true,
      };
    }

    const affectedCandidates = new Set<string>();

    for (const app of toMigrate) {
      const stageHistory = app.stageHistory || [];
      stageHistory.push({
        stage: "matched_candidates" as any,
        enteredAt: new Date(now).toISOString(),
        changedBy: "system_migration",
      });

      await ctx.db.patch(app._id, {
        currentStage: "matched_candidates" as any,
        lastStageChangedAt: now,
        stageHistory,
      });

      // Update stage counts on job (decrement new_cvs, increment matched_candidates)
      await adjustJobStageStat(ctx, app.jobId, "new_cvs", "matched_candidates");

      affectedCandidates.add(String(app.candidateId));
    }

    // Sync overall status for candidates affected in this batch
    for (const candIdStr of affectedCandidates) {
      await syncCandidateOverallStatus(ctx, candIdStr as any);
    }

    return {
      migratedCount: toMigrate.length,
      isDone: toMigrate.length < limit,
    };
  },
});

/**
 * Action runner: Iteratively processes batches until all stuck manual directory apps
 * are moved from 'new_cvs' to 'matched_candidates'.
 */
export const runFullManualDirectoryMigration = action({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 150;
    let totalMigrated = 0;
    let iterations = 0;
    const maxIterations = 50; // Safety brake

    while (iterations < maxIterations) {
      iterations++;
      const res: any = await ctx.runMutation(
        api.admin.migrateManualDirectoryApps.migrateManualDirectoryAppsBatch,
        { batchSize }
      );

      totalMigrated += res.migratedCount;
      console.log(`[Migration] Iteration #${iterations}: Migrated ${res.migratedCount} applications (Total: ${totalMigrated})`);

      if (res.isDone || res.migratedCount === 0) {
        break;
      }
    }

    return {
      success: true,
      totalMigrated,
      iterations,
    };
  },
});
