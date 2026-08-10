import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";

dotenv.config({ path: ".env.hosted" });
const url = process.env.CONVEX_URL || "https://api.career141.com";
const adminKey = process.env.CONVEX_DEPLOY_KEY || process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;

const client = new ConvexHttpClient(url);
if (adminKey) {
  client.setAdminAuth(adminKey);
}

async function inspectStuckUploads() {
  console.log("=== INSPECTING CV UPLOADS RECORDS ===");

  try {
    const active = await client.query("stats/stats:getDirectUploadLiveStatus");
    console.log("Live status:", active);

    const uploads = await client.query("candidates/candidates:listUploadsByStatus", { status: "uploaded", limit: 20 });
    console.log(`\nSample of 'uploaded' records (${uploads.length}):`);
    for (const u of uploads) {
      console.log(`- ID: ${u._id}, File: ${u.fileName}, Provider: ${u.storageProvider}, s3Key: ${u.s3Key || "NONE"}, storageId: ${u.storageId || "NONE"}, status: ${u.status}`);
    }

    const failed = await client.query("candidates/candidates:listUploadsByStatus", { status: "failed", limit: 20 });
    console.log(`\nSample of 'failed' records (${failed.length}):`);
    for (const u of failed) {
      console.log(`- ID: ${u._id}, File: ${u.fileName}, Provider: ${u.storageProvider}, s3Key: ${u.s3Key || "NONE"}, storageId: ${u.storageId || "NONE"}, error: ${u.errorMessage}`);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

inspectStuckUploads();
