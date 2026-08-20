import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Aura voice-agent experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Aura — Candidate screening rehearsal<\/title>/i);
  assert.match(html, /Give Aura the brief/);
  assert.match(html, /Start practice screening/);
  assert.match(html, /Natural OpenAI voice/);
  assert.doesNotMatch(html, /OPENAI_API_KEY/);
});

test("streams natural speech while keeping the API key server-side", async () => {
  const [page, route, speechRoute, transcriptionRoute, config] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/respond/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/speak/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/transcribe/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/agent-config.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /recognition\.continuous = true/);
  assert.match(page, /window\.speechSynthesis\.speak/);
  assert.match(page, /FINAL_END_OF_TURN_DELAY_MS = 360/);
  assert.match(page, /INTERIM_END_OF_TURN_DELAY_MS = 600/);
  assert.match(page, /LOW_CONFIDENCE_THRESHOLD = 0\.78/);
  assert.match(page, /recognition\.maxAlternatives = 3/);
  assert.match(page, /transcriptNeedsAccuracyRef/);
  assert.match(page, /selectNaturalVoice/);
  assert.match(page, /new AudioContext/);
  assert.match(page, /speechResponse\.body\.getReader/);
  assert.match(page, /noiseSuppression: true/);
  assert.match(page, /new MediaRecorder/);
  assert.match(page, /\/api\/transcribe/);
  assert.match(page, /response\.output_text\.delta/);
  assert.doesNotMatch(page, /OPENAI_API_KEY/);
  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.match(route, /stream: true/);
  assert.match(speechRoute, /gpt-4o-mini-tts/);
  assert.match(speechRoute, /voice: "marin"/);
  assert.match(speechRoute, /response_format: "pcm"/);
  assert.match(speechRoute, /smooth, connected phrasing/);
  assert.doesNotMatch(speechRoute, /brief pauses/);
  assert.match(transcriptionRoute, /gpt-4o-mini-transcribe/);
  assert.match(transcriptionRoute, /v1\/audio\/transcriptions/);
  assert.match(config, /gpt-5\.6-luna/);
  assert.match(route, /reasoning: \{ effort: "none" \}/);
  assert.match(route, /text: \{ verbosity: "low" \}/);
  assert.match(config, /Sound like a good recruiter on a real call/);
  assert.match(config, /usually under 35 words/);
  assert.doesNotMatch(`${page}\n${route}\n${speechRoute}\n${transcriptionRoute}\n${config}`, /Sinhala|Tamil|Sri Lankan|pronunciation guide/i);
});
