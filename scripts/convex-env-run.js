const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getEnvMap(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) return {};
  const content = fs.readFileSync(absolutePath, 'utf8');
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

const mode = process.argv[2] || 'local'; // 'local' | 'hosted'
const action = process.argv[3] || 'dev'; // 'dev' | 'sync-from-hosted'

const targetEnvFile = mode === 'hosted' ? '.env.hosted' : '.env.localdev';

// Switch environment file to .env.local
if (fs.existsSync(targetEnvFile)) {
  fs.copyFileSync(targetEnvFile, '.env.local');
  console.log(`Switched environment to ${mode === 'hosted' ? 'Hosted Backend (api.career141.com)' : 'Local Backend (127.0.0.1)'}`);
}

const currentEnv = getEnvMap('.env.local');

if (action === 'dev') {
  const url = currentEnv.CONVEX_SELF_HOSTED_URL || (mode === 'hosted' ? 'https://api.career141.com' : 'http://127.0.0.1:3210');
  const adminKey = currentEnv.CONVEX_SELF_HOSTED_ADMIN_KEY;

  if (!adminKey) {
    console.error(`[ERROR] CONVEX_SELF_HOSTED_ADMIN_KEY not found in .env.local / ${targetEnvFile}`);
    process.exit(1);
  }

  console.log(`[Convex Runner] Connecting to ${url}...`);
  execSync(`npx convex dev --url "${url}" --admin-key "${adminKey}"`, { stdio: 'inherit' });

} else if (action === 'sync-from-hosted') {
  const hostedEnv = getEnvMap('.env.hosted');
  const localEnv = getEnvMap('.env.localdev');

  if (!hostedEnv.CONVEX_SELF_HOSTED_ADMIN_KEY || !localEnv.CONVEX_SELF_HOSTED_ADMIN_KEY) {
    console.error('[ERROR] Missing CONVEX_SELF_HOSTED_ADMIN_KEY in .env.hosted or .env.localdev');
    process.exit(1);
  }

  console.log('[Sync] Exporting database from hosted backend...');
  execSync(`npx convex export --url "${hostedEnv.CONVEX_SELF_HOSTED_URL || 'https://api.career141.com'}" --admin-key "${hostedEnv.CONVEX_SELF_HOSTED_ADMIN_KEY}" --path hosted_export.zip`, { stdio: 'inherit' });

  console.log('[Sync] Importing database into local backend...');
  execSync(`npx convex import hosted_export.zip --replace --yes --url "${localEnv.CONVEX_SELF_HOSTED_URL || 'http://127.0.0.1:3210'}" --admin-key "${localEnv.CONVEX_SELF_HOSTED_ADMIN_KEY}"`, { stdio: 'inherit' });
}
