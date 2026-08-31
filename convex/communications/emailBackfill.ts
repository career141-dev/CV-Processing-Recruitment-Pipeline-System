"use node";

import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { getGraphToken } from "../lib/graphClient";
import { extractText } from "../cvs/cvExtraction";
import { getOpenAI, OPENROUTER_CV_EXTRACTION_MODEL } from "../lib/llm";

// ── 1. MULTI-SIGNAL SCORING HEURISTICS ──────────────────────────────────────────

const CV_FILENAME_POSITIVE_REGEX =
  /(?:cv|resume|curriculum[_\s-]?vitae|biodata|bio[_\s-]?data|profile|candidate)/i;

const CV_FILENAME_NEGATIVE_REGEX =
  /(?:invoice|receipt|bill|tax|statement|payslip|salary|contract|agreement|nda|offer[_\s-]?letter|certificate|timesheet|bank|payment|quotation|purchase[_\s-]?order|po[_\s-]?\d|challan)/i;

const CV_FILE_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg"]);
const NON_CV_FILE_EXTENSIONS = new Set([
  ".xlsx",
  ".xls",
  ".pptx",
  ".ppt",
  ".zip",
  ".rar",
  ".7z",
  ".csv",
  ".txt",
  ".json",
  ".xml",
  ".mp3",
  ".mp4",
  ".svg",
]);

const CV_SECTION_HEADERS = [
  /\b(?:work\s+)?experience\b/i,
  /\bemployment(?:\s+history)?\b/i,
  /\beducation(?:al\s+background)?\b/i,
  /\bacademic\s+(?:qualifications|background|history)\b/i,
  /\b(?:technical\s+|core\s+)?skills\b/i,
  /\bprojects\b/i,
  /\b(?:professional\s+)?summary\b/i,
  /\bcareer\s+objective\b/i,
  /\bcertifications?(?:\s+and\s+licenses)?\b/i,
  /\bqualifications?\b/i,
  /\breferences?\b/i,
];

const CV_DATE_RANGE_REGEX =
  /(?:(?:19|20)\d{2}\s*[-–—to\/]\s*(?:(?:19|20)\d{2}|present|current|now|date))|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(?:19|20)\d{2}\s*[-–—to]\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(?:19|20)\d{2}|present|current|now))/gi;

const CONTACT_EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const CONTACT_PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

interface MultiSignalResult {
  score: number;
  filenameScore: number;
  extensionScore: number;
  structuralScore: number;
  matchedHeaders: number;
  dateRangesCount: number;
  textLength: number;
  llmInvoked: boolean;
  llmConfidence?: number;
  llmReason?: string;
}

/**
 * Calculates a multi-signal weighted score (0 - 1) for a given attachment.
 */
