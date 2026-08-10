import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";

dotenv.config({ path: ".env.hosted" });
const url = process.env.CONVEX_URL || "https://api.career141.com";
const adminKey = process.env.CONVEX_DEPLOY_KEY || process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;

const client = new ConvexHttpClient(url);
if (adminKey) {
  client.setAdminAuth(adminKey);
}

async function inspectWhatsAppNumbers() {
  const token = "EAAVsiEb3mHEBSIuLifLIqEvWVh9P0EkUnxKufE7fFRgay0IwCTZAPOTjv3gYxSk4iC2mNOKs8JTT3Qb0ZAdTHsP4WbZCiNZAiw4WOj5vLPQ9CSI4uiivAWKDhLnVzN6toTXdfvMRkZAUibXh3Rgg2bJkFOQ7YUbZAp005nlKdX9fbM7sZBcyZBjWBIzUST8t2QZDZD";

  try {
    // Check all numbers registered in DB
    const numbers = await client.query("settings/whatsappNumbers:list");
    console.log("DB WhatsApp Numbers:", numbers);

    // Test each phoneId with Meta API
    for (const num of numbers || []) {
      const pId = num.whatchimpPhoneId || num.phoneId;
      console.log(`\nChecking phone ${num.phone} (ID: ${pId}) with Meta...`);
      if (pId) {
        const res = await fetch(`https://graph.facebook.com/v19.0/${pId}?fields=id,display_phone_number,name_status,status,quality_rating&access_token=${token}`);
        console.log(`Meta status for ${pId}:`, await res.json());
      }
    }

    // Also check default META_PHONE_NUMBER_ID
    const defaultPId = "965783109962872";
    console.log(`\nChecking default ID ${defaultPId} with Meta...`);
    const defRes = await fetch(`https://graph.facebook.com/v19.0/${defaultPId}?fields=id,display_phone_number,name_status,status,quality_rating&access_token=${token}`);
    console.log(`Meta status for default ${defaultPId}:`, await defRes.json());

  } catch (err) {
    console.error("Error:", err);
  }
}

inspectWhatsAppNumbers();
