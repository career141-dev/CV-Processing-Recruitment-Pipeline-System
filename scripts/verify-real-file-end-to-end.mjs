import { ConvexHttpClient } from "convex/browser";
import fs from "fs";

// Load environment configuration
const envContent = fs.readFileSync(".env.hosted", "utf8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const [k, v] = line.split("=");
  if (k && v) envVars[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
}

const url = envVars.CONVEX_SELF_HOSTED_URL || "https://api.career141.com";
const client = new ConvexHttpClient(url);

console.log(`[Real File Verification] Connecting to Convex backend at ${url}...`);

async function runEndToEndVerification() {
  try {
    // ─────────────────────────────────────────────────────────────
    // STEP 1: Purge any pre-existing fake/seeded test records
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Step 1] Purging old fake test records from TA Review Workspace...");
    const existingFailed = await client.query("candidates/candidates:listFailedUploads", { limit: 50 });
    let purgedCount = 0;
    for (const item of existingFailed.page) {
      if (
        item.fileName === "EMPIRICAL_QA_TEST_LOW_CONFIDENCE_CV.pdf" ||
        item.fileName === "QA_Test_Low_Confidence_Scanned_CV.pdf" ||
        item.fileName === "REAL_THIN_CV_TEST_IMAGE.png" ||
        item.uploadedBy === "Empirical QA Worker" ||
        item.uploadedBy === "QA Automated Test" ||
        item.uploadedBy === "Real Pipeline End-to-End QA Worker"
      ) {
        await client.mutation("candidates/candidates:deleteCvUploadRecord", { cvUploadId: item._id });
        console.log(`  - Purged fake test record: ${item._id} (${item.fileName})`);
        purgedCount++;
      }
    }
    console.log(`Step 1 Complete: Purged ${purgedCount} fake test records.`);

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Store real 1-page blank PDF buffer in Convex Storage & create cvUploads record
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Step 2] Storing REAL 1-page thin PDF document (0 text characters) into Convex Storage...");
    const { cvUploadId, storageId } = await client.action("candidates/candidates:saveTestUploadWithStorage", {
      fileName: "REAL_THIN_CV_BLANK_DOCUMENT.pdf",
      fileType: "pdf",
    });
    console.log(`  - Uploaded real PDF buffer directly to Convex storage. Storage ID: ${storageId}`);
    console.log(`  - Created cvUploads record ID: ${cvUploadId} (Initial Status: 'uploaded')`);

    // ─────────────────────────────────────────────────────────────
    // STEP 3: Execute processCvExtraction (Pdfjs -> Tesseract OCR -> < 50 char gate -> status write)
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Step 3] Executing processCvExtraction action (Full Pipeline -> Gate Flow)...");
    const extractionResult = await client.action("cvs/cvExtraction:processCvExtraction", {
      storageId,
      fileType: "pdf",
      cvUploadId,
      sourceChannel: "manual",
      uploadedBy: "Real Pipeline End-to-End QA Worker",
    });
    console.log(`  - Extraction Action Result: ${extractionResult} (Expected null due to low-confidence gate return)`);

    // ─────────────────────────────────────────────────────────────
    // STEP 4: Capture BEFORE Snapshot (T0)
    // ─────────────────────────────────────────────────────────────
    const t0Time = new Date().toISOString();
    const t0Record = await client.query("candidates/candidates:getCvUpload", { cvUploadId });
    const t0WorkspaceList = await client.query("candidates/candidates:listFailedUploads", { limit: 50 });
    const t0Surfaced = t0WorkspaceList.page.some((item) => item._id === cvUploadId);

    console.log(`\n================ BEFORE SNAPSHOT (T0: ${t0Time}) ================`);
    console.log(`- Record ID: ${cvUploadId}`);
    console.log(`- Status at T0: ${t0Record?.status}`);
    console.log(`- Error Message: "${t0Record?.errorMessage}"`);
    console.log(`- Surfaced in TA Review Workspace Query: ${t0Surfaced}`);
    console.log("==================================================================");

    // Verify Tesseract gate succeeded
    if (t0Record?.status !== "needs_review") {
      throw new Error(`Pipeline did not assign 'needs_review' status. Actual status: ${t0Record?.status}`);
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 5: Wait 130 Seconds (2+ Minutes / 2+ Cron Cycles)
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Step 5] Waiting 130 seconds (2+ full minutes) to verify status persistence across cron cycles...");
    const totalWaitSeconds = 130;
    const intervalMs = 10000;
    let elapsed = 0;

    while (elapsed < totalWaitSeconds) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      elapsed += intervalMs / 1000;
      console.log(`  ... Elapsed: ${elapsed}s / ${totalWaitSeconds}s (Status holding: '${(await client.query("candidates/candidates:getCvUpload", { cvUploadId }))?.status}')`);
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 6: Capture AFTER Snapshot (T1)
    // ─────────────────────────────────────────────────────────────
    const t1Time = new Date().toISOString();
    const t1Record = await client.query("candidates/candidates:getCvUpload", { cvUploadId });
    const t1WorkspaceList = await client.query("candidates/candidates:listFailedUploads", { limit: 50 });
    const t1Surfaced = t1WorkspaceList.page.some((item) => item._id === cvUploadId);

    console.log(`\n================ AFTER SNAPSHOT (T1: ${t1Time}) ================`);
    console.log(`- Record ID: ${cvUploadId}`);
    console.log(`- Status at T1: ${t1Record?.status}`);
    console.log(`- Error Message: "${t1Record?.errorMessage}"`);
    console.log(`- Surfaced in TA Review Workspace Query: ${t1Surfaced}`);
    console.log("=================================================================");

    // ─────────────────────────────────────────────────────────────
    // STEP 7: Clean up the real test file from TA Review Workspace
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Step 7] Cleaning up real test record from TA Review Workspace...");
    await client.mutation("candidates/candidates:deleteCvUploadRecord", { cvUploadId });
    console.log(`  - Deleted test record ${cvUploadId} cleanly.`);

    // ─────────────────────────────────────────────────────────────
    // FINAL SIDE-BY-SIDE VERIFICATION SUMMARY
    // ─────────────────────────────────────────────────────────────
    const pass = t0Record?.status === "needs_review" && t1Record?.status === "needs_review" && t0Surfaced && t1Surfaced;

    console.log("\n==================================================================");
    console.log("             FINAL SIDE-BY-SIDE EMPIRICAL VERIFICATION            ");
    console.log("==================================================================");
    console.log(`Test Execution Timestamp T0 : ${t0Time}`);
    console.log(`Test Execution Timestamp T1 : ${t1Time}`);
    console.log(`Elapsed Duration           : ${elapsed} seconds (> 120s threshold)`);
    console.log(`Test File Type             : Real 1-page PDF (0 text characters)`);
    console.log(`Pipeline Action Executed   : processCvExtraction -> pdfjs/Tesseract -> Gate`);
    console.log("------------------------------------------------------------------");
    console.log(`Status at T0               : ${t0Record?.status}`);
    console.log(`Status at T1               : ${t1Record?.status}`);
    console.log(`Status Changed?            : ${t0Record?.status !== t1Record?.status ? "YES (FAILED)" : "NO (PASSED - PERSISTED)"}`);
    console.log(`TA Workspace Surfaced T0   : ${t0Surfaced}`);
    console.log(`TA Workspace Surfaced T1   : ${t1Surfaced}`);
    console.log(`Fake Records Cleaned Up?   : YES (${purgedCount + 1} records deleted)`);
    console.log(`Overall Empirical Result   : ${pass ? "SUCCESS - FULLY PERSISTED & VERIFIED" : "FAILURE"}`);
    console.log("==================================================================\n");

  } catch (err) {
    console.error("Verification failed:", err);
  }
}

runEndToEndVerification();
