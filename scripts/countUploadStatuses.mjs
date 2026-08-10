import dotenv from 'dotenv';
import { ConvexHttpClient } from 'convex/browser';

dotenv.config({ path: '.env.hosted' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "https://api.career141.com";
const adminKey = process.env.CONVEX_DEPLOY_KEY || process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;

const client = new ConvexHttpClient(CONVEX_URL);
if (adminKey) {
  client.setAdminAuth(adminKey);
}

async function countStatuses() {
  console.log("=== COUNTING ALL CV UPLOADS BY STATUS ===");

  try {
    // Query stats/stats:getDeepSeekExtractionStats or getRecentUploads or iterate
    const stats = await client.query("stats/stats:getDeepSeekExtractionStats");
    console.log("DeepSeek extraction stats:", JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

countStatuses();
