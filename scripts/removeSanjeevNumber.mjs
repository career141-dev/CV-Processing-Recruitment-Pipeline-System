import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";

dotenv.config({ path: ".env.hosted" });
const url = process.env.CONVEX_URL || "https://api.career141.com";
const adminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY || process.env.CONVEX_DEPLOY_KEY;

const client = new ConvexHttpClient(url);
if (adminKey) {
  client.setAdminAuth(adminKey);
}

async function run() {
  try {
    const numbers = await client.query("settings/whatsappNumbers:list");
    console.log("Numbers:", numbers);

    const sanjeev = numbers.find(n => n.phone?.includes("722858346") || n.whatchimpPhoneId === "893484140519882");
    if (sanjeev) {
      await client.mutation("settings/whatsappNumbers:remove", { id: sanjeev._id });
      console.log("Removed sanjeev number:", sanjeev._id);
    }
  } catch (err) {
    console.error("Full error:", err);
  }
}

run();
