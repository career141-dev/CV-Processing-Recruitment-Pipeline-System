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

console.log(`[Empirical Test] Connecting to ${url}...`);

async function runTest() {
  try {
    // 1. Create a test upload record
    const uploadId = await client.mutation("cvs/cvUploads:saveUpload", {
      fileName: "EMPIRICAL_QA_TEST_LOW_CONFIDENCE_CV.pdf",
      fileSize: 512,
      fileType: "pdf",
      uploadedBy: "Empirical QA Worker",
      source: "Manual Directory Import",
    });
    console.log(`1. Created test upload record: ${uploadId}`);

    // 2. Set status to "needs_review" with low-confidence error message
    await client.mutation("candidates/candidates:updateCvUpload", {
      cvUploadId: uploadId,
      status: "needs_review",
      errorMessage: "Low-confidence OCR text (14 chars < 50 threshold). Flagged for manual TA human review.",
    });
    console.log(`2. Updated status to 'needs_review'`);

    // 3. Query record status directly from Convex DB
    const dbRecord = await client.query("candidates/candidates:getCvUpload", { cvUploadId: uploadId });
    console.log(`3. Direct DB Record status: ${dbRecord?.status}`);

    // 4. Query listFailedUploads (drives the TA Review Workspace UI)
    const taWorkspaceList = await client.query("candidates/candidates:listFailedUploads", { limit: 50 });
    const targetItem = taWorkspaceList.page.find((item) => item._id === uploadId);

    console.log("\n================ EMPIRICAL VERIFICATION EVIDENCE ================");
    console.log(`- Test Record ID: ${uploadId}`);
    console.log(`- Database Status: ${dbRecord?.status}`);
    console.log(`- Database Error Message: "${dbRecord?.errorMessage}"`);
    console.log(`- Present in TA Review Workspace Query (listFailedUploads): ${Boolean(targetItem)}`);
    if (targetItem) {
      console.log(`- Workspace Record Object:`, JSON.stringify(targetItem, null, 2));
    }
    console.log(`- Empirical Verification Passed: ${dbRecord?.status === "needs_review" && Boolean(targetItem) === true}`);
    console.log("=================================================================");
  } catch (err) {
    console.error("Test execution failed:", err);
  }
}

runTest();
