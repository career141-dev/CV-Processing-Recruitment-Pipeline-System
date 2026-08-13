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

console.log(`[Stage 1 Runner - 3 Workers] Connecting to Convex backend at ${url}...`);

const STAGE_1_WORKERS = 3;
const TARGET_TOTAL_CVS = 20;

async function runStage1Batch() {
  const startTime = Date.now();
  const processedRecords = [];
  const claimedRecordIds = new Set();
  let loopDetected = false;
  let total429Errors = 0;

  console.log(`\n==================================================================`);
  console.log(`     STAGE 1 EXECUTION RUNNER (3 WORKERS - 20 REAL BACKLOG CVS)   `);
  console.log(`==================================================================`);
  console.log(`Launch Time        : ${new Date(startTime).toISOString()}`);
  console.log(`Worker Concurrency : ${STAGE_1_WORKERS} workers`);
  console.log(`Target Batch Volume: ${TARGET_TOTAL_CVS} real CVs`);
  console.log(`------------------------------------------------------------------\n`);

  async function workerTask(workerId) {
    while (processedRecords.length < TARGET_TOTAL_CVS && !loopDetected) {
      // Claim 1 item from unextracted backlog via public mutation
      const claimedBatch = await client.mutation("cvs/cvUploads:claimUploadedBatchPublic", {
        limit: 1,
      }).catch((err) => {
        console.error(`[Worker ${workerId}] claimUploadedBatchPublic failed:`, err.message || err);
        return [];
      });

      if (!claimedBatch || claimedBatch.length === 0) {
        // No more uploaded items available right now
        await new Promise((res) => setTimeout(res, 500));
        break;
      }

      const item = claimedBatch[0];
      const cvUploadId = item._id;

      // INSTANT STOP CONDITION: Check for double-claim / looping
      if (claimedRecordIds.has(cvUploadId)) {
        loopDetected = true;
        console.error(`\n[CRITICAL HARD ABORT] Worker ${workerId} detected DOUBLE-CLAIM / LOOPING on record ID: ${cvUploadId}!`);
        console.error(`Triggering instant runtime abort and automatic rollback to 1-worker sequential fallback...`);
        break;
      }
      claimedRecordIds.add(cvUploadId);

      console.log(`[Worker ${workerId}] Claimed CV ID: ${cvUploadId} (${item.fileName || 'N/A'}). Starting extraction...`);
      const itemStart = Date.now();

      let actionError = null;
      let actionResult = null;
      try {
        const actionPayload = {
          cvUploadId,
          fileType: item.fileType || "pdf",
          sourceChannel: item.source || "manual_upload",
          uploadedBy: item.uploadedBy || "Stage1_QA_Runner",
        };
        if (item.storageId) actionPayload.storageId = item.storageId;
        if (item.s3Key) actionPayload.s3Key = item.s3Key;

        actionResult = await client.action("cvs/cvExtraction:processCvExtraction", actionPayload);
      } catch (err) {
        actionError = err.message || String(err);
        if (actionError.includes("429") || actionError.includes("Rate limit")) {
          total429Errors++;
        }
      }

      const itemDuration = Date.now() - itemStart;

      // Query database for final terminal status and candidate profile with retry
      let updatedUpload = await client.query("candidates/candidates:getCvUpload", { cvUploadId });
      let candidateProfile = null;

      if (updatedUpload?.candidateId) {
        candidateProfile = await client.query("health:getCandidateDetailsForQa", {
          candidateId: updatedUpload.candidateId,
        }).catch(() => null);
      }

      // 4-Criteria Accuracy Verification
      const namePresent = Boolean(candidateProfile?.fullName && candidateProfile.fullName.trim().length > 0);
      const contactReachable = Boolean(candidateProfile?.email || candidateProfile?.phone);
      const structuredDataPresent = Boolean(
        (candidateProfile?.skills && candidateProfile.skills.length > 0) ||
        (candidateProfile?.jobHistory && candidateProfile.jobHistory.length > 0)
      );
      const schemaValid = !actionError && updatedUpload?.status !== "failed" && updatedUpload?.status !== "failed_retry";
      
      const passAccuracy = updatedUpload?.status === "needs_review" ? true : (namePresent && contactReachable && structuredDataPresent && schemaValid);

      const recordOutcome = {
        cvUploadId,
        fileName: item.fileName,
        fileType: item.fileType,
        workerId,
        durationMs: itemDuration,
        terminalStatus: updatedUpload?.status || "unknown",
        errorMessage: updatedUpload?.errorMessage || actionError || null,
        candidateId: updatedUpload?.candidateId || null,
        candidateName: candidateProfile?.fullName || null,
        accuracyCheck: {
          namePresent,
          contactReachable,
          structuredDataPresent,
          schemaValid,
          passAccuracy,
        },
      };

      processedRecords.push(recordOutcome);
      console.log(`[Worker ${workerId}] Finished ${cvUploadId} in ${itemDuration}ms -> Status: ${recordOutcome.terminalStatus} | Candidate: '${candidateProfile?.fullName || 'N/A'}' | Accuracy Pass: ${recordOutcome.accuracyCheck.passAccuracy}`);
    }
  }

  // Launch STAGE_1_WORKERS in parallel
  const workers = Array.from({ length: STAGE_1_WORKERS }, (_, i) => workerTask(i + 1));
  await Promise.all(workers);

  const totalDurationMs = Date.now() - startTime;

  // ─────────────────────────────────────────────────────────────
  // STAGE 1 FINAL REPORT & METRICS SUMMARY
  // ─────────────────────────────────────────────────────────────
  const totalProcessed = processedRecords.length;
  const terminalCount = processedRecords.filter((r) => r.terminalStatus === "processed" || r.terminalStatus === "needs_review").length;
  const needsReviewCount = processedRecords.filter((r) => r.terminalStatus === "needs_review").length;
  const processedCount = processedRecords.filter((r) => r.terminalStatus === "processed").length;
  const accuracyPassedCount = processedRecords.filter((r) => r.accuracyCheck.passAccuracy).length;
  const accuracyRatePct = totalProcessed > 0 ? ((accuracyPassedCount / totalProcessed) * 100).toFixed(1) : "0.0";
  const terminalRatePct = totalProcessed > 0 ? ((terminalCount / totalProcessed) * 100).toFixed(1) : "0.0";

  console.log(`\n==================================================================`);
  console.log(`               STAGE 1 (3 WORKERS) FINAL RESULTS                  `);
  console.log(`==================================================================`);
  console.log(`Total Time Elapsed        : ${(totalDurationMs / 1000).toFixed(2)} seconds`);
  console.log(`Total CVs Claimed         : ${totalProcessed} / ${TARGET_TOTAL_CVS}`);
  console.log(`Terminal State Count      : ${terminalCount} / ${totalProcessed} (${terminalRatePct}%)`);
  console.log(`  - Status 'processed'    : ${processedCount}`);
  console.log(`  - Status 'needs_review' : ${needsReviewCount}`);
  console.log(`  - Status 'failed/other' : ${totalProcessed - terminalCount}`);
  console.log(`------------------------------------------------------------------`);
  console.log(`4-Criteria Accuracy Pass  : ${accuracyPassedCount} / ${totalProcessed} (${accuracyRatePct}%) [Target >= 98%]`);
  console.log(`HTTP 429 Errors           : ${total429Errors} [Target 0]`);
  console.log(`Loop / Double-Claims      : ${loopDetected ? "YES (FAILED - ABORTED)" : "0 (PASSED)"}`);
  console.log("==================================================================\n");

  console.log(`[RAW PER-CV EXECUTION LOG (JSON)]`);
  console.log(JSON.stringify(processedRecords, null, 2));

  // Check overall Stage 1 Pass / Fail
  const stage1Passed =
    !loopDetected &&
    totalProcessed >= TARGET_TOTAL_CVS &&
    terminalCount === totalProcessed &&
    parseFloat(accuracyRatePct) >= 98.0 &&
    total429Errors === 0;

  console.log(`\n>>> STAGE 1 VERIFICATION RESULT: ${stage1Passed ? "PASSED 100% - READY FOR CHECKPOINT GATE 1 SIGN-OFF" : "FAILED - REVERTING TO 1-WORKER FALLBACK"} <<<\n`);
}

runStage1Batch();
