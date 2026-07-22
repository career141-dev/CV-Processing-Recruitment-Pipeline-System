"use node";

import OpenAI from "openai";
import type { ActionCtx } from "../_generated/server";


export type TaskType = "cv_structuring" | "jd_extraction" | "jd_matching" | "email_routing" | "cv_vision_ocr";

// Model configuration for development
const MODEL_CONFIG = {
  cv_structuring: "meta/llama-3.1-8b-instruct",      // Fast, good for parsing
  jd_extraction: "meta/llama-3.1-70b-instruct",     // Better understanding  
  jd_matching: "meta/llama-3.1-70b-instruct",         // Strong reasoning
  email_routing: "meta/llama-3.1-8b-instruct",        // Fast text classification
  cv_vision_ocr: "meta/llama-3.2-11b-vision-instruct" // Multimodal vision OCR
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

export async function callNvidiaVisionOCR(
  ctx: ActionCtx,
  imageBase64DataUrls: string[],
  cvUploadId?: Id<"cvUploads">
): Promise<string> {
  if (!imageBase64DataUrls || imageBase64DataUrls.length === 0) {
    throw new Error("No image content provided for Vision OCR");
  }

  const model = "meta/llama-3.2-11b-vision-instruct";
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY environment variable is not set");
  }

  const openai = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey,
    timeout: 60000,
    maxRetries: 0,
  });

  const contentItems: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    {
      type: "text",
      text: "Transcribe all visible text from the provided document image(s) accurately, completely, and verbatim in top-to-bottom reading order. Return ONLY the extracted document text with no markdown wrapper, no conversational preambles, and no explanation.",
    },
  ];

  for (const imageUrl of imageBase64DataUrls) {
    contentItems.push({
      type: "image_url",
      image_url: { url: imageUrl },
    });
  }

  const maxAttempts = 3;
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: contentItems as any,
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      });

      if (response.usage) {
        await logLLMUsage(
          ctx,
          "cv_vision_ocr",
          model,
          response.usage.prompt_tokens,
          response.usage.completion_tokens,
          true,
          undefined,
          cvUploadId
        );
      }

      const extractedText = response.choices[0]?.message?.content?.trim() || "";
      return extractedText;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = message;
      console.error(`[callNvidiaVisionOCR] Call failed (attempt ${attempt}/${maxAttempts}):`, message);

      const isRateLimit = message.includes("429") || message.toLowerCase().includes("too many requests");
      const isTransientError =
        isRateLimit ||
        message.toLowerCase().includes("timed out") ||
        message.toLowerCase().includes("timeout") ||
        message.includes("502") ||
        message.includes("503") ||
        message.includes("504");

      if (isTransientError && attempt < maxAttempts) {
        const waitMs = isRateLimit ? attempt * 5000 : Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      break;
    }
  }

  await logLLMUsage(
    ctx,
    "cv_vision_ocr",
    model,
    0,
    0,
    false,
    lastError,
    cvUploadId
  );

  throw new Error(`Vision OCR failed: ${lastError}`);
}

