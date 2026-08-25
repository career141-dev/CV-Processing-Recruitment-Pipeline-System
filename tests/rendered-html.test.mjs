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
  assert.match(html, /Realtime OpenAI voice/);
  assert.doesNotMatch(html, /OPENAI_API_KEY/);
});

test("uses one secure Realtime voice session with accurate transcription and barge-in", async () => {
  const [page, realtimeRoute, config] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/realtime/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/agent-config.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /new RTCPeerConnection/);
  assert.match(page, /createDataChannel\("oai-events"\)/);
  assert.match(page, /\/api\/realtime/);
  assert.match(page, /input_audio_buffer\.speech_started/);
  assert.match(page, /conversation\.item\.input_audio_transcription\.completed/);
  assert.match(page, /response\.output_audio_transcript\.delta/);
  assert.match(page, /output_audio_buffer\.clear/);
  assert.match(page, /noiseSuppression: true/);
  assert.doesNotMatch(page, /SpeechRecognition|speechSynthesis|MediaRecorder|AudioContext/);
  assert.doesNotMatch(page, /OPENAI_API_KEY/);
  assert.match(realtimeRoute, /process\.env\.OPENAI_API_KEY/);
  assert.match(realtimeRoute, /gpt-realtime-2\.1-mini/);
  assert.match(realtimeRoute, /v1\/realtime\/calls/);
  assert.match(realtimeRoute, /voice: "marin"/);
  assert.match(realtimeRoute, /gpt-4o-transcribe/);
  assert.match(realtimeRoute, /type: "semantic_vad"/);
  assert.match(realtimeRoute, /eagerness: "high"/);
  assert.match(realtimeRoute, /interrupt_response: true/);
  assert.match(config, /Sound like a good recruiter on a real call/);
  assert.match(config, /Keep one steady vocal character throughout the call/);
  assert.match(config, /usually under 35 words/);
  assert.doesNotMatch(`${page}\n${realtimeRoute}\n${config}`, /Sinhala|Tamil|Sri Lankan|pronunciation guide/i);
});
