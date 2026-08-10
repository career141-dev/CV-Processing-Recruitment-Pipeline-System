import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";

dotenv.config({ path: ".env.hosted" });
const url = process.env.CONVEX_URL || "https://api.career141.com";
const adminKey = process.env.CONVEX_DEPLOY_KEY || process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;

const client = new ConvexHttpClient(url);
if (adminKey) {
  client.setAdminAuth(adminKey);
}

async function testSendMessageFlow() {
  console.log("=== TESTING SEND MESSAGE FLOW (META APPROVED TEMPLATE) ===");

  try {
    const candidatesRes = await client.query("candidates/candidates:listCandidates", {});
    const candidates = candidatesRes?.page || candidatesRes || [];

    const targetCandidate = candidates.find(c => c.phone?.includes("753883167") || c.fullName?.toLowerCase().includes("sanjeev")) || candidates[0];
    
    if (!targetCandidate) {
      console.error("No candidate found to test with.");
      return;
    }

    console.log(`Target candidate: ${targetCandidate.fullName} (${targetCandidate._id}), Phone: ${targetCandidate.phone}`);

    // Find jobs
    const jobs = await client.query("jobs/jobs:list", {});
    const activeJob = jobs.find(j => j.status === "active") || jobs[0];

    console.log(`Target job: ${activeJob?.title} (${activeJob?._id})`);

    // 2. Trigger sendMessage via WhatsApp channel
    console.log("Triggering sendMessage via WhatsApp channel...");
    const commId = await client.mutation("pipeline/outreach:sendMessage", {
      candidateId: targetCandidate._id,
      jobId: activeJob?._id,
      channel: "whatsapp",
      body: "Initial outreach for follow up",
      setupFollowUps: true,
    });

    console.log(`Communication record created: ${commId}. Waiting 4 seconds for Meta Cloud API dispatch...`);
    await new Promise(r => setTimeout(r, 4000));

    const status = await client.query("pipeline/outreach:getCommunicationStatus", {
      communicationId: commId,
    });

    console.log("Final Communication Delivery Status in DB:", status);
  } catch (err) {
    console.error("Test error:", err);
  }
}

testSendMessageFlow();
