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
import mammoth from "mammoth";
// Tesseract OCR removed due to Convex V8 runtime worker thread incompatibility
import {
  deriveNoticePeriodDays,
  deriveSeniorityLevel,
  deriveEducationFields,
  deriveTotalExperienceYears,
  deriveCurrentRole,
} from "../candidates/derivations";
import { generateNvidiaEmbedding, logLLMUsage, callNvidiaVisionOCR, getOpenAI, OPENROUTER_PRIMARY_MODEL, OPENROUTER_FALLBACK_MODELS, OPENROUTER_CV_EXTRACTION_MODEL, OPENROUTER_CV_FALLBACK_MODELS } from "../lib/llm";

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

export const refereeSchema = z.object({
  name: z.preprocess(makeString, z.string().nullable().optional()),
  designation: z.preprocess(makeString, z.string().nullable().optional()),
  company: z.preprocess(makeString, z.string().nullable().optional()),
  contactNo: z.preprocess(makeString, z.string().nullable().optional()),
  email: z.preprocess(makeString, z.string().nullable().optional()),
  relationship: z.preprocess(makeString, z.string().nullable().optional()),
  notes: z.preprocess(makeString, z.string().nullable().optional()),
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
  referees: z.array(refereeSchema).nullable().optional(),
});

export type CvExtractionResult = z.infer<typeof cvExtractionSchema>;

type ExtractionArgs = {
  storageId?: Id<"_storage">;
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
  s3Key?: string;
  storageProvider?: string;
};

