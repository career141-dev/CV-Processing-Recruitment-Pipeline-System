import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";

dotenv.config({ path: ".env.hosted" });
const url = process.env.CONVEX_URL || "https://api.career141.com";
const adminKey = process.env.CONVEX_DEPLOY_KEY || process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;

const client = new ConvexHttpClient(url);
if (adminKey) {
  client.setAdminAuth(adminKey);
}

async function sendFreeTextViaConvex() {
  console.log("Sending free-text message to Sanjeev via Convex server action...");
  try {
    // Send free-text message via whatsappOutbound internal action / sendMetaFreeText
    const commId = "k17asmqq1byhse0kd2anwhdaen8by5s1";
    // Or we can invoke sendMetaFreeText directly from a new test script on Convex
  } catch (err) {
    console.error("Error:", err);
  }
}

sendFreeTextViaConvex();
