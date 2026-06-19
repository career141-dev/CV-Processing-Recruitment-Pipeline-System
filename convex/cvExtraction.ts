"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
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
};

const ExtractionActionArgs = {
  storageId: v.id("_storage"),
  fileType: v.string(),
  sourceChannel: v.optional(v.string()),
  uploadedBy: v.string(),
  cvUploadId: v.id("cvUploads"),
};

// ──────────────────────────────────────────────────
// Text Extraction
// ──────────────────────────────────────────────────

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const PDFParser = await import("pdf2json");
  return new Promise<string>((resolve, reject) => {
    const pdfParser = new PDFParser.default(null, true);
    pdfParser.on("pdfParser_dataReady", (pdfData: { Pages: Array<{ Texts: Array<{ R: Array<{ T: string }> }> }> }) => {
      try {
        const textParts: string[] = [];
        for (const page of pdfData.Pages) {
          const pageText = (page.Texts || [])
            .map((t) => (t.R || []).map((r) => decodeURIComponent(r.T)).join(" "))
            .join(" ");
          textParts.push(pageText);
        }
        resolve(textParts.join("\n"));
      } catch (err) {
        reject(err);
      }
    });
    pdfParser.on("pdfParser_dataError", (errMsg: Error | { parserError: Error }) => {
      const err = "parserError" in errMsg ? errMsg.parserError : errMsg;
      reject(err || new Error("PDF parse failed"));
    });
    pdfParser.parseBuffer(Buffer.from(buffer));
  });
}

async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
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
  if (
    type === "docx" ||
    type === "doc" ||
    type.includes("wordprocessingml")
  ) {
    return extractTextFromDocx(buffer);
  }
  return new TextDecoder().decode(buffer);
}

function computeSha256(buffer: ArrayBuffer): string {
  return crypto.createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

// ──────────────────────────────────────────────────
// NVIDIA LLM
// ──────────────────────────────────────────────────

function createNvidiaClient(): OpenAI {
  return new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.NVIDIA_API_KEY!,
  });
}

export async function callNvidiaLLM(rawText: string): Promise<CvExtractionResult> {
  const openai = createNvidiaClient();

  const MAX_CHARS = 15000;
  const textToSend =
    rawText.length > MAX_CHARS
      ? rawText.slice(0, MAX_CHARS).replace(/\s+\S*$/, "")
      : rawText;

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
- summary: string | null (1-2 sentence professional summary based on the CV)

CRITICAL RULES:
1. Extract text verbatim from the CV. Do NOT rephrase, normalize, or infer.
2. If a field is not present in the CV, set it to null — do not generate fake values or placeholder text.
3. For "summary", write a brief professional summary based on the CV content.
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
  if (!content) {
    throw new Error("LLM returned empty response");
  }

  const parsed = JSON.parse(content) as Record<string, unknown>;
  return cvExtractionSchema.parse(parsed);
}

// ──────────────────────────────────────────────────
// Reusable extraction pipeline — processes one CV
// ──────────────────────────────────────────────────

export async function runCvExtraction(
  ctx: ActionCtx,
  args: ExtractionArgs,
): Promise<string | null> {
  const { storageId, fileType, sourceChannel, cvUploadId } = args;

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
    if (!rawText || rawText.trim().length < 20) {
      throw new Error("Insufficient text extracted from file");
    }

    const extracted = await callNvidiaLLM(rawText);

    const nullToUndefined = <T extends Record<string, unknown>>(obj: T): Record<string, unknown> =>
      Object.fromEntries(
        Object.entries(obj).map(([k, v]) => {
          if (v === null) return [k, undefined];
          if (Array.isArray(v)) {
            return [
              k,
              v.map((item) =>
                item !== null && typeof item === "object" && !Array.isArray(item)
                  ? Object.fromEntries(
                      Object.entries(item).map(([ik, iv]) => [ik, iv === null ? undefined : iv]),
                    )
                  : item,
              ),
            ];
          }
          return [k, v];
        }),
      );

    const candidateId = await ctx.runMutation(api.candidates.createCandidate, {
      ...nullToUndefined(extracted),
      sourceChannel: sourceChannel ?? undefined,
      fileHash,
      cvUploadId,
    });

    await ctx.runMutation(api.candidates.updateCvUpload, {
      cvUploadId,
      status: "processed",
      fileHash,
      candidateId,
    });

    return candidateId;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await ctx.runMutation(api.candidates.updateCvUpload, {
      cvUploadId,
      status: "failed",
      errorMessage: message,
    });
    throw err;
  }
}

// ──────────────────────────────────────────────────
// Public Action — callable from client or other actions
// ──────────────────────────────────────────────────

export const processCvExtraction = action({
  args: ExtractionActionArgs,
  handler: async (ctx, args): Promise<string | null> => {
    return runCvExtraction(ctx, args);
  },
});