function calculateAttachmentHeuristicScore(
  fileName: string,
  rawText: string
): {
  score: number;
  filenameScore: number;
  extensionScore: number;
  structuralScore: number;
  matchedHeaders: number;
  dateRangesCount: number;
  textLength: number;
} {
  const lowerName = fileName.toLowerCase().trim();
  const extMatch = lowerName.match(/\.[a-z0-9]+$/);
  const ext = extMatch ? extMatch[0] : "";

  // 1. Filename Score (0.0 to 1.0)
  let filenameScore = 0.5; // Neutral start
  if (CV_FILENAME_POSITIVE_REGEX.test(lowerName)) {
    filenameScore += 0.35;
  }
  if (CV_FILENAME_NEGATIVE_REGEX.test(lowerName)) {
    filenameScore -= 0.45;
  }
  filenameScore = Math.max(0, Math.min(1, filenameScore));

  // 2. Extension Score (0.0 to 1.0)
  let extensionScore = 0.5;
  if (CV_FILE_EXTENSIONS.has(ext)) {
    extensionScore += 0.3;
  } else if (NON_CV_FILE_EXTENSIONS.has(ext)) {
    extensionScore -= 0.45;
  }
  extensionScore = Math.max(0, Math.min(1, extensionScore));

  // 3. Structural Text Score (0.0 to 1.0)
  let structuralScore = 0.2;
  const textLength = rawText.trim().length;

  let matchedHeaders = 0;
  for (const regex of CV_SECTION_HEADERS) {
    if (regex.test(rawText)) matchedHeaders++;
  }

  const dateMatches = rawText.match(CV_DATE_RANGE_REGEX) || [];
  const dateRangesCount = dateMatches.length;

  const hasEmail = CONTACT_EMAIL_REGEX.test(rawText);
  const hasPhone = CONTACT_PHONE_REGEX.test(rawText);

  if (textLength >= 100) {
    // Header signal (up to +0.35)
    if (matchedHeaders >= 3) structuralScore += 0.35;
    else if (matchedHeaders === 2) structuralScore += 0.25;
    else if (matchedHeaders === 1) structuralScore += 0.15;

    // Date range signal (up to +0.25)
    if (dateRangesCount >= 3) structuralScore += 0.25;
    else if (dateRangesCount >= 1) structuralScore += 0.15;

    // Contact info signal (up to +0.15)
    if (hasEmail && hasPhone) structuralScore += 0.15;
    else if (hasEmail || hasPhone) structuralScore += 0.08;

    // Reasonable CV length bonus
    if (textLength >= 300 && textLength <= 25000) {
      structuralScore += 0.1;
    }
  } else if (textLength > 0 && textLength < 50) {
    // Thin text penalty
    structuralScore -= 0.2;
  }

  structuralScore = Math.max(0, Math.min(1, structuralScore));

  // 4. Weighted Composite Score
  // Weights: Filename = 0.25, Extension = 0.15, Structure = 0.60
  const compositeScore =
    filenameScore * 0.25 + extensionScore * 0.15 + structuralScore * 0.6;

  return {
    score: Math.max(0, Math.min(1, compositeScore)),
    filenameScore,
    extensionScore,
    structuralScore,
    matchedHeaders,
    dateRangesCount,
    textLength,
  };
}

/**
 * DeepSeek V4 Flash LLM Confirmation on Ambiguous Score Band (0.40 - 0.69).
 */
