"use node";

import OpenAI from "openai";
import type { ActionCtx } from "../_generated/server";


export type TaskType = "cv_structuring" | "jd_extraction" | "jd_matching" | "email_routing";

// Model configuration for development
const MODEL_CONFIG = {
  cv_structuring: "meta/llama-3.1-8b-instruct",      // Fast, good for parsing
  jd_extraction: "meta/llama-3.1-70b-instruct",     // Better understanding  
  jd_matching: "meta/llama-3.1-70b-instruct",         // Strong reasoning
  email_routing: "meta/llama-3.1-70b-instruct"         // Smarter text classification
};

export function getOpenAI(taskType: TaskType): OpenAI {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not set");
  }
  
  return new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey,
    timeout: 30000, // 30 seconds to prevent Convex action timeouts
    maxRetries: 0,  // Disable SDK retries to handle them in our own custom logic
  });
}

export function getModelForTask(taskType: TaskType): string {
  return MODEL_CONFIG[taskType];
}

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { embedText } from "../matching/agent2";

export async function logLLMUsage(
  ctx: ActionCtx,
  taskType: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  success: boolean,
  error?: string,
  cvUploadId?: Id<"cvUploads">
): Promise<void> {
  try {
    await ctx.runMutation(internal.stats.stats.logNvidiaCallMutation, {
      taskType,
      model,
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens + outputTokens,
      success,
      error,
      cvUploadId,
    });
  } catch (err) {
    console.error("Failed to log LLM usage:", err);
  }
}

export async function generateNvidiaEmbedding(
  ctx: ActionCtx,
  text: string,
  cvUploadId?: Id<"cvUploads">
): Promise<number[] | undefined> {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  // Safety truncate to avoid token limits
  const safeText = trimmed.slice(0, 15000);

  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { embedding, usage } = await embedText(safeText, "passage");

      // Log successful call
      await logLLMUsage(
        ctx,
        "embedding",
        usage.model,
        usage.promptTokens,
        0,
        true,
        undefined,
        cvUploadId
      );

      return embedding;
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || String(error);
      
      // Log failed call attempt
      await logLLMUsage(
        ctx,
        "embedding",
        "nvidia/nv-embedqa-e5-v5",
        0,
        0,
        false,
        errorMessage,
        cvUploadId
      );

      if (attempt < maxRetries) {
        const waitMs = Math.pow(2, attempt) * 1000;
        console.warn(`[Embedding] NVIDIA API error (attempt ${attempt}/${maxRetries}), retrying in ${waitMs}ms...`, errorMessage);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      } else {
        break;
      }
    }
  }

  console.error("Embedding generation error:", lastError);
  return undefined;
}

