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
 * Strict CV / Resume Filename Detector.
 * Only accepts files with explicit "cv", "resume", "curriculum vitae", or "biodata" in their filename.
 * Automatically excludes invoices, receipts, payslips, scoop decks, agreements, and agency rebranded files.
 */
export function isCvOrResumeFilename(fileName: string): boolean {
  if (!fileName) return false;
  const lower = fileName.toLowerCase().trim();

  // 1. Must have valid document extension
  const extMatch = lower.match(/\.[a-z0-9]+$/);
  const ext = extMatch ? extMatch[0] : "";
  if (!CV_FILE_EXTENSIONS.has(ext)) return false;

  // 2. Negative checks: Exclude invoices, statements, payslips, scoop decks, etc.
  if (
    /(?:invoice|receipt|bill|tax|statement|payslip|salary|contract|agreement|nda|offer[_\s-]?letter|timesheet|bank|payment|quotation|purchase[_\s-]?order|po[_\s-]?\d|challan|scoop)/i.test(
      lower
    )
  ) {
    return false;
  }

  // 3. Exclude internal agency rebranded profile format: "[Name] - CAREER141.pdf"
  if (/-\s*career141(?:\s*\(\d+\))?\.[a-z0-9]+$/i.test(lower)) {
    return false;
  }

  // 4. Positive check: Must contain cv, resume, curriculum vitae, or biodata
  const hasCvOrResume =
    /\b(?:cv|resume|resumes|curriculum[_\s-]?vitae|biodata|bio[_\s-]?data)\b/i.test(lower) ||
    /(?:^|[\s_\-.\(\)\[\]])(?:cv|resume|curriculum[_\s-]?vitae|biodata)(?:$|[\s_\-.\(\)\[\]\d])/i.test(lower);

  return hasCvOrResume;
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
Analyze the following document filename and text snippet, and determine whether this document is an original Candidate CV / Resume / Curriculum Vitae.

Filename: "${fileName}"
Document Text Snippet:
"""
${snippet}
"""

Classification Rules:
- Return isCv: true ONLY if the document is an original candidate CV, resume, bio-data, or employment application describing an individual's career history, education, skills, and background.
- Return isCv: false if the document is an agency scoop sheet, candidate pitch deck, client submission summary, invoice, payslip, financial statement, legal contract, NDA, certificate of attendance, or vendor quotation.
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

// ── 3. MAIN BACKFILL & SCANNING ACTIONS ───────────────────────────────────────

/**
 * Public action: Starts a mailbox scan by launching Phase 1 (Discovery) or resuming from persistent checkpoint.
 */
export const startMailboxScan = action({
  args: {
    mailboxEmail: v.string(),
    folder: v.optional(v.string()), // "inbox" | "sentitems" | "all"
    dryRun: v.optional(v.boolean()),
    maxMessages: v.optional(v.number()), // -1 for All remaining, or 50, 150, 300, 500, 1000
    userId: v.optional(v.string()),
    forceRediscovery: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; jobId: Id<"mailboxScanJobs">; resumed: boolean }> => {
    const targetEmail = args.mailboxEmail.toLowerCase().trim();
    const folder = args.folder || "inbox";
    const isDryRun = args.dryRun ?? false;
    const maxMessages = args.maxMessages || 150;

    // Check if a persistent checkpoint exists for this mailbox + folder
    let checkpoint = null;
    if (!args.forceRediscovery) {
      checkpoint = await ctx.runQuery(
        (api as any).communications.emailBackfillMutations.getMailboxCheckpoint,
        {
          mailboxEmail: targetEmail,
          folder,
        }
      );
    }

    const canResume =
      checkpoint &&
      checkpoint.totalDiscoveredAttachmentEmails > 0 &&
      checkpoint.totalExtractedCount < checkpoint.totalDiscoveredAttachmentEmails;

    if (canResume) {
      const currentExtracted = checkpoint.totalExtractedCount || 0;
      const totalDiscovered = checkpoint.totalDiscoveredAttachmentEmails;
      const remaining = Math.max(0, totalDiscovered - currentExtracted);
      const batchSize = maxMessages === -1 ? remaining : Math.min(maxMessages, remaining);
      const targetGoal = currentExtracted + batchSize;

      console.log(
        `[startMailboxScan] Resuming from checkpoint for ${targetEmail} (#${currentExtracted}/${totalDiscovered} extracted). Extracting next batch of ${batchSize}...`
      );

      // Create scan job directly in extracting phase with resumption context
      const jobId: Id<"mailboxScanJobs"> = await ctx.runMutation(
        (internal as any).communications.emailBackfillMutations.createScanJob,
        {
          mailboxEmail: targetEmail,
          folder,
          dryRun: isDryRun,
          userId: args.userId,
          totalMessages: targetGoal,
        }
      );

      await ctx.runMutation(
        (internal as any).communications.emailBackfillMutations.updateScanProgress,
        {
          jobId,
          phase: "extracting",
          discoveredTotalEmails: checkpoint.totalDiscoveredEmails || totalDiscovered,
          discoveredAttachmentEmails: totalDiscovered,
          targetAttachmentEmails: targetGoal,
          processedAttachmentEmails: currentExtracted,
          scannedMessages: currentExtracted,
          currentFolderIndex: checkpoint.currentFolderIndex ?? 0,
          nextCursorUrl: checkpoint.nextCursorUrl,
          currentStage: `Resuming from checkpoint: Extracting #${currentExtracted + 1} to #${targetGoal} of ${totalDiscovered} attachment emails...`,
          logMessage: {
            message: `Resumed from checkpoint: Previously extracted ${currentExtracted}/${totalDiscovered}. Extracting next batch of ${batchSize} attachment emails.`,
            type: "info",
          },
        }
      );

      // Schedule Phase 2 extraction starting directly from cursor
      await ctx.scheduler.runAfter(
        0,
        (internal as any).communications.emailBackfill.executeMailboxScanBackground,
        {
          jobId,
          mailboxEmail: targetEmail,
          folder,
          dryRun: isDryRun,
          maxMessages: targetGoal,
          targetAttachmentEmails: targetGoal,
          processedAttachmentEmails: currentExtracted,
          folderIndex: checkpoint.currentFolderIndex ?? 0,
          nextCursorUrl: checkpoint.nextCursorUrl,
          scannedMessages: currentExtracted,
        }
      );

      return { success: true, jobId, resumed: true };
    }

    console.log(
      `[startMailboxScan] Starting fresh discovery scan for ${targetEmail} (folder: ${folder}, target depth: ${maxMessages}, dryRun: ${isDryRun})...`
    );

    // 1. Create scan job record in database in discovery phase
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

    // 2. Schedule Phase 1: Fast folder discovery
    await ctx.scheduler.runAfter(
      0,
      (internal as any).communications.emailBackfill.executeMailboxDiscoveryPhase,
      {
        jobId,
        mailboxEmail: targetEmail,
        folder,
        dryRun: isDryRun,
        maxMessages,
      }
    );

    return { success: true, jobId, resumed: false };
  },
});

/**
 * Phase 1 (Discovery): Fast-scans the target folder(s) using Graph API header-only queries,
 * discovers total attachment-bearing emails to set the true extraction goal, saves persistent
 * checkpoint in database, then automatically transitions into Phase 2 extraction.
 */
export const executeMailboxDiscoveryPhase = internalAction({
  args: {
    jobId: v.id("mailboxScanJobs"),
    mailboxEmail: v.string(),
    folder: v.string(),
    dryRun: v.boolean(),
    maxMessages: v.number(),
  },
  handler: async (ctx, args) => {
    const { jobId, mailboxEmail, folder, dryRun, maxMessages } = args;

    try {
      const token = await getGraphToken();
      if (!token) {
        throw new Error(
          "Failed to acquire Microsoft Graph access token. Verify MS_TENANT_ID, MS_CLIENT_ID, and MS_CLIENT_SECRET."
        );
      }

      await ctx.runMutation(
        (internal as any).communications.emailBackfillMutations.updateScanProgress,
        {
          jobId,
          phase: "discovery",
          currentStage: `Phase 1: Discovering attachment-bearing emails in ${folder.toUpperCase()}...`,
          logMessage: {
            message: `Starting discovery pass across mailbox: ${mailboxEmail} (folder: ${folder})`,
            type: "info",
          },
        }
      );

      const foldersToScan = folder === "all" ? ["inbox", "sentitems"] : [folder];

      let totalEmailsDiscovered = 0;
      let totalAttachmentEmailsDiscovered = 0;

      for (const currentFolder of foldersToScan) {
        let url: string | null = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
          mailboxEmail
        )}/mailFolders/${currentFolder}/messages?$select=id,hasAttachments,receivedDateTime,subject,from&$top=100&$filter=hasAttachments eq true`;

        while (url) {
          const status = await ctx.runQuery(
            (internal as any).communications.emailBackfillMutations.checkJobStatus,
            { jobId }
          );
          if (status === "stopped" || status === "paused") return;

          let res = await safeGraphFetch(url, token);

          // Fallback if tenant filter is constrained
          if (!res || !res.ok) {
            const fallbackUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
              mailboxEmail
            )}/mailFolders/${currentFolder}/messages?$select=id,hasAttachments,receivedDateTime,subject,from&$top=100`;
            res = await safeGraphFetch(fallbackUrl, token);
          }

          if (!res || !res.ok) {
            console.warn(`[Discovery] Graph fetch issue for ${currentFolder}`);
            break;
          }

          const data = (await res.json()) as any;
          const messages = data.value || [];
          totalEmailsDiscovered += messages.length;

          for (const msg of messages) {
            if (msg.hasAttachments) {
              totalAttachmentEmailsDiscovered++;
            }
          }

          await ctx.runMutation(
            (internal as any).communications.emailBackfillMutations.updateScanProgress,
            {
              jobId,
              discoveredTotalEmails: totalEmailsDiscovered,
              discoveredAttachmentEmails: totalAttachmentEmailsDiscovered,
              currentStage: `Discovered ${totalAttachmentEmailsDiscovered} attachment emails (${totalEmailsDiscovered} scanned in ${currentFolder.toUpperCase()})...`,
            }
          );

          url = data["@odata.nextLink"] || null;
        }
      }

      // Calculate extraction target based on scan depth
      const targetGoal =
        maxMessages === -1
          ? totalAttachmentEmailsDiscovered
          : Math.min(maxMessages, totalAttachmentEmailsDiscovered);

      // Persist discovered count in mailboxCheckpoints table
      await ctx.runMutation(
        (internal as any).communications.emailBackfillMutations.saveMailboxCheckpoint,
        {
          mailboxEmail,
          folder,
          totalDiscoveredAttachmentEmails: totalAttachmentEmailsDiscovered,
          totalDiscoveredEmails: totalEmailsDiscovered,
          totalExtractedCount: 0,
        }
      );

      await ctx.runMutation(
        (internal as any).communications.emailBackfillMutations.updateScanProgress,
        {
          jobId,
          phase: "extracting",
          totalMessages: targetGoal,
          targetAttachmentEmails: targetGoal,
          discoveredTotalEmails: totalEmailsDiscovered,
          discoveredAttachmentEmails: totalAttachmentEmailsDiscovered,
          currentStage: `Discovery complete! Found ${totalAttachmentEmailsDiscovered} attachment-bearing emails. Target goal: ${targetGoal}. Transitioning to Phase 2 extraction...`,
          logMessage: {
            message: `Discovery complete: Found ${totalAttachmentEmailsDiscovered} attachment emails. Target extraction goal: ${targetGoal}. Starting Phase 2 extraction...`,
            type: "success",
          },
        }
      );

      // Launch Phase 2 extraction runner
      await ctx.scheduler.runAfter(
        0,
        (internal as any).communications.emailBackfill.executeMailboxScanBackground,
        {
          jobId,
          mailboxEmail,
          folder,
          dryRun,
          maxMessages: targetGoal,
          targetAttachmentEmails: targetGoal,
          processedAttachmentEmails: 0,
          folderIndex: 0,
        }
      );
    } catch (err: any) {
      console.error("[MailboxDiscovery Phase Error]:", err);
      await ctx.runMutation(
        (internal as any).communications.emailBackfillMutations.setScanJobStatus,
        {
          jobId,
          status: "error",
          phase: "error",
          errorMessage: err?.message || String(err),
          currentStage: "Discovery phase failed.",
          logMessage: {
            message: `Discovery failed with error: ${err?.message || err}`,
            type: "error",
          },
        }
      );
    }
  },
});

