"use node";
import { Jimp } from "jimp";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import OpenAI from "openai";
import crypto from "crypto";
import { z } from "zod";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";
import tesseract from "tesseract.js";
import {
  deriveNoticePeriodDays,
  deriveSeniorityLevel,
  deriveEducationFields,
  deriveTotalExperienceYears,
  deriveCurrentRole,
} from "../candidates/derivations";
import { generateNvidiaEmbedding, logLLMUsage } from "../lib/llm";

// ──────────────────────────────────────────────────
// Types & Schemas
// ──────────────────────────────────────────────────

const makeArray = (val: any) => {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val.filter(v => v !== null && v !== undefined).map(String);
  if (typeof val === "string") return val.split(",").map(s => s.trim());
  return [];
};

const makeNumber = (val: any) => {
  if (val === null || val === undefined) return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
};

const makeString = (val: any) => {
  if (val === null || val === undefined) return null;
  return String(val);
};

export const educationSchema = z.object({
  degree: z.preprocess(makeString, z.string().nullable().optional()),
  institution: z.preprocess(makeString, z.string().nullable().optional()),
  year: z.preprocess(makeNumber, z.number().nullable().optional()),
  field: z.preprocess(makeString, z.string().nullable().optional()),
});

export const jobHistorySchema = z.object({
  company: z.preprocess(makeString, z.string().nullable().optional()),
  title: z.preprocess(makeString, z.string().nullable().optional()),
  startDate: z.preprocess(makeString, z.string().nullable().optional()),
  endDate: z.preprocess(makeString, z.string().nullable().optional()),
  description: z.preprocess(makeString, z.string().nullable().optional()),
  confidence: z.preprocess(makeNumber, z.number().nullable().optional()),
});

const makeSkillArray = (val: any) => {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) {
    return val.filter(v => v && typeof v === 'object' && v.value).map(v => ({
      value: String(v.value),
      confidence: Number(v.confidence) || null
    }));
  }
  return [];
};

export const cvExtractionSchema = z.object({
  fullName: z.preprocess(makeString, z.string().nullable().optional()),
  email: z.preprocess(makeString, z.string().nullable().optional()),
  phone: z.preprocess(makeString, z.string().nullable().optional()),
  location: z.preprocess(makeString, z.string().nullable().optional()),
  linkedinUrl: z.preprocess(makeString, z.string().nullable().optional()),
  currentTitle: z.preprocess(makeString, z.string().nullable().optional()),
  currentEmployer: z.preprocess(makeString, z.string().nullable().optional()),
  seniorityLevel: z.preprocess(makeString, z.string().nullable().optional()),
  industries: z.preprocess(makeArray, z.array(z.string()).nullable().optional()),
  sector: z.preprocess(makeString, z.string().nullable().optional()),
  expectedSalary: z.preprocess(makeNumber, z.number().nullable().optional()),
  noticePeriod: z.preprocess(makeString, z.string().nullable().optional()),
  employmentStatus: z.preprocess(makeString, z.string().nullable().optional()),
  skills: z.preprocess(makeSkillArray, z.array(z.object({
    value: z.string(),
    confidence: z.number().nullable().optional()
  })).nullable().optional()),
  education: z.array(educationSchema).nullable().optional(),
  certifications: z.preprocess(makeArray, z.array(z.string()).nullable().optional()),
  languages: z.preprocess(makeArray, z.array(z.string()).nullable().optional()),
  summary: z.preprocess(makeString, z.string().nullable().optional()),
  jobHistory: z.array(jobHistorySchema).nullable().optional(),
});

export type CvExtractionResult = z.infer<typeof cvExtractionSchema>;

type ExtractionArgs = {
  storageId: Id<"_storage">;
  fileType: string;
  sourceChannel?: string;
  uploadedBy: string;
  cvUploadId: Id<"cvUploads">;
  workableCandidateId?: string;
  skipLLM?: boolean;
  preExtractedData?: {
    fullName?: string;
    email?: string;
    phone?: string;
  };
  batchId?: Id<"ingestionBatches">;
  logId?: Id<"ingestionLog">;
  isRetry?: boolean;
  retryCount?: number;
};

