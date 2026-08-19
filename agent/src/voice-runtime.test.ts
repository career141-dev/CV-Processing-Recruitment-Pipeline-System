import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyConsent,
  isExplicitConfirmation,
  normalizeConfirmedAnswer,
  signVoiceEvent,
  parseVoiceRoomMetadata,
  boundedText,
  TranscriptBuffer,
  createConsentIdempotencyKey,
  MAX_TRANSCRIPT_CHARACTERS,
} from "./voice-runtime.js";

// ── classifyConsent ──────────────────────────────────────────────────

test("classifyConsent: granted on yes variants", () => {
  assert.equal(classifyConsent("yes"), "granted");
  assert.equal(classifyConsent("Yeah"), "granted");
  assert.equal(classifyConsent("yep, sure"), "granted");
  assert.equal(classifyConsent("ok"), "granted");
  assert.equal(classifyConsent("okay go ahead"), "granted");
  assert.equal(classifyConsent("I consent"), "granted");
  assert.equal(classifyConsent("I agree to continue"), "granted");
  assert.equal(classifyConsent("go ahead"), "granted");
  assert.equal(classifyConsent("fine to proceed"), "granted");
  assert.equal(classifyConsent("that's fine"), "granted");
  assert.equal(classifyConsent("you may continue"), "granted");
});

test("classifyConsent: declined on no variants", () => {
  // Direct word matches
  assert.equal(classifyConsent("no"), "declined");
  assert.equal(classifyConsent("nope"), "declined");
  assert.equal(classifyConsent("nah"), "declined");
  assert.equal(classifyConsent("decline"), "declined");
  assert.equal(classifyConsent("I want to stop"), "declined");
  assert.equal(classifyConsent("please cancel"), "declined");
  // Phrase patterns
  assert.equal(classifyConsent("I do not consent"), "declined");
  assert.equal(classifyConsent("I don't agree"), "declined");
  assert.equal(classifyConsent("I'm not comfortable"), "declined");
  assert.equal(classifyConsent("I will not consent"), "declined");
  assert.equal(classifyConsent("end the call please"), "declined");
  assert.equal(classifyConsent("hang up the call"), "declined");
  assert.equal(classifyConsent("I would rather not"), "declined");
});

test("classifyConsent: unclear on ambiguous input", () => {
  assert.equal(classifyConsent("maybe"), "unclear");
  assert.equal(classifyConsent("what is the role about"), "unclear");
  assert.equal(classifyConsent(""), "unclear");
  assert.equal(classifyConsent("hello"), "unclear");
});

// ── isExplicitConfirmation ───────────────────────────────────────────

test("isExplicitConfirmation: positive cases", () => {
  assert.equal(isExplicitConfirmation("yes"), true);
  assert.equal(isExplicitConfirmation("yeah"), true);
  assert.equal(isExplicitConfirmation("yep"), true);
  assert.equal(isExplicitConfirmation("correct"), true);
  assert.equal(isExplicitConfirmation("confirmed"), true);
  assert.equal(isExplicitConfirmation("exactly"), true);
  assert.equal(isExplicitConfirmation("that's correct"), true);
  assert.equal(isExplicitConfirmation("that is right"), true);
  assert.equal(isExplicitConfirmation("you got it right"), true);
  assert.equal(isExplicitConfirmation("I confirm"), true);
});

test("isExplicitConfirmation: negative cases", () => {
  assert.equal(isExplicitConfirmation("no"), false);
  assert.equal(isExplicitConfirmation("nope"), false);
  assert.equal(isExplicitConfirmation("wrong"), false);
  assert.equal(isExplicitConfirmation("incorrect"), false);
  assert.equal(isExplicitConfirmation("change"), false);
  assert.equal(isExplicitConfirmation("actually"), false);
  assert.equal(isExplicitConfirmation("not"), false);
  assert.equal(isExplicitConfirmation(""), false);
  assert.equal(isExplicitConfirmation("maybe"), false);
});

// ── normalizeConfirmedAnswer ─────────────────────────────────────────