/**
 * Phase 2 (Extraction): Time-sliced extraction runner that yields every ~30 seconds to prevent
 * the 120s Convex Action timeout, extracting text, calculating multi-signal heuristic + DeepSeek V4 Flash,
 * uploading to R2, and calling Agent 1 ingestion.
 */
export const executeMailboxScanBackground = internalAction({
  args: {
    jobId: v.id("mailboxScanJobs"),
    mailboxEmail: v.string(),
    folder: v.string(),
    dryRun: v.boolean(),
    maxMessages: v.number(),
    targetAttachmentEmails: v.optional(v.number()),
    processedAttachmentEmails: v.optional(v.number()),
    folderIndex: v.optional(v.number()),
    nextCursorUrl: v.optional(v.string()),
    scannedMessages: v.optional(v.number()),
    totalAttachments: v.optional(v.number()),
    classifiedHighConfidence: v.optional(v.number()),
    flaggedNeedsReview: v.optional(v.number()),
    skippedLowConfidence: v.optional(v.number()),
    llmCallsCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const MAX_ACTION_DURATION_MS = 30000; // 30s yield threshold (well below 120s Convex limit)

    const { jobId, mailboxEmail, folder, dryRun, maxMessages } = args;
    const targetGoal = args.targetAttachmentEmails || maxMessages || 150;
    let processedAttachmentEmails = args.processedAttachmentEmails || 0;
    const startFolderIndex = args.folderIndex ?? 0;

    let totalAttachmentsInspected = args.totalAttachments || 0;
    let classifiedHighConfidence = args.classifiedHighConfidence || 0;
    let flaggedNeedsReview = args.flaggedNeedsReview || 0;
    let skippedLowConfidence = args.skippedLowConfidence || 0;
    let llmCallsCount = args.llmCallsCount || 0;

    try {
      const token = await getGraphToken();
      if (!token) {
        throw new Error(
          "Failed to acquire Microsoft Graph access token. Verify MS_TENANT_ID, MS_CLIENT_ID, and MS_CLIENT_SECRET."
        );
      }

      const foldersToScan: string[] =
        folder === "all" ? ["inbox", "sentitems"] : [folder];

      let currentFolderCursor: string | null = null;

      for (let fIdx = startFolderIndex; fIdx < foldersToScan.length; fIdx++) {
        const currentFolder = foldersToScan[fIdx];

        // Check for cancellation / pause before each folder
        const status = await ctx.runQuery(
          (internal as any).communications.emailBackfillMutations.checkJobStatus,
          { jobId }
        );
        if (status === "stopped" || status === "paused") {
          return;
        }

        // Determine starting URL for this folder (use nextCursorUrl if resuming current folder)
        let url: string | null =
          fIdx === startFolderIndex && args.nextCursorUrl
            ? args.nextCursorUrl
            : `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
                mailboxEmail
              )}/mailFolders/${currentFolder}/messages?$select=id,subject,hasAttachments,receivedDateTime,from&$top=15&$filter=hasAttachments eq true`;

        if (!args.nextCursorUrl || fIdx > startFolderIndex) {
          await ctx.runMutation((internal as any).communications.emailBackfillMutations.updateScanProgress, {
            jobId,
            phase: "extracting",
            currentFolderIndex: fIdx,
            currentStage: `Phase 2: Extracting from ${currentFolder.toUpperCase()} (${processedAttachmentEmails}/${targetGoal} emails)...`,
            logMessage: {
              message: `Extracting attachment emails from folder: ${currentFolder}...`,
              type: "info",
            },
          });
        }

        while (url && processedAttachmentEmails < targetGoal) {
          currentFolderCursor = url;
          // Check for job cancellation
          const currentStatus = await ctx.runQuery(
            (internal as any).communications.emailBackfillMutations.checkJobStatus,
            { jobId }
          );
          if (currentStatus === "stopped" || currentStatus === "paused") {
            return;
          }

          let res = await safeGraphFetch(url, token);

          // Fallback if tenant filter is constrained
          if (!res || !res.ok) {
            const fallbackUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
              mailboxEmail
            )}/mailFolders/${currentFolder}/messages?$select=id,subject,hasAttachments,receivedDateTime,from&$top=15`;
            res = await safeGraphFetch(fallbackUrl, token);
          }

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
          const nextLink: string | null = data["@odata.nextLink"] || null;

          if (messages.length === 0) break;

          for (const message of messages) {
            if (processedAttachmentEmails >= targetGoal) break;

            if (!message.hasAttachments) continue;
            processedAttachmentEmails++;

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

              // 1. Strict Filename Pre-Filter: Only process files with CV/Resume in their name
              if (!isCvOrResumeFilename(attachName)) {
                skippedLowConfidence++;
                continue;
              }

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
                    phase: "extracting",
                    scannedMessages: processedAttachmentEmails,
                    processedAttachmentEmails,
                    targetAttachmentEmails: targetGoal,
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
                    phase: "extracting",
                    scannedMessages: processedAttachmentEmails,
                    processedAttachmentEmails,
                    targetAttachmentEmails: targetGoal,
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
                    phase: "extracting",
                    scannedMessages: processedAttachmentEmails,
                    processedAttachmentEmails,
                    targetAttachmentEmails: targetGoal,
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

          url = nextLink;
          currentFolderCursor = nextLink;

          // Check if time threshold reached to yield and self-schedule next batch
          const elapsed = Date.now() - startTime;
          const hasMoreInFolder = url !== null && processedAttachmentEmails < targetGoal;
          const hasMoreFolders = fIdx < foldersToScan.length - 1 && processedAttachmentEmails < targetGoal;

          if (elapsed >= MAX_ACTION_DURATION_MS && (hasMoreInFolder || hasMoreFolders)) {
            const nextFolderIdx = url ? fIdx : fIdx + 1;
            const nextUrl = url ? url : undefined;

            // Save checkpoint upon yielding so progress and next pagination cursor are persistent
            await ctx.runMutation(
              (internal as any).communications.emailBackfillMutations.saveMailboxCheckpoint,
              {
                mailboxEmail,
                folder,
                totalExtractedCount: processedAttachmentEmails,
                nextCursorUrl: nextUrl,
                currentFolderIndex: nextFolderIdx,
              }
            );

            await ctx.runMutation(
              (internal as any).communications.emailBackfillMutations.updateScanProgress,
              {
                jobId,
                phase: "extracting",
                scannedMessages: processedAttachmentEmails,
                processedAttachmentEmails,
                targetAttachmentEmails: targetGoal,
                totalAttachments: totalAttachmentsInspected,
                classifiedHighConfidence,
                flaggedNeedsReview,
                skippedLowConfidence,
                llmCallsCount,
                currentFolderIndex: nextFolderIdx,
                nextCursorUrl: nextUrl,
                currentStage: `Phase 2: Extracting batch (${processedAttachmentEmails}/${targetGoal} attachment emails processed)...`,
              }
            );

            await ctx.scheduler.runAfter(
              0,
              (internal as any).communications.emailBackfill.executeMailboxScanBackground,
              {
                jobId,
                mailboxEmail,
                folder,
                dryRun,
                maxMessages: targetGoal,
                targetAttachmentEmails: targetGoal,
                processedAttachmentEmails,
                folderIndex: nextFolderIdx,
                nextCursorUrl: nextUrl,
                scannedMessages: processedAttachmentEmails,
                totalAttachments: totalAttachmentsInspected,
                classifiedHighConfidence,
                flaggedNeedsReview,
                skippedLowConfidence,
                llmCallsCount,
              }
            );
            return;
          }
        }
      }

      // Save persistent checkpoint on completion
      await ctx.runMutation(
        (internal as any).communications.emailBackfillMutations.saveMailboxCheckpoint,
        {
          mailboxEmail,
          folder,
          totalExtractedCount: processedAttachmentEmails,
          nextCursorUrl: currentFolderCursor || undefined,
        }
      );

      // Mark Job as Completed
      await ctx.runMutation((internal as any).communications.emailBackfillMutations.setScanJobStatus, {
        jobId,
        status: "done",
        phase: "done",
        scannedMessages: processedAttachmentEmails,
        processedAttachmentEmails,
        targetAttachmentEmails: targetGoal,
        currentStage: `Scan completed successfully (${processedAttachmentEmails} attachment emails extracted).`,
        logMessage: {
          message: `Scan finished: ${processedAttachmentEmails} attachment emails extracted, ${totalAttachmentsInspected} attachments evaluated (${classifiedHighConfidence} high confidence, ${flaggedNeedsReview} needs review, ${skippedLowConfidence} skipped, ${llmCallsCount} LLM calls).`,
          type: "success",
        },
      });
    } catch (err: any) {
      console.error("[MailboxScan Critical Error]:", err);
      await ctx.runMutation((internal as any).communications.emailBackfillMutations.setScanJobStatus, {
        jobId,
        status: "error",
        phase: "error",
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
