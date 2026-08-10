import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";

dotenv.config({ path: ".env.hosted" });
const url = process.env.CONVEX_URL || "https://api.career141.com";
const adminKey = process.env.CONVEX_DEPLOY_KEY || process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;

const client = new ConvexHttpClient(url);
if (adminKey) {
  client.setAdminAuth(adminKey);
}

async function testQueueCron() {
  console.log("=== TESTING PROCESS UNEXTRACTED QUEUE CRON ===");

  try {
    const res = await client.action("cvs/cvExtraction:processUnextractedQueueCron", {});
    console.log("Result:", res);

    const liveStatus = await client.query("stats/stats:getDirectUploadLiveStatus");
    console.log("Live extraction status after run:", liveStatus);
  } catch (err) {
    console.error("Error:", err);
  }
}

testQueueCron();
