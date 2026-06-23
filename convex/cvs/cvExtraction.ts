"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import OpenAI from "openai";
import crypto from "crypto";
import { z } from "zod";

// ──────────────────────────────────────────────────
// Types & Schemas
// ──────────────────────────────────────────────────

export const educationSchema = z.object({
  degree: z.string().nullable(),
  institution: z.string().nullable(),
  year: z.number().nullable(),
  field: z.string().nullable(),
});

export const cvExtractionSchema = z.object({
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  currentTitle: z.string().nullable(),
  currentEmployer: z.string().nullable(),
  seniorityLevel: z.string().nullable(),
  yearsOfExperience: z.number().nullable(),
  industries: z.array(z.string()).nullable(),
  expectedSalary: z.string().nullable(),
  noticePeriod: z.string().nullable(),
  employmentStatus: z.string().nullable(),
  skills: z.array(z.string()).nullable(),
  education: z.array(educationSchema).nullable(),
  certifications: z.array(z.string()).nullable(),
  languages: z.array(z.string()).nullable(),
  summary: z.string().nullable(),
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

/**
 * PDF: Use pdfjs-dist/legacy — same approach as the C141 platform.
 * The legacy build ships browser-API polyfills (DOMMatrix, ImageData,
 * Path2D, etc.) so it works correctly inside the Convex "use node"
 * serverless runtime where those globals are otherwise absent.
 *
 * Uses each text item's transform/position info to insert line breaks
 * where lines change vertically, preserving paragraph structure for
 * better LLM extraction and search quality.
 */
async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  if (typeof globalThis.DOMMatrix === "undefined") {
    globalThis.DOMMatrix = class DOMMatrix {} as any;
  }
  if (typeof globalThis.ImageData === "undefined") {
    globalThis.ImageData = class ImageData {} as any;
  }
  if (typeof globalThis.Path2D === "undefined") {
    globalThis.Path2D = class Path2D {} as any;
  }

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let lastY: number | null = null;

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = "transform" in item ? (item as any).transform[5] : 0;
      if (lastY !== null && Math.abs(y - lastY) > 5) {
        lines.push("");
      }
      lines.push(item.str);
      lastY = y;
    }

    textParts.push(lines.join(" ").replace(/ {2,}/g, " ").trim());
  }

  return textParts.join("\n\n");
}

/**
 * DOCX: Use mammoth (same as C141 platform).
 * Guard against bundler wrapping the module under .default.
 */
