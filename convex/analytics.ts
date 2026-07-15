import { query } from "./_generated/server";

/**
 * Overview metrics for the Analytics dashboard.
 * 
 * OPTIMIZED: Reads pre-computed counters instead of scanning full tables.
 * - Pipeline stage counts: aggregated from each job's `stageCounts` field
 * - Source distribution: read from `systemStats` singleton
 * - Basic counts: read from `systemStats` singleton
 * 
 * Total I/O: O(activeJobs) instead of O(allApplications + allJobs)
 */
export const getOverviewMetrics = query({
  args: {},
  handler: async (ctx) => {
    // 1. Read pre-computed global stats (O(1) — singleton lookup)
    const sysStat = await ctx.db.query("systemStats")
      .withIndex("by_singletonKey", q => q.eq("singletonKey", "global_stats"))
      .first();

    const totalCVs = sysStat?.totalApplications || 0;

    // 2. Read only active jobs (bounded, typically 30-50 jobs)
    const activeJobs = await ctx.db.query("jobs")
      .withIndex("by_status", q => q.eq("status", "active"))
      .collect();

    // 3. Aggregate pipeline stage counts from per-job stageCounts (already maintained by adjustJobStageStat)
    const globalStageCounts: Record<string, number> = {};
    for (const job of activeJobs) {
      const sc = job.stageCounts || {};
      for (const [stage, count] of Object.entries(sc)) {
        globalStageCounts[stage] = (globalStageCounts[stage] || 0) + (count as number);
      }
    }

    // 4. Compute derived metrics from the aggregated counts
    const shortlistStages = ["ta_shortlist", "second_shortlist", "director_shortlist", "client_review"];
    const shortlisted = shortlistStages.reduce((sum, s) => sum + (globalStageCounts[s] || 0), 0);
    const interviews = globalStageCounts["interview"] || 0;
    const placements = globalStageCounts["placed"] || 0;

    // 5. Source distribution from daily stats (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const dailyStats = await ctx.db.query("dailyStats")
      .withIndex("by_dateStr", q => q.gte("dateStr", thirtyDaysAgo))
      .collect();

    const sourceTotals: Record<string, number> = {};
    let totalFromSources = 0;
    for (const d of dailyStats) {
      if (d.cvsBySource) {
        for (const [source, count] of Object.entries(d.cvsBySource)) {
          sourceTotals[source] = (sourceTotals[source] || 0) + count;
          totalFromSources += count;
        }
      }
    }

    const sourceDistribution = Object.entries(sourceTotals)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / Math.max(totalFromSources, 1)) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // 6. Pipeline distribution for bar chart
    const pipelineStages = [
      { id: "new_cvs", label: "New CVs" },
      { id: "matched_candidates", label: "Matched" },
      { id: "ta_shortlist", label: "TA Shortlist" },
      { id: "ai_call", label: "AI Screened" },
      { id: "director_shortlist", label: "Director Review" },
      { id: "client_review", label: "Client Review" },
      { id: "interview", label: "Interview" },
      { id: "offer", label: "Offer" },
      { id: "placed", label: "Placed" },
    ];

    const totalStageCount = Object.values(globalStageCounts).reduce((a, b) => a + b, 0);
    const pipelineDistribution = pipelineStages.map((stage) => {
      const count = globalStageCounts[stage.id] || 0;
      return {
        ...stage,
        count,
        percentage: Math.round((count / Math.max(totalStageCount, 1)) * 100),
      };
    });

    return {
      totalCVs,
      activeJobs: activeJobs.length,
      shortlisted,
      interviews,
      placements,
      sourceDistribution,
      pipelineDistribution,
    };
  },
});
