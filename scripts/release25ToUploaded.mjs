import { ConvexHttpClient } from "convex/browser";
import fs from "fs";

const envContent = fs.readFileSync(".env.hosted", "utf8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const [k, v] = line.split("=");
  if (k && v) envVars[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
}

const url = envVars.CONVEX_SELF_HOSTED_URL || "https://api.career141.com";
const client = new ConvexHttpClient(url);

async function release25() {
  const res = await client.mutation("health:resetStuckProcessingToUploaded", { limit: 25 });
  console.log("Reset records to uploaded:", res);
}

release25();
