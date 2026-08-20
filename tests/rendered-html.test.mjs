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
  assert.match(html, /<title>Aura — Hands-free voice agent<\/title>/i);
  assert.match(html, /A conversation/);
  assert.match(html, /Start conversation/);
  assert.match(html, /Automatic turn detection/);
  assert.doesNotMatch(html, /OPENAI_API_KEY/);
});

test("keeps the API key server-side and the interaction hands-free", async () => {
  const [page, route, config] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/respond/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/agent-config.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /recognition\.continuous = true/);
  assert.match(page, /window\.speechSynthesis\.speak/);
  assert.match(page, /END_OF_TURN_DELAY_MS = 720/);
  assert.match(page, /selectNaturalVoice/);
  assert.match(page, /response\.output_text\.delta/);
  assert.doesNotMatch(page, /OPENAI_API_KEY/);
  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.match(route, /stream: true/);
  assert.match(config, /8 to 24 words/);
  assert.match(config, /sound like a real person/);
});
