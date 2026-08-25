#!/usr/bin/env node
/**
 * Stability invariant guard.
 *
 * Production entered a multi-day crash loop because commit dab19e7 ("feat: add
 * candidate management service and update docker configuration") silently
 * reverted three backend stability settings, and because ten cron jobs shared
 * the same intervals and therefore fired on the same tick forever.
 *
 * Nothing in review or in the deploy pipeline caught either problem. This script
 * does. It runs on pull requests and as the first step of the production deploy,
 * so a commit that reintroduces a known-fatal setting fails before it can reach
 * the VPS.
 *
 * Run locally with:  node scripts/check-stability-invariants.mjs
 * Exits 0 when every invariant holds, 1 otherwise.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(repoRoot, rel), "utf8");

const failures = [];
const fail = (invariant, detail) => failures.push({ invariant, detail });

// ── docker-compose.yml: the three settings dab19e7 reverted ──────────────────
{
  const compose = read("docker-compose.yml");

  // Isolate the backend service so a limit on dashboard/qdrant/livekit can't
  // satisfy a check meant for the Convex backend.
  const backend = compose
    .split(/\n {2}(?=[a-z][a-z0-9_-]*:)/)
    .find((block) => block.trimStart().startsWith("backend:"));

  if (!backend) {
    fail("compose/backend-service", "could not locate the `backend:` service block in docker-compose.yml");
  } else {
    const retention = backend.match(/DOCUMENT_RETENTION_DELAY=\$\{DOCUMENT_RETENTION_DELAY:-(\d+)\}/);
    if (!retention) {
      fail("compose/retention-delay", "DOCUMENT_RETENTION_DELAY default not found on the backend service");
    } else if (Number(retention[1]) < 172800) {
      fail(
        "compose/retention-delay",
        `DOCUMENT_RETENTION_DELAY is ${retention[1]}s, must be >= 172800s (48h). ` +
          `Aggressive retention GC churns the multi-GB SQLite database and holds the write lock long enough to stall the backend.`,
      );
    }

    const mem = backend.match(/^\s*mem_limit:\s*([\d.]+)g\s*$/m);
    if (!mem) {
      fail("compose/mem-limit", "backend mem_limit not found, or not expressed in gigabytes");
    } else if (Number(mem[1]) < 8.5) {
      fail(
        "compose/mem-limit",
        `backend mem_limit is ${mem[1]}g, must be >= 8.5g. Sized in 9dd1f80 for the 11GB VPS.`,
      );
    }

    const startPeriod = backend.match(/^\s*start_period:\s*(\d+)(s|m)\s*$/m);
    if (!startPeriod) {
      fail("compose/start-period", "backend healthcheck start_period not found");
    } else {
      const seconds = Number(startPeriod[1]) * (startPeriod[2] === "m" ? 60 : 1);
      if (seconds < 300) {
        fail(
          "compose/start-period",
          `healthcheck start_period is ${startPeriod[1]}${startPeriod[2]}, must be >= 5m. ` +
            `Index bootstrap on this database exceeds 150s, so a shorter window marks the container unhealthy mid-bootstrap and times out the deploy readiness gate.`,
        );
      }
    }

    for (const knob of ["NODE_ACTIONS", "V8_ACTIONS"]) {
      const key = `APPLICATION_MAX_CONCURRENT_${knob}`;
      const cap = backend.match(new RegExp(`${key}=\\$\\{${key}:-(\\d+)\\}`));
      if (!cap) {
        fail(`compose/${knob.toLowerCase()}-cap`, `${key} default not found on the backend service`);
      } else if (Number(cap[1]) > 6) {
        fail(
          `compose/${knob.toLowerCase()}-cap`,
          `${key} is ${cap[1]}, must be <= 6. Higher caps let heavy actions stampede the backend.`,
        );
      }
    }
  }
}

// ── crons.ts: no two recurring jobs may share an interval ────────────────────
// crons.interval anchors every job to the same deploy timestamp, so jobs sharing
// an interval collide on the same tick for the lifetime of the deployment.
{
  const crons = read("convex/crons.ts");
  const byInterval = new Map();

  for (const [, name, minutes] of crons.matchAll(
    /crons\.interval\(\s*"([^"]+)"\s*,\s*\{\s*minutes:\s*(\d+)\s*\}/g,
  )) {
    if (!byInterval.has(minutes)) byInterval.set(minutes, []);
    byInterval.get(minutes).push(name);
  }

  if (byInterval.size === 0) {
    fail("crons/parse", "no crons.interval(...) declarations found in convex/crons.ts");
  }

  for (const [minutes, names] of byInterval) {
    if (names.length > 1) {
      fail(
        "crons/interval-collision",
        `${names.length} cron jobs share a ${minutes}-minute interval and will fire on the same tick forever: ${names.join(", ")}. ` +
          `Give each recurring job a distinct interval (primes work best).`,
      );
    }
  }
}

// ── candidates.ts: the dashboard query must stay bounded ─────────────────────
// An unbounded read here scans the whole candidates table and trips Convex's
// ~16,384 operations-per-query limit: "Your request timed out performing too
// many system operations."
{
  const source = read("convex/candidates/candidates.ts");
  const start = source.indexOf("export const listCandidatesPaginated");

  if (start === -1) {
    fail("candidates/paginated-query", "listCandidatesPaginated not found in convex/candidates/candidates.ts");
  } else {
    const next = source.indexOf("\nexport const ", start + 1);
    const body = source.slice(start, next === -1 ? source.length : next);

    if (!body.includes(".paginate(")) {
      fail(
        "candidates/paginated-query",
        "listCandidatesPaginated no longer calls .paginate(). It must page the candidates table, never read it whole.",
      );
    }
    if (body.includes(".collect()")) {
      fail(
        "candidates/paginated-query",
        "listCandidatesPaginated contains .collect(), which reads every matching row. " +
          "On a six-figure candidates table this trips the Convex per-query operation limit and takes the dashboard down.",
      );
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\nStability guard FAILED with ${failures.length} violation(s):\n`);
  for (const { invariant, detail } of failures) {
    console.error(`  [${invariant}]`);
    console.error(`    ${detail}\n`);
  }
  console.error("These settings were reverted once already and caused a multi-day production outage.");
  console.error("If a change here is genuinely intended, update this guard in the same commit and explain why.\n");
  process.exit(1);
}

console.log("Stability guard passed: compose limits, cron intervals and dashboard query bounds all hold.");
