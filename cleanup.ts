import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient(process.env.CONVEX_URL || "http://127.0.0.1:3210");

async function run() {
  let cursor = null;
  let totalCleaned = 0;
  let isDone = false;
  
  console.log("Starting heavy field cleanup on candidates...");
  
  while (!isDone) {
    const result = await client.mutation("admin/cleanupCandidates:cleanupAllHeavyFields", { cursor });
    
    totalCleaned += result.cleaned;
    cursor = result.continueCursor;
    isDone = result.isDone;
    
    console.log(`Cleaned in this batch: ${result.cleaned}. Total cleaned: ${totalCleaned}. isDone: ${isDone}`);
  }
  
  console.log(`Finished! Total candidates cleaned: ${totalCleaned}`);
}

run().catch(console.error);
