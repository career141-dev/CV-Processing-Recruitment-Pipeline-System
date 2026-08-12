import { ConvexHttpClient } from "convex/browser";
import fs from "fs";

const envContent = fs.readFileSync(".env.hosted", "utf8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const [k, v] = line.split("=");
  if (k && v) envVars[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
}

const url = envVars.CONVEX_SELF_HOSTED_URL || "https://api.career141.com";
const client = new ConvexHttpClient(url);

console.log(`[Pre-Flight Backlog Composition Baseline] Connecting to Convex backend at ${url}...`);

async function runBacklogCompositionAnalysis() {
  try {
    const metrics = await client.query("health:getBacklogCompositionMetrics", {});

    console.log(`\n==================================================================`);
    console.log(`         PRE-FLIGHT BASELINE BACKLOG COMPOSITION REPORT          `);
    console.log(`==================================================================`);
    console.log(`Execution Timestamp         : ${new Date().toISOString()}`);
    console.log(`Target Backend Endpoint     : ${url}`);
    console.log(`------------------------------------------------------------------`);
    console.log(`Total Unextracted Backlog   : ${metrics.totalUploaded} records (status: 'uploaded')`);
    console.log(`In-Flight Processing Count  : ${metrics.totalProcessing} records (status: 'processing')`);
    console.log(`Flagged TA Review Count     : ${metrics.totalNeedsReview} records (status: 'needs_review')`);
    console.log(`------------------------------------------------------------------`);
    console.log(`Group A (Text PDF/Docx)     : ${metrics.groupA_text} records (${metrics.totalUploaded > 0 ? ((metrics.groupA_text / metrics.totalUploaded) * 100).toFixed(1) : 0}%)`);
    console.log(`Group B (Scanned/Image/OCR) : ${metrics.groupB_scanned} records (${metrics.totalUploaded > 0 ? ((metrics.groupB_scanned / metrics.totalUploaded) * 100).toFixed(1) : 0}%)`);
    console.log(`------------------------------------------------------------------`);
    console.log(`Fresh Volume (< 48 Hours)   : ${metrics.freshUnder48h} records`);
    console.log(`Historical Backlog (>= 48h) : ${metrics.historicalOver48h} records`);
    console.log(`==================================================================\n`);

    if (metrics.sampleUploadedIds && metrics.sampleUploadedIds.length > 0) {
      console.log(`[Sample Backlog Items (First 10 of ${metrics.sampleUploadedIds.length})]`);
      for (const item of metrics.sampleUploadedIds.slice(0, 10)) {
        console.log(`  - ID: ${item.id} | File: ${item.fileName || 'N/A'} | Type: ${item.fileType || 'N/A'} | Created: ${item.creationTime}`);
      }
      console.log("");
    }
  } catch (err) {
    console.error("Backlog composition analysis failed:", err);
  }
}

runBacklogCompositionAnalysis();
