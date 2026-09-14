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
const action = process.argv[3] || 'dev'; // 'dev' | 'sync-from-hosted' | 'run'

const targetEnvFile = mode === 'hosted' ? '.env.hosted' : '.env.localdev';

// Switch environment file to .env.local
if (fs.existsSync(targetEnvFile)) {
  fs.copyFileSync(targetEnvFile, '.env.local');
  console.log(`Switched environment to ${mode === 'hosted' ? 'Hosted Backend (api.career141.com)' : 'Local Backend (127.0.0.1)'}`);
}

const currentEnv = getEnvMap('.env.local');

function runNpx(args, adminKey, url) {
  const { spawnSync } = require('child_process');
  const convexCli = path.resolve(process.cwd(), 'node_modules/convex/bin/main.js');
  const env = {
    ...process.env,
    CONVEX_SELF_HOSTED_ADMIN_KEY: adminKey || process.env.CONVEX_SELF_HOSTED_ADMIN_KEY,
    CONVEX_SELF_HOSTED_URL: url || process.env.CONVEX_SELF_HOSTED_URL,
    CONVEX_URL: url || process.env.CONVEX_URL,
  };
  const fullArgs = [convexCli, ...args];
  if (adminKey && !args.includes('--admin-key')) {
    fullArgs.push('--admin-key', adminKey);
  }
  const res = spawnSync(process.execPath, fullArgs, { stdio: 'inherit', env });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
}

if (action === 'dev') {
  const url = currentEnv.CONVEX_SELF_HOSTED_URL || (mode === 'hosted' ? 'https://api.career141.com' : 'http://127.0.0.1:3210');
  const adminKey = currentEnv.CONVEX_SELF_HOSTED_ADMIN_KEY;

  if (!adminKey) {
    console.error(`[ERROR] CONVEX_SELF_HOSTED_ADMIN_KEY not found in .env.local / ${targetEnvFile}`);
    process.exit(1);
  }

  console.log(`[Convex Runner] Connecting to ${url}...`);
  runNpx(['dev', '--url', url], adminKey, url);

} else if (action === 'deploy') {
  const url = currentEnv.CONVEX_SELF_HOSTED_URL || (mode === 'hosted' ? 'https://api.career141.com' : 'http://127.0.0.1:3210');
  const adminKey = currentEnv.CONVEX_SELF_HOSTED_ADMIN_KEY;
  console.log(`[Convex Runner] Deploying to ${url}...`);
  runNpx(['deploy', '--url', url], adminKey, url);

} else if (action === 'run') {
  const url = currentEnv.CONVEX_SELF_HOSTED_URL || (mode === 'hosted' ? 'https://api.career141.com' : 'http://127.0.0.1:3210');
  const adminKey = currentEnv.CONVEX_SELF_HOSTED_ADMIN_KEY;
  const funcName = process.argv[4];
  const extraArgs = process.argv.slice(5);

  if (!funcName) {
    console.error('[ERROR] Please specify a function name to run. Example: node scripts/convex-env-run.js hosted run candidates/refereeActions:reparseAllHostedReferees');
    process.exit(1);
  }

  console.log(`[Convex Runner] Running ${funcName} against ${url}...`);
  runNpx(['run', '--url', url, funcName, ...extraArgs], adminKey, url);

} else if (action === 'sync-from-hosted') {
  const hostedEnv = getEnvMap('.env.hosted');
  const localEnv = getEnvMap('.env.localdev');

  if (!hostedEnv.CONVEX_SELF_HOSTED_ADMIN_KEY || !localEnv.CONVEX_SELF_HOSTED_ADMIN_KEY) {
    console.error('[ERROR] Missing CONVEX_SELF_HOSTED_ADMIN_KEY in .env.hosted or .env.localdev');
    process.exit(1);
  }

  console.log('[Sync] Exporting database from hosted backend...');
  runNpx(['export', '--url', hostedEnv.CONVEX_SELF_HOSTED_URL || 'https://api.career141.com', '--path', 'hosted_export.zip'], hostedEnv.CONVEX_SELF_HOSTED_ADMIN_KEY, hostedEnv.CONVEX_SELF_HOSTED_URL);

  console.log('[Sync] Importing database into local backend...');
  runNpx(['import', 'hosted_export.zip', '--replace-all', '--yes', '--url', localEnv.CONVEX_SELF_HOSTED_URL || 'http://127.0.0.1:3210'], localEnv.CONVEX_SELF_HOSTED_ADMIN_KEY, localEnv.CONVEX_SELF_HOSTED_URL);
}
