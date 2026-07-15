import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel.d.ts";

/**
 * Helper to get vector embeddings from NVIDIA API
 */
export async function embedText(text: string, inputType: "query" | "passage" = "query"): Promise<number[]> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY environment variable not set.");
  }

  const response = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      input: [text],
      model: "nvidia/nv-embedqa-e5-v5",
      input_type: inputType,
      encoding_format: "float",
      truncate: "END"
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA API Error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  if (!data.data || !data.data[0] || !data.data[0].embedding) {
    throw new Error("Invalid response format from NVIDIA Embedding API");
  }

  return data.data[0].embedding;
}

/**
 * Internal action to embed a candidate's full text and save it to the DB.
 */
export const generateAndStoreEmbedding = internalAction({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const candidate = await ctx.runQuery(internal.matching.queries.getCandidate, { candidateId: args.candidateId });
    if (!candidate) return;

    const resume = await ctx.runQuery(internal.matching.queries.getCandidateResume, { candidateId: args.candidateId });
    if (!resume || !resume.rawText) return;

    const textToEmbed = resume.rawText.slice(0, 15000); 
    const embedding = await embedText(textToEmbed, "passage");

    await ctx.runMutation(internal.matching.queries.updateCandidateEmbedding, {
      candidateId: args.candidateId,
      embedding,
    });
  },
});

export const generateJobEmbedding = action({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args): Promise<void> => {
    const job = await ctx.runQuery(api.jobs.jobs.getJob, { jobId: args.jobId });
    if (!job) return;

    const jobRequirementsText = `
      Title: ${job.title}
      Description: ${job.jobDescription}
      Required Skills: ${(job.requiredSkills || []).join(", ")}
      Nice to have Skills: ${(job.niceToHaveSkills || []).join(", ")}
      Industry: ${job.clientIndustry || ""}
      Seniority: ${job.seniorityLevel || ""}
    `;

    const jobEmbedding = await embedText(jobRequirementsText);
    
    await ctx.runMutation(internal.matching.queries.updateJobEmbedding, {
      jobId: args.jobId,
      embedding: jobEmbedding,
    });
  }
});

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Reverse Match using Vector Search and Keyword Matching
 */
