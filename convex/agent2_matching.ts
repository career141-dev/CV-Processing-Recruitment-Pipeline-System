import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel.d.ts";

/**
 * Helper to get vector embeddings from NVIDIA API
 */
export async function embedText(text: string): Promise<number[]> {
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
      input_type: "query",
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
    const candidate = await ctx.runQuery(internal.agent2_matching_queries.getCandidate, { candidateId: args.candidateId });
    if (!candidate || !candidate.rawText) return;

    // We can truncate to avoid massive payload. NVIDIA embedqa usually takes up to 4096 or 8192 tokens.
    const textToEmbed = candidate.rawText.slice(0, 15000); 
    const embedding = await embedText(textToEmbed);

    await ctx.runMutation(internal.agent2_matching_queries.updateCandidateEmbedding, {
      candidateId: args.candidateId,
      embedding,
    });
  },
});

export const generateJobEmbedding = action({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args): Promise<void> => {
    const job = await ctx.runQuery(api.jobs.getJob, { jobId: args.jobId });
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
    
    await ctx.runMutation(internal.agent2_matching_queries.updateJobEmbedding, {
      jobId: args.jobId,
      embedding: jobEmbedding,
    });
  }
});

/**
 * Reverse Match using Vector Search
 */
export const runReverseMatch = action({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args): Promise<void> => {
    try {
      const job = await ctx.runQuery(api.jobs.getJob, { jobId: args.jobId });
      if (!job) return;

      let jobEmbedding = job.embedding;

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
        await ctx.runMutation(internal.agent2_matching_queries.updateJobEmbedding, {
          jobId: args.jobId,
          embedding: jobEmbedding,
        });
      }

      const minScore = job.minMatchScoreToShow ?? 60;

      // Perform Vector Search across all candidates
      const results = await ctx.vectorSearch("candidates", "vector_index_candidates", {
        vector: jobEmbedding,
        limit: 200,
      });

      if (results.length === 0) {
        await ctx.runMutation(api.jobs.saveReverseMatchResults, {
          jobId: args.jobId,
          results: [],
          status: "done",
        });
        return;
      }

      // We have candidate ids, fetch them and calculate score
      // Note: vectorSearch returns _id and _score
      const enrichedCandidates = await Promise.all(
        results.map(async (r) => {
          const candidate = await ctx.runQuery(internal.agent2_matching_queries.getCandidate, { candidateId: r._id });
          return {
            candidate,
            vectorScore: r._score, // Usually between 0 and 1
          };
        })
      );

      // NVIDIA cosine similarity score conversion (roughly mapping 0.5-1.0 to 0-100 for display)
      // Usually vector search gives scores near 0.7-0.9 for matches.
      const matchResults = enrichedCandidates
        .filter(c => c.candidate !== null)
        .map(c => {
          const cv = c.candidate!;
          // Map vector score to 0-100 score. Heuristic mapping:
          const matchScore = Math.min(Math.round(c.vectorScore * 100), 100);

          return {
            cvId: cv._id,
            overallScore: matchScore,
            breakdown: {
              skills: matchScore, 
              experience: matchScore,
              seniority: matchScore,
              industry: matchScore,
              location: matchScore,
            },
            matchedSkills: [], // Need deeper analysis or LLM to extract this precisely
            missingSkills: [],
            reason: `Semantic match based on AI embeddings (Similarity: ${(c.vectorScore * 100).toFixed(1)}%)`,
            sourceLevel1: cv.firstSourceChannel ?? undefined,
            sourceLevel2: cv.firstSourceJobId ?? undefined,
          };
        })
        .filter(r => r.overallScore >= minScore)
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 30); // Store top 30

      await ctx.runMutation(api.jobs.saveReverseMatchResults, {
        jobId: args.jobId,
        results: matchResults,
        status: "done",
      });

    } catch (e) {
      console.error("Reverse match vector search error:", e);
      await ctx.runMutation(api.jobs.saveReverseMatchResults, {
        jobId: args.jobId,
        results: [],
        status: "error",
      });
    }
  },
});
