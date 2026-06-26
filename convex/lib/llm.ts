"use node";

import OpenAI from "openai";
import type { ActionCtx } from "../_generated/server";


export type TaskType = "cv_structuring" | "jd_extraction" | "jd_matching";

// Model configuration for development
const MODEL_CONFIG = {
  cv_structuring: "meta/llama-3.1-8b-instruct",      // Fast, good for parsing
  jd_extraction: "meta/llama-3.1-70b-instruct",     // Better understanding  
  jd_matching: "meta/llama-3.1-70b-instruct"         // Strong reasoning
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

export async function logLLMUsage(
  ctx: ActionCtx,
  taskType: TaskType,
  model: string,
  inputTokens: number,
  outputTokens: number,
  success: boolean,
  error?: string
): Promise<void> {
  // No-op for target system to keep schema simple
}

export async function generateNvidiaEmbedding(text: string): Promise<number[] | undefined> {
  try {
    const openai = getOpenAI("cv_structuring");
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    
    // Safety truncate to avoid token limits (bge-m3 has an 8192 token limit)
    const safeText = trimmed.slice(0, 25000);
    
    const response = await openai.embeddings.create({
      input: [safeText],
      model: "baai/bge-m3",
    });
    
    return response.data[0]?.embedding;
  } catch (error) {
    console.error("Embedding generation error:", error);
    return undefined;
  }
}
