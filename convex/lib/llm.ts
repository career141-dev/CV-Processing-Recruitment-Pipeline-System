"use node";

import OpenAI from "openai";
import type { ActionCtx } from "../_generated/server";


export type TaskType = "cv_structuring" | "jd_extraction" | "jd_matching" | "email_routing" | "cv_vision_ocr";

export const IS_CV_EXTRACTION_TASK = (taskType: string): boolean => {
  return taskType === "cv_structuring" || taskType === "cv_vision_ocr" || taskType === "email_routing" || taskType === "jd_matching";
};

export const OPENROUTER_CV_EXTRACTION_MODEL = "deepseek/deepseek-v4-flash";
export const OPENROUTER_PRIMARY_MODEL = OPENROUTER_CV_EXTRACTION_MODEL;
export const OPENROUTER_VISION_MODEL = "google/gemini-2.0-flash-lite-001";
export const OPENROUTER_SCANNED_CV_MODEL = OPENROUTER_VISION_MODEL;
export const OPENROUTER_FALLBACK_MODELS = [OPENROUTER_CV_EXTRACTION_MODEL];
export const OPENROUTER_CV_FALLBACK_MODELS = [OPENROUTER_CV_EXTRACTION_MODEL];
export const OPENROUTER_VISION_FALLBACK_MODELS = [
  OPENROUTER_VISION_MODEL,
];
export const NVIDIA_PRIMARY_MODEL = "meta/llama-3.1-70b-instruct";
export const NVIDIA_FALLBACK_MODEL = "meta/llama-3.1-70b-instruct";

export function getModelForTask(taskType: TaskType | string): string {
  if (taskType === "cv_vision_ocr") {
    return OPENROUTER_VISION_MODEL;
  }
  if (IS_CV_EXTRACTION_TASK(taskType)) {
    return OPENROUTER_CV_EXTRACTION_MODEL;
  }
  return NVIDIA_PRIMARY_MODEL;
}

export function getOpenAI(taskType: TaskType | string): OpenAI {
  if (IS_CV_EXTRACTION_TASK(taskType)) {
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

  // Non-CV extractions use NVIDIA NIM API to preserve OpenRouter credits
  return getNvidiaOpenAI();
}

export function getNvidiaOpenAI(): OpenAI {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not set");
  }

  return new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey,
    timeout: 45000,
    maxRetries: 0,
  });
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
  provider?: string,
  sourceChannel?: string
): Promise<void> {
  try {
    const resolvedProvider = provider || (taskType === "embedding" || !IS_CV_EXTRACTION_TASK(taskType) || model.includes("nvidia") ? "nvidia" : "openrouter");
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
      sourceChannel,
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

  let lastError = "";
  let successfulModel = OPENROUTER_VISION_MODEL;

  for (const model of OPENROUTER_VISION_FALLBACK_MODELS) {
    try {
      console.log(`[callNvidiaVisionOCR] Invoking Vision OCR model: ${model}`);
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
      if (extractedText && extractedText.length > 10) {
        console.log(`[callNvidiaVisionOCR] Vision OCR succeeded with model ${model} (${extractedText.length} chars)`);
        return extractedText;
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.warn(`[callNvidiaVisionOCR] Vision OCR failed with model ${model}: ${lastError}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  await logLLMUsage(
    ctx,
    "cv_vision_ocr",
    successfulModel,
    0,
    0,
    false,
    lastError,
    cvUploadId,
    "openrouter"
  );

  throw new Error(`Vision OCR failed to extract text from candidate document: ${lastError}`);
}

export interface LLMCompletionOptions {
  messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "text" };
  cvUploadId?: Id<"cvUploads">;
  sourceChannel?: string;
}

export async function executeLLMWithNvidiaFallback(
  ctx: ActionCtx,
  taskType: TaskType | string,
  options: LLMCompletionOptions
): Promise<{ content: string; provider: "openrouter" | "nvidia"; model: string }> {
  if (IS_CV_EXTRACTION_TASK(taskType)) {
    // CV Extractions: Use OpenRouter API exclusively with deepseek/deepseek-v4-flash (no fallback models)
    const model = OPENROUTER_CV_EXTRACTION_MODEL;
    try {
      const openai = getOpenAI(taskType);
      const response = await openai.chat.completions.create({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.1,
        max_tokens: options.max_tokens ?? 4096,
        ...(options.response_format ? { response_format: options.response_format } : {}),
      });

      if (response.usage) {
        await logLLMUsage(
          ctx,
          taskType,
          model,
          response.usage.prompt_tokens,
          response.usage.completion_tokens,
          true,
          undefined,
          options.cvUploadId,
          "openrouter",
          options.sourceChannel
        );
      }

      const content = response.choices[0]?.message?.content?.trim() || "";
      if (content) {
        return { content, provider: "openrouter", model };
      }
      throw new Error("OpenRouter deepseek/deepseek-v4-flash returned empty response");
    } catch (openRouterError: any) {
      const errorMsg = openRouterError?.message || String(openRouterError);
      console.error(`[executeLLMWithNvidiaFallback] CV extraction call (${model}) failed for task "${taskType}": ${errorMsg}`);
      
      await logLLMUsage(
        ctx,
        taskType,
        model,
        0,
        0,
        false,
        `CV Extraction Failed: ${errorMsg}`,
        options.cvUploadId,
        "openrouter",
        options.sourceChannel
      );

      throw openRouterError;
    }
  }

  // Non-CV Tasks (Reverse Match, Search, JD Extraction, Email Routing, etc.): Use NVIDIA NIM API
  const model = NVIDIA_PRIMARY_MODEL;
  try {
    const nvidiaOpenAI = getNvidiaOpenAI();
    const response = await nvidiaOpenAI.chat.completions.create({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.max_tokens ?? 4096,
      ...(options.response_format ? { response_format: options.response_format } : {}),
    });

    if (response.usage) {
      await logLLMUsage(
        ctx,
        taskType,
        model,
        response.usage.prompt_tokens,
        response.usage.completion_tokens,
        true,
        undefined,
        options.cvUploadId,
        "nvidia",
        options.sourceChannel
      );
    }

    const content = response.choices[0]?.message?.content?.trim() || "";
    if (content) {
      return { content, provider: "nvidia", model };
    }
    throw new Error(`NVIDIA ${model} returned empty response`);
  } catch (nvidiaError: any) {
    const errorMsg = nvidiaError?.message || String(nvidiaError);
    console.error(`[executeLLMWithNvidiaFallback] Non-CV task call (${model}) failed for task "${taskType}": ${errorMsg}`);
    
    await logLLMUsage(
      ctx,
      taskType,
      model,
      0,
      0,
      false,
      `NVIDIA Call Failed: ${errorMsg}`,
      options.cvUploadId,
      "nvidia",
      options.sourceChannel
    );

    throw nvidiaError;
  }
}


