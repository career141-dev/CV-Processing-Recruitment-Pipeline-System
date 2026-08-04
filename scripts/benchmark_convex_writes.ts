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

async function runWriteBenchmark(concurrencyLevel: number) {
  console.log(`\n-----------------------------------------------------------------`);
  console.log(`⚡ Benchmark: ${concurrencyLevel} Concurrent In-Flight HTTP Writes to ${CONVEX_URL}`);
  console.log(`-----------------------------------------------------------------`);

  const tStart = Date.now();
  const promises: Promise<number>[] = [];

  for (let i = 0; i < concurrencyLevel; i++) {
    const p = (async () => {
      const itemStart = Date.now();
      try {
        const candidateId = await client.mutation("candidates/candidates:createCandidate" as any, {
          rawText: `Benchmark write payload ${i} at ${Date.now()}`,
          sourceChannel: "write_benchmark",
          isParsed: false,
        });

        if (candidateId) {
          await client.mutation("candidates/candidates:deleteCandidate" as any, {
            candidateId,
            preserveUpload: false,
          });
        }
        return Date.now() - itemStart;
      } catch (err: any) {
        console.error(`  Item ${i} error:`, err.message);
        return Date.now() - itemStart;
      }
    })();

    promises.push(p);
  }

  const latencies = await Promise.all(promises);
  const totalElapsed = Date.now() - tStart;
  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const maxLatency = Math.max(...latencies);

  console.log(`✅ Total Elapsed Time for ${concurrencyLevel} Writes: ${totalElapsed} ms`);
  console.log(`📊 Average Per-Write Latency: ${avgLatency} ms`);
  console.log(`⏱️ Max Single-Write Latency: ${maxLatency} ms`);

  return { concurrencyLevel, totalElapsedMs: totalElapsed, avgLatencyMs: avgLatency, maxLatencyMs: maxLatency };
}

async function main() {
  console.log("=================================================================");
  console.log("📊 Convex Database Write-Latency Benchmark (5, 10, 15 Concurrency)");
  console.log("=================================================================");

  const res5 = await runWriteBenchmark(5);
  const res10 = await runWriteBenchmark(10);
  const res15 = await runWriteBenchmark(15);

  console.log("\n=================================================================");
  console.log("📈 Benchmark Summary Results:");
  console.log("=================================================================");
  console.table([res5, res10, res15]);
  process.exit(0);
}

main().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
