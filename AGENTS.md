# Career141 — Engineering Rules for Antigravity

These rules govern how changes get proposed, verified, and shipped on the Career141 platform (self-hosted Convex on Contabo VPS + Cloudflare R2). They exist because past submissions have shipped unauthorized model/vendor swaps, unverified throughput numbers, and "resolved" claims with no evidence behind them. Every rule below closes a specific failure mode that has already happened once. Treat this file as binding, not advisory.

---

<!-- BEGIN:nextjs-agent-rules -->
## 0. Stack version warning

This project may run a Next.js version with breaking changes relative to your training data — APIs, conventions, and file structure can differ. Before writing any code that touches routing, data fetching, server actions, or config, **read the relevant guide in `node_modules/next/dist/docs/`** and heed deprecation notices. Do not assume a pattern from memory is still correct — verify against the installed version's docs first.

The same principle applies beyond Next.js: before touching Convex, OpenRouter, or any third-party SDK integration, confirm current method signatures and rate-limit behavior against the actual installed package/API docs, not assumption.
<!-- END:nextjs-agent-rules -->

---

## 1. Explain First, Then Implement (mandatory)

When an issue, error, or unexpected behavior arises:

1. **Do not** make unrequested changes, apply silent fallbacks, or alter business configuration without explicit review.
2. Always produce, before writing code:
   - **What the exact issue is** — precise symptom, not a summary.
   - **Why it happened** — root cause, traced to an actual line/query/config, not a guess.
   - **What needs to be done** — the proposed fix, stated as a diff of behavior, plus alternatives considered.
3. Send that explanation to Binath for sign-off. Code follows approval, not the other way around.

This applies to bug fixes, performance changes, and anything framed as "just a small adjustment while I was in there."

## 2. Strict Adherence to Approved Configuration

- Never introduce a secondary fallback (alternate phone number, alternate route, alternate model provider, alternate API key pool, etc.) that deviates from the approved primary setup, even temporarily, even for testing.
- **Any model or vendor not already in the confirmed LLM/comms architecture requires explicit written sign-off before it touches code** — this includes reintroducing previously-rejected options (e.g. Twilio, Cartesia, Gemini, multi-key round-robin schemes, Llama 3.1 70B as a primary extractor). "It's just for a quick test" is not sign-off.
- If the approved config can't do what's needed, that's an escalation (see §1), not a reason to route around it silently.

## 3. Evidence Standard — No Narrative "Resolved" Claims

A fix, migration, or optimization is not "done" until it ships with:

- The **actual query/log text** run against real data — not a description of what the query would show.
- **Real numeric output** — counts, timings, before/after values — not "should now be fixed" or "tested and working."
- For anything time-sensitive (latency, throughput, dedup timing), a genuine **before/after temporal proof** — two real timestamps or two real runs, not a synthetic single snapshot presented as both states.

Reports that describe expected behavior instead of showing observed behavior get sent back, not accepted.

## 4. Rollout & Deployment Discipline

- Concurrency, batch-size, or throughput changes ship in a **graduated ramp** (e.g., 3 → 8 workers), never as a single jump to target scale.
- Each stage requires a checkpoint before proceeding: Convex write-latency check, dedup/race-condition check, and a hard abort threshold where applicable (e.g., TPM ceiling).
- State explicitly, before Stage 1 begins, what happens to in-flight work if an abort threshold fires, and whether rollback (e.g., to 1 worker) is a live toggle or requires redeploy. Unanswered = blocking, not assumed-safe.
- Production changes require the GitHub Actions manual approval gate — no direct-to-prod pushes.

## 5. Search & Matching Logic — No Hard AND-Filters

- Any filter or matching mechanism that applies binary/hard exclusion on a narrow candidate or result pool is treated as a bug, because it reliably produces zero-result outcomes.
- Default to **soft weighted scoring** across search, reverse matching, and any ranking system. If a hard filter is genuinely required (e.g., legal/compliance exclusion), it must be called out explicitly and justified — not introduced as a side effect of a scoring change.

## 6. Data Integrity Rules

- **Merge, never overwrite**, on reverse-match rescans. TA-actioned candidates (including rejected ones) must remain excluded per the existing reject-status filter. A rescan that silently erases previously matched/actioned candidates is a data-loss bug, treated as a P0.
- **Dedup race conditions**: concurrent CV processing for the same candidate requires an identity lock or a Convex-layer uniqueness constraint. "It probably won't collide in practice" is not an acceptable mitigation at 1,000+ CVs/day.

## 7. Compliance

- Multi-account API key schemes to bypass provider rate limits are not permitted, regardless of internal framing ("just load balancing," "separate team member's key," etc.) — this violates OpenRouter ToS and is a hard no.

## 8. Cost & Vendor Claims

- Pricing figures used in any proposal or cost model must come from **written vendor confirmation or an official pricing page** — not a third-party calculator, a sales call summary without paper trail, or a benchmark estimate. If written confirmation isn't in hand yet, the proposal says so explicitly rather than presenting a placeholder as final.

## 9. Scope Discipline

- Email and WhatsApp are **independently owned workstreams** and must be evaluated and built separately unless a document explicitly states otherwise. Do not assume shared database fields, shared timing logic, or shared state between them without it being written down.
- New vendor/model introductions must be caught and flagged before coding begins, not discovered in a diff after the fact.

## 10. Submission Format Back to Binath

Every plan or fix submission should arrive as:

1. **Issue / Goal** — one paragraph.
2. **Root cause or design rationale** — grounded in real evidence per §3.
3. **Proposed change** — explicit diff of behavior, including any new vendor/model touched (flag per §2).
4. **Evidence attached** — real query output, real numbers, before/after where relevant.
5. **Blocking questions** — anything Antigravity needs Binath to answer before coding starts, listed explicitly, not buried in prose.

Submissions missing evidence or blocking-questions sections get sent back for resubmission before review begins — this is not a formality, it's the gate.

---

*This file supersedes any prior informal agreement on process. If a rule here conflicts with a request in a specific brief, the specific brief's explicit sign-off wins — but the sign-off has to be explicit and in writing, not inferred.*