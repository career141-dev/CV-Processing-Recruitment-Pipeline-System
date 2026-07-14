"use node";

import OpenAI from "openai";
import type { ActionCtx } from "../_generated/server";


export type TaskType = "cv_structuring" | "jd_extraction" | "jd_matching" | "email_routing";

// Model configuration for development
const MODEL_CONFIG = {
  cv_structuring: "meta/llama-3.1-8b-instruct",      // Fast, good for parsing
  jd_extraction: "meta/llama-3.1-70b-instruct",     // Better understanding  
  jd_matching: "meta/llama-3.1-70b-instruct",         // Strong reasoning
  email_routing: "meta/llama-3.1-8b-instruct"         // Fast text classification
};

export function getOpenAI(taskType: TaskType): OpenAI {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not set");
  }
  
  return new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey,
  });
}

export function getModelForTask(taskType: TaskType): string {
  return MODEL_CONFIG[taskType];
}

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

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
    await ctx.runMutation(internal.stats.tokenLogging.logNvidiaCallMutation, {
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

  // Safety truncate to avoid token limits (bge-m3 has an 8192 token limit)
  const safeText = trimmed.slice(0, 25000);

  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const openai = getOpenAI("cv_structuring");
      const response = await openai.embeddings.create({
        input: [safeText],
        model: "baai/bge-m3",
      });

      // Log successful call
      const promptTokens = response.usage?.prompt_tokens ?? 0;
      await logLLMUsage(
        ctx,
        "embedding",
        "baai/bge-m3",
        promptTokens,
        0,
        true,
        undefined,
        cvUploadId
      );

      return response.data[0]?.embedding;
    } catch (error: any) {
      lastError = error;
      const status = error?.status ?? 0;
      
      // Log failed call attempt
      await logLLMUsage(
        ctx,
        "embedding",
        "baai/bge-m3",
        0,
        0,
        false,
        error?.message || "Unknown error",
        cvUploadId
      );

      // Only retry on transient server errors (5xx)
      if (status >= 500 && attempt < maxRetries) {
        const waitMs = Math.pow(2, attempt) * 1000; // 2s, 4s
        console.warn(`[Embedding] NVIDIA API error (attempt ${attempt}/${maxRetries}), retrying in ${waitMs}ms...`, error?.message);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      } else {
        break;
      }
    }
  }

  console.error("Embedding generation error:", lastError);
  return undefined;
}

