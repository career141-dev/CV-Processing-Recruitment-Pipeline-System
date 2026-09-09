#!/usr/bin/env node

/**
 * Career141 — Email CV Backfill & Mailbox Scanner CLI
 *
 * Usage:
 *   node scripts/email-cv-backfill.mjs --mailbox "azeem@career141.com" --folder "inbox" --port 3211 --dry-run
 *   node scripts/email-cv-backfill.mjs --mailbox "azeem@career141.com" --folder "inbox" --port 3211
 */

import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.join(__dirname, "../.env.local") });

// Parse command line arguments
const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
}

const mailbox = getArg("--mailbox", "azeem@career141.com").toLowerCase().trim();
const folder = getArg("--folder", "inbox").toLowerCase().trim();
const dryRun = args.includes("--dry-run");
const maxMessages = parseInt(getArg("--max-messages", "150"), 10);
const port = getArg("--port", "");
const customUrl = getArg("--url", "");

// Determine Convex URL
let convexUrl = customUrl || process.env.CONVEX_SELF_HOSTED_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
if (port === "3211") {
  convexUrl = "http://127.0.0.1:3211";
} else if (port === "3210") {
  convexUrl = "http://127.0.0.1:3210";
}

if (!convexUrl) {
  convexUrl = "http://127.0.0.1:3211";
}

console.log("\n============================================================");
console.log("  CAREER141 — EMAIL CV BACKFILL & CLASSIFIER RUNNER");
console.log("============================================================");
console.log(` Target Mailbox : ${mailbox}`);
console.log(` Folder Scope   : ${folder.toUpperCase()}`);
console.log(` Execution Mode : ${dryRun ? "DRY RUN (Calibration & Scoring Only)" : "LIVE INGESTION -> Agent 1 & Agent 6"}`);
console.log(` Max Messages   : ${maxMessages}`);
console.log(` Convex Endpoint: ${convexUrl}`);
console.log("============================================================\n");

async function main() {
  const client = new ConvexHttpClient(convexUrl);

  console.log(`[1/4] Dispatching mailbox scan job to Convex backend...`);
  
  let startRes;
  try {
    startRes = await client.action("communications/emailBackfill:startMailboxScan", {
      mailboxEmail: mailbox,
      folder,
      dryRun,
      maxMessages,
    });
  } catch (err) {
    console.error(`\n❌ Failed to start scan action on ${convexUrl}:`, err.message);
    console.error("Please verify that the Convex dev server is running on the specified port.\n");
    process.exit(1);
  }

  if (!startRes?.jobId) {
    console.error("❌ Failed to receive valid jobId from startMailboxScan.");
    process.exit(1);
  }

  const jobId = startRes.jobId;
  console.log(`✅ Scan job created successfully (ID: ${jobId})\n`);
  console.log(`[2/4] Monitoring live scan progress...\n`);

  let lastLogIndex = 0;
  let isDone = false;

  while (!isDone) {
    await new Promise((r) => setTimeout(r, 1500));

    try {
      const job = await client.query("communications/emailBackfillMutations:getScanJob", {
        jobId,
      });

      if (!job) continue;

      // Print new logs
      const logs = job.recentLogs || [];
      if (logs.length > lastLogIndex) {
        for (let i = lastLogIndex; i < logs.length; i++) {
          const l = logs[i];
          const time = new Date(l.timestamp).toLocaleTimeString();
          const prefix =
            l.type === "success"
              ? "🟢 [SUCCESS]"
              : l.type === "warning"
              ? "🟡 [REVIEW] "
              : l.type === "error"
              ? "🔴 [ERROR]  "
              : "ℹ️  [INFO]   ";
          console.log(`${time} ${prefix} ${l.message}`);
        }
        lastLogIndex = logs.length;
      }

      if (job.status === "done" || job.status === "error" || job.status === "stopped") {
        isDone = true;

        console.log("\n============================================================");
        console.log("  SCAN RUN SUMMARY & CLASSIFICATION METRICS");
        console.log("============================================================");
        console.log(` Status                  : ${job.status.toUpperCase()}`);
        console.log(` Messages Scanned        : ${job.scannedMessages}`);
        console.log(` Attachments Evaluated   : ${job.totalAttachments}`);
        console.log(` High-Confidence CVs     : ${job.classifiedHighConfidence} ${dryRun ? "(Dry Run)" : "(Ingested to Agent 1)"}`);
        console.log(` Flagged for Review      : ${job.flaggedNeedsReview} (Ambiguous band 0.40 - 0.69)`);
        console.log(` Skipped Non-CVs         : ${job.skippedLowConfidence} (Invoices/Receipts/Contracts)`);
        console.log(` DeepSeek Confirmations  : ${job.llmCallsCount}`);
        if (job.startedAt && job.completedAt) {
          const elapsedSec = ((job.completedAt - job.startedAt) / 1000).toFixed(1);
          console.log(` Duration                : ${elapsedSec}s`);
        }
        console.log("============================================================\n");
      }
    } catch (pollErr) {
      console.warn(`[Poll Warning]:`, pollErr.message);
    }
  }
}

main().catch((err) => {
  console.error("Fatal Runner Error:", err);
  process.exit(1);
});