const ExtractionActionArgs = {
  storageId: v.id("_storage"),
  fileType: v.string(),
  sourceChannel: v.optional(v.string()),
  uploadedBy: v.string(),
  cvUploadId: v.id("cvUploads"),
  workableCandidateId: v.optional(v.string()),
  skipLLM: v.optional(v.boolean()),
  preExtractedData: v.optional(v.object({
    fullName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  })),
  batchId: v.optional(v.id("ingestionBatches")),
  logId: v.optional(v.id("ingestionLog")),
  isRetry: v.optional(v.boolean()),
  retryCount: v.optional(v.number()),
};

// ──────────────────────────────────────────────────
// Text Extraction
// ──────────────────────────────────────────────────

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const data = new Uint8Array(buffer.slice(0));
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    standardFontDataUrl: "https://unpkg.com/pdfjs-dist@5.7.284/standard_fonts/",
  });
  
  try {
    const pdf = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      const items = textContent.items.map((item: any) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
      }));
      
      items.sort((a, b) => {
        if (Math.abs(a.y - b.y) < 5) {
          return a.x - b.x;
        }
        return b.y - a.y; // Y goes up in PDF
      });

      let lastY = null;
      for (const item of items) {
        if (lastY !== null && Math.abs(lastY - item.y) > 5) {
          fullText += "\n";
        } else if (lastY !== null) {
          fullText += "  ";
        }
        fullText += item.str;
        lastY = item.y;
      }
      fullText += "\n\n";
    }
    return fullText;
  } catch (error) {
    console.error("PDF extraction failed:", error);
    throw error;
  }
}

async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return result.value;
  } catch (error) {
    console.error("Docx extraction failed:", error);
    throw new Error("Docx extraction failed: " + (error as any).message);
  }
}

async function extractTextFromImage(buffer: ArrayBuffer): Promise<string> {
  const result = await tesseract.recognize(Buffer.from(buffer), 'eng', {
    logger: () => {}
  });
  return result.data.text;
}

export async function extractText(
  buffer: ArrayBuffer,
  fileType: string,
): Promise<string> {
  const type = fileType.toLowerCase();

  if (type === "pdf" || type === "application/pdf") {
    try {
      const pdfText = await extractTextFromPdf(buffer);
      if (pdfText.trim().length > 50) return pdfText;
    } catch (e) {
      console.warn("Failed to extract text from PDF normally, attempting OCR fallback", e);
    }
    // Fall back to OCR for scanned PDFs
    return extractTextFromImage(buffer);
  }

  if (type === "docx" || type === "doc" || type.includes("wordprocessingml")) {
    return extractTextFromDocx(buffer);
  }

  if (type.includes("image") || type === "png" || type === "jpeg" || type === "jpg") {
    return extractTextFromImage(buffer);
  }

  if (type === "rtf") {
    const decoded = new TextDecoder("utf-8").decode(buffer);
    const text = decoded
      .replace(/\\[a-z]+[-0-9]*/g, "")
      .replace(/[{}]/g, "")
      .replace(/\\(?:par|line|tab)/g, " ")
      .replace(/\\'[0-9a-f]{2}/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 50) return text;
  }

  if (type === "txt") {
    return new TextDecoder("utf-8").decode(buffer);
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

// ──────────────────────────────────────────────────
// Text Cleaning
// ──────────────────────────────────────────────────

export function cleanRawText(text: string): string {
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFD]/g, "");

  cleaned = cleaned.replace(/[|│║┆┇┊┋┌┍┎┏┐┑┒┓└┕┖┗┘┙┚┛├┝┞┟┠┡┢┣┤┥┦┧┨┩┪┫┬┭┮┯┰┱┲┳┴┵┶┷┸┹┺┻┼┽┾┿╀╁╂╃╄╅╆╇╈╉╊╋═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬╭╮╯╰╱╲╳╴╵╶╷╸╹╺╻╼╽╾╿─━┄┅┈┉]/g, " ");
  cleaned = cleaned.replace(/[-_]{3,}/g, " ");

  const lines = cleaned.split("\n");
  
  const lineCounts = new Map<string, number>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      lineCounts.set(trimmed, (lineCounts.get(trimmed) || 0) + 1);
    }
  }

  const filteredLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (/^page\s*\d+\s*(of\s*\d+)?$/i.test(trimmed)) continue;
    if (/^\d+\s*\/\s*\d+$/.test(trimmed)) continue;
    if (/^\d+$/.test(trimmed)) continue;
    
    if (trimmed.length > 0 && (lineCounts.get(trimmed) || 0) >= 3) {
      continue;
    }

    filteredLines.push(line);
  }

  cleaned = filteredLines.join("\n");

  cleaned = cleaned.replace(/\n{3,}/g, "\n");
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ");

  return cleaned;
}

