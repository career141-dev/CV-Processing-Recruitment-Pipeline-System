#!/usr/bin/env node

/**
 * Career141 — Background Mailbox CV Scanner CLI
 *
 * Targets joborders@career141.com (or custom mailbox) to scan all folders (excluding Deleted/Drafts/Junk),
 * evaluates attachments using the two-phase CV method, and ingests valid CVs into the system.
 *
 * Commands:
 *   node scripts/mailbox-scanner.mjs start [email] [--dry-run] [--port 3211]
 *   node scripts/mailbox-scanner.mjs progress [email] [--watch] [--port 3211]
 *   node scripts/mailbox-scanner.mjs stop [email] [--port 3211]
 */

import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.join(__dirname, "../.env.local"), override: true });

const DEFAULT_MAILBOX = "joborders@career141.com";

const rawArgs = process.argv.slice(2);

function printHelp() {
  console.log(`
============================================================
  CAREER141 — BACKGROUND MAILBOX CV SCANNER
============================================================
Usage:
  npm run mailbox:start    [email]   Start background scan
  npm run mailbox:progress [email]   Get ongoing progress
  npm run mailbox:stop     [email]   Stop ongoing background scan

Or with node:
  node scripts/mailbox-scanner.mjs start    [email] [--dry-run]
  node scripts/mailbox-scanner.mjs progress [email] [--watch]
  node scripts/mailbox-scanner.mjs stop     [email]

Default mailbox: ${DEFAULT_MAILBOX}
Folder scope   : All folders (excluding Deleted Items, Drafts, Junk Email)
============================================================
`);
}

if (rawArgs.length === 0 || rawArgs.includes("--help") || rawArgs.includes("-h")) {
  printHelp();
  process.exit(0);
}

const command = rawArgs[0].toLowerCase().trim();
const flags = rawArgs.filter((a) => a.startsWith("-"));
const positionalArgs = rawArgs.slice(1).filter((a) => !a.startsWith("-"));

// Determine email address (defaults to joborders@career141.com)
const mailboxEmail = (positionalArgs[0] || DEFAULT_MAILBOX).toLowerCase().trim();

function getFlagValue(flagName, defaultValue) {
  const index = rawArgs.indexOf(flagName);
  if (index !== -1 && rawArgs[index + 1] && !rawArgs[index + 1].startsWith("-")) {
    return rawArgs[index + 1];
  }
  return defaultValue;
}

const isDryRun = rawArgs.includes("--dry-run");
const isWatch = rawArgs.includes("--watch") || rawArgs.includes("-w");
const forceRediscovery = rawArgs.includes("--force-rediscovery") || rawArgs.includes("--fresh");
const customPort = getFlagValue("--port", "");
const customUrl = getFlagValue("--url", "");

// Resolve Convex backend URL
let convexUrl = customUrl || process.env.CONVEX_SELF_HOSTED_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
if (customPort === "3211") {
  convexUrl = "http://127.0.0.1:3211";
} else if (customPort === "3210") {
  convexUrl = "http://127.0.0.1:3210";
}
if (!convexUrl) {
  convexUrl = "http://127.0.0.1:3211";
}

const client = new ConvexHttpClient(convexUrl);

