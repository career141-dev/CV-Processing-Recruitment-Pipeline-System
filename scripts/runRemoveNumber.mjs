import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";

dotenv.config({ path: ".env.hosted" });
const url = process.env.CONVEX_URL || "https://api.career141.com";
const adminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY || process.env.CONVEX_DEPLOY_KEY;

const client = new ConvexHttpClient(url);
if (adminKey) {
  client.setAdminAuth(adminKey);
}

async function removeSanjeevNumber() {
  console.log("=== REMOVING +94 72 285 8346 VIA MUTATION ===");

  try {
    const res = await client.mutation("settings/whatsappNumbers:removeNumberByPattern", { pattern: "722858346" });
    console.log("Mutation result:", res);

    const list = await client.query("settings/whatsappNumbers:list");
    console.log("Current WhatsApp Numbers in DB:", list);
  } catch (err) {
    console.error("Error:", err);
  }
}

removeSanjeevNumber();