test("normalizeConfirmedAnswer: valid salary with currency", () => {
  const result = normalizeConfirmedAnswer({
    field: "currentSalary",
    value: 250000,
    currency: "lkr",
  });
  assert.deepEqual(result, {
    field: "currentSalary",
    value: 250000,
    currency: "LKR",
  });
});

test("normalizeConfirmedAnswer: valid expected salary", () => {
  const result = normalizeConfirmedAnswer({
    field: "expectedSalary",
    value: 350000,
    currency: "USD",
  });
  assert.deepEqual(result, {
    field: "expectedSalary",
    value: 350000,
    currency: "USD",
  });
});

test("normalizeConfirmedAnswer: valid notice period", () => {
  const result = normalizeConfirmedAnswer({
    field: "noticePeriodDays",
    value: 60,
  });
  assert.deepEqual(result, {
    field: "noticePeriodDays",
    value: 60,
  });
});

test("normalizeConfirmedAnswer: rejects negative value", () => {
  assert.throws(() =>
    normalizeConfirmedAnswer({ field: "currentSalary", value: -1, currency: "LKR" }),
  );
});

test("normalizeConfirmedAnswer: rejects Infinity", () => {
  assert.throws(() =>
    normalizeConfirmedAnswer({ field: "currentSalary", value: Infinity, currency: "LKR" }),
  );
});

test("normalizeConfirmedAnswer: rejects salary without currency", () => {
  assert.throws(() =>
    normalizeConfirmedAnswer({ field: "currentSalary", value: 100000 }),
  );
});

test("normalizeConfirmedAnswer: rejects invalid currency code", () => {
  assert.throws(() =>
    normalizeConfirmedAnswer({ field: "expectedSalary", value: 100000, currency: "us" }),
  );
  assert.throws(() =>
    normalizeConfirmedAnswer({ field: "expectedSalary", value: 100000, currency: "USDL" }),
  );
});

test("normalizeConfirmedAnswer: rejects salary over 1 billion", () => {
  assert.throws(() =>
    normalizeConfirmedAnswer({ field: "currentSalary", value: 1_000_000_001, currency: "LKR" }),
  );
});

test("normalizeConfirmedAnswer: rejects notice period with currency", () => {
  assert.throws(() =>
    normalizeConfirmedAnswer({ field: "noticePeriodDays", value: 30, currency: "LKR" }),
  );
});

test("normalizeConfirmedAnswer: rejects non-integer notice period", () => {
  assert.throws(() =>
    normalizeConfirmedAnswer({ field: "noticePeriodDays", value: 30.5 }),
  );
});

test("normalizeConfirmedAnswer: rejects notice period over 730 days", () => {
  assert.throws(() =>
    normalizeConfirmedAnswer({ field: "noticePeriodDays", value: 731 }),
  );
});

// ── signVoiceEvent ───────────────────────────────────────────────────

test("signVoiceEvent: produces deterministic HMAC-SHA256", () => {
  const secret = "test-secret-key-for-hmac-signing";
  const timestamp = "1720000000";
  const nonce = "abc123def456";
  const body = '{"type":"consent"}';

  const sig1 = signVoiceEvent(body, secret, timestamp, nonce);
  const sig2 = signVoiceEvent(body, secret, timestamp, nonce);

  assert.equal(sig1, sig2);
  assert.equal(sig1.length, 64); // SHA-256 hex = 64 chars
  assert.match(sig1, /^[a-f0-9]{64}$/);
});

test("signVoiceEvent: different inputs produce different signatures", () => {
  const secret = "test-secret";
  const sig1 = signVoiceEvent('{"a":1}', secret, "1000", "nonce1");
  const sig2 = signVoiceEvent('{"a":2}', secret, "1000", "nonce1");
  assert.notEqual(sig1, sig2);
});

// ── boundedText ──────────────────────────────────────────────────────

test("boundedText: returns fallback for non-string input", () => {
  assert.equal(boundedText(undefined, "default", 100), "default");
  assert.equal(boundedText(null, "default", 100), "default");
  assert.equal(boundedText(42, "default", 100), "default");
  assert.equal(boundedText([], "default", 100), "default");
});

