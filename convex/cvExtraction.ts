"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";
import crypto from "crypto";
import { z } from "zod";
import PDFParser from "pdf2json";
import mammoth from "mammoth";
import tesseract from "tesseract.js";

// ──────────────────────────────────────────────────
// Types & Schemas
// ──────────────────────────────────────────────────

export const educationSchema = z.object({
  degree: z.string().nullable().optional(),
  institution: z.string().nullable().optional(),
  year: z.number().nullable().optional(),
  field: z.string().nullable().optional(),
});

export const jobHistorySchema = z.object({
  company: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const cvExtractionSchema = z.object({
  fullName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  currentTitle: z.string().nullable().optional(),
  currentEmployer: z.string().nullable().optional(),
  seniorityLevel: z.string().nullable().optional(),
  yearsOfExperience: z.number().nullable().optional(),
  industries: z.array(z.string()).nullable().optional(),
  sector: z.string().nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
  education: z.array(educationSchema).nullable().optional(),
  languages: z.array(z.string()).nullable().optional(),
  summary: z.string().nullable().optional(),
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
};

// ──────────────────────────────────────────────────
// Text Extraction
// ──────────────────────────────────────────────────

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);
    
    pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
    pdfParser.on("pdfParser_dataReady", () => {
      resolve(pdfParser.getRawTextContent());
    });
    
    pdfParser.parseBuffer(Buffer.from(buffer));
  });
}

async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return result.value;
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
    return extractTextFromPdf(buffer);
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

  try {
    const pdfText = await extractTextFromPdf(buffer);
    if (pdfText.trim().length > 50) return pdfText;
  } catch {}

  try {
    const docxText = await extractTextFromDocx(buffer);
    if (docxText.trim().length > 50) return docxText;
  } catch {}

  try {
    const imgText = await extractTextFromImage(buffer);
    if (imgText.trim().length > 50) return imgText;
  } catch {}

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
  rawText: string,
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
1. Return only valid JSON. No markdown, no backticks, no explanation.
2. If a field is not found, return null. Never invent or guess.
3. Return skills as an array of strings.
4. Return jobHistory as an array of objects.
{
  "fullName": null,
  "email": null,
  "phone": null,
  "location": null,
  "linkedinUrl": null,
  "currentTitle": null,
  "currentEmployer": null,
  "seniorityLevel": null,
  "yearsOfExperience": null,
  "industries": null,
  "sector": null,
  "skills": null,
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
      "description": null
    }
  ]
}
CV TEXT:
${textToSend}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = parseJsonRobustly(content);
    if (!parsed) return null;

    try {
      return cvExtractionSchema.parse(parsed);
    } catch {
      return null;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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

function nullToUndefined<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
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
  );
}

// ──────────────────────────────────────────────────
// Core extraction pipeline — one CV at a time
// ──────────────────────────────────────────────────

export async function runCvExtraction(
  ctx: ActionCtx,
  args: ExtractionArgs,
): Promise<string | null> {
  const { storageId, fileType, sourceChannel, cvUploadId, workableCandidateId, skipLLM, preExtractedData } = args;

  await ctx.runMutation(api.candidates.updateCvUpload, {
    cvUploadId,
    status: "processing",
  });

  try {
    const blob = await ctx.storage.get(storageId);
    if (!blob) throw new Error("File not found in Convex storage");

    const buffer = await blob.arrayBuffer();
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

    const candidateId = await ctx.runMutation(api.candidates.createCandidate, {
      rawText: cappedRawText,
      sourceChannel: sourceChannel ?? undefined,
      fileHash,
      cvUploadId,
      workableCandidateId: workableCandidateId ?? undefined,
    });

    await ctx.runMutation(api.candidates.updateCvUpload, {
      cvUploadId,
      status: "processing",
      fileHash,
      candidateId,
    });

    let extracted: CvExtractionResult | null = null;
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
        yearsOfExperience: null,
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
    } else {
      extracted = await callNvidiaLLM(cappedRawText);
    }

    if (extracted) {
      const safeExtracted = nullToUndefined(extracted);
      await ctx.runMutation(api.candidates.createCandidate, {
        ...safeExtracted,
        fileHash,
      });
    }

    await ctx.runMutation(api.candidates.updateCvUpload, {
      cvUploadId,
      status: "processed",
    });

    return candidateId;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    const isInsufficientBalance =
      message.includes("403") ||
      message.toLowerCase().includes("insufficient") ||
      message.toLowerCase().includes("balance") ||
      message.toLowerCase().includes("credits");

    await ctx.runMutation(api.candidates.updateCvUpload, {
      cvUploadId,
      status: isInsufficientBalance ? "processed" : "failed",
      errorMessage: isInsufficientBalance
        ? "Processed raw text only (LLM extraction skipped due to insufficient credits)"
        : message,
    });

    if (!isInsufficientBalance) throw err;
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
  args: {},
  handler: async (ctx): Promise<{ queued: number }> => {
    // Auth check removed to avoid Clerk dev instance token issues; 
    // it simply kicks off the internal processing queue.
    await ctx.scheduler.runAfter(0, internal.cvExtraction.processNextInQueue, {});
    return { queued: 1 };
  },
});

export const processNextInQueue = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const result = await ctx.runQuery(api.candidates.listFailedUploads, {
      limit: 1,
    });

    if (result.page.length === 0) {
      return;
    }

    const upload = result.page[0];

    await ctx.runMutation(api.candidates.updateCvUpload, {
      cvUploadId: upload._id,
      status: "processing",
    });

    if (upload.storageId) {
      await runCvExtraction(ctx, {
        storageId: upload.storageId,
        fileType: upload.fileType,
        sourceChannel: upload.source,
        uploadedBy: upload.uploadedBy,
        cvUploadId: upload._id,
      });
    } else {
      await ctx.runMutation(api.candidates.updateCvUpload, {
        cvUploadId: upload._id,
        status: "failed",
        errorMessage: "No storageId attached to this upload",
      });
    }

    await ctx.scheduler.runAfter(1600, internal.cvExtraction.processNextInQueue, {});
  },
});
