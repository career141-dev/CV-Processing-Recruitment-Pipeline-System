import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = "https://api.career141.com";
const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
  console.log("=================================================================");
  console.log("🧪 RECOVERY ACTION TEST");
  console.log("=================================================================\n");

  // Sample upload ID from recent ingestion logs
  const testUploadId = "jd7cdebfnqhvbmfq51pxb24akh8anvg1";
  const sampleStorageId = "kg23302c2x00q6sfeee4ejbncd8amem7";

  console.log(`🚀 Executing processCvExtraction for cvUploadId: ${testUploadId}...`);
  try {
    const res: any = await client.action("cvs/cvExtraction:processCvExtraction" as any, {
      cvUploadId: testUploadId,
      storageId: sampleStorageId,
      fileType: "pdf",
      sourceChannel: "Recovery_Test",
      uploadedBy: "recovery_test_runner",
    });
    console.log("✅ Candidate Extraction Succeeded! Candidate ID:", res);
  } catch (err: any) {
    console.error("❌ Extraction Error:", err.message);
  }
}

main().catch(console.error);