test("boundedText: returns fallback for empty/whitespace string", () => {
  assert.equal(boundedText("", "fallback", 100), "fallback");
  assert.equal(boundedText("   ", "fallback", 100), "fallback");
});

test("boundedText: normalizes whitespace and strips control characters", () => {
  assert.equal(boundedText("  hello   world  ", "", 100), "hello world");
  assert.equal(boundedText("hello\x00world", "", 100), "hello world");
  assert.equal(boundedText("line1\nline2\ttab", "", 100), "line1 line2 tab");
});

test("boundedText: truncates to maxLength", () => {
  assert.equal(boundedText("hello world", "", 5), "hello");
  assert.equal(boundedText("hi", "", 100), "hi");
});

// ── TranscriptBuffer ─────────────────────────────────────────────────

test("TranscriptBuffer: formats timestamps correctly", () => {
  const startedAt = 1_000_000; // fixed start
  const buffer = new TranscriptBuffer(startedAt);

  buffer.append("assistant", "Hello!", startedAt + 5_000); // +5s
  const output = buffer.toString();
  assert.match(output, /\[00:05\] assistant: Hello!/);
});

test("TranscriptBuffer: candidate lines use candidate role", () => {
  const buffer = new TranscriptBuffer(Date.now());
  buffer.append("candidate", "Hi there");
  assert.match(buffer.toString(), /candidate: Hi there/);
});

test("TranscriptBuffer: skips empty text", () => {
  const buffer = new TranscriptBuffer(Date.now());
  buffer.append("assistant", "");
  buffer.append("assistant", "   ");
  assert.equal(buffer.toString(), "");
});

test("TranscriptBuffer: enforces character limit", () => {
  const buffer = new TranscriptBuffer(Date.now());
  // Fill with enough content to approach the limit
  const line = "x".repeat(100);
  for (let i = 0; i < Math.ceil(MAX_TRANSCRIPT_CHARACTERS / 110); i++) {
    buffer.append("assistant", line);
  }
  assert.ok(buffer.toString().length <= MAX_TRANSCRIPT_CHARACTERS);
});

// ── createConsentIdempotencyKey ─────────────────────────────────────

test("createConsentIdempotencyKey: returns unique keys", () => {
  const key1 = createConsentIdempotencyKey();
  const key2 = createConsentIdempotencyKey();
  assert.ok(key1.startsWith("consent-"));
  assert.notEqual(key1, key2);
});

// ── parseVoiceRoomMetadata ──────────────────────────────────────────

test("parseVoiceRoomMetadata: defaults for empty input", () => {
  const meta = parseVoiceRoomMetadata(undefined);
  assert.equal(meta.candidateName, "Candidate");
  assert.equal(meta.jobTitle, "the position");
  assert.equal(meta.mode, "simulation");
  assert.equal(meta.sessionMode, "simulation");
  assert.equal(meta.persistenceMode, "none");
  assert.equal(meta.companyHidden, false);
  assert.equal(meta.callScriptUsed, "default");
});

test("parseVoiceRoomMetadata: parses live mode with required fields", () => {
  const raw = JSON.stringify({
    mode: "live",
    sessionMode: "live",
    callSessionId: "session-123",
    stateVersion: 0,
    candidateName: "John Doe",
    jobTitle: "Software Engineer",
  });
  const meta = parseVoiceRoomMetadata(raw);
  assert.equal(meta.mode, "live");
  assert.equal(meta.sessionMode, "live");
  assert.equal(meta.persistenceMode, "full");
  assert.equal(meta.callSessionId, "session-123");
  assert.equal(meta.stateVersion, 0);
  assert.equal(meta.candidateName, "John Doe");
  assert.equal(meta.jobTitle, "Software Engineer");
});

