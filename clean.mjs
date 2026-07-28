import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";
dotenv.config({ path: ".env.hosted" });

const url = process.env.CONVEX_URL || "https://api.career141.com";
const client = new ConvexHttpClient(url);
client.setAdminAuth(process.env.CONVEX_DEPLOY_KEY || process.env.CONVEX_SELF_HOSTED_ADMIN_KEY);

async function run() {
  console.log("Running correct recovery on:", url);
  try {
    const res = await client.action("recoverCorrect:recoverCorrectApps");
    console.log("Result:", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("Failed:", err.message);
  }
}
run();
