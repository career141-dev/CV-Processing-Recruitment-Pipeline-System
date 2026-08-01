#!/usr/bin/env node

/**
 * 18,000 Candidate Folder CV Importer Script
 *
 * Usage:
 *   node scripts/folder-cv-importer.js "E:\Candidate_CVs_18k"
 *
 * Features:
 *   - Traverses 18,000 candidate subfolders on an external drive or local directory.
 *   - Looks inside each subfolder for a 'Downloads' or 'downloads' subfolder.
 *   - Selects the first resume file (.pdf, .docx, .doc, .rtf, .txt).
 *   - Uploads candidates in batches of 100 candidates.
 *   - Persists state in scripts/folder_import_progress.json for 100% crash recovery / pause-resume.
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load local environment variables
dotenv.config();
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "http://localhost:3210";
const PROGRESS_FILE = path.join(__dirname, "folder_import_progress.json");
const BATCH_SIZE = 100;
const VALID_EXTENSIONS = [".pdf", ".docx", ".doc", ".rtf", ".txt"];

// Initialize Convex Client for Node
let ConvexClient;
try {
  ConvexClient = require("convex/browser").ConvexClient;
} catch (err) {
  console.error("❌ 'convex' package not found in node_modules. Please ensure dependencies are installed.");
  process.exit(1);
}

function loadProgressState(rootDir) {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
      if (data.rootDirectory === rootDir) {
        return data;
      }
    } catch (e) {
      console.warn("⚠️ Warning: Could not parse existing progress file. Starting fresh.");
    }
  }
  return {
    rootDirectory: rootDir,
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    totalFoldersDiscovered: 0,
    processedCount: 0,
    uploadedCount: 0,
    skippedNoResumeCount: 0,
    failedCount: 0,
    currentBatchIndex: 1,
    processedFolders: {},
  };
}

function saveProgressState(state) {
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function findDownloadsFolder(candidateFolderPath) {
  try {
    const items = fs.readdirSync(candidateFolderPath);
    const downloadsName = items.find((item) => {
      const lower = item.toLowerCase();
      return lower === "downloads" || lower === "download";
    });
    if (downloadsName) {
      const fullPath = path.join(candidateFolderPath, downloadsName);
      if (fs.statSync(fullPath).isDirectory()) {
        return fullPath;
      }
    }
  } catch (err) {
    // Ignore read errors
  }
  return null;
}

function findFirstResumeFile(downloadsFolderPath) {
  try {
    const files = fs.readdirSync(downloadsFolderPath);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (VALID_EXTENSIONS.includes(ext)) {
        const fullPath = path.join(downloadsFolderPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && stat.size > 0) {
          return {
            fileName: file,
            filePath: fullPath,
            ext: ext.replace(".", ""),
            fileSize: stat.size,
          };
        }
      }
    }
  } catch (err) {
    // Ignore read errors
  }
  return null;
}

async function main() {
  const targetDirArg = process.argv[2];

  console.log("=================================================================");
  console.log("📁 18,000 Candidate External Drive Folder Importer");
  console.log("=================================================================\n");

  if (!targetDirArg) {
    console.log("Usage:");
    console.log('  node scripts/folder-cv-importer.js "E:\\Path\\To\\18000_Candidate_Folders"\n');
    console.log("Please specify the root directory path of your candidate folders.");
    process.exit(1);
  }

  const rootDir = path.resolve(targetDirArg);
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    console.error(`❌ Error: Specified directory does not exist or is not a folder: "${rootDir}"`);
    process.exit(1);
  }

  console.log(`📂 Target Root Directory: "${rootDir}"`);
  console.log(`📡 Convex Backend URL: "${CONVEX_URL}"`);
  console.log(`📦 Batch Size: ${BATCH_SIZE} candidates / batch\n`);

  const client = new ConvexClient(CONVEX_URL);

  const state = loadProgressState(rootDir);

  console.log("🔍 Scanning candidate subfolders...");
  const allSubitems = fs.readdirSync(rootDir);
  const candidateFolders = allSubitems.filter((item) => {
    try {
      const p = path.join(rootDir, item);
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  });

  state.totalFoldersDiscovered = candidateFolders.length;
  saveProgressState(state);

  console.log(`✅ Discovered ${candidateFolders.length.toLocaleString()} total candidate folders.`);
  console.log(`📊 Previously Processed: ${state.processedCount.toLocaleString()} folders.`);
  console.log(`🚀 Remaining To Process: ${(candidateFolders.length - state.processedCount).toLocaleString()} folders.\n`);

  let currentBatch = [];
  let batchCounter = 0;

  for (let i = 0; i < candidateFolders.length; i++) {
    const folderName = candidateFolders[i];

    // Check if already processed
    if (state.processedFolders[folderName]) {
      continue;
    }

    const candidateFolderPath = path.join(rootDir, folderName);
    const downloadsFolder = findDownloadsFolder(candidateFolderPath);

    if (!downloadsFolder) {
      state.processedFolders[folderName] = { status: "skipped", reason: "No Downloads folder" };
      state.processedCount++;
      state.skippedNoResumeCount++;
      saveProgressState(state);
      continue;
    }

    const resumeFile = findFirstResumeFile(downloadsFolder);
    if (!resumeFile) {
      state.processedFolders[folderName] = { status: "skipped", reason: "No valid resume file in Downloads" };
      state.processedCount++;
      state.skippedNoResumeCount++;
      saveProgressState(state);
      continue;
    }

    currentBatch.push({
      folderName,
      resumeFile,
    });

    // When batch size reaches 100, process batch!
    if (currentBatch.length >= BATCH_SIZE || i === candidateFolders.length - 1) {
      batchCounter++;
      console.log(`-----------------------------------------------------------------`);
      console.log(`⚡ Processing Batch #${state.currentBatchIndex} (${currentBatch.length} candidates)...`);
      console.log(`-----------------------------------------------------------------`);

      for (let bIdx = 0; bIdx < currentBatch.length; bIdx++) {
        const item = currentBatch[bIdx];
        const { folderName, resumeFile } = item;

        try {
          const fileBuffer = fs.readFileSync(resumeFile.filePath);
          const base64Data = fileBuffer.toString("base64");
          const uploadFileName = `${folderName}_${resumeFile.fileName}`;

          process.stdout.write(`  [${bIdx + 1}/${currentBatch.length}] Uploading ${folderName} (${resumeFile.fileName})... `);

          // Call Convex folder candidate upload action
          const result = await client.action("cvs/folderIngestion:uploadFolderCandidate", {
            fileName: uploadFileName,
            fileType: resumeFile.ext,
            base64Data,
            uploadedBy: "Local Directory Worker",
            sourceChannel: "Manual Directory Import",
            batchIndex: bIdx,
          });

          state.processedFolders[folderName] = {
            status: "uploaded",
            file: resumeFile.fileName,
            cvUploadId: result.cvUploadId,
            timestamp: new Date().toISOString(),
          };
          state.processedCount++;
          state.uploadedCount++;
          console.log(`✅ Success`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`❌ Failed: ${msg}`);
          state.processedFolders[folderName] = {
            status: "failed",
            error: msg,
            timestamp: new Date().toISOString(),
          };
          state.processedCount++;
          state.failedCount++;
        }

        saveProgressState(state);
      }

      console.log(`\n🎉 Batch #${state.currentBatchIndex} Complete!`);
      console.log(`   Uploaded: ${state.uploadedCount} | Skipped: ${state.skippedNoResumeCount} | Failed: ${state.failedCount}`);
      console.log(`   Overall Progress: ${state.processedCount} / ${candidateFolders.length} (${((state.processedCount / candidateFolders.length) * 100).toFixed(1)}%)\n`);

      state.currentBatchIndex++;
      saveProgressState(state);
      currentBatch = [];
    }
  }

  console.log("=================================================================");
  console.log("🎊 DIRECTORY IMPORT FULLY COMPLETED!");
  console.log(`   Total Folders Processed: ${state.processedCount.toLocaleString()}`);
  console.log(`   Total CVs Uploaded: ${state.uploadedCount.toLocaleString()}`);
  console.log(`   Skipped (No Resume): ${state.skippedNoResumeCount.toLocaleString()}`);
  console.log(`   Failed Uploads: ${state.failedCount.toLocaleString()}`);
  console.log("=================================================================");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal CLI Importer Error:", err);
  process.exit(1);
});
