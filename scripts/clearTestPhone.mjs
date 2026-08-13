import { ConvexHttpClient } from "convex/browser";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "https://api.career141.com";
const client = new ConvexHttpClient(CONVEX_URL);

async function clearPhone(targetPhone) {
  const cleanPhone = targetPhone.replace(/[^0-9]/g, "");
  console.log(`[ClearTestPhone] Starting complete cleanup for test phone: +${cleanPhone}...`);

  try {
    const res = await client.mutation("communications/whatchimp:deleteSession", { phone: cleanPhone }).catch(() => null);
    console.log(`[ClearTestPhone] Deleted whatsappSession for +${cleanPhone}`);
  } catch (e) {
    console.warn(`[ClearTestPhone] Session delete note:`, e.message);
  }

  try {
    const result = await client.mutation("candidates/candidates:purgeCandidateByPhone", { phone: cleanPhone });
    console.log(`[ClearTestPhone] Purge candidate result for +${cleanPhone}:`, result);
  } catch (e) {
    console.log(`[ClearTestPhone] Note on candidate purge:`, e.message);
  }

  console.log(`[ClearTestPhone] Cleanup completed successfully for +${cleanPhone}!`);
}

const target = process.argv[2] || "94722858346";
clearPhone(target);