const MAX_RAW_TEXT_LENGTH = 500_000;

function computeSha256(buffer: ArrayBuffer): string {
  return crypto.createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

// ──────────────────────────────────────────────────
// LLM — same graceful-fallback pattern as C141
// ──────────────────────────────────────────────────

function createNvidiaClient(): OpenAI {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY environment variable is not set");
  return new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey,
  });
}

function parseJsonRobustly(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {}

  const stripped = content.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {}

  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const jsonStr = content.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {}
  }

  return null;
}

/**
 * Calls the LLM to extract structured CV data.
 * Returns an empty object (not throws) if the API call fails —
 * matching C141's parseCvWithAI fallback behaviour.
 * The caller decides whether to treat empty data as an error.
 */
export async function callNvidiaLLM(
  ctx: ActionCtx,
  rawText: string,
  cvUploadId?: Id<"cvUploads">
): Promise<CvExtractionResult | null> {
  const MAX_CHARS = 15000;
  const textToSend =
    rawText.length > MAX_CHARS
      ? rawText.slice(0, MAX_CHARS).replace(/\s+\S*$/, "")
      : rawText;

  try {
    const openai = createNvidiaClient();
    const response = await openai.chat.completions.create({
      model: "meta/llama-3.1-70b-instruct",
      temperature: 0,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `Extract candidate information from the CV text below and return it as a JSON object.
CRITICAL INSTRUCTION: If the document is NOT a CV, Resume, or Candidate Profile (e.g., if it is an email signature, company brochure, invoice, cover letter without a CV, or random text), you MUST return an empty JSON object: {}
1. Return only valid JSON. No markdown, no backticks, no explanation.
2. If a field is not found, return null. Never invent or guess.
3. Return skills as an array of objects with value and confidence (0.0 to 1.0).
4. Return jobHistory as an array of objects, including a confidence field (0.0 to 1.0) on each job object.
5. If currentTitle or currentEmployer are not explicitly stated as "current" or "present", infer them from the most recent job in their work experience by considering the dates.
{
  "fullName": null,
  "email": null,
  "phone": null,
  "location": null,
  "linkedinUrl": null,
  "currentTitle": null,
  "currentEmployer": null,
  "seniorityLevel": null,
  "industries": null,
  "sector": null,
  "skills": [
    {
      "value": "string",
      "confidence": 0.0
    }
  ],
  "education": [
    {
      "degree": null,
      "institution": null,
      "year": null,
      "field": null
    }
  ],
  "languages": null,
  "summary": null,
  "jobHistory": [
    {
      "company": null,
      "title": null,
      "startDate": null,
      "endDate": null,
      "description": null,
      "confidence": 0.0
    }
  ]
}
CV TEXT:
${textToSend}`,
        },
      ],
    });

    // Log successful token usage
    if (response.usage) {
      await logLLMUsage(
        ctx,
        "cv_structuring",
        "meta/llama-3.1-70b-instruct",
        response.usage.prompt_tokens,
        response.usage.completion_tokens,
        true,
        undefined,
        cvUploadId
      );
    }

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = parseJsonRobustly(content);
    if (!parsed) return null;

    // Check if the AI determined this is NOT a CV
    if (Object.keys(parsed).length === 0 || (!parsed.fullName && !parsed.email && !parsed.phone && !parsed.skills && !parsed.jobHistory)) {
      throw new Error("NOT_A_CV");
    }

    try {
      return cvExtractionSchema.parse(parsed);
    } catch (e) {
      console.error("Zod parse error:", e);
      return null;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[callNvidiaLLM] LLM call failed:", message);
    
    // Log failed call
    await logLLMUsage(
      ctx,
      "cv_structuring",
      "meta/llama-3.1-70b-instruct",
      0,
      0,
      false,
      message,
      cvUploadId
    );
    if (
      message.includes("403") ||
      message.toLowerCase().includes("insufficient") ||
      message.toLowerCase().includes("balance") ||
      message.toLowerCase().includes("credits")
    ) {
      throw error;
    }
    return null;
  }
}

