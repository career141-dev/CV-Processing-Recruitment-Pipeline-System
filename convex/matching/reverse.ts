import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel.d.ts";
import { getOpenAI, getModelForTask } from "../lib/llm";


type Breakdown = {
  skills: number;
  experience: number;
  seniority: number;
  industry: number;
  location: number;
};

type ReverseMatchResult = {
  cvId: string;
  overallScore: number;
  breakdown: Breakdown;
  matchedSkills: string[];
  missingSkills: string[];
  reason: string;
  sourceLevel1?: string;
  sourceLevel2?: string;
};

// Reverse Match: scan the full candidate database against a published job
// Triggered automatically on publish (when reverseMatchOnPublish is true) and via
// the manual "rescan" button. Scores candidates with AI and saves a ranked shortlist.
export const runReverseMatch = action({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args): Promise<void> => {
    try {
      const job = await ctx.runQuery(api.jobs.jobs.getJob, { jobId: args.jobId });
      if (!job) return;

      const minScore = job.minMatchScoreToShow ?? 60;

      // Build search terms from the structured job fields, falling back to the
      // free-text description. These pull the broadest relevant candidate set.
      const terms: string[] = [];
      if (job.title) terms.push(job.title);
      for (const s of (job.requiredSkills ?? []).slice(0, 4)) terms.push(s);
      if (terms.length === 0 && job.jobDescription) {
        for (const t of job.jobDescription
          .split(/[\n,;]+/)
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 3 && s.length < 60)
          .slice(0, 4)) {
          terms.push(t);
        }
      }

      // Fetch candidates for each term in parallel, then dedupe.
      const batches = await Promise.all(
        terms.slice(0, 6).map((term) =>
          ctx.runQuery(api.matching.search.searchCandidates, {
            query: term,
            industry: job.clientIndustry ?? undefined,
            seniority: job.seniorityLevel ?? undefined,
            limit: 40,
          })
        )
      );

      const seen = new Set<string>();
      const candidates: any[] = [];
      for (const batch of batches) {
        for (const cv of batch) {
          if (!seen.has(cv._id)) {
            seen.add(cv._id);
            candidates.push(cv);
          }
        }
      }

      if (candidates.length === 0) {
        await ctx.runMutation(internal.jobs.jobs.saveReverseMatchResults, {
          jobId: args.jobId,
          results: [],
          status: "done",
        });
        return;
      }

      // Compact candidate payload for the scoring model (cap at 40).
      const pool = candidates.slice(0, 40);
      
      const allResumes = await ctx.runQuery(internal.matching.queries.getCandidateResumesBatch, {
        candidateIds: pool.map(c => c._id)
      });
      const resumeMap = new Map(allResumes.map((r: any) => [r.candidateId, r]));

      const candidateSummaries = pool.map((cv, i) => ({
        index: i,
        name: cv.fullName ?? cv.email ?? "Unknown",
        title: cv.currentJobTitle ?? "",
        industry: cv.clientIndustry ?? "", 
        seniority: cv.seniorityLevel ?? "",
        years: cv.totalExperienceYears ?? null,
        location: cv.location ?? "",
        skills: (cv.skills ?? []).slice(0, 8).join(", "),
        snippet: ((resumeMap.get(cv._id) as any)?.rawText ?? "").slice(0, 400),
      }));

      const jobReq = {
        title: job.title,
        requiredSkills: job.requiredSkills ?? [],
        niceToHaveSkills: job.niceToHaveSkills ?? [],
        seniority: job.seniorityLevel ?? null,
        minYearsExperience: job.experienceMinYears ?? null,
        industry: job.clientIndustry ?? null,
        location: job.location ?? null,
        summary: job.jobDescription.slice(0, 1500),
      };

      const model = getModelForTask("jd_matching");
      const openai = getOpenAI("jd_matching");

      type ScoreItem = {
        index: number;
        overallScore: number;
        breakdown: Breakdown;
        matchedSkills: string[];
        missingSkills: string[];
        reason: string;
      };

      let scored: ScoreItem[] = [];
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        const scoreResponse = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content: `You are a talent matching expert. Score each candidate against a job's requirements.
For each candidate return a breakdown score (0-100) across 5 dimensions, plus which required skills they have/lack.
Return JSON:
{
  "matches": [
    {
      "index": number,
      "overallScore": 0-100,
      "breakdown": { "skills": 0-100, "experience": 0-100, "seniority": 0-100, "industry": 0-100, "location": 0-100 },
      "matchedSkills": ["skill1", ...],
      "missingSkills": ["skill1", ...],
      "reason": "1-2 sentence explanation of fit"
    }
  ]
}
Only include candidates with overallScore >= ${minScore}. Sort by overallScore descending. Max 30 results.`,
            },
            {
              role: "user",
              content: `Job Requirements:\n${JSON.stringify(jobReq, null, 2)}\n\nCandidates:\n${JSON.stringify(candidateSummaries, null, 2)}`,
            },
          ],
          response_format: { type: "json_object" },
        });

        inputTokens = scoreResponse.usage?.prompt_tokens || 0;
        outputTokens = scoreResponse.usage?.completion_tokens || 0;
        const content = scoreResponse.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(content) as { matches?: ScoreItem[] };
        scored = parsed.matches ?? [];

        await ctx.runMutation(internal.stats.stats.logNvidiaCallsBatchMutation, {
          logs: [
            {
              taskType: "jd_matching",
              model,
              promptTokens: inputTokens,
              completionTokens: outputTokens,
              success: true,
            }
          ]
        });
      } catch (err) {
        scored = [];
        await ctx.runMutation(internal.stats.stats.logNvidiaCallsBatchMutation, {
          logs: [
            {
              taskType: "jd_matching",
              model,
              promptTokens: inputTokens,
              completionTokens: outputTokens,
              success: false,
              error: err instanceof Error ? err.message : String(err),
            }
          ]
        });
      }

      const results: ReverseMatchResult[] = scored
        .filter((s) => s.index >= 0 && s.index < pool.length && s.overallScore >= minScore)
        .map((s) => {
          const cv = pool[s.index]!;
          return {
            cvId: cv._id,
            overallScore: s.overallScore,
            breakdown: s.breakdown,
            matchedSkills: s.matchedSkills ?? [],
            missingSkills: s.missingSkills ?? [],
            reason: s.reason ?? "",
            sourceLevel1: cv.firstSourceChannel ?? undefined,
            sourceLevel2: cv.firstSourceJobId ?? undefined,
          };
        })
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 30);

      await ctx.runMutation(internal.jobs.jobs.saveReverseMatchResults, {
        jobId: args.jobId,
        results,
        status: "done",
      });
    } catch (e) {
      console.error(e);
      await ctx.runMutation(internal.jobs.jobs.saveReverseMatchResults, {
        jobId: args.jobId,
        results: [],
        status: "error",
      });
    }
  },
});
