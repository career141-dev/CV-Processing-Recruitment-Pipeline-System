import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import dotenv from "dotenv";

dotenv.config();

const client = new ConvexHttpClient("https://api.career141.com");

async function main() {
  try {
    console.log("Calling addDemoCandidate mutation...");
    const result = await client.mutation(anyApi.seedTimeline.addDemoCandidate as any);
    console.log("Success! Created:", result);
  } catch (error) {
    console.error("Failed:", error);
  }
}

main();
