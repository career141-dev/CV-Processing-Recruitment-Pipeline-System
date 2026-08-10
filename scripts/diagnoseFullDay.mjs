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

async function diagnoseFullDay() {
  console.log("=== FULL DAY CV UPLOADS DIAGNOSTIC (10:00 AM - 17:30 PM IST) ===");
  const start10AM = new Date("2026-08-06T10:00:00+05:30").getTime();
  const end530PM = new Date("2026-08-06T17:30:00+05:30").getTime();

  try {
    const recentUploads = await client.query("health:getRecentUploads");
    
    // Total count by status in recent query
    const statusCounts = {};
    recentUploads.forEach(u => {
      statusCounts[u.status] = (statusCounts[u.status] || 0) + 1;
    });

    console.log("\nRecent Upload Sample Status Breakdown:", statusCounts);

    // Let's check candidates created today
    const stats = await client.query("stats/stats:getSystemStats");
    console.log("\nSystem Stats:", stats);

  } catch (err) {
    console.error("Error:", err.message);
  }
}

diagnoseFullDay();
