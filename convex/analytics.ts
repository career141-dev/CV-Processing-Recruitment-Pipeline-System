import { query } from "./_generated/server";

/**
 * Overview metrics for the Analytics dashboard.
 * 
 * UPDATED: Now calculates stats live from the DB instead of relying on cached systemStats.
 */
export const getOverviewMetrics = query({
  args: {},
  handler: async (ctx) => {
    // 1. Calculate live Total CVs
    const allUploads = await ctx.db.query("cvUploads").collect();
    const totalCVs = allUploads.length;

    // 2. Read only active jobs
    const activeJobs = await ctx.db.query("jobs")
      .withIndex("by_status", q => q.eq("status", "active"))
      .collect();

    // 3. Aggregate pipeline stage counts from per-job stageCounts (which are updated transactionally in real-time)
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

    // 5. Live Source distribution (Last 30 Days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const sourceTotals: Record<string, number> = {};
    let totalFromSources = 0;
    
    for (const upload of allUploads) {
      if (upload._creationTime >= thirtyDaysAgo) {
        const source = upload.source || "database";
        sourceTotals[source] = (sourceTotals[source] || 0) + 1;
        totalFromSources++;
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