async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const extractFn =
    typeof mammoth.extractRawText === "function"
      ? mammoth.extractRawText
      : (mammoth as any).default?.extractRawText;
  if (!extractFn) {
    throw new Error("mammoth library could not be loaded correctly");
  }
  const result = await extractFn({ buffer: Buffer.from(buffer) });
  return result.value;
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

  // Unknown type — try PDF first (most common for CVs), then DOCX, then raw decode
  try {
    const pdfText = await extractTextFromPdf(buffer);
    if (pdfText.trim().length > 50) return pdfText;
  } catch {}

  try {
    const docxText = await extractTextFromDocx(buffer);
    if (docxText.trim().length > 50) return docxText;
  } catch {}

  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
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
          role: "system",
          content: `You are a CV data extraction tool. Extract the following fields exactly as written in the CV. Do not paraphrase, summarize, or infer information that is not explicitly present. If a field is not present, return null — do not generate placeholder content.

Return a valid JSON object with these fields:
- fullName: string | null (full name exactly as written)
- email: string | null (email address exactly as written)
- phone: string | null (phone number exactly as written)
- location: string | null (city, country or location exactly as written)
- linkedinUrl: string | null (LinkedIn profile URL exactly as written)
- currentTitle: string | null (most recent job title exactly as written)
- currentEmployer: string | null (most recent employer name exactly as written)
- seniorityLevel: string | null (only if explicitly stated — e.g. Junior, Mid, Senior, Lead, Manager, Director, C-Level)
- yearsOfExperience: number | null (only if explicitly stated, e.g. "10 years" -> 10)
- industries: string[] | null (industries explicitly mentioned)
- expectedSalary: string | null (salary expectation exactly as written)
- noticePeriod: string | null (notice period exactly as written)
- employmentStatus: string | null (current employment status exactly as written)
- skills: string[] | null (list of skills exactly as written)
- education: { degree: string | null, institution: string | null, year: number | null, field: string | null }[] | null
- certifications: string[] | null (certifications exactly as written)
- languages: string[] | null (languages exactly as written)
- summary: string | null (the exact professional summary, profile, or about-me section written in the CV verbatim)

CRITICAL RULES:
1. Extract text verbatim from the CV. Do NOT rephrase, normalize, or infer.
2. If a field is not present in the CV, set it to null — do not generate fake values or placeholder text.
3. For "summary", extract the exact professional summary or profile statement verbatim as written in the CV. Do not summarize, rephrase, or write an AI-generated summary.
4. For "yearsOfExperience", only extract if explicitly stated (e.g. "10+ years of experience").
5. For "seniorityLevel", only extract if the CV explicitly states a level.`,
        },
        {
          role: "user",
          content: `Extract the required fields from this CV text. Return ONLY valid JSON:\n\n${textToSend}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return cvExtractionSchema.parse(parsed);
    } catch {
      // JSON parse or schema validation failed — fall back gracefully
      return null;
    }
  } catch (error) {
    // Re-throw credit/balance errors so the caller can set status to "paused"
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("403") ||
      message.toLowerCase().includes("insufficient") ||
      message.toLowerCase().includes("balance") ||
      message.toLowerCase().includes("credits")
    ) {
      throw error;
    }
    // All other API errors fall back gracefully (return null)
    return null;
  }
}

// ──────────────────────────────────────────────────
// null → undefined helper (same as before)
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
    // 1. Fetch file from Convex storage
    const blob = await ctx.storage.get(storageId);
    if (!blob) throw new Error("File not found in Convex storage");

    const buffer = await blob.arrayBuffer();
    const fileHash = computeSha256(buffer);

    // 2. Extract raw text — pdfjs-dist/legacy for PDF, mammoth for DOCX.
    //    The FULL extracted text is stored so the search index covers the
    //    entire CV (capped at MAX_RAW_TEXT_LENGTH to stay within Convex's
    //    1 MB document limit).  Only the slice sent to the LLM is capped
    //    further (see callNvidiaLLM which limits to MAX_CHARS = 15 000).
    const rawText = await extractText(buffer, fileType);
    const trimmed = rawText.trim();
    if (trimmed.length < 20) {
      throw new Error("Insufficient text extracted from file");
    }
    const cappedRawText = trimmed.length > MAX_RAW_TEXT_LENGTH
      ? trimmed.slice(0, MAX_RAW_TEXT_LENGTH)
      : trimmed;

    // 3. Call LLM — graceful fallback to null on non-credit errors
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
        expectedSalary: null,
        noticePeriod: null,
        employmentStatus: null,
        skills: null,
        education: null,
        certifications: null,
        languages: null,
        summary: null,
      };
    } else {
      extracted = await callNvidiaLLM(cappedRawText);
    }

    // 4. Save candidate — even if LLM failed we save rawText for search indexing.
    //    Convex document size limit is 1 MB; a full CV rarely exceeds 100 KB of
    //    text, so we keep the full text.  We cap at 500 000 chars as a safety
    //    net only.
    const safeExtracted = extracted ? nullToUndefined(extracted) : {};

    const candidateId = await ctx.runMutation(api.candidates.createCandidate, {
      ...safeExtracted,
      rawText: cappedRawText,
      sourceChannel: sourceChannel ?? undefined,
      fileHash,
      cvUploadId,
      workableCandidateId: workableCandidateId ?? undefined,
    });

    const jobId = await ctx.runMutation(api.candidates.updateCvUpload, {
      cvUploadId,
      status: "processed",
      fileHash,
      candidateId,
    }) as string | undefined | null;

    if (jobId) {
      await ctx.scheduler.runAfter(0, api.cvs.cvScoringActions.processCvScoring, {
        candidateId,
        jobId: jobId as any,
      });
    }

    return candidateId;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Mirror C141: pause on credit errors so the user can top up and resume
    const isInsufficientBalance =
      message.includes("403") ||
      message.toLowerCase().includes("insufficient") ||
      message.toLowerCase().includes("balance") ||
      message.toLowerCase().includes("credits");

    await ctx.runMutation(api.candidates.updateCvUpload, {
      cvUploadId,
      status: "processed",
      errorMessage: isInsufficientBalance
        ? "Processed raw text only (LLM extraction skipped due to insufficient credits)"
        : message,
    });

    // Don't re-throw for balance errors — caller should not retry immediately
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
// Batch Resume — same pattern as C141's resumeBatch
// Retries all "paused" or "failed" uploads in pages
// ──────────────────────────────────────────────────

export const resumeFailedUploads = action({
  args: {},
  handler: async (ctx): Promise<{ queued: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await ctx.runAction(internal.cvs.cvExtraction.resumeBatch, {
      cursor: undefined,
      totalQueued: 0,
    });
    return { queued: 0 };
  },
});

export const resumeBatch = internalAction({
  args: {
    cursor: v.optional(v.string()),
    totalQueued: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Fetch a page of failed/paused uploads
    const result = await ctx.runQuery(api.candidates.listFailedUploads, {
      cursor: args.cursor,
      limit: 50,
    });

    for (let i = 0; i < result.page.length; i++) {
      const upload = result.page[i];
      // Stagger retries: 1 second apart to avoid rate limit spikes
      // Note: cvUploads uses 'source' field, exposed as sourceChannel to the action
      ctx.scheduler.runAfter(i * 1000, api.cvs.cvExtraction.processCvExtraction, {
        storageId: upload.storageId as Id<"_storage">,
        fileType: upload.fileType,
        sourceChannel: upload.source,
        uploadedBy: upload.uploadedBy,
        cvUploadId: upload._id,
      });
    }

    // Recurse if there are more pages
    if (!result.isDone && result.continueCursor) {
      ctx.scheduler.runAfter(
        result.page.length * 1000 + 500,
        internal.cvs.cvExtraction.resumeBatch,
        {
          cursor: result.continueCursor,
          totalQueued: args.totalQueued + result.page.length,
        },
      );
    }
  },
});