export const runReverseMatch = action({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args): Promise<void> => {
    try {
      const job = await ctx.runQuery(api.jobs.jobs.getJob, { jobId: args.jobId });
      if (!job) return;

      // Set status to running immediately
      await ctx.runMutation(internal.jobs.jobs.saveReverseMatchResults, {
        jobId: args.jobId,
        results: job.reverseMatchResults || [],
        status: "running",
      });

      let jobEmbedding = job.embedding;

      // 1. Generate job embedding if missing
      if (!jobEmbedding || jobEmbedding.length === 0) {
        const jobRequirementsText = `
          Title: ${job.title}
          Description: ${job.jobDescription}
          Required Skills: ${(job.requiredSkills || []).join(", ")}
          Nice to have Skills: ${(job.niceToHaveSkills || []).join(", ")}
          Industry: ${job.clientIndustry || ""}
          Seniority: ${job.seniorityLevel || ""}
        `;

        jobEmbedding = await embedText(jobRequirementsText);
        
        // Save the embedding to the job record
        await ctx.runMutation(internal.matching.queries.updateJobEmbedding, {
          jobId: args.jobId,
          embedding: jobEmbedding,
        });
      }

      // 2. Perform Keyword Search (Pool limit widened to 100)
      const terms: string[] = [];
      if (job.title) terms.push(job.title);
      for (const s of (job.requiredSkills ?? []).slice(0, 4)) terms.push(s);
      
      const batches = await Promise.all(
        terms.slice(0, 6).map((term) =>
          ctx.runQuery(api.matching.search.searchCandidates, {
            query: term,
            industry: job.clientIndustry ?? undefined,
            seniority: job.seniorityLevel ?? undefined,
            limit: 100,
          })
        )
      );

      const dedupedKeywordsMap = new Map<string, any>();
      for (const batch of batches) {
        for (const cv of batch) {
          if (cv && cv._id) {
            dedupedKeywordsMap.set(cv._id.toString(), cv);
          }
        }
      }

      // 3. Perform Vector Search across all candidates (Pool limit widened to 256)
      const results = await ctx.vectorSearch("candidateResumes", "vector_index_candidates", {
        vector: jobEmbedding,
        limit: 256,
      });

      const vectorResultsMap = new Map<string, number>();
      if (results.length > 0) {
        const mappedResumes = await ctx.runQuery(internal.matching.queries.getCandidatesByResumeIds, {
          resumeIds: results.map((r) => r._id),
        });
        const resumeIdToCandidateId = new Map(mappedResumes.map((item: any) => [item.resumeId, item.candidate._id]));
        for (const r of results) {
          const cId = resumeIdToCandidateId.get(r._id);
          if (cId) {
            vectorResultsMap.set(cId.toString(), r._score);
          }
        }
      }

      // 4. Generate missing embeddings on the fly for keyword-matched candidates (up to 15)
      // Only check candidates not returned by vector search
      const keywordCandidateIdsMissingEmbeddings = Array.from(dedupedKeywordsMap.keys()).filter(id => !vectorResultsMap.has(id));
      const keywordResumes = await ctx.runQuery(internal.matching.queries.getCandidateResumesBatch, {
        candidateIds: keywordCandidateIdsMissingEmbeddings as Id<"candidates">[]
      });
      const keywordResumeMap = new Map(keywordResumes.map((r: any) => [r.candidateId, r]));

      const missingEmbeddings = Array.from(dedupedKeywordsMap.values()).filter(
        cv => {
          if (vectorResultsMap.has(cv._id.toString())) return false; // Already has embedding from vector search
          const resume: any = keywordResumeMap.get(cv._id);
          return !resume || !resume.embedding || resume.embedding.length === 0;
        }
      );

      if (missingEmbeddings.length > 0) {
        const limitToEmbed = missingEmbeddings.slice(0, 15);
        await Promise.all(
          limitToEmbed.map(async (cv) => {
            try {
              const resume: any = keywordResumeMap.get(cv._id);
              if (resume && resume.rawText) {
                const textToEmbed = resume.rawText.slice(0, 15000);
                const embedding = await embedText(textToEmbed, "passage");
                await ctx.runMutation(internal.matching.queries.updateCandidateEmbedding, {
                  candidateId: cv._id,
                  embedding,
                });
                resume.embedding = embedding; // Update in-memory reference
              }
            } catch (err) {
              console.error(`Failed to generate on-the-fly embedding for candidate ${cv._id}:`, err);
            }
          })
        );
      }

      // 5. Merge, enrich, and calculate similarity scores
      // Get existing results
      const existingResults = job.reverseMatchResults || [];

      // Get applications for checking human actions/shortlists
      const applications = await ctx.runQuery(internal.matching.queries.getApplicationsByJobIdInternal, { jobId: args.jobId });
      const appliedCandidateIds = new Set(
        (applications || []).map((app) => app.candidateId.toString())
      );

      // Keep only previously matched candidates who exist in the applications table (bounded growth)
      const existingToKeep = existingResults.filter((r) => appliedCandidateIds.has(r.cvId));
      const existingToKeepIds = existingToKeep.map(r => r.cvId);

      const allCandidateIds = new Set<string>([
        ...Array.from(vectorResultsMap.keys()),
        ...Array.from(dedupedKeywordsMap.keys()),
        ...existingToKeepIds, // Merge previously matched candidates with TA actions
      ]);

      // Fetch candidateResumes only for candidates that we don't have vector search scores for (Lean read optimization)
      const needResumesIds = Array.from(allCandidateIds).filter(id => !vectorResultsMap.has(id));
      const neededResumes = await ctx.runQuery(internal.matching.queries.getCandidateResumesBatch, {
        candidateIds: needResumesIds as Id<"candidates">[]
      });
      const resumeMap = new Map(neededResumes.map((r: any) => [r.candidateId, r]));

      const enrichedCandidates: any[] = [];
      for (const cid of allCandidateIds) {
        let candidate = dedupedKeywordsMap.get(cid);
        if (!candidate) {
          candidate = await ctx.runQuery(internal.matching.queries.getCandidate, {
            candidateId: cid as any,
          });
        }
        if (!candidate) continue;

        let score = vectorResultsMap.get(cid);
        if (score === undefined) {
          const resume: any = resumeMap.get(cid);
          if (resume && resume.embedding && resume.embedding.length > 0) {
            score = cosineSimilarity(jobEmbedding, resume.embedding);
          } else {
            score = 0;
          }
        }

        enrichedCandidates.push({ candidate, vectorScore: score });
      }

      const { scoreCandidateAgainstRequirements } = await import("../cvs/cvScoring.js");

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

      const matchResults = enrichedCandidates
        .map(c => {
          const cv = c.candidate;
          
          const cvPayload = {
            _id: cv._id,
            fullName: cv.fullName,
            currentTitle: cv.currentTitle,
            currentEmployer: cv.currentEmployer,
            industries: cv.industries,
            seniorityLevel: cv.seniorityLevel,
            yearsOfExperience: cv.yearsOfExperience || cv.totalExperienceYears,
            location: cv.location,
            skills: cv.skills,
            rawText: undefined, // Lean matching pattern: bypass loading massive raw CV texts
            summary: cv.summary,
          };

          const scored = scoreCandidateAgainstRequirements(cvPayload as any, req as any, 0);

          const matchScore = Math.round(
            (scored.titleScore * ((job.scoreWeightJobTitle ?? 30) / 100)) +
            (scored.skillScore * ((job.scoreWeightSkills ?? 35) / 100)) +
            (scored.experienceScore * ((job.scoreWeightExperience ?? 15) / 100)) +
            (scored.industryScore * ((job.scoreWeightIndustry ?? 15) / 100)) +
            (scored.locationScore * ((job.scoreWeightLocation ?? 5) / 100))
          );

          return {
            cvId: cv._id,
            overallScore: matchScore,
            breakdown: {
              skills: scored.skillScore, 
              experience: scored.experienceScore,
              seniority: scored.seniorityScore,
              industry: scored.industryScore,
              location: scored.locationScore,
            },
            matchedSkills: scored.matchedRequired,
            missingSkills: scored.missingRequired,
            reason: `AI Match score: ${matchScore}% (vector similarity: ${(c.vectorScore * 100).toFixed(1)}%)`,
            sourceLevel1: cv.firstSourceChannel ?? undefined,
            sourceLevel2: cv.firstSourceJobId ?? undefined,
          };
        });

      // Sort all candidates by overall score descending (soft ranking gate)
      matchResults.sort((a, b) => b.overallScore - a.overallScore);

      // Slice the top 30 as new matches
      const newTop30 = matchResults.slice(0, 30);
      const newTop30Ids = new Set(newTop30.map(r => r.cvId));

      // Append any previously matched TA-acted candidates who fell out of the top 30
      const extraExistingMatches = matchResults.filter(
        r => existingToKeepIds.includes(r.cvId) && !newTop30Ids.has(r.cvId)
      );

      const finalResults = [...newTop30, ...extraExistingMatches];

      await ctx.runMutation(internal.jobs.jobs.saveReverseMatchResults, {
        jobId: args.jobId,
        results: finalResults,
        status: "done",
      });

    } catch (e) {
      console.error("Reverse match vector search error:", e);
      const job = await ctx.runQuery(api.jobs.jobs.getJob, { jobId: args.jobId });
      await ctx.runMutation(internal.jobs.jobs.saveReverseMatchResults, {
        jobId: args.jobId,
        results: job?.reverseMatchResults || [],
        status: "error",
      });
    }
  },
});

