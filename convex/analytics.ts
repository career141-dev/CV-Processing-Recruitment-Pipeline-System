import { query } from "./_generated/server";

export const getOverviewMetrics = query({
  args: {},
  handler: async (ctx) => {
    const applications = await ctx.db.query("applications").collect();
    const jobs = await ctx.db.query("jobs").collect();

    // 1. Basic Counts
    const totalCVs = applications.length;
    const activeJobs = jobs.filter(j => j.status === "active").length;

    // 2. Shortlisted Count
    const shortlistStages = ["ta_shortlist", "second_shortlist", "director_shortlist", "client_review"];
    const shortlisted = applications.filter(app => shortlistStages.includes(app.currentStage)).length;

    // 3. Interviews Count
    const interviews = applications.filter(app => app.currentStage === "interview").length;

    // 4. Placements Count
    const placements = applications.filter(app => app.currentStage === "placed").length;

    // 5. Source Distribution (for Donut Chart)
    const sources: Record<string, number> = {};
    for (const app of applications) {
      const source = app.sourceChannel || "unknown";
      sources[source] = (sources[source] || 0) + 1;
    }
    
    // Convert to array and sort by count descending
    const sourceDistribution = Object.entries(sources)
      .map(([name, count]) => ({ name, count, percentage: Math.round((count / Math.max(totalCVs, 1)) * 100) }))
      .sort((a, b) => b.count - a.count);

    // 6. Pipeline Distribution (for Bar Chart)
    const pipelineStages = [
      { id: "new_cvs", label: "New CVs" },
      { id: "matched_candidates", label: "Matched" },
      { id: "ta_shortlist", label: "TA Shortlist" },
      { id: "ai_call", label: "AI Screened" },
      { id: "director_shortlist", label: "Director Review" },
      { id: "client_review", label: "Client Review" },
      { id: "interview", label: "Interview" },
      { id: "offer", label: "Offer" },
      { id: "placed", label: "Placed" }
    ];

    const pipelineDistribution = pipelineStages.map(stage => {
      const count = applications.filter(app => app.currentStage === stage.id).length;
      return {
        ...stage,
        count,
        percentage: Math.round((count / Math.max(totalCVs, 1)) * 100)
      };
    });

    return {
      totalCVs,
      activeJobs,
      shortlisted,
      interviews,
      placements,
      sourceDistribution,
      pipelineDistribution
    };
  }
});
