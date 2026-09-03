"use node";

import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { getGraphToken } from "../lib/graphClient";
import { extractText } from "../cvs/cvExtraction";

// ── 1. TWO-STAGE CV DETECTION ENGINE ──────────────────────────────────────────

/**
 * Stage 1: Allowed CV extensions and MIME types per specification.
 * - Allowed extensions: .pdf, .doc, .docx
 * - Allowed MIME types: application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
 */
const ALLOWED_CV_EXTENSIONS = new Set([".pdf", ".doc", ".docx"]);
const ALLOWED_CV_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream", // Graph API occasionally labels .pdf/.docx as octet-stream
]);

export function isAllowedCvType(fileName: string, contentType?: string): boolean {
  if (!fileName) return false;
  const lowerName = fileName.toLowerCase().trim();
  const extMatch = lowerName.match(/\.[a-z0-9]+$/);
  const ext = extMatch ? extMatch[0] : "";
  if (!ALLOWED_CV_EXTENSIONS.has(ext)) return false;

  const lowerMime = (contentType || "").toLowerCase().trim();
  if (lowerMime && !ALLOWED_CV_MIME_TYPES.has(lowerMime)) {
    return false;
  }
  return true;
}

/**
 * Stage 2: 23 Required CV Keywords.
 * The document must contain at least 3 distinct keywords from this list to be accepted as a CV.
 */
export const CV_KEYWORDS: string[] = [
  "curriculum vitae",
  "resume",
  "cv",
  "work experience",
  "professional experience",
  "employment history",
  "education",
  "qualifications",
  "skills",
  "objective",
  "summary",
  "profile",
  "references",
  "bachelor",
  "master",
  "degree",
  "university",
  "college",
  "position",
  "job title",
  "employer",
  "internship",
  "volunteer",
];

export function checkCvKeywords(rawText: string): {
  isCv: boolean;
  matchedCount: number;
  matchedKeywords: string[];
} {
  if (!rawText || rawText.trim().length === 0) {
    return { isCv: false, matchedCount: 0, matchedKeywords: [] };
  }

  const lower = rawText.toLowerCase();
  const matchedKeywords: string[] = [];

  for (const kw of CV_KEYWORDS) {
    // Word boundary regex matching to avoid substring collision (e.g., 'cv' shouldn't match 'cover' or 'recovery')
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
    if (regex.test(lower)) {
      matchedKeywords.push(kw);
    }
  }

  return {
    isCv: matchedKeywords.length >= 3,
    matchedCount: matchedKeywords.length,
    matchedKeywords,
  };
}

// ── 2. MICROSOFT GRAPH API HELPERS ───────────────────────────────────────────