/**
 * Action to recursively backfill embeddings for all candidate resumes in batches.
 * Paced at 15 candidates per run with 30s delay to respect NVIDIA rate limits (40 RPM).
 */
export const backfillCandidateEmbeddings = action({
  args: { batchSize: v.optional(v.number()), cursor: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ processed: number; remaining: number; continueCursor?: string }> => {
    const limit = args.batchSize ?? 15;

    // Find resumes missing embeddings using paginated scan
    const result = await ctx.runQuery(internal.matching.queries.getCandidateResumesMissingEmbeddings, {
      limit,
      cursor: args.cursor,
    });

    const missing = result.missing;

    if (missing.length === 0) {
      if (!result.isDone) {
        // If we hit the end of this batch's scan but there are still pages left in the DB, schedule next page scan
        await ctx.scheduler.runAfter(30000, api.matching.agent2.backfillCandidateEmbeddings, {
          batchSize: limit,
          cursor: result.continueCursor ?? undefined,
        });
      }
      return { processed: 0, remaining: result.isDone ? 0 : 999 };
    }

    let processed = 0;
    for (const resume of missing) {
      try {
        if (resume.rawText && resume.rawText.trim()) {
          const textToEmbed = resume.rawText.slice(0, 15000);
          const embedding = await embedText(textToEmbed, "passage");
          await ctx.runMutation(internal.matching.queries.updateCandidateEmbedding, {
            candidateId: resume.candidateId,
            embedding,
          });
          processed++;
        } else {
          // If candidate resume has no raw text, embed a dummy text to avoid infinite loops
          const embedding = await embedText("Empty resume profile placeholder", "passage");
          await ctx.runMutation(internal.matching.queries.updateCandidateEmbedding, {
            candidateId: resume.candidateId,
            embedding,
          });
          processed++;
        }
      } catch (err) {
        console.error(`Failed to backfill embedding for candidate ${resume.candidateId}:`, err);
      }
    }

    if (!result.isDone) {
      // Pacing delay: 30 seconds between batches to stay under NVIDIA NIM 40 RPM rate limit
      await ctx.scheduler.runAfter(30000, api.matching.agent2.backfillCandidateEmbeddings, {
        batchSize: limit,
        cursor: result.continueCursor ?? undefined,
      });
    }

    return {
      processed,
      remaining: result.isDone ? 0 : 999,
      continueCursor: result.continueCursor ?? undefined,
    };
  },
});