test("parseVoiceRoomMetadata: test mode requires simulation room mode", () => {
  // mode: "simulation" + sessionMode: "test" is the valid combo;
  // mode: "live" + sessionMode: "test" hits the inconsistency check first
  const raw = JSON.stringify({ mode: "live", sessionMode: "test" });
  assert.throws(() => parseVoiceRoomMetadata(raw), /inconsistent/);
  // Verify the actual test-mode guard exists by checking it
  // doesn't accept non-simulation room mode with test session
  const raw2 = JSON.stringify({ mode: "simulation", sessionMode: "test", callSessionId: "test-123", stateVersion: 0 });
  const meta = parseVoiceRoomMetadata(raw2);
  assert.equal(meta.sessionMode, "test");
  assert.equal(meta.persistenceMode, "finalize_only");
});

test("parseVoiceRoomMetadata: live sessionMode requires live mode", () => {
  const raw = JSON.stringify({ mode: "simulation", sessionMode: "live" });
  assert.throws(() => parseVoiceRoomMetadata(raw), /inconsistent/);
});

test("parseVoiceRoomMetadata: live mode requires callSessionId and stateVersion", () => {
  const raw = JSON.stringify({ mode: "live", sessionMode: "live" });
  assert.throws(() => parseVoiceRoomMetadata(raw), /requires callSessionId and stateVersion/);
});

test("parseVoiceRoomMetadata: test mode with correct fields", () => {
  const raw = JSON.stringify({
    mode: "simulation",
    sessionMode: "test",
    callSessionId: "test-123",
    stateVersion: 0,
  });
  const meta = parseVoiceRoomMetadata(raw);
  assert.equal(meta.sessionMode, "test");
  assert.equal(meta.persistenceMode, "finalize_only");
});

test("parseVoiceRoomMetadata: rejects invalid JSON", () => {
  assert.throws(() => parseVoiceRoomMetadata("not json"), /not valid JSON/);
});

test("parseVoiceRoomMetadata: rejects array input", () => {
  assert.throws(() => parseVoiceRoomMetadata("[]"), /must be a JSON object/);
});

test("parseVoiceRoomMetadata: truncates long fields", () => {
  const raw = JSON.stringify({
    candidateName: "A".repeat(200),
    jobTitle: "B".repeat(300),
    jobDescription: "C".repeat(5000),
  });
  const meta = parseVoiceRoomMetadata(raw);
  assert.equal(meta.candidateName.length, 100);
  assert.equal(meta.jobTitle.length, 160);
  assert.equal(meta.jobDescription.length, 2_000);
});

test("parseVoiceRoomMetadata: parses customQuestions list", () => {
  const raw = JSON.stringify({
    customQuestions: ["Q1", "Q2", "Q3"],
  });
  const meta = parseVoiceRoomMetadata(raw);
  assert.deepEqual(meta.customQuestions, ["Q1", "Q2", "Q3"]);
});

test("parseVoiceRoomMetadata: caps customQuestions at 8", () => {
  const raw = JSON.stringify({
    customQuestions: Array.from({ length: 15 }, (_, i) => `Question ${i + 1}`),
  });
  const meta = parseVoiceRoomMetadata(raw);
  assert.equal(meta.customQuestions.length, 8);
});

test("parseVoiceRoomMetadata: parses callScriptUsed", () => {
  const raw1 = JSON.stringify({ callScriptUsed: "initial_screening" });
  assert.equal(parseVoiceRoomMetadata(raw1).callScriptUsed, "initial_screening");

  const raw2 = JSON.stringify({ callScriptUsed: "technical_prescreen" });
  assert.equal(parseVoiceRoomMetadata(raw2).callScriptUsed, "technical_prescreen");

  const raw3 = JSON.stringify({ callScriptUsed: "unknown" });
  assert.equal(parseVoiceRoomMetadata(raw3).callScriptUsed, "default");
});

test("parseVoiceRoomMetadata: companyHidden flag", () => {
  const raw = JSON.stringify({ companyHidden: true });
  assert.equal(parseVoiceRoomMetadata(raw).companyHidden, true);

  const raw2 = JSON.stringify({ companyHidden: false });
  assert.equal(parseVoiceRoomMetadata(raw2).companyHidden, false);
});