export async function getAvailableMailboxFolders(
  mailboxEmail: string,
  token: string
): Promise<string[]> {
  try {
    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
      mailboxEmail
    )}/mailFolders?$top=50&$select=id,displayName`;
    const res = await safeGraphFetch(url, token);
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data.value) && data.value.length > 0) {
        return data.value.map((f: any) => f.id);
      }
    }
  } catch (err: any) {
    console.warn("[MailboxScan] Error fetching mail folders:", err?.message || err);
  }
  return ["inbox", "sentitems", "archive"];
}

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
          currentStage: `Phase 1: Discovering attachment-bearing emails across ${folder === "all" ? "all available folders" : folder.toUpperCase()}...`,
          logMessage: {
            message: `Starting discovery pass across mailbox: ${mailboxEmail} (${folder === "all" ? "all available folders" : `folder: ${folder}`})`,
            type: "info",
          },
        }
      );

      const foldersToScan =
        folder === "all"
          ? await getAvailableMailboxFolders(mailboxEmail, token)
          : [folder];

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
              currentStage: `Discovered ${totalAttachmentEmailsDiscovered} attachment emails (${totalEmailsDiscovered} scanned across folders)...`,
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
        api.communications.emailBackfillMutations.saveMailboxCheckpoint,
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
    deduplicatedCount: v.optional(v.number()),
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
    let deduplicatedCount = args.deduplicatedCount || 0;
    let llmCallsCount = args.llmCallsCount || 0;

    try {
      const token = await getGraphToken();
      if (!token) {
        throw new Error(
          "Failed to acquire Microsoft Graph access token. Verify MS_TENANT_ID, MS_CLIENT_ID, and MS_CLIENT_SECRET."
        );
      }

      const foldersToScan: string[] =
        folder === "all"
          ? await getAvailableMailboxFolders(mailboxEmail, token)
          : [folder];

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

            // Check for job cancellation on each message for instant stop responsiveness
            const loopStatus = await ctx.runQuery(
              api.communications.emailBackfillMutations.checkJobStatus,
              { jobId }
            );
            if (loopStatus === "stopped" || loopStatus === "paused") {
              // Save checkpoint immediately
              await ctx.runMutation(
                api.communications.emailBackfillMutations.saveMailboxCheckpoint,
                {
                  mailboxEmail,
                  folder,
                  totalExtractedCount: processedAttachmentEmails,
                  nextCursorUrl: currentFolderCursor || undefined,
                }
              );
              return;
            }

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
              // Check for job cancellation on each individual attachment
              const attStatus = await ctx.runQuery(
                api.communications.emailBackfillMutations.checkJobStatus,
                { jobId }
              );
              if (attStatus === "stopped" || attStatus === "paused") {
                await ctx.runMutation(
                  api.communications.emailBackfillMutations.saveMailboxCheckpoint,
                  {
                    mailboxEmail,
                    folder,
                    totalExtractedCount: processedAttachmentEmails,
                    nextCursorUrl: currentFolderCursor || undefined,
                  }
                );
                return;
              }

              totalAttachmentsInspected++;
              const attachName = att.name || "attachment.dat";
              const contentType = att.contentType || "application/octet-stream";

              // Stage 1: File type & MIME filter (pre-download)
              if (!isAllowedCvType(attachName, contentType)) {
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

              // Pre-upload Deduplication Check: Check if this file already exists in cvUploads
              const isDuplicate = await ctx.runQuery(
                api.communications.emailBackfillMutations.checkCvDuplicateByHash,
                { fileHash }
              );

              if (isDuplicate) {
                deduplicatedCount++;
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
                    deduplicatedCount,
                    llmCallsCount,
                    logMessage: {
                      message: `[DUPLICATE CV SKIPPED] ${attachName} already exists in database (SHA-256 match). Skipping re-upload.`,
                      type: "info",
                    },
                  }
                );
                continue;
              }

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

              // Stage 2: 23-Keyword Check (at least 3 keywords required)
              const keywordResult = checkCvKeywords(rawText);

              if (keywordResult.isCv) {
                // Accepted as genuine CV (>= 3 keywords found)
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
                    deduplicatedCount,
                    llmCallsCount,
                    logMessage: {
                      message: `[MATCH CV] ${attachName} (${keywordResult.matchedCount} keywords matched: ${keywordResult.matchedKeywords.slice(0, 4).join(", ")}${keywordResult.matchedKeywords.length > 4 ? "..." : ""}) from "${subject.slice(0, 30)}..." -> ${dryRun ? "Dry Run (Queued)" : "Ingested to Agent 1"}`,
                      type: "success",
                    },
                  }
                );
              } else {
                // Rejected: not a CV (< 3 keywords) -> notACv: true
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
                    deduplicatedCount,
                    llmCallsCount,
                    logMessage: {
                      message: `[SKIPPED non-CV] ${attachName} (${keywordResult.matchedCount}/3 keywords: ${keywordResult.matchedKeywords.join(", ") || "none"}) -> notACv: true`,
                      type: "info",
                    },
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
              api.communications.emailBackfillMutations.saveMailboxCheckpoint,
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
                deduplicatedCount,
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
                deduplicatedCount,
                llmCallsCount,
              }
            );
            return;
          }
        }
      }

      // Save persistent checkpoint on completion
      await ctx.runMutation(
        api.communications.emailBackfillMutations.saveMailboxCheckpoint,
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
        deduplicatedCount,
        currentStage: `Scan completed successfully (${processedAttachmentEmails} attachment emails extracted).`,
        logMessage: {
          message: `Scan finished: ${processedAttachmentEmails} attachment emails extracted, ${totalAttachmentsInspected} attachments evaluated (${classifiedHighConfidence} matched CVs, ${deduplicatedCount} duplicates skipped, ${flaggedNeedsReview} needs review, ${skippedLowConfidence} non-CV skipped).`,
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
