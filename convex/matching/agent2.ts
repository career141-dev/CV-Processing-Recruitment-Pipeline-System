// @ts-nocheck
import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel.d.ts";

/**
 * Helper to get vector embeddings from NVIDIA API
 */
export async function embedText(
  text: string,
  inputType: "query" | "passage" = "query"
): Promise<{ embedding: number[]; usage: { promptTokens: number; model: string } }> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY environment variable not set.");
  }

  const sanitized = text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFD]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) {
    throw new Error("Text is empty after sanitization");
  }

  const response = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      input: [sanitized],
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

  const promptTokens = data.usage?.prompt_tokens ?? 0;
  return {
    embedding: data.data[0].embedding,
    usage: {
      promptTokens,
      model: "nvidia/nv-embedqa-e5-v5",
    },
  };
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
    try {
      const { embedding, usage } = await embedText(textToEmbed, "passage");

      await ctx.runMutation(internal.matching.queries.updateCandidateEmbedding, {
        candidateId: args.candidateId,
        embedding,
      });

      await ctx.runMutation(internal.stats.stats.logNvidiaCallsBatchMutation, {
        logs: [
          {
            taskType: "embedding",
            model: usage.model,
            promptTokens: usage.promptTokens,
            completionTokens: 0,
            success: true,
            cvUploadId: candidate.cvUploadId ?? undefined,
          }
        ]
      });
    } catch (err) {
      await ctx.runMutation(internal.stats.stats.logNvidiaCallsBatchMutation, {
        logs: [
          {
            taskType: "embedding",
            model: "nvidia/nv-embedqa-e5-v5",
            promptTokens: 0,
            completionTokens: 0,
            success: false,
            error: err instanceof Error ? err.message : String(err),
            cvUploadId: candidate.cvUploadId ?? undefined,
          }
        ]
      });
      throw err;
    }
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

    try {
      const { embedding: jobEmbedding, usage } = await embedText(jobRequirementsText);
      await ctx.runMutation(internal.matching.queries.updateJobEmbedding, {
        jobId: args.jobId,
        embedding: jobEmbedding,
      });

      await ctx.runMutation(internal.stats.stats.logNvidiaCallsBatchMutation, {
        logs: [
          {
            taskType: "embedding",
            model: usage.model,
            promptTokens: usage.promptTokens,
            completionTokens: 0,
            success: true,
          }
        ]
      });
    } catch (err) {
      await ctx.runMutation(internal.stats.stats.logNvidiaCallsBatchMutation, {
        logs: [
          {
            taskType: "embedding",
            model: "nvidia/nv-embedqa-e5-v5",
            promptTokens: 0,
            completionTokens: 0,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }
        ]
      });
      throw err;
    }
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
    const tokenLogs: any[] = [];
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

        try {
          const embedResult = await embedText(jobRequirementsText);
          jobEmbedding = embedResult.embedding;
          tokenLogs.push({
            taskType: "embedding",
            model: embedResult.usage.model,
            promptTokens: embedResult.usage.promptTokens,
            completionTokens: 0,
            success: true,
          });

          // Save the embedding to the job record
          await ctx.runMutation(internal.matching.queries.updateJobEmbedding, {
            jobId: args.jobId,
            embedding: jobEmbedding,
          });
        } catch (err) {
          tokenLogs.push({
            taskType: "embedding",
            model: "nvidia/nv-embedqa-e5-v5",
            promptTokens: 0,
            completionTokens: 0,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
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

      const dedupedKeywordsMap = new Map<string, { candidateId: Id<"candidates">; score: number }>();
      for (const batch of batches) {
        for (const result of batch) {
          if (result && result.candidateId) {
            const cIdStr = result.candidateId.toString();
            if (!dedupedKeywordsMap.has(cIdStr)) {
              dedupedKeywordsMap.set(cIdStr, { candidateId: result.candidateId, score: result.score });
            }
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
        const mappedResumes = await ctx.runQuery(internal.matching.queries.getCandidateIdsByResumeIds, {
          resumeIds: results.map((r) => r._id),
        });
        const resumeIdToCandidateId = new Map(mappedResumes.map((item) => [item.resumeId, item.candidateId]));
        for (const r of results) {
          const cId = resumeIdToCandidateId.get(r._id);
          if (cId) {
            vectorResultsMap.set(cId.toString(), r._score);
          }
        }
      }

      // 4. Deduplicate all candidate IDs in memory
      const allCandidateIdStrings = new Set<string>([
        ...Array.from(vectorResultsMap.keys()),
        ...Array.from(dedupedKeywordsMap.keys()),
      ]);

      // 5. Batch fetch full candidate documents in a single query
      const allCandidateIds = Array.from(allCandidateIdStrings) as Id<"candidates">[];
      let candidatesMap = new Map<string, any>();
      if (allCandidateIds.length > 0) {
        const candidates = await ctx.runQuery(internal.matching.queries.getCandidatesBatch, {
          candidateIds: allCandidateIds,
        });
        for (const c of candidates) {
          candidatesMap.set(c._id.toString(), c);
        }
      }

      // 6. Generate missing embeddings on the fly for keyword-matched candidates (up to 15)
      // Only check candidates not returned by vector search
      const keywordCandidateIdsMissingEmbeddings = Array.from(dedupedKeywordsMap.keys()).filter(id => !vectorResultsMap.has(id));
      const keywordResumes = await ctx.runQuery(internal.matching.queries.getCandidateResumesBatch, {
        candidateIds: keywordCandidateIdsMissingEmbeddings as Id<"candidates">[]
      });
      const keywordResumeMap = new Map(keywordResumes.map((r: any) => [r.candidateId, r]));

      const missingEmbeddings = Array.from(dedupedKeywordsMap.values()).filter(
        k => {
          const cIdStr = k.candidateId.toString();
          if (vectorResultsMap.has(cIdStr)) return false; // Already has embedding from vector search
          const resume: any = keywordResumeMap.get(k.candidateId);
          return !resume || !resume.embedding || resume.embedding.length === 0;
        }
      );

      if (missingEmbeddings.length > 0) {
        const limitToEmbed = missingEmbeddings.slice(0, 15);
        await Promise.all(
          limitToEmbed.map(async (k) => {
            try {
              const resume: any = keywordResumeMap.get(k.candidateId);
              if (resume && resume.rawText) {
                const textToEmbed = resume.rawText.slice(0, 15000);
                const embedResult = await embedText(textToEmbed, "passage");
                const embedding = embedResult.embedding;
                await ctx.runMutation(internal.matching.queries.updateCandidateEmbedding, {
                  candidateId: k.candidateId,
                  embedding,
                });
                resume.embedding = embedding; // Update in-memory reference
                const cand = candidatesMap.get(k.candidateId.toString());
                tokenLogs.push({
                  taskType: "embedding",
                  model: embedResult.usage.model,
                  promptTokens: embedResult.usage.promptTokens,
                  completionTokens: 0,
                  success: true,
                  cvUploadId: cand?.cvUploadId ?? undefined,
                });
              }
            } catch (err) {
              console.error(`Failed to generate on-the-fly embedding for candidate ${k.candidateId}:`, err);
              const cand = candidatesMap.get(k.candidateId.toString());
              tokenLogs.push({
                taskType: "embedding",
                model: "nvidia/nv-embedqa-e5-v5",
                promptTokens: 0,
                completionTokens: 0,
                success: false,
                error: err instanceof Error ? err.message : String(err),
                cvUploadId: cand?.cvUploadId ?? undefined,
              });
            }
          })
        );
      }

      // 7. Merge, enrich, and calculate similarity scores
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

      // Include existing TA-acted candidates in the final set
      for (const cId of existingToKeepIds) {
        if (!candidatesMap.has(cId)) {
          const cand = await ctx.runQuery(internal.matching.queries.getCandidate, { candidateId: cId as Id<"candidates"> });
          if (cand) candidatesMap.set(cId, cand);
        }
      }

      const enrichedCandidates: any[] = [];

      for (const id of allCandidateIdStrings) {
        const keywordMatch = dedupedKeywordsMap.get(id);
        const vectorScore = vectorResultsMap.get(id);
        const cand = candidatesMap.get(id);

        if (!cand) continue;

        if (vectorScore !== undefined) {
          // If returned by vector search, use vector search score
          enrichedCandidates.push({
            candidate: cand,
            vectorScore,
          });
        } else if (keywordMatch) {
          // If only returned by keyword search, calculate cosine similarity dynamically
          const resume: any = keywordResumeMap.get(id as Id<"candidates">);
          if (resume && resume.embedding && resume.embedding.length > 0) {
            const similarity = cosineSimilarity(jobEmbedding, resume.embedding);
            enrichedCandidates.push({
              candidate: cand,
              vectorScore: similarity,
            });
          }
        }
      }

      // Add existing TA-acted candidates not in allCandidateIdStrings with default score
      for (const cId of existingToKeepIds) {
        if (!allCandidateIdStrings.has(cId)) {
          const cand = candidatesMap.get(cId);
          if (cand) {
            enrichedCandidates.push({
              candidate: cand,
              vectorScore: 0.5, // Default mid score
            });
          }
        }
      }

      // 6. Run scoring engine logic
      const { scoreCandidateAgainstRequirements } = await import("../cvs/cvScoring.js");
      const matchResults = enrichedCandidates
        .map(c => {
          const cv = c.candidate;

          const cvPayload = {
            _id: cv._id,
            fullName: cv.fullName,
            email: cv.email,
            phone: cv.phone,
            location: cv.location,
            currentJobTitle: cv.currentJobTitle,
            currentEmployer: cv.currentEmployer,
            totalExperienceYears: cv.totalExperienceYears,
            skills: cv.skills,
            educationDegree: cv.educationDegree,
            educationInstitution: cv.educationInstitution,
            educationYear: cv.educationYear,
            expectedSalary: cv.expectedSalary,
            availability: cv.availability,
            languages: cv.languages,
            certifications: cv.certifications,
            noticePeriodDays: cv.noticePeriodDays,
          };

          const scored = scoreCandidateAgainstRequirements(cvPayload, {
            title: job.title,
            requiredSkills: job.requiredSkills ?? [],
            niceToHaveSkills: job.niceToHaveSkills ?? [],
            minYearsExperience: job.experienceMinYears ?? null,
            education: job.educationLevel ?? null,
            languages: job.languagesRequired ?? [],
            location: job.location,
            industry: job.clientIndustry,
            seniority: job.seniorityLevel,
            summary: job.jobDescription,
            keywords: [],
          });

          // Overall score is weighted average between vector similarity and heuristics
          const heuristicsWeight = 0.4;
          const vectorWeight = 0.6;
          const matchScore = Math.round(
            (scored.overallScore * heuristicsWeight) + ((c.vectorScore * 100) * vectorWeight)
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
            candidateName: cv.fullName ?? undefined,
            candidateRole: cv.currentTitle ?? cv.currentJobTitle ?? undefined,
            candidateExp: cv.yearsOfExperience ?? cv.totalExperienceYears ?? undefined,
          };
        });

      // Sort all candidates by overall score descending
      matchResults.sort((a, b) => b.overallScore - a.overallScore);

      // STRICT Filter Gate: Only keep candidates who meet the minimum score threshold
      const minScore = job.minMatchScoreToShow ?? 60;
      const filteredMatches = matchResults.filter(r => r.overallScore >= minScore);

      // Slice the top 30 from the filtered matches
      const newTop30 = filteredMatches.slice(0, 30);
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

      if (tokenLogs.length > 0) {
        await ctx.runMutation(internal.stats.stats.logNvidiaCallsBatchMutation, {
          logs: tokenLogs,
        });
      }

    } catch (e) {
      console.error("Reverse match vector search error:", e);
      const job = await ctx.runQuery(api.jobs.jobs.getJob, { jobId: args.jobId });
      await ctx.runMutation(internal.jobs.jobs.saveReverseMatchResults, {
        jobId: args.jobId,
        results: job?.reverseMatchResults || [],
        status: "error",
      });

      if (tokenLogs.length > 0) {
        try {
          await ctx.runMutation(internal.stats.stats.logNvidiaCallsBatchMutation, {
            logs: tokenLogs,
          });
        } catch (logErr) {
          console.error("Failed to write token logs on error path:", logErr);
        }
      }
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
    const tokenLogs: any[] = [];
    for (const resume of missing) {
      try {
        if (resume.rawText && resume.rawText.trim()) {
          const textToEmbed = resume.rawText.slice(0, 15000);
          const embedResult = await embedText(textToEmbed, "passage");
          const embedding = embedResult.embedding;
          await ctx.runMutation(internal.matching.queries.updateCandidateEmbedding, {
            candidateId: resume.candidateId,
            embedding,
          });
          tokenLogs.push({
            taskType: "embedding",
            model: embedResult.usage.model,
            promptTokens: embedResult.usage.promptTokens,
            completionTokens: 0,
            success: true,
          });
          processed++;
        } else {
          // If candidate resume has no raw text, embed a dummy text to avoid infinite loops
          const embedResult = await embedText("Empty resume profile placeholder", "passage");
          const embedding = embedResult.embedding;
          await ctx.runMutation(internal.matching.queries.updateCandidateEmbedding, {
            candidateId: resume.candidateId,
            embedding,
          });
          tokenLogs.push({
            taskType: "embedding",
            model: embedResult.usage.model,
            promptTokens: embedResult.usage.promptTokens,
            completionTokens: 0,
            success: true,
          });
          processed++;
        }
      } catch (err) {
        console.error(`Failed to backfill embedding for candidate ${resume.candidateId}:`, err);
        tokenLogs.push({
          taskType: "embedding",
          model: "nvidia/nv-embedqa-e5-v5",
          promptTokens: 0,
          completionTokens: 0,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (tokenLogs.length > 0) {
      try {
        await ctx.runMutation(internal.stats.stats.logNvidiaCallsBatchMutation, {
          logs: tokenLogs,
        });
      } catch (logErr) {
        console.error("Failed to write backfill token logs:", logErr);
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
