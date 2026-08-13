import fs from "fs";
import { execSync } from "child_process";

const env = fs.readFileSync(".env.hosted", "utf8");
const adminKeyMatch = env.match(/CONVEX_SELF_HOSTED_ADMIN_KEY=([^\r\n]+)/);
const urlMatch = env.match(/CONVEX_SELF_HOSTED_URL=([^\r\n]+)/);

const adminKey = adminKeyMatch ? adminKeyMatch[1].trim() : "";
const url = urlMatch ? urlMatch[1].trim() : "https://api.career141.com";

console.log(`[Deploy] Deploying Convex functions to ${url}...`);

try {
  execSync(`npx convex deploy --url "${url}" --admin-key "${adminKey}"`, {
    stdio: "inherit",
  });
  console.log(`[Deploy] ✅ Successfully deployed to ${url}!`);
} catch (err) {
  console.error(`[Deploy] ❌ Error:`, err.message);
  process.exit(1);
}