async function callDeepSeekCvConfirmation(
  fileName: string,
  rawText: string
): Promise<{ isCv: boolean; confidence: number; reason: string }> {
  try {
    const openai = getOpenAI("cv_structuring");
    const snippet = rawText.slice(0, 2500);

    const prompt = `You are an automated document classifier for a talent recruitment pipeline.
Analyze the following document filename and text snippet, and determine whether this document is a Candidate CV / Resume / Curriculum Vitae.

Filename: "${fileName}"
Document Text Snippet:
"""
${snippet}
"""

Classification Rules:
- Return isCv: true if the document describes an individual's career history, education, skills, employment background, or bio-data for employment.
- Return isCv: false if the document is an invoice, payslip, financial statement, legal contract, NDA, certificate of attendance, company brochure, or vendor quotation.
- Provide a confidence score between 0.0 and 1.0.

Respond strictly in JSON format:
{
  "isCv": boolean,
  "confidence": number,
  "reason": "short 1-sentence explanation"
}`;

    const completion = await openai.chat.completions.create({
      model: OPENROUTER_CV_EXTRACTION_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return { isCv: false, confidence: 0.5, reason: "Empty response from LLM" };
    }

    const parsed = JSON.parse(content);
    return {
      isCv: Boolean(parsed.isCv),
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      reason: parsed.reason || "Classified via DeepSeek V4 Flash",
    };
  } catch (err: any) {
    console.warn("[DeepSeek Confirmation Error]:", err?.message || err);
    return { isCv: false, confidence: 0.5, reason: `LLM call failed: ${err?.message}` };
  }
}

// ── 2. MICROSOFT GRAPH API HELPERS ───────────────────────────────────────────

async function safeGraphFetch(
  url: string,
  token: string,
  retries: number = 3
): Promise<Response | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) return res;
      if (res.status === 404 || res.status === 401) return res; // Non-retryable
      console.warn(
        `[Graph API] Attempt ${attempt}/${retries} HTTP ${res.status} for ${url.slice(0, 80)}`
      );
      if (attempt === retries) return res;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    } catch (err: any) {
      console.warn(`[Graph API Network] Attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt === retries) return null;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  return null;
}

// ── 3. MAIN BACKFILL & SCANNING ACTION ────────────────────────────────────────

/**
 * Public action: Starts a mailbox scan in the background.
 */
export const startMailboxScan = action({
  args: {
    mailboxEmail: v.string(),
    folder: v.optional(v.string()), // "inbox" | "sentitems" | "all"
    dryRun: v.optional(v.boolean()),
    maxMessages: v.optional(v.number()),
    userId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; jobId: Id<"mailboxScanJobs"> }> => {
    const targetEmail = args.mailboxEmail.toLowerCase().trim();
    const folder = args.folder || "inbox";
    const isDryRun = args.dryRun ?? false;
    const maxMessages = args.maxMessages || 250;

    console.log(
      `[startMailboxScan] Starting background scan for ${targetEmail} (folder: ${folder}, dryRun: ${isDryRun})...`
    );

    // 1. Create scan job record in database
    const jobId: Id<"mailboxScanJobs"> = await ctx.runMutation(
      (internal as any).communications.emailBackfillMutations.createScanJob,
      {
        mailboxEmail: targetEmail,
        folder,
        dryRun: isDryRun,
        userId: args.userId,
        totalMessages: 0,
      }
    );

    // 2. Schedule async execution runner
    await ctx.scheduler.runAfter(
      0,
      (internal as any).communications.emailBackfill.executeMailboxScanBackground,
      {
        jobId,
        mailboxEmail: targetEmail,
        folder,
        dryRun: isDryRun,
        maxMessages,
      }
    );

    return { success: true, jobId };
  },
});

/**
 * Internal background action: Traverses Graph API, inspects attachments, runs classification,
 * uploads to R2, and queues into Agent 1 ingestion pipeline.
 */
export const executeMailboxScanBackground = internalAction({
  args: {
    jobId: v.id("mailboxScanJobs"),
    mailboxEmail: v.string(),
    folder: v.string(),
    dryRun: v.boolean(),
    maxMessages: v.number(),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const { jobId, mailboxEmail, folder, dryRun, maxMessages } = args;

    try {
      const token = await getGraphToken();
      if (!token) {
        throw new Error(
          "Failed to acquire Microsoft Graph access token. Verify MS_TENANT_ID, MS_CLIENT_ID, and MS_CLIENT_SECRET."
        );
      }

      await ctx.runMutation((internal as any).communications.emailBackfillMutations.updateScanProgress, {
        jobId,
        currentStage: "Connecting to Microsoft Graph API...",
        logMessage: {
          message: `Authenticated with Microsoft Graph. Preparing to scan mailbox: ${mailboxEmail}`,
          type: "info",
        },
      });

      // Determine folders to scan
      const foldersToScan: string[] =
        folder === "all" ? ["inbox", "sentitems"] : [folder];

      let totalMessagesScanned = 0;
      let totalAttachmentsInspected = 0;
      let classifiedHighConfidence = 0;
      let flaggedNeedsReview = 0;
      let skippedLowConfidence = 0;
      let llmCallsCount = 0;

      for (const currentFolder of foldersToScan) {
        // Check for cancellation / pause before each folder
        const status = await ctx.runQuery(
          (internal as any).communications.emailBackfillMutations.checkJobStatus,
          { jobId }
        );
        if (status === "stopped" || status === "paused") {
          console.log(`[MailboxScan] Job ${jobId} was marked as ${status}. Halting execution.`);
          return;
        }

        let url: string | null = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
          mailboxEmail
        )}/mailFolders/${currentFolder}/messages?$select=id,subject,hasAttachments,receivedDateTime,from&$top=50`;

        await ctx.runMutation((internal as any).communications.emailBackfillMutations.updateScanProgress, {
          jobId,
          currentStage: `Scanning folder: ${currentFolder.toUpperCase()}...`,
          logMessage: {
            message: `Traversing folder: ${currentFolder}...`,
            type: "info",
          },
        });

        while (url && totalMessagesScanned < maxMessages) {
          // Check for job cancellation
          const currentStatus = await ctx.runQuery(
            (internal as any).communications.emailBackfillMutations.checkJobStatus,
            { jobId }
          );
          if (currentStatus === "stopped" || currentStatus === "paused") {
            return;
          }

          const res = await safeGraphFetch(url, token);
          if (!res || !res.ok) {
            const errText = res ? await res.text() : "Network unreachable";
            console.error(`[MailboxScan] Failed to fetch messages for ${currentFolder}:`, errText);
            await ctx.runMutation((internal as any).communications.emailBackfillMutations.updateScanProgress, {
              jobId,
              logMessage: {
                message: `Failed to fetch messages for folder ${currentFolder}: ${errText.slice(0, 120)}`,
                type: "error",
              },
            });
            break;
          }

          const data = (await res.json()) as any;
          const messages = data.value || [];
          if (messages.length === 0) break;

          for (const message of messages) {
            totalMessagesScanned++;

            if (!message.hasAttachments) continue;

            const senderEmail =
              message.from?.emailAddress?.address || "unknown@career141.com";
            const subject = message.subject || "(No Subject)";

            // Fetch attachment list for this message
            const attachUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
              mailboxEmail
            )}/messages/${message.id}/attachments?$select=id,name,contentType,size`;

            const attachRes = await safeGraphFetch(attachUrl, token);
            if (!attachRes || !attachRes.ok) continue;

            const attachData = (await attachRes.json()) as any;
            const attachments = attachData.value || [];

            for (const att of attachments) {
              totalAttachmentsInspected++;
              const attachName = att.name || "attachment.dat";
              const contentType = att.contentType || "application/octet-stream";

              // Fetch attachment binary bytes
              const contentUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
                mailboxEmail
              )}/messages/${message.id}/attachments/${att.id}`;

              const contentRes = await safeGraphFetch(contentUrl, token);
              if (!contentRes || !contentRes.ok) continue;

              const contentData = (await contentRes.json()) as any;
              const contentBytes = contentData.contentBytes;
              if (!contentBytes) continue;

              // Convert base64 to ArrayBuffer
              const binaryString = atob(contentBytes);
              const fileBuffer = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                fileBuffer[i] = binaryString.charCodeAt(i);
              }

              // Compute SHA-256 hash
              const hashBuffer = await crypto.subtle.digest(
                "SHA-256",
                fileBuffer.buffer as ArrayBuffer
              );
              const fileHash = Array.from(new Uint8Array(hashBuffer))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");

              // Extract text using existing extractText pipeline
              let rawText = "";
              try {
                const extracted = await extractText(
                  fileBuffer.buffer as ArrayBuffer,
                  contentType,
                  true,
                  ctx
                );
                rawText = extracted.text || "";
              } catch (extractErr: any) {
                console.warn(
                  `[MailboxScan] Text extraction failed for ${attachName}:`,
                  extractErr.message
                );
              }

              // Calculate heuristic multi-signal score
              const heuristic = calculateAttachmentHeuristicScore(attachName, rawText);
              let finalScore = heuristic.score;
              let llmInvoked = false;
              let llmReason: string | undefined;

              // Ambiguous score band check [0.40, 0.70) -> Call DeepSeek V4 Flash
              if (finalScore >= 0.4 && finalScore < 0.7 && rawText.length >= 50) {
                llmInvoked = true;
                llmCallsCount++;
                const llmCheck = await callDeepSeekCvConfirmation(attachName, rawText);
                llmReason = llmCheck.reason;

                if (llmCheck.isCv && llmCheck.confidence >= 0.7) {
                  finalScore = Math.max(0.75, llmCheck.confidence);
                } else if (!llmCheck.isCv && llmCheck.confidence >= 0.7) {
                  finalScore = Math.min(0.35, 1 - llmCheck.confidence);
                } else {
                  // Borderline
                  finalScore = 0.55;
                }
              }

              // Decision & Routing
              if (finalScore >= 0.7) {
                // High Confidence CV
                classifiedHighConfidence++;

                if (!dryRun) {
                  // Upload to R2
                  const s3Key = await ctx.runAction(internal.storage.r2.uploadBufferToR2, {
                    fileName: attachName,
                    contentType: contentType || "application/pdf",
                    base64Data: contentBytes,
                  });

                  // Trigger Agent 1 -> Agent 6 Ingestion Pipeline
                  await ctx.runMutation(api.pipeline.ingestion.processCvIngestion, {
                    sourceChannel: "email",
                    rawSender: senderEmail,
                    s3Key,
                    storageProvider: "r2",
                    fileHash,
                    fileName: attachName,
                    fileType: contentType || "application/pdf",
                    fileSizeBytes: fileBuffer.length,
                    metaCampaignId: `Email — Backfill — ${mailboxEmail}/${currentFolder}`,
                  });
                }

                await ctx.runMutation(
                  (internal as any).communications.emailBackfillMutations.updateScanProgress,
                  {
                    jobId,
                    scannedMessages: totalMessagesScanned,
                    totalAttachments: totalAttachmentsInspected,
                    classifiedHighConfidence,
                    flaggedNeedsReview,
                    skippedLowConfidence,
                    llmCallsCount,
                    logMessage: {
                      message: `[MATCH] ${attachName} (Score: ${(finalScore * 100).toFixed(0)}%${llmInvoked ? ", LLM Confirmed" : ""}) from "${subject.slice(0, 30)}..." -> ${dryRun ? "Dry Run (Queued)" : "Ingested to Agent 1"}`,
                      type: "success",
                    },
                  }
                );
              } else if (finalScore >= 0.4) {
                // Ambiguous -> Flag as needs_review
                flaggedNeedsReview++;
                await ctx.runMutation(
                  (internal as any).communications.emailBackfillMutations.updateScanProgress,
                  {
                    jobId,
                    scannedMessages: totalMessagesScanned,
                    totalAttachments: totalAttachmentsInspected,
                    classifiedHighConfidence,
                    flaggedNeedsReview,
                    skippedLowConfidence,
                    llmCallsCount,
                    logMessage: {
                      message: `[REVIEW] ${attachName} (Score: ${(finalScore * 100).toFixed(0)}%${llmReason ? ` - ${llmReason}` : ""}) -> Flagged for review`,
                      type: "warning",
                    },
                  }
                );
              } else {
                // Low confidence -> Skip & Log
                skippedLowConfidence++;
                await ctx.runMutation(
                  (internal as any).communications.emailBackfillMutations.updateScanProgress,
                  {
                    jobId,
                    scannedMessages: totalMessagesScanned,
                    totalAttachments: totalAttachmentsInspected,
                    classifiedHighConfidence,
                    flaggedNeedsReview,
                    skippedLowConfidence,
                    llmCallsCount,
                  }
                );
              }
            }
          }

          // Advance pagination
          url = data["@odata.nextLink"] || null;
        }
      }

      // Mark Job as Completed
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      await ctx.runMutation((internal as any).communications.emailBackfillMutations.setScanJobStatus, {
        jobId,
        status: "done",
        currentStage: `Scan completed in ${elapsedSec}s.`,
        logMessage: {
          message: `Scan finished: ${totalMessagesScanned} messages scanned, ${totalAttachmentsInspected} attachments evaluated (${classifiedHighConfidence} high confidence, ${flaggedNeedsReview} needs review, ${skippedLowConfidence} skipped, ${llmCallsCount} LLM calls).`,
          type: "success",
        },
      });
    } catch (err: any) {
      console.error("[MailboxScan Critical Error]:", err);
      await ctx.runMutation((internal as any).communications.emailBackfillMutations.setScanJobStatus, {
        jobId,
        status: "error",
        errorMessage: err?.message || String(err),
        currentStage: "Scan failed with error.",
        logMessage: {
          message: `Scan halted due to error: ${err?.message || err}`,
          type: "error",
        },
      });
    }
  },
});
