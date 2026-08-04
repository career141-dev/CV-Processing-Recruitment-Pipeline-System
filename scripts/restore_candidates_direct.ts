import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = "https://api.career141.com";
const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
  console.log("=================================================================");
  console.log("🛠️ CANDIDATE AUTOMATED RECOVERY RUNNER");
  console.log(`📡 Connecting to Live Server: ${CONVEX_URL}`);
  console.log("=================================================================\n");

  try {
    const stats: any = await client.query("stats/stats:getDashboardStats" as any);
    console.log("📊 Current Live Server Stats:", stats);

    const ingestion: any = await client.query("stats/stats:getIngestionStats" as any);
    console.log("📥 Ingestion Stats:", ingestion);

    const recovered: any = await client.mutation("cvs/cvUploads:recoverStuckUploads" as any);
    console.log("🔄 Recovered Stuck Uploads Count:", recovered);
  } catch (err: any) {
    console.error("Recovery query error:", err.message);
  }
}

main().catch(console.error);
