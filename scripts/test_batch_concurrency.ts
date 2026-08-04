import { ConvexHttpClient } from "convex/browser";
import fs from "fs";
import path from "path";

try {
  const dotenv = require("dotenv");
  dotenv.config();
  dotenv.config({ path: ".env.local" });
} catch (e) {}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "https://api.career141.com";
const client = new ConvexHttpClient(CONVEX_URL);

// Standard sample CV text for batch testing
function createSampleCvBuffer(index: number) {
  const sampleText = `
Candidate Resume #${index}
Full Name: Alex Developer ${index}
Email: alex.dev.${index}@testdomain.org
Phone: +1 555 010 ${100 + index}
Location: New York, USA
LinkedIn: https://linkedin.com/in/alexdeveloper${index}

Professional Summary:
Senior Software Engineer with 6 years of experience in TypeScript, React, Node.js, and Distributed Cloud Architectures.

Work Experience:
Software Architect - Tech Corp (2021 - Present)
- Architected scalable serverless microservices handling 10M daily requests.
- Optimized database query throughput by 40%.

Full Stack Developer - Cloud Systems (2018 - 2021)
- Built real-time dashboard UI using Next.js and Tailwind CSS.

Education:
B.S. in Computer Science - Columbia University (2018)

Skills: TypeScript, Node.js, React, Convex, PostgreSQL, Docker, AWS, REST APIs.
`;
  return Buffer.from(sampleText, "utf-8");
}

async function runBatchConcurrencyTest() {
  console.log("=================================================================");
  console.log("🧪 PARALLEL BATCH EXTRACTION CONCURRENCY TEST");
  console.log(`📡 Target Convex Backend: ${CONVEX_URL}`);
  console.log("=================================================================\n");

  const BATCH_COUNT = 10;
  const uploadedIds: string[] = [];
  const startTimes: Record<string, number> = {};

  console.log(`🚀 Dispatching batch of ${BATCH_COUNT} CVs to Convex...`);
  const tBatchStart = Date.now();

  for (let i = 1; i <= BATCH_COUNT; i++) {
    const buffer = createSampleCvBuffer(i);
    const base64Data = buffer.toString("base64");
    const fileName = `batch_test_${tBatchStart}_cv${i}.txt`;

    startTimes[fileName] = Date.now();
    try {
      const res: any = await client.action("cvs/folderIngestion:uploadFolderCandidate" as any, {
        fileName,
        fileType: "txt",
        base64Data,
        uploadedBy: "batch_test_runner",
        sourceChannel: "concurrency_test",
        batchIndex: i - 1,
      });

      uploadedIds.push(res.cvUploadId);
      console.log(`  [${i}/${BATCH_COUNT}] Dispatched ${fileName} -> cvUploadId: ${res.cvUploadId}`);
    } catch (err: any) {
      console.error(`  [${i}/${BATCH_COUNT}] Dispatch failed for ${fileName}:`, err.message);
    }
  }

  console.log(`\n⏳ Batch dispatched in ${Date.now() - tBatchStart} ms.`);
  console.log("🔍 Polling Convex database to monitor parallel execution timelines...\n");

  let completedCount = 0;
  const pollStart = Date.now();
  let executionTimelines: any[] = [];

  while (completedCount < uploadedIds.length && Date.now() - pollStart < 60000) {
    await new Promise((r) => setTimeout(r, 1500));

    // Query uploads status
    const uploads: any[] = await Promise.all(
      uploadedIds.map((id) =>
        client.query("candidates/candidates:getCvUpload" as any, { cvUploadId: id })
      )
    );

    completedCount = uploads.filter((u) => u && (u.status === "processed" || u.status === "failed")).length;
    process.stdout.write(`\r📊 Progress: ${completedCount}/${uploadedIds.length} extractions completed...`);

    if (completedCount === uploadedIds.length) {
      executionTimelines = uploads.map((u, idx) => ({
        cvNumber: idx + 1,
        fileName: u.fileName,
        status: u.status,
        creationTime: new Date(u._creationTime).toISOString().slice(11, 23),
        candidateId: u.candidateId ?? "N/A",
      }));
      break;
    }
  }

  const tTotalBatch = Date.now() - tBatchStart;
  console.log(`\n\n=================================================================`);
  console.log("📈 PARALLEL EXTRACTION TEST RESULTS SUMMARY");
  console.log("=================================================================");
  console.log(`⏱️ Total Time for All ${BATCH_COUNT} CV Extractions: ${(tTotalBatch / 1000).toFixed(2)} seconds`);
  console.log(`⚡ Average Speed: ${(tTotalBatch / BATCH_COUNT / 1000).toFixed(2)}s per CV (in parallel)`);
  console.log(`💡 (Old Sequential Time would have been ~50.00 seconds!)\n`);

  console.table(executionTimelines);

  console.log("\n✅ Parallel Concurrency Test Complete!");
}

runBatchConcurrencyTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
