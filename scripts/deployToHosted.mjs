import fs from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.hosted' });
dotenv.config({ path: '.env' });

let adminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY || process.env.CONVEX_DEPLOY_KEY || process.env.CONVEX_ADMIN_KEY;
if (!adminKey || adminKey === "undefined" || adminKey === "null" || adminKey.trim() === "") {
  adminKey = "convex-self-hosted|01c7a32b0d2deae44e0fdcd9108f8b62c6c1af651cac34d644be0f3912d0ba099aa6f4369b";
}

let url = process.env.CONVEX_SELF_HOSTED_URL || "http://127.0.0.1:3210";

console.log(`[Deploy] Syncing latest Convex backend code to ${url}...`);

try {
  execSync(`npx convex dev --once --typecheck=disable --url "${url}" --admin-key "${adminKey}"`, {
    stdio: 'inherit',
    env: { ...process.env, CONVEX_SELF_HOSTED_ADMIN_KEY: adminKey },
  });
  console.log('[Deploy] Successfully synced backend code to Convex server!');
} catch (err) {
  console.error('[Deploy] Sync failed:', err.message);
}
