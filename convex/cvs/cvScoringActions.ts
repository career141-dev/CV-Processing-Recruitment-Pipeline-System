import { action, internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import { syncCandidateOverallStatus } from "../candidates/candidates";

// 1. Internal Query to get the necessary data for scoring
export const getScoringData = internalQuery({
  args: { candidateId: v.id("candidates"), jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    const job = await ctx.db.get(args.jobId);
    if (!candidate || !job) return null;

    // Get the application
    const application = await ctx.db.query("applications")
      .withIndex("by_candidate_job", (q) => q.eq("candidateId", args.candidateId).eq("jobId", args.jobId))
      .first();

    return { candidate, job, application };
  },
});

// 2. Internal Mutation to save the score and move pipeline stage if needed
export const saveMatchScore = internalMutation({
  args: {
    applicationId: v.id("applications"),
    jobId: v.id("jobs"),
    candidateId: v.id("candidates"),
    score: v.number(),
    reason: v.string(),
    minMatchScoreToShow: v.number(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) return;

    // Update application with score
    await ctx.db.patch(args.applicationId, {
      aiMatchScore: args.score,
      aiMatchExplanation: args.reason,
    });

    // Save to match_scores history
    await ctx.db.insert("match_scores", {
      jobId: args.jobId,
      candidateId: args.candidateId,
      score: args.score,
      scoredBy: "system",
      scoreSource: "search",
      scoredAt: new Date().toISOString(),
      trigger: "search",
    } as any);

    // If score >= minimum required, auto-advance pipeline to ta_shortlist
    if (args.score >= args.minMatchScoreToShow && app.currentStage === "new_cvs") {
      await ctx.db.patch(args.applicationId, {
        currentStage: "ta_shortlist",
        lastStageChangedAt: Date.now(),
      });
      await syncCandidateOverallStatus(ctx, args.candidateId);
    }
  },
});

export const processCvScoring = action({
  args: { candidateId: v.id("candidates"), jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    // 1. Get candidate and job
    const data = await ctx.runQuery(internal.cvs.cvScoringActions.getScoringData, {
      candidateId: args.candidateId,
      jobId: args.jobId,
    });
    
    if (!data || !data.application) {
      console.error("Failed to find candidate, job, or application for scoring");
      return;
    }
    
    const { candidate, job, application } = data;

    // 2. Build SearchRequirements from Job
    const req = {
      title: job.title,
      summary: job.jobDescription,
      requiredSkills: job.requiredSkills,
      preferredSkills: job.niceToHaveSkills ?? [],
      industry: job.clientIndustry,
      location: job.location,
      minYearsExperience: job.experienceMinYears,
      seniority: job.seniorityLevel,
      alternativeTitles: [],
    };

    // 3. Score candidate heuristically
    const { scoreCandidateAgainstRequirements, scoreWithLLM } = await import("./cvScoring.js");
    const scored = scoreCandidateAgainstRequirements(candidate as any, req as any, 0);

    // 4. Overwrite overallScore with weighted AI Config
    const weightedScore = Math.round(
      (scored.titleScore * ((job.scoreWeightJobTitle ?? 20) / 100)) +
      (scored.skillScore * ((job.scoreWeightSkills ?? 35) / 100)) +
      (scored.experienceScore * ((job.scoreWeightExperience ?? 25) / 100)) +
      (scored.industryScore * ((job.scoreWeightIndustry ?? 15) / 100)) +
      (scored.locationScore * ((job.scoreWeightLocation ?? 5) / 100))
    );

    // 5. Call LLM for deeper scoring
    const llmScore = await scoreWithLLM({ cv: candidate }, req as any);

    // Blend the scores (e.g., 60% Heuristic, 40% LLM)
    const finalScore = Math.round((weightedScore * 0.6) + (llmScore * 0.4));
    
    // 6. Save the final score
    await ctx.runMutation(internal.cvs.cvScoringActions.saveMatchScore, {
      applicationId: application._id,
      jobId: job._id,
      candidateId: candidate._id,
      score: finalScore,
      reason: `${scored.reason} (LLM Adjusted Score: ${llmScore})`,
      minMatchScoreToShow: job.minMatchScoreToShow ?? 60,
    });
  },
});
