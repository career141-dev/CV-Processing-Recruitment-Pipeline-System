# Career141 — Codebase Memory
Saved 2026-09-14, branch `sanjeev-dev`. Reload this file instead of re-analyzing the repo.

## 1. What this project is
Career141 — AI recruitment automation platform ("Recruiter Desk"). Multi-channel CV ingestion
(WhatsApp/Meta, M365 email, LinkedIn, Workable, manual) → LLM parsing (DeepSeek R1/V3, Claude 3.5
via OpenRouter) → candidate dedup → weighted AI matching (Voyage AI embeddings + Qdrant) →
11-stage pipeline with SLA tracking, AI follow-ups, and AI phone screening.

## 2. Stack
- Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Clerk auth, TanStack Query, Sonner
- Self-hosted Convex (Docker on Contabo VPS): DB + queries/mutations/actions + crons + webhooks
- Cloudflare R2 (S3 SDK) for CV storage; Qdrant vector DB; Voyage AI 1024-dim embeddings
- Voice: LiveKit WebRTC + SIP (Dialog Axiata); standalone `agent/` Node worker
  (@livekit/agents 1.6.4, Deepgram STT → LLM → Cartesia TTS); Redis session store
- Prod: 8 containers behind Caddy (web:3000, convex:3210/3211, convex-dashboard:6791,
  qdrant:6333/6334, livekit:7880/7881, livekit-sip:5060, voice-agent:8081, redis:6379)
- Deploys: GitHub PRs only → .github/workflows/deploy.yml, zero-downtime web swap

## 3. Repo map (~85k lines TS, ~290 files)
- `src/app/dashboard/` — production recruiter UI (jobs, openings, clients, candidates, outreach,
  analytics, cv-scanner, aura-voice-agent, ingestion/token monitors, settings)
- `src/app/new-pages/` — redesigns in progress: `ats/` = static LinkedIn-Recruiter-style pipeline
  prototype (mock-data only, NOT backend-wired); `client/`, `headhunting/` siblings
- `src/app/api/` — 12 route handlers: aura, realtime, respond, speak, transcribe, voice,
  whatsapp, email/send-followup, prepare-jd, r2-file, debug-env, health
- `src/components/` — RouteGuard/AccessGate/ProtectedRoute (RBAC), Sidebar/TopNavbar, domain folders
- `src/hooks/` — useRole.ts, usePermissions.ts, use-debounce, use-mobile
- `convex/` (127 files) — cvs/ (extraction, scoring, uploads, ingestion, healer, lazyParsing),
  matching/ (agent2), communications/ (whatchimp, whatsappAgent, emailAgent, graph*), aiCalls/,
  applications/, pipeline/, jobs/, users/, clients/, openings/, meta/, integrations/, cvScanner/,
  admin/ (qaTests), storage/ (r2), settings/, stats/, templates/
- `convex/schema.ts` (~2,000 lines, 40+ tables) — key tables: users, teams, jobAssignments,
  candidateLocks (dedup), clients, openings, jobs, jobChannels, match_scores, cvUploads,
  candidateResumes (vector 1024), candidates, applications (pipeline), pipelineEvents, aiCalls,
  voiceCallSessions, voiceAnswers, communications, directorReviews, clientReviews, interviews,
  offers, placements, ingestionBatches
- `agent/` — voice worker daemon, own package.json + tests
- `scripts/` — 18 ops scripts (convex-env-run.js env switcher, auto-backup, deploys, migrations)
- `worker/` — VESTIGIAL vinext Cloudflare Worker template; dead code
- `drizzle/` + `db/` — likely legacy (Convex is the real DB); confirm before touching
- Local dev: start-local-dev.bat, `npm run dev` + `npm run dev:local` (or dev:hosted)

## 4. Multi-agent pipeline (core domain)
- Agent 1 ingestion/parsing: webhooks → cvUploads → extraction → candidates; dedup via
  candidateLocks identity locks; stuck-upload recovery + retry fields
- Agent 2 matching: soft weighted scoring (defaults skills 35 / jobTitle 30 / experience 15 /
  industry 15 / location 5), per-dimension gates & penalties (seniorityGate, currentRoleGate,
  roleFamilyMatch), reverse match on publish, minMatchScoreToShow default 60
- Agent 3 follow-ups: WhatsApp/email sequences Day 2/4/7 + custom steps, time windows,
  per-application followUpState, cron sweeps capped (10 apps/stage, 20 AI calls/run)
- Agent 5 AI calls: LiveKit rooms + SIP, IVR, consent, idempotent voiceAnswers with
  state-version optimistic locking, scripts: default/initial_screening/technical_prescreen
- Stages (applications.currentStage order): new_cvs → matched_candidates → ta_shortlist →
  ai_call → follow_up → second_shortlist → director_shortlist → client_review → interview →
  offer → placed (+ rejected, unresponsive)
- Job gates: directorReviewEnabled, clientReviewEnabled, esaCheckEnabled, rejectionLoopAction
- Crons (convex/crons.ts): autopilotEnabled kill-switch, channel_toggles, calling-hours gate
  by phone prefix, batched candidate reads

## 5. RBAC
Roles: admin, ta_manager, senior_ta, recruiter, director, client, viewer + legacy ta/ops +
test_ta. Enforced via useRole.ts + RouteGuard/AccessGate. test_ta hides Ingestion Monitor,
Token Monitor, Settings.

## 6. Engineering rules (AGENTS.md — binding)
1. Explain first (symptom → root cause → proposed diff) before code. 2. No unapproved
vendors/models/fallbacks. 3. Evidence standard: real logs/numbers, before/after. 4. Graduated
rollouts with abort thresholds. 5. No hard AND filters — soft weighted scoring only.
6. Merge never overwrite (reverse-match rescans are P0 if data lost). 7. No multi-account key
schemes (OpenRouter ToS). 8. Pricing claims need vendor docs. 9. Email & WhatsApp are separate
workstreams. 10. Submission format: issue/root-cause/change/evidence/blocking-questions.
11. Never dev/build on prod VPS; feature branches + PRs only.
`.agents/AGENTS.md`: this Next.js is NEWER than training data — read
`node_modules/next/dist/docs/` before touching routing/data fetching/server actions/config.

## 7. WIP snapshot (2026-09-14)
- Branch `sanjeev-dev`; ~52 uncommitted files: new `src/app/new-pages/ats/**` static redesign
  (17 components, mock-data, types) + edits to dashboard clients/openings pages + globals.css
- Recent commits: openings workflow, clients directory LinkedIn-style redesign, UI polish
- `npx tsc --noEmit` passes clean

## 8. Known issues / watchlist
- convex/http.ts Meta webhook accepts hardcoded fallback tokens ("career141-secure-key",
  "whatchimp_secret", "career141") AND passes when token list is empty — security smell
- README.md contains what looks like a real CONVEX_SELF_HOSTED_ADMIN_KEY
- worker/ is dead vinext scaffolding — removal candidate
- Test coverage thin: npm test = cvScoring tests only; agent has voice-runtime.test.ts;
  admin/qaTests run as hosted Convex actions

## 9. Verification playbook
- `npx tsc --noEmit` → 0 errors expected
- `npm run build` → Next.js production build (~29 routes)
- `npm test` → cvScoring tests (tsx --test)
- QA suite (hosted only): node scripts/convex-env-run.js hosted run admin/qaTests:runFullQaSuite
- Local dev: start-local-dev.bat or npm run dev + npm run dev:local
