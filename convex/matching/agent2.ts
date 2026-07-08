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
    if (!candidate || !candidate.rawText) return;

    // We can truncate to avoid massive payload. NVIDIA embedqa usually takes up to 4096 or 8192 tokens.
    const textToEmbed = candidate.rawText.slice(0, 15000); 
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

      const minScore = job.minMatchScoreToShow ?? 60;

      // 2. Perform Keyword Search
      const terms: string[] = [];
      if (job.title) terms.push(job.title);
      for (const s of (job.requiredSkills ?? []).slice(0, 4)) terms.push(s);
      
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

      const dedupedKeywordsMap = new Map<string, any>();
      for (const batch of batches) {
        for (const cv of batch) {
          if (cv && cv._id) {
            dedupedKeywordsMap.set(cv._id.toString(), cv);
          }
        }
      }

      // 3. Perform Vector Search across all candidates
      const results = await ctx.vectorSearch("candidates", "vector_index_candidates", {
        vector: jobEmbedding,
        limit: 150,
      });

      const vectorResultsMap = new Map<string, number>();
      for (const r of results) {
        vectorResultsMap.set(r._id.toString(), r._score);
      }

      // 4. Generate missing embeddings on the fly for keyword-matched candidates (up to 15)
      const missingEmbeddings = Array.from(dedupedKeywordsMap.values()).filter(
        cv => !cv.embedding || cv.embedding.length === 0
      );

      if (missingEmbeddings.length > 0) {
        const limitToEmbed = missingEmbeddings.slice(0, 15);
        await Promise.all(
          limitToEmbed.map(async (cv) => {
            try {
              if (cv.rawText) {
                const textToEmbed = cv.rawText.slice(0, 15000);
                const embedding = await embedText(textToEmbed, "passage");
                await ctx.runMutation(internal.matching.queries.updateCandidateEmbedding, {
                  candidateId: cv._id,
                  embedding,
                });
                cv.embedding = embedding; // Update in-memory reference
              }
            } catch (err) {
              console.error(`Failed to generate on-the-fly embedding for candidate ${cv._id}:`, err);
            }
          })
        );
      }

      // 5. Merge, enrich, and calculate similarity scores
      const allCandidateIds = new Set<string>([
        ...Array.from(vectorResultsMap.keys()),
        ...Array.from(dedupedKeywordsMap.keys()),
      ]);

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
          if (candidate.embedding && candidate.embedding.length > 0) {
            score = cosineSimilarity(jobEmbedding, candidate.embedding);
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
            rawText: cv.rawText,
            summary: cv.summary,
          };

          const scored = scoreCandidateAgainstRequirements(cvPayload as any, req as any, 0);

          const matchScore = Math.round(
            (scored.titleScore * ((job.scoreWeightJobTitle ?? 20) / 100)) +
            (scored.skillScore * ((job.scoreWeightSkills ?? 35) / 100)) +
            (scored.experienceScore * ((job.scoreWeightExperience ?? 25) / 100)) +
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
        })
        .filter(r => {
          // STRICT FILTER: Enforce required skills match (0 missing required skills)
          const hasMissingRequired = r.missingSkills && r.missingSkills.length > 0;
          return !hasMissingRequired && r.overallScore >= minScore;
        })
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 30); // Store top 30

      await ctx.runMutation(internal.jobs.jobs.saveReverseMatchResults, {
        jobId: args.jobId,
        results: matchResults,
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