// ──────────────────────────────────────────────────
// null → undefined helper
// ──────────────────────────────────────────────────

type NullToUndefined<T> = T extends null
  ? undefined
  : T extends (infer U)[]
    ? NullToUndefined<U>[]
    : T extends Record<string, unknown>
      ? { [K in keyof T]: NullToUndefined<T[K]> }
      : T;

function nullToUndefined<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]: NullToUndefined<T[K]> } {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (v === null) return [k, undefined];
      if (Array.isArray(v)) {
        return [
          k,
          v.map((item) =>
            item !== null && typeof item === "object" && !Array.isArray(item)
              ? Object.fromEntries(
                  Object.entries(item).map(([ik, iv]) => [
                    ik,
                    iv === null ? undefined : iv,
                  ]),
                )
              : item,
          ),
        ];
      }
      return [k, v];
    }),
  ) as { [K in keyof T]: NullToUndefined<T[K]> };
}

// ──────────────────────────────────────────────────
// Core extraction pipeline — one CV at a time
// ──────────────────────────────────────────────────

export async function runCvExtraction(
  ctx: ActionCtx,
  args: ExtractionArgs,
): Promise<string | null> {
  const { storageId, fileType, sourceChannel, cvUploadId, workableCandidateId, skipLLM, preExtractedData } = args;

  await ctx.runMutation(api.candidates.candidates.updateCvUpload, {
    cvUploadId,
    status: "processing",
  });

  if (args.logId) {
    await ctx.runMutation(api.cvs.batches.updateLogStage, {
      logId: args.logId,
      stage: "parsing"
    });
  }

  let candidateId: any = null;

  try {
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("File URL not found in Convex storage");

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download file from Convex storage. Status: ${response.status}`);

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      throw new Error("The file retrieved from storage is empty (zero bytes).");
    }
    const fileHash = computeSha256(buffer);

    const rawText = await extractText(buffer, fileType);
    const cleanedText = cleanRawText(rawText);
    const trimmed = cleanedText.trim();
    if (trimmed.length < 20) {
      throw new Error("Insufficient text extracted from file");
    }
    const cappedRawText = trimmed.length > MAX_RAW_TEXT_LENGTH
      ? trimmed.slice(0, MAX_RAW_TEXT_LENGTH)
      : trimmed;

    candidateId = await ctx.runMutation(api.candidates.candidates.createCandidate, {
      rawText: cappedRawText,
      sourceChannel: sourceChannel ?? undefined,
      fileHash,
      cvUploadId,
      workableCandidateId: workableCandidateId ?? undefined,
      isParsed: !skipLLM,
    });

    await ctx.runMutation(api.candidates.candidates.updateCvUpload, {
      cvUploadId,
      status: "processing",
      fileHash,
      candidateId,
    });

    let finalCandidateId: Id<"candidates"> | null = null;
    let extracted: CvExtractionResult | null = null;
    let embedding: number[] | undefined = undefined;

    if (skipLLM && preExtractedData) {
      extracted = {
        fullName: preExtractedData.fullName ?? null,
        email: preExtractedData.email ?? null,
        phone: preExtractedData.phone ?? null,
        location: null,
        linkedinUrl: null,
        currentTitle: null,
        currentEmployer: null,
        seniorityLevel: null,
        industries: null,
        sector: null,
        expectedSalary: null,
        noticePeriod: null,
        employmentStatus: null,
        skills: null,
        education: null,
        certifications: null,
        languages: null,
        summary: null,
        jobHistory: null,
      } as unknown as CvExtractionResult;

      try {
        embedding = await generateNvidiaEmbedding(ctx, cappedRawText, cvUploadId);
      } catch (embedErr: any) {
        console.error("[CvExtraction] Embedding generation failed (continuing without embedding):", embedErr.message || embedErr);
      }
    } else {
      if (args.logId) {
        await ctx.runMutation(api.cvs.batches.updateLogStage, {
          logId: args.logId,
          stage: "ai_extraction"
        });
      }
      
      // Run both LLM extraction and Embedding generation in parallel
      const [extractedData, embeddingResult] = await Promise.all([
        callNvidiaLLM(ctx, cappedRawText, cvUploadId),
        generateNvidiaEmbedding(ctx, cappedRawText, cvUploadId).catch((err: any) => {
          console.error("[CvExtraction] Embedding generation failed (continuing without embedding):", err.message || err);
          return undefined;
        })
      ]);

      extracted = extractedData;
      if (!extracted) {
        throw new Error("LLM failed to extract candidate data (API timeout or invalid response)");
      }
      embedding = embeddingResult;
    }

    if (extracted) {
      const safeExtracted = nullToUndefined(extracted);
      
      const noticePeriodDays = deriveNoticePeriodDays(extracted.noticePeriod);
      // We pass undefined for yearsOfExperience since we rely on derivation
      const totalExperienceYears = deriveTotalExperienceYears(extracted.jobHistory, undefined);
      const seniorityLevel = deriveSeniorityLevel(totalExperienceYears, extracted.currentTitle) ?? safeExtracted.seniorityLevel;
      const { educationDegree, educationInstitution, educationYear } = deriveEducationFields(extracted.education);
      const { derivedEmployer, derivedTitle } = deriveCurrentRole(extracted.jobHistory, extracted.currentEmployer, extracted.currentTitle);

      const formattedSkills = safeExtracted.skills?.map((s: any) => s.value) || [];
      const parsingConfidence = {
        skills: safeExtracted.skills?.map((s: any) => ({ skill: s.value, confidence: s.confidence })),
        jobHistory: safeExtracted.jobHistory?.map((jh: any) => ({ company: jh.company, title: jh.title, confidence: jh.confidence }))
      };

      const formattedJobHistory = safeExtracted.jobHistory?.map((jh) => ({
        company: jh.company ?? "Unknown Company",
        title: jh.title ?? "Unknown Title",
        startDate: jh.startDate,
        endDate: jh.endDate,
        description: jh.description,
      }));

      finalCandidateId = await ctx.runMutation(api.candidates.candidates.createCandidate, {
        ...safeExtracted,
        cvUploadId,
        currentEmployer: derivedEmployer,
        currentTitle: derivedTitle,
        jobHistory: formattedJobHistory,
        seniorityLevel: seniorityLevel ?? safeExtracted.seniorityLevel,
        noticePeriodDays,
        educationDegree,
        educationInstitution,
        educationYear,
        totalExperienceYears,
        fileHash,
        skills: formattedSkills,
        parsingConfidence,
        isParsed: true,
        embedding,
      }) as Id<"candidates">;
    }

    const resolvedCandidateId = finalCandidateId || candidateId;

    if (finalCandidateId && finalCandidateId !== candidateId) {
      console.log(`[cvExtraction] Merged into existing candidate: ${finalCandidateId}. Deleting duplicate candidate record: ${candidateId}`);
      await ctx.runMutation(api.candidates.candidates.deleteCandidate, { candidateId });
    }

    const jobId = await ctx.runMutation(api.candidates.candidates.updateCvUpload, {
      cvUploadId,
      status: "processed",
      fileHash,
      candidateId: resolvedCandidateId,
    }) as string | undefined | null;

    if (jobId) {
      await ctx.runMutation(api.applications.applications.createApplication, {
        candidateId: resolvedCandidateId,
        jobId: jobId as any,
        cvFileId: cvUploadId,
        sourceChannel: sourceChannel ?? "manual_upload",
      });

      await ctx.scheduler.runAfter(0, api.cvs.cvScoringActions.processCvScoring, {
        candidateId: resolvedCandidateId,
        jobId: jobId as any,
      });
    }

    if (args.logId) {
      await ctx.runMutation(api.cvs.batches.updateLogStage, {
        logId: args.logId,
        stage: "completed",
        candidateName: extracted?.fullName ?? undefined,
      });
    }
    if (args.batchId) {
      await ctx.runMutation(api.cvs.batches.updateBatchProgress, {
        batchId: args.batchId,
        status: "completed"
      });
      // Trigger the next batch automatically if this batch is complete
      await ctx.runMutation(api.cvs.cvUploads.checkAndTriggerNextBatch, {
        batchId: args.batchId,
      });
    }

    return candidateId;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    const isInsufficientBalance =
      message.includes("403") ||
      message.toLowerCase().includes("insufficient") ||
      message.toLowerCase().includes("balance") ||
      message.toLowerCase().includes("credits");

    const isRateLimit = message.includes("429") || message.toLowerCase().includes("too many requests");
    const isNotACV = message.includes("NOT_A_CV");

    // Clean up the blank candidate stub since extraction failed
    if (candidateId) {
      console.log(`[CvExtraction] Extraction failed, cleaning up blank candidate: ${candidateId}`);
      await ctx.runMutation(api.candidates.candidates.deleteCandidate, { candidateId });
    }

    if (isRateLimit && ((args as any).retryCount ?? 0) < 5) {
      const nextRetryCount = ((args as any).retryCount ?? 0) + 1;
      const delayMs = nextRetryCount * 60 * 1000; // 1m, 2m, 3m...
      console.log(`[CvExtraction] Nvidia Rate Limit hit (429). Retrying in ${delayMs/1000}s (Attempt ${nextRetryCount})`);
      
      await ctx.runMutation(api.candidates.candidates.updateCvUpload, {
        cvUploadId,
        status: "pending_retry",
        errorMessage: `Nvidia API Rate Limit (429). Retrying automatically in ${delayMs/1000}s...`,
      });

      await ctx.scheduler.runAfter(delayMs, api.cvs.cvExtraction.processCvExtraction, {
         ...args,
         isRetry: true,
         retryCount: nextRetryCount
      });
      return null;
    }

    await ctx.runMutation(api.candidates.candidates.updateCvUpload, {
      cvUploadId,
      status: (isInsufficientBalance || isNotACV) 
        ? "processed" 
        : ((args as any).isRetry ? "failed_retry" : "failed"),
      errorMessage: isInsufficientBalance
        ? "Processed raw text only (LLM extraction skipped due to insufficient credits)"
        : isNotACV 
        ? "Document rejected: Not recognized as a valid CV or Resume."
        : message,
    });

    if (args.logId) {
      await ctx.runMutation(api.cvs.batches.updateLogStage, {
        logId: args.logId,
        stage: isInsufficientBalance ? "completed" : "failed",
        errorMessage: message
      });
    }
    if (args.batchId) {
      await ctx.runMutation(api.cvs.batches.updateBatchProgress, {
        batchId: args.batchId,
        status: isInsufficientBalance ? "completed" : "failed"
      });
      // Trigger the next batch automatically if this batch is complete
      await ctx.runMutation(api.cvs.cvUploads.checkAndTriggerNextBatch, {
        batchId: args.batchId,
      });
    }

    console.error(`[CvExtraction] Extraction failed: ${message}`);
    return null;
  }
}

// ──────────────────────────────────────────────────
// Public Action — callable from client
// ──────────────────────────────────────────────────

export const processCvExtraction = action({
  args: ExtractionActionArgs,
  handler: async (ctx, args): Promise<string | null> => {
    return runCvExtraction(ctx, args);
  },
});

// ──────────────────────────────────────────────────
// Batch Resume — rate limited queue worker
// ──────────────────────────────────────────────────

export const resumeFailedUploads = action({
  args: { batchId: v.optional(v.id("ingestionBatches")) },
  handler: async (ctx, args): Promise<{ queued: number }> => {
    await ctx.runAction(internal.cvs.cvExtraction.resumeBatch, {
      cursor: undefined,
      totalQueued: 0,
      batchId: args.batchId,
    });
    return { queued: 0 };
  },
});

export const resumeBatch = internalAction({
  args: { cursor: v.optional(v.string()), totalQueued: v.number(), batchId: v.optional(v.id("ingestionBatches")) },
  handler: async (ctx, args): Promise<void> => {
    const result = await ctx.runQuery(api.candidates.candidates.listFailedUploads, {
      limit: 5,
      cursor: args.cursor,
    });

    for (let i = 0; i < result.page.length; i++) {
      const upload = result.page[i];
      await ctx.runMutation(api.cvs.cvUploads.queueManualExtraction, {
        cvUploadId: upload._id,
        storageId: upload.storageId as Id<"_storage">,
        fileName: upload.fileName,
        fileType: upload.fileType,
        sourceChannel: upload.source || "Retry Failed",
        uploadedBy: upload.uploadedBy,
        batchId: args.batchId,
        isRetry: true,
      });
    }

    if (!result.isDone && result.continueCursor) {
      ctx.scheduler.runAfter(
        result.page.length * 1000 + 500,
        internal.cvs.cvExtraction.resumeBatch,
        {
          cursor: result.continueCursor,
          totalQueued: args.totalQueued + result.page.length,
          batchId: args.batchId,
        },
      );
    }
  },
});

export const startBatchExtraction = action({
  args: { batchId: v.id("ingestionBatches") },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.cvs.cvExtraction.processNextBatch, {
      batchId: args.batchId,
    });
  },
});

export const processNextBatch = internalAction({
  args: { batchId: v.id("ingestionBatches") },
  handler: async (ctx, args) => {
    // 1. Get up to 5 uploads in this batch that are still "uploaded"
    const uploads = await ctx.runQuery(internal.cvs.cvUploads.listUploadedInBatch, {
      batchId: args.batchId,
      limit: 5,
    });

    if (uploads.length === 0) {
      console.log(`[processNextBatch] No more uploads to process for batch ${args.batchId}`);
      return;
    }

    // 2. Queue those 5 uploads
    const cvUploadIds = [];
    for (const upload of uploads) {
      cvUploadIds.push(upload._id);
      
      // Update status to "queued" and schedule extraction
      await ctx.runMutation(api.cvs.cvUploads.queueManualExtraction, {
        cvUploadId: upload._id,
        storageId: upload.storageId as Id<"_storage">,
        fileName: upload.fileName,
        fileType: upload.fileType,
        sourceChannel: upload.source || "Manual",
        uploadedBy: upload.uploadedBy,
        batchId: args.batchId,
      });
    }

    // 3. We no longer poll batch progress here.
    // The next batch will be triggered by checkAndTriggerNextBatch
    // when the last CV in this batch finishes extracting.
  },
});