const ExtractionActionArgs = {
  storageId: v.optional(v.id("_storage")),
  s3Key: v.optional(v.string()),
  storageProvider: v.optional(v.string()),
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
  return new Promise((resolve, reject) => {
    try {
      const PDFParser = require("pdf2json");
      const pdfParser = new PDFParser(null, 1);
      pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
      pdfParser.on("pdfParser_dataReady", () => {
        resolve(pdfParser.getRawTextContent());
      });
      pdfParser.parseBuffer(Buffer.from(buffer));
    } catch (error) {
      console.error("PDF extraction failed:", error);
      reject(error);
    }
  });
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

async function extractImagesFromPdfBuffer(
  buffer: ArrayBuffer,
  maxPages: number = 5
): Promise<string[]> {
  const images: string[] = [];
  try {
    let pdfjsLib: any;
    try {
      pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
    } catch {
      pdfjsLib = require("pdfjs-dist");
    }
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
    });
    const pdfDoc = await loadingTask.promise;
    const numPages = Math.min(pdfDoc.numPages, maxPages);

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const ops = await page.getOperatorList();

      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        if (
          fn === pdfjsLib.OPS.paintImageXObject ||
          fn === pdfjsLib.OPS.paintInlineImageXObject
        ) {
          const imgName = ops.argsArray[i][0];
          let imgData: any = null;

          try {
            imgData = page.objs.get(imgName);
          } catch { }

          if (!imgData) continue;

          const width = imgData.width;
          const height = imgData.height;

          if (!width || !height || width < 50 || height < 50) {
            continue;
          }

          if (imgData.data && imgData.data.length > 0) {
            try {
              let rgbaBuffer: Buffer;
              const kind = imgData.kind;

              if (kind === 1 || imgData.data.length === width * height) {
                rgbaBuffer = Buffer.alloc(width * height * 4);
                for (let j = 0; j < width * height; j++) {
                  const val = imgData.data[j];
                  const offset = j * 4;
                  rgbaBuffer[offset] = val;
                  rgbaBuffer[offset + 1] = val;
                  rgbaBuffer[offset + 2] = val;
                  rgbaBuffer[offset + 3] = 255;
                }
              } else if (imgData.data.length === width * height * 3) {
                rgbaBuffer = Buffer.alloc(width * height * 4);
                for (let j = 0; j < width * height; j++) {
                  const srcOffset = j * 3;
                  const destOffset = j * 4;
                  rgbaBuffer[destOffset] = imgData.data[srcOffset];
                  rgbaBuffer[destOffset + 1] = imgData.data[srcOffset + 1];
                  rgbaBuffer[destOffset + 2] = imgData.data[srcOffset + 2];
                  rgbaBuffer[destOffset + 3] = 255;
                }
              } else if (imgData.data.length === width * height * 4) {
                rgbaBuffer = Buffer.from(imgData.data);
              } else {
                continue;
              }

              const jimpImg = new Jimp({
                data: rgbaBuffer,
                width,
                height,
              });

              const base64Data = await jimpImg.getBase64("image/jpeg");
              images.push(base64Data);
            } catch (jimpErr) {
              console.warn(`[PDF Image Extraction] Jimp encoding error on page ${pageNum}:`, jimpErr);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[extractImagesFromPdfBuffer] Failed to extract images from PDF:", err);
  }

  return images;
}

async function extractTextFromImage(
  buffer: ArrayBuffer,
  fileType: string,
  ctx?: ActionCtx,
  cvUploadId?: Id<"cvUploads">
): Promise<string> {
  if (!ctx) {
    throw new Error("Image CV extraction requires Vision OCR, but ActionCtx was not provided.");
  }

  const mimeType = fileType.toLowerCase().includes("png") ? "image/png" : "image/jpeg";
  const base64Str = Buffer.from(buffer).toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64Str}`;

  const visionText = await callNvidiaVisionOCR(ctx, [dataUrl], cvUploadId);
  if (!visionText || visionText.trim().length < 20) {
    throw new Error("Insufficient text extracted from image (Vision OCR returned less than 20 characters).");
  }

  return visionText;
}

export async function extractText(
  buffer: ArrayBuffer,
  fileType: string,
  skipOCR: boolean = false,
  ctx?: ActionCtx,
  cvUploadId?: Id<"cvUploads">
): Promise<string> {
  const type = fileType.toLowerCase();

  if (type === "pdf" || type === "application/pdf") {
    let pdfText = "";
    try {
      pdfText = await extractTextFromPdf(buffer);
    } catch (e) {
      console.warn("Standard PDF text extraction failed, falling back to Vision OCR...", e);
    }

    if (pdfText && pdfText.trim().length >= 50) {
      return pdfText;
    }

    console.log(`[extractText] PDF text extraction yielded < 50 chars (${pdfText.trim().length} chars). Invoking Vision OCR...`);

    if (!ctx) {
      throw new Error("PDF text extraction returned less than 50 characters, and ActionCtx is missing for Vision OCR fallback.");
    }

    const pageImages = await extractImagesFromPdfBuffer(buffer, 5);
    if (!pageImages || pageImages.length === 0) {
      throw new Error("Scanned PDF text extraction failed: less than 50 characters extracted and no scanned page images could be extracted from PDF.");
    }

    const visionText = await callNvidiaVisionOCR(ctx, pageImages, cvUploadId);
    if (!visionText || visionText.trim().length < 20) {
      throw new Error("Insufficient text extracted from scanned PDF (Vision OCR returned less than 20 characters).");
    }

    return visionText;
  }

  const magic = new Uint8Array(buffer.slice(0, 4));
  const isZipHeader = magic[0] === 0x50 && magic[1] === 0x4b && magic[2] === 0x03 && magic[3] === 0x04;

  if (type === "docx" || type === "doc" || type.includes("wordprocessingml") || isZipHeader) {
    return extractTextFromDocx(buffer);
  }

  if (type.includes("image") || type === "png" || type === "jpeg" || type === "jpg" || type === "webp") {
    return extractTextFromImage(buffer, fileType, ctx, cvUploadId);
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

const MAX_RAW_TEXT_LENGTH = 150_000;

function computeSha256(buffer: ArrayBuffer): string {
  return crypto.createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

function parseJsonRobustly(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch { }

  const stripped = content.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch { }

  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const jsonStr = content.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonStr) as Record<string, unknown>;
    } catch { }
  }

  return null;
}

/**
 * Calls OpenRouter LLM to extract structured CV data.
 * Uses OPENROUTER_PRIMARY_MODEL with fallback models if rate-limited.
 */
export async function callOpenRouterLLM(
  ctx: ActionCtx,
  rawText: string,
  cvUploadId?: Id<"cvUploads">
): Promise<CvExtractionResult | null> {
  const MAX_CHARS = 15000;
  const textToSend =
    rawText.length > MAX_CHARS
      ? rawText.slice(0, MAX_CHARS).replace(/\s+\S*$/, "")
      : rawText;

  // TEMP: remove multi-model fallback once OPENROUTER credits added — see OPENROUTER_CV_EXTRACTION_MODEL
  const modelsToTry = OPENROUTER_CV_FALLBACK_MODELS;
  let lastMessage = "";

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const openai = getOpenAI("cv_structuring");
        const response = await openai.chat.completions.create({
          model,
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
6. Extract any referees or professional references explicitly mentioned in the CV (including name, designation/title, company, contact number/phone, email, relationship to candidate, and any notes). Return as an array of objects under "referees".
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
  ],
  "referees": [
    {
      "name": null,
      "designation": null,
      "company": null,
      "contactNo": null,
      "email": null,
      "relationship": null,
      "notes": null
    }
  ]
}
CV TEXT:
${textToSend}`,
            },
          ],
        });

        if (response.usage) {
          await logLLMUsage(
            ctx,
            "cv_structuring",
            model,
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
        console.error(`[callOpenRouterLLM] Call failed with model ${model} (attempt ${attempt}):`, message);
        lastMessage = message;

        if (
          message.includes("403") ||
          message.toLowerCase().includes("insufficient") ||
          message.toLowerCase().includes("balance") ||
          message.toLowerCase().includes("credits") ||
          message.includes("NOT_A_CV")
        ) {
          throw error;
        }

        const isRateLimit = message.includes("429") || message.toLowerCase().includes("too many requests");
        if (isRateLimit) {
          console.warn(`[callOpenRouterLLM] Rate limit (429) on ${model}. Trying next fallback model...`);
          break;
        }
      }
    }
  }

  await logLLMUsage(
    ctx,
    "cv_structuring",
    OPENROUTER_CV_EXTRACTION_MODEL,
    0,
    0,
    false,
    lastMessage,
    cvUploadId
  );
  return null;
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

  // Check if upload is still valid/running, abort if already marked failed or cancelled
  const uploadStatus = await ctx.runQuery(api.candidates.candidates.getCvUploadStatus, { cvUploadId });
  if (!uploadStatus || uploadStatus === "failed" || uploadStatus === "failed_retry" || uploadStatus === "cancelled") {
    console.log(`[CvExtraction] Aborting extraction for upload ${cvUploadId} because status is: ${uploadStatus}`);
    return null;
  }

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
    let url: string | null = null;

    if (args.s3Key && args.storageProvider === "r2") {
      url = await ctx.runAction(api.storage.r2.generateDownloadUrl, { key: args.s3Key });
    } else if (args.storageId) {
      url = await ctx.storage.getUrl(args.storageId);
    }

    if (!url) throw new Error("File URL not found (neither R2 nor Convex storage)");

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download file from Convex storage. Status: ${response.status}`);

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      throw new Error("The file retrieved from storage is empty (zero bytes).");
    }
    const fileHash = computeSha256(buffer);

    // Skip extraction if file is duplicate of an already extracted candidate (Agent 6 factor)
    const existingCandidate = await ctx.runQuery(api.candidates.candidates.findCandidateByHash, { fileHash });
    if (existingCandidate) {
      console.log(`[CvExtraction] Duplicate CV detected (hash: ${fileHash}). Candidate ID: ${existingCandidate._id}. Skipping extraction.`);
      
      const jobId = await ctx.runMutation(api.candidates.candidates.updateCvUpload, {
        cvUploadId,
        status: "processed",
        fileHash,
        candidateId: existingCandidate._id,
      }) as string | undefined | null;

      if (jobId) {
        await ctx.runMutation(api.applications.applications.createApplication, {
          candidateId: existingCandidate._id,
          jobId: jobId as any,
          cvFileId: cvUploadId,
          sourceChannel: sourceChannel ?? "manual_upload",
        });

        // Trigger scoring for this duplicate CV on the new job too
        if (!skipLLM) {
          await ctx.scheduler.runAfter(0, api.cvs.cvScoringActions.processCvScoring, {
            candidateId: existingCandidate._id,
            jobId: jobId as any,
          });
        }
      }

      if (args.logId) {
        await ctx.runMutation(api.cvs.batches.updateLogStage, {
          logId: args.logId,
          stage: "completed",
          candidateName: existingCandidate.fullName || "Duplicate Candidate",
        });
      }

      if (args.batchId) {
        await ctx.runMutation(api.cvs.batches.updateBatchProgress, {
          batchId: args.batchId,
          status: "completed",
        });
        await ctx.runMutation(api.cvs.cvUploads.checkAndTriggerNextBatch, {
          batchId: args.batchId,
        });
      }

      return existingCandidate._id;
    }

    const rawText = await extractText(buffer, fileType, !!skipLLM, ctx, cvUploadId);
    const cleanedText = cleanRawText(rawText);
    const trimmed = cleanedText.trim();
    if (trimmed.length < 20) {
      throw new Error("Insufficient text extracted from file");
    }
    let cappedRawText = trimmed.length > MAX_RAW_TEXT_LENGTH
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

      // First try: call OpenRouter LLM (OPENROUTER_PRIMARY_MODEL) with extracted text
      let [extractedData, embeddingResult] = await Promise.all([
        callOpenRouterLLM(ctx, cappedRawText, cvUploadId).catch((err) => {
          console.warn("[CvExtraction] First call to callOpenRouterLLM failed:", err.message || err);
          return null;
        }),
        generateNvidiaEmbedding(ctx, cappedRawText, cvUploadId).catch((err: any) => {
          console.error("[CvExtraction] Embedding generation failed (continuing without embedding):", err.message || err);
          return undefined;
        })
      ]);

      extracted = extractedData;

      // Fallback: If primary LLM failed on standard text, and document is PDF where Vision OCR hasn't run yet
      if (!extracted && (fileType.toLowerCase() === "pdf" || fileType.toLowerCase() === "application/pdf")) {
        console.warn(`[CvExtraction] OpenRouter LLM extraction returned null for standard text. Attempting Gemma 4 26B Vision OCR fallback...`);
        try {
          const pageImages = await extractImagesFromPdfBuffer(buffer, 5);
          if (pageImages && pageImages.length > 0) {
            const visionRawText = await callNvidiaVisionOCR(ctx, pageImages, cvUploadId);
            const cleanedVision = cleanRawText(visionRawText).trim();
            if (cleanedVision.length >= 20) {
              cappedRawText = cleanedVision.length > MAX_RAW_TEXT_LENGTH
                ? cleanedVision.slice(0, MAX_RAW_TEXT_LENGTH)
                : cleanedVision;
              console.log(`[CvExtraction] Vision OCR transcribed ${cappedRawText.length} characters. Passing raw text back to DeepSeek V4 Flash for candidate detail extraction...`);
              extracted = await callOpenRouterLLM(ctx, cappedRawText, cvUploadId);
            }
          }
        } catch (visionFallbackErr: any) {
          console.error("[CvExtraction] Vision OCR fallback attempt failed:", visionFallbackErr.message || visionFallbackErr);
        }
      }

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

      const { referees, ...safeExtractedWithoutReferees } = safeExtracted;

      await ctx.runMutation(api.candidates.candidates.updateCandidateFields, {
        candidateId,
        rawText: cappedRawText,
        ...safeExtractedWithoutReferees,
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
      });

      if (extracted.referees && extracted.referees.length > 0) {
        const validReferees = extracted.referees
          .filter((r) => r && r.name && r.name.trim().length > 0)
          .map((r) => ({
            name: r.name!.trim(),
            designation: r.designation || undefined,
            company: r.company || undefined,
            contactNo: r.contactNo || undefined,
            email: r.email || undefined,
            relationship: r.relationship || undefined,
            notes: r.notes || undefined,
          }));

        if (validReferees.length > 0) {
          await ctx.runMutation(api.candidates.referees.saveExtractedReferees, {
            candidateId,
            referees: validReferees,
          });
        }
      }

      if (!embedding) {
        console.log(`[CvExtraction] Embedding was not generated during parsing for candidate ${candidateId}. Scheduling fallback background embedding task...`);
        await ctx.scheduler.runAfter(1000, internal.matching.agent2.generateAndStoreEmbedding, {
          candidateId,
        });
      }
    }

    const resolvedCandidateId = candidateId;

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

      if (!skipLLM) {
        await ctx.scheduler.runAfter(0, api.cvs.cvScoringActions.processCvScoring, {
          candidateId: resolvedCandidateId,
          jobId: jobId as any,
        });
      }
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
    const isTransientLLMError = message.includes("timeout") || message.includes("invalid response") || message.toLowerCase().includes("timed out");
    const isNotACV = message.includes("NOT_A_CV");

    const shouldRetry = (isRateLimit || isTransientLLMError) && ((args as any).retryCount ?? 0) < 5;

    // Clean up the blank candidate stub since extraction failed
    if (candidateId) {
      console.log(`[CvExtraction] Extraction failed, cleaning up blank candidate: ${candidateId}`);
      await ctx.runMutation(api.candidates.candidates.deleteCandidate, { candidateId });
    }

    if (shouldRetry) {
      const nextRetryCount = ((args as any).retryCount ?? 0) + 1;
      const baseDelayMs = nextRetryCount * 60 * 1000; // 1m, 2m, 3m...
      const jitterMs = Math.floor(Math.random() * 30000); // up to 30s jitter
      const delayMs = baseDelayMs + jitterMs;
      const reason = isRateLimit ? "Nvidia API Rate Limit (429)" : "LLM API Timeout/Invalid Response";
      console.log(`[CvExtraction] ${reason}. Retrying in ${(delayMs / 1000).toFixed(1)}s (Attempt ${nextRetryCount})`);

      await ctx.runMutation(api.candidates.candidates.updateCvUpload, {
        cvUploadId,
        status: "pending_retry",
        errorMessage: `${reason}. Retrying automatically in ${(delayMs / 1000).toFixed(1)}s...`,
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
        storageId: upload.storageId as Id<"_storage"> | undefined,
        s3Key: upload.s3Key,
        storageProvider: upload.storageProvider,
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
    await ctx.runMutation(api.cvs.cvUploads.checkAndTriggerNextBatch, {
      batchId: args.batchId,
    });
  },
});
export const processNextBatch = internalAction({
  args: { batchId: v.id("ingestionBatches") },
  handler: async (ctx, args) => {
    // 1. Get up to 3 uploads in this batch that are still "uploaded"
    const uploads = await ctx.runQuery(internal.cvs.cvUploads.listUploadedInBatch, {
      batchId: args.batchId,
      limit: 3,
    });

    if (uploads.length === 0) {
      console.log(`[processNextBatch] No more uploads to process for batch ${args.batchId}`);
      return;
    }

    // 2. Queue those uploads with stagger
    let index = 0;
    const cvUploadIds = [];
    for (const upload of uploads) {
      cvUploadIds.push(upload._id);
      
      // Update status to "queued" and schedule extraction with a 2-second stagger
      await ctx.runMutation(api.cvs.cvUploads.queueManualExtraction, {
        cvUploadId: upload._id,
        storageId: upload.storageId as Id<"_storage"> | undefined,
        s3Key: upload.s3Key,
        storageProvider: upload.storageProvider,
        fileName: upload.fileName,
        fileType: upload.fileType,
        sourceChannel: upload.source || "Manual",
        uploadedBy: upload.uploadedBy,
        batchId: args.batchId,
        delayMs: index * 2000,
      });
      index++;
    }

    // 3. We no longer poll batch progress here.
    // The next batch will be triggered by checkAndTriggerNextBatch
    // when the last CV in this batch finishes extracting.
  },
});
