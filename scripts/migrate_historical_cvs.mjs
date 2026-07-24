import { ConvexHttpClient } from "convex/browser";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const CONVEX_URL = "https://api.career141.com";
const STORAGE_DIR = path.join(process.cwd(), "_storage_temp", "_storage");
const client = new ConvexHttpClient(CONVEX_URL);

async function uploadFile(filePath) {
  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  let mimeType = "application/pdf";
  if (fileName.endsWith(".png")) mimeType = "image/png";
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) mimeType = "image/jpeg";

  // 1. Generate upload URL
  const uploadUrl = await client.mutation("storageMigration:generateUploadUrl", {});

  // Replace internal host in uploadUrl if needed
  const postUrl = uploadUrl.replace(/^http:\/\/(127\.0\.0\.1|localhost|convex|0\.0\.0\.0)(:\d+)?/, CONVEX_URL);

  // 2. Upload binary file
  const response = await fetch(postUrl, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    throw new Error(`HTTP upload failed with status ${response.status}`);
  }

  const { storageId: newStorageId } = await response.json();

  // 3. Link historical storage ID in database
  const oldStorageId = fileName.replace(/\.[^/.]+$/, ""); // strip extension
  const linkResult = await client.mutation("storageMigration:linkHistoricalCvFile", {
    oldStorageId,
    newStorageId,
    fileHash,
  });

  return { fileName, oldStorageId, newStorageId, ...linkResult };
}

async function main() {
  if (!fs.existsSync(STORAGE_DIR)) {
    console.error(`Storage directory not found at ${STORAGE_DIR}. Make sure _storage.zip is extracted.`);
    process.exit(1);
  }

  const files = fs.readdirSync(STORAGE_DIR).filter(f => f !== "documents.jsonl");
  console.log(`🚀 Starting migration of ${files.length} historical CV files to ${CONVEX_URL}...\n`);

  let matchedCount = 0;
  let unmatchedCount = 0;
  let errorCount = 0;

  const BATCH_SIZE = 10;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (fileName) => {
      const filePath = path.join(STORAGE_DIR, fileName);
      try {
        const res = await uploadFile(filePath);
        if (res.success) {
          matchedCount++;
          console.log(`[MATCHED ${matchedCount}] ${fileName} ---> DB Record (${res.fileName})`);
        } else {
          unmatchedCount++;
          console.log(`[UNMATCHED ${unmatchedCount}] ${fileName} (Uploaded to storage, no matching DB row)`);
        }
      } catch (err) {
        errorCount++;
        console.error(`[ERROR] ${fileName}:`, err.message);
      }
    }));

    const progress = Math.round(((i + batch.length) / files.length) * 100);
    console.log(`\n--- Progress: ${i + batch.length} / ${files.length} files (${progress}%) ---\n`);
  }

  console.log("\n=======================================================");
  console.log("🎉 HISTORICAL MIGRATION COMPLETE!");
  console.log(`   - Total Processed: ${files.length}`);
  console.log(`   - Successfully Matched to DB Candidates: ${matchedCount}`);
  console.log(`   - Uploaded to Storage (Unmatched): ${unmatchedCount}`);
  console.log(`   - Errors: ${errorCount}`);
  console.log("=======================================================");
}

main();
