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

async function run50CvBenchmark() {
  console.log("=================================================================");
  console.log("📊 50-CV Empirical Baseline Timing Benchmark (Sequential Pipeline)");
  console.log(`📡 Target Backend: ${CONVEX_URL}`);
  console.log("=================================================================\n");

  const sampleDir = path.join(__dirname, "../temp_sample_cvs");
  if (!fs.existsSync(sampleDir)) {
    console.error(`❌ Sample CV directory not found: ${sampleDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(sampleDir).filter(f => f.endsWith(".pdf") || f.endsWith(".docx")).slice(0, 50);
  console.log(`📁 Found ${files.length} sample CV files for empirical timing.\n`);

  const results: any[] = [];
  const tStartBatch = Date.now();

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const filePath = path.join(sampleDir, fileName);
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");
    const fileType = path.extname(fileName).replace(".", "").toLowerCase();

    console.log(`[${i + 1}/${files.length}] Uploading & processing ${fileName}...`);

    try {
      const uploadRes: any = await client.action("cvs/folderIngestion:uploadFolderCandidate" as any, {
        fileName: `bench_${Date.now()}_${fileName}`,
        fileType,
        base64Data,
        uploadedBy: "benchmark_runner",
        sourceChannel: "empirical_timing_benchmark",
      });

      console.log(`   Uploaded! cvUploadId: ${uploadRes.cvUploadId}`);
      results.push({
        index: i + 1,
        fileName,
        cvUploadId: uploadRes.cvUploadId,
        status: "submitted",
      });
    } catch (err: any) {
      console.error(`   Error processing ${fileName}:`, err.message);
      results.push({
        index: i + 1,
        fileName,
        error: err.message,
      });
    }
  }

  const totalBatchTimeMs = Date.now() - tStartBatch;
  console.log("\n=================================================================");
  console.log(`✅ Completed Submission of 50-CV Batch in ${totalBatchTimeMs} ms`);
  console.log("=================================================================");
}

run50CvBenchmark().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
