import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.hosted" });
if (!process.env.CONVEX_DEPLOY_KEY) {
  dotenv.config({ path: ".env" });
}

const url = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "https://api.career141.com";
const adminKey = process.env.CONVEX_DEPLOY_KEY || process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;

const backupsDir = path.resolve("./backups");
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
const backupFileName = `backup_${todayStr}.zip`;
const backupFilePath = path.join(backupsDir, backupFileName);
const rootBackupPath = path.resolve("./backup.zip");

console.log(`[Auto-Backup] Starting 5-day automated database export to ${backupFilePath}...`);

try {
  // 1. Export live database snapshot from Convex
  const cmd = `npx convex export --url "${url}" --admin-key "${adminKey}" --path "${backupFilePath}"`;
  execSync(cmd, { stdio: "inherit" });

  // 2. Also refresh root backup.zip for immediate recovery
  fs.copyFileSync(backupFilePath, rootBackupPath);

  console.log(`[Auto-Backup] Successfully created snapshot: ${backupFilePath}`);
  console.log(`[Auto-Backup] Updated root backup file: ${rootBackupPath}`);

  // 3. Keep latest 10 backups, clean up old backups
  const files = fs.readdirSync(backupsDir).filter(f => f.startsWith("backup_") && f.endsWith(".zip"));
  if (files.length > 10) {
    files.sort();
    const toDelete = files.slice(0, files.length - 10);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(backupsDir, f));
      console.log(`[Auto-Backup] Pruned old backup: ${f}`);
    }
  }
} catch (err) {
  console.error(`[Auto-Backup] Failed to run automated backup:`, err.message);
  process.exit(1);
}
