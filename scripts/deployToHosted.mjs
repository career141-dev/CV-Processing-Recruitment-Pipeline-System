import fs from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.hosted' });

const adminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY || process.env.CONVEX_DEPLOY_KEY;
const url = process.env.CONVEX_URL || process.env.CONVEX_SELF_HOSTED_URL || "https://api.career141.com";

console.log(`[Deploy] Syncing latest Convex backend code to ${url}...`);

try {
  execSync(`npx convex dev --once --url "${url}" --admin-key "${adminKey}"`, {
    stdio: 'inherit',
    env: { ...process.env },
  });
  console.log('[Deploy] Successfully synced backend code to Convex server!');
} catch (err) {
  console.error('[Deploy] Sync failed:', err.message);
}