function formatDuration(ms) {
  if (!ms || ms <= 0) return "0s";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  if (hrs > 0) return `${hrs}h ${min % 60}m ${sec % 60}s`;
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. START COMMAND
// ─────────────────────────────────────────────────────────────────────────────
async function handleStart() {
  console.log("\n============================================================");
  console.log("  CAREER141 — STARTING BACKGROUND MAILBOX SCAN");
  console.log("============================================================");
  console.log(` Target Mailbox : ${mailboxEmail}`);
  console.log(` Scope          : ALL active folders (excluding Deleted Items/Drafts/Junk)`);
  console.log(` Execution Mode : Background (Server-side Asynchronous)`);
  console.log(` Ingestion Mode : ${isDryRun ? "DRY RUN (Evaluation only)" : "LIVE INGESTION -> Agent 1 & Agent 6"}`);
  console.log(` Rediscovery    : ${forceRediscovery ? "YES (Re-scan folder tree & reset count)" : "Resume from checkpoint if available"}`);
  console.log(` Backend URL    : ${convexUrl}`);
  console.log("============================================================\n");

  try {
    const result = await client.mutation("communications/emailBackfillMutations:startMailboxScan", {
      mailboxEmail,
      folder: "all",
      maxMessages: -1, // Scan all attachment-bearing emails
      dryRun: isDryRun,
      mode: "background",
      forceRediscovery,
    });

    if (result.alreadyRunning) {
      console.log(`⚠️  A background scan is ALREADY RUNNING for ${mailboxEmail}.`);
      console.log(`   Active Job ID: ${result.jobId}`);
      console.log(`\nTo view progress: npm run mailbox:progress -- ${mailboxEmail}`);
      console.log(`To stop the job : npm run mailbox:stop -- ${mailboxEmail}\n`);
      return;
    }

    if (!result.success) {
      console.error("❌ Failed to start mailbox scan:", result.message || "Unknown error");
      process.exit(1);
    }

    console.log("🚀 Background scan launched successfully!");
    console.log(`   Job ID : ${result.jobId}`);
    console.log(`   Resumed: ${result.resumed ? "YES (from previous checkpoint)" : "NO (Fresh discovery)"}`);
    console.log(`\n✅ The process is now running in the background on the Convex server.`);
    console.log(`   You can close this command window at any time without interrupting the scan.\n`);
    console.log("Commands:");
    console.log(`   npm run mailbox:progress -- ${mailboxEmail}   (View ongoing progress & metrics)`);
    console.log(`   npm run mailbox:stop -- ${mailboxEmail}       (Stop ongoing background scan)\n`);
  } catch (err) {
    console.error(`\n❌ Error connecting to Convex at ${convexUrl}:`, err.message);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. STOP COMMAND
// ─────────────────────────────────────────────────────────────────────────────
async function handleStop() {
  console.log("\n============================================================");
  console.log("  CAREER141 — STOPPING BACKGROUND MAILBOX SCAN");
  console.log("============================================================");
  console.log(` Target Mailbox : ${mailboxEmail}`);
  console.log(` Backend URL    : ${convexUrl}`);
  console.log("============================================================\n");

  try {
    let res;
    try {
      res = await client.mutation("communications/emailBackfillMutations:stopMailboxScanByEmail", {
        mailboxEmail,
      });
    } catch (mutationErr) {
      if (mutationErr.message?.includes("Could not find public function")) {
        // Fallback for earlier deployed schema: retrieve latest scan job and call requestJobControl
        const latestJob = await client.query("communications/emailBackfillMutations:getLatestScanJob", {
          mailboxEmail,
        });
        if (latestJob && (latestJob.status === "running" || latestJob.status === "retrying" || latestJob.status === "pending")) {
          await client.mutation("communications/emailBackfillMutations:requestJobControl", {
            jobId: latestJob._id,
            action: "stop",
          });
          res = { stoppedCount: 1, jobIds: [latestJob._id] };
        } else {
          res = { stoppedCount: 0 };
        }
      } else {
        throw mutationErr;
      }
    }

    if (res.stoppedCount === 0) {
      console.log(`ℹ️  No active running background scan found for ${mailboxEmail}.`);
      console.log(`To check latest job status: npm run mailbox:progress -- ${mailboxEmail}\n`);
      return;
    }

    console.log(`🛑 Successfully stopped ${res.stoppedCount} background scan job(s) for ${mailboxEmail}.`);
    if (res.jobIds && res.jobIds.length > 0) {
      console.log(`   Job ID(s): ${res.jobIds.join(", ")}`);
    }
    console.log(`\n✅ Checkpoints saved. You can resume at any time with:`);
    console.log(`   npm run mailbox:start -- ${mailboxEmail}\n`);
  } catch (err) {
    console.error(`\n❌ Error stopping scan on Convex:`, err.message);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PROGRESS COMMAND
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAndRenderProgress() {
  try {
    let data;
    try {
      data = await client.query("communications/emailBackfillMutations:getMailboxScanProgress", {
        mailboxEmail,
      });
    } catch (queryErr) {
      if (queryErr.message?.includes("Could not find public function")) {
        // Fallback for earlier deployed schema: query getLatestScanJob directly
        const rawJob = await client.query("communications/emailBackfillMutations:getLatestScanJob", {
          mailboxEmail,
        });
        if (!rawJob) {
          data = { hasJob: false, mailboxEmail, message: `No scan jobs found for mailbox ${mailboxEmail}.` };
        } else {
          data = {
            hasJob: true,
            jobId: rawJob._id,
            mailboxEmail: rawJob.mailboxEmail,
            status: rawJob.status,
            phase: rawJob.phase || "unknown",
            currentStage: rawJob.currentStage || "Idle",
            totalAttachmentEmails: rawJob.discoveredAttachmentEmails ?? rawJob.totalMessages ?? 0,
            processedAttachmentEmails: rawJob.processedAttachmentEmails ?? rawJob.scannedMessages ?? 0,
            cvsAddedToSystem: rawJob.classifiedHighConfidence ?? 0,
            nonCvSkipped: rawJob.skippedLowConfidence ?? 0,
            duplicatesSkipped: rawJob.deduplicatedCount ?? 0,
            totalAttachments: rawJob.totalAttachments ?? 0,
            discoveredTotalEmails: rawJob.discoveredTotalEmails ?? 0,
            startedAt: rawJob.startedAt,
            completedAt: rawJob.completedAt ?? null,
            lastHeartbeatAt: rawJob.lastHeartbeatAt ?? null,
            recentLogs: (rawJob.recentLogs || []).slice(-5),
            mode: rawJob.mode || "background",
            dryRun: rawJob.dryRun,
          };
        }
      } else {
        throw queryErr;
      }
    }

    if (!data || !data.hasJob) {
      console.log("\n============================================================");
      console.log(`ℹ️  ${data?.message || `No scan records found for ${mailboxEmail}.`}`);
      console.log(`To start a new scan: npm run mailbox:start -- ${mailboxEmail}`);
      console.log("============================================================\n");
      return false;
    }

    const totalAttachmentMails = data.totalAttachmentEmails || 0;
    const processedMails = data.processedAttachmentEmails || 0;
    const cvsAdded = data.cvsAddedToSystem || 0;
    const nonCvSkipped = data.nonCvSkipped || 0;
    const duplicatesSkipped = data.duplicatesSkipped || 0;
    const pct = totalAttachmentMails > 0 ? ((processedMails / totalAttachmentMails) * 100).toFixed(1) : "0.0";

    const statusBadge =
      data.status === "running"
        ? "🟢 RUNNING"
        : data.status === "done"
        ? "✅ COMPLETED"
        : data.status === "stopped"
        ? "🛑 STOPPED"
        : data.status === "error"
        ? "🔴 ERROR"
        : data.status === "paused"
        ? "⏸️  PAUSED"
        : data.status.toUpperCase();

    const elapsed = data.completedAt
      ? data.completedAt - data.startedAt
      : Date.now() - data.startedAt;

    console.clear();
    console.log("============================================================");
    console.log("  CAREER141 — MAILBOX CV SCAN PROGRESS & METRICS");
    console.log("============================================================");
    console.log(` Target Mailbox              : ${data.mailboxEmail}`);
    console.log(` Job ID                      : ${data.jobId}`);
    console.log(` Status                      : ${statusBadge} (Phase: ${data.phase.toUpperCase()})`);
    if (data.completedAt) {
      const finishTime = new Date(data.completedAt).toLocaleTimeString();
      const ago = formatDuration(Date.now() - data.completedAt);
      console.log(` Completion Info             : Finished at ${finishTime} (${ago} ago — inactive)`);
    } else if (data.status === "running") {
      console.log(` State                       : ⚡ Actively running background extraction on server`);
    }
    console.log(` Current Activity            : ${data.currentStage}`);
    console.log("────────────────────────────────────────────────────────────");
    console.log("  REQUIRED METRICS:");
    console.log(`  1. Total Mails with Attachments : ${totalAttachmentMails}`);
    console.log(`  2. Mails Gone Through           : ${processedMails} / ${totalAttachmentMails} (${pct}%)`);
    console.log(`  3. CVs Added into System        : ${cvsAdded} ${data.dryRun ? "(Dry Run)" : "(Ingested via Agent 1 & 6)"}`);
    console.log("────────────────────────────────────────────────────────────");
    console.log("  ADDITIONAL BREAKDOWN:");
    console.log(`  • Non-CV Attachments Skipped    : ${nonCvSkipped} (Invoices/receipts/non-CVs)`);
    console.log(`  • Duplicate CVs Skipped         : ${duplicatesSkipped} (Already in database)`);
    console.log(`  • Total Attachments Evaluated   : ${data.totalAttachments || 0}`);
    console.log(`  • Total Discovered Emails       : ${data.discoveredTotalEmails || 0} (across folders)`);
    console.log(`  • Elapsed Time                  : ${formatDuration(elapsed)}`);
    console.log("────────────────────────────────────────────────────────────");
    console.log("  RECENT ACTIVITY LOGS:");
    if (data.recentLogs && data.recentLogs.length > 0) {
      for (const log of data.recentLogs) {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const prefix =
          log.type === "success"
            ? "🟢 [MATCH]"
            : log.type === "warning"
            ? "🟡 [WARN] "
            : log.type === "error"
            ? "🔴 [ERR]  "
            : "ℹ️  [INFO] ";
        console.log(`   ${time} ${prefix} ${log.message}`);
      }
    } else {
      console.log("   (No logs yet)");
    }
    if (data.status === "done" && processedMails < totalAttachmentMails) {
      console.log(`\n💡 Notice: Previous pass finished folder batch (${processedMails}/${totalAttachmentMails}). To run fresh scan across all folders:`);
      console.log(`   npm run mailbox:start -- ${data.mailboxEmail} --fresh`);
    }
    console.log("============================================================\n");

    return data.status === "running" || data.status === "retrying" || data.status === "pending";
  } catch (err) {
    console.error(`\n❌ Error fetching scan progress from ${convexUrl}:`, err.message);
    return false;
  }
}

async function handleProgress() {
  if (!isWatch) {
    await fetchAndRenderProgress();
    return;
  }

  // Live streaming watch mode
  console.log(`Connecting to ${convexUrl} for live progress updates (Press Ctrl+C to exit)...`);
  let isRunning = true;
  while (isRunning) {
    isRunning = await fetchAndRenderProgress();
    if (!isRunning) {
      console.log("Scan process has finished or is not active.");
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  switch (command) {
    case "start":
      await handleStart();
      break;
    case "stop":
      await handleStop();
      break;
    case "progress":
    case "status":
      await handleProgress();
      break;
    default:
      console.error(`❌ Unknown command: "${command}". Expected "start", "stop", or "progress".\n`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal CLI Error:", err);
  process.exit(1);
});
