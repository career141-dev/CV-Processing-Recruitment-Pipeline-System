"use node";

import OpenAI from "openai";
import type { ActionCtx } from "../_generated/server";


export type TaskType = "cv_structuring" | "jd_extraction" | "jd_matching" | "email_routing" | "cv_vision_ocr";

export const OPENROUTER_PRIMARY_MODEL = "deepseek/deepseek-v4-flash";
export const OPENROUTER_CV_EXTRACTION_MODEL = "deepseek/deepseek-v4-flash";
export const OPENROUTER_SCANNED_CV_MODEL = "google/gemma-4-26b-a4b-it:free";

export const OPENROUTER_FALLBACK_MODELS = [
  OPENROUTER_PRIMARY_MODEL,
  OPENROUTER_SCANNED_CV_MODEL,
];

export const OPENROUTER_CV_FALLBACK_MODELS = [
  OPENROUTER_CV_EXTRACTION_MODEL,
  OPENROUTER_SCANNED_CV_MODEL,
];

// Model configuration mapping
const MODEL_CONFIG = {
  cv_structuring: OPENROUTER_CV_EXTRACTION_MODEL,
  jd_extraction: OPENROUTER_PRIMARY_MODEL,
  jd_matching: OPENROUTER_PRIMARY_MODEL,
  email_routing: OPENROUTER_PRIMARY_MODEL,
  cv_vision_ocr: OPENROUTER_SCANNED_CV_MODEL,
};

export function getOpenAI(taskType: TaskType): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY || "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";
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://career141.com",
      "X-Title": "Career141 System",
    },
    timeout: 45000,
    maxRetries: 0,
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
  cvUploadId?: Id<"cvUploads">,
  provider?: string
): Promise<void> {
  try {
    const resolvedProvider = provider || (taskType === "embedding" || model.includes("nvidia") ? "nvidia" : "openrouter");
    await ctx.runMutation(internal.stats.stats.logNvidiaCallMutation, {
      taskType,
      model,
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens + outputTokens,
      success,
      error,
      cvUploadId,
      provider: resolvedProvider,
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

  const model = OPENROUTER_SCANNED_CV_MODEL;
  const openai = getOpenAI("cv_vision_ocr");

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
          cvUploadId,
          "openrouter"
        );
      }

      const extractedText = response.choices[0]?.message?.content?.trim() || "";
      return extractedText;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = message;
      console.error(`[callScannedCvLLM] Call failed (attempt ${attempt}/${maxAttempts}):`, message);

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
    cvUploadId,
    "openrouter"
  );

  throw new Error(`Scanned CV text extraction failed: ${lastError}`);
}

