import { createHmac, randomUUID } from "node:crypto";

export const MAX_TRANSCRIPT_CHARACTERS = 50_000;
const VOICE_EVENT_TIMEOUT_MS = 2_000;

export type SessionMode = "live" | "test" | "simulation";
export type PersistenceMode = "full" | "finalize_only" | "none";
export type CallScriptUsed = "default" | "initial_screening" | "technical_prescreen";
export type ConsentDecision = "granted" | "declined" | "unclear";
export type FinalStatus = "completed" | "failed" | "cancelled";
export type ConfirmedAnswerField =
  | "currentSalary"
  | "expectedSalary"
  | "noticePeriodDays";

export type VoiceRoomMetadata = Readonly<{
  candidateName: string;
  jobTitle: string;
  jobDescription: string;
  customScript: string;
  customQuestions: string[];
  mode: "live" | "simulation";
  sessionMode: SessionMode;
  persistenceMode: PersistenceMode;
  callSessionId?: string;
  stateVersion?: number;
  companyHidden: boolean;
  callScriptUsed: CallScriptUsed;
}>;

export type ConsentEvent = Readonly<{
  type: "consent";
  callSessionId: string;
  decision: "granted" | "declined";
  idempotencyKey: string;
  expectedStateVersion: number;
}>;

export type ConfirmedAnswerEvent = Readonly<{
  type: "confirmed_answer";
  callSessionId: string;
  turnId: string;
  field: ConfirmedAnswerField;
  value: number;
  currency?: string;
  expectedStateVersion: number;
}>;

export type FinalizeEvent = Readonly<{
  type: "finalize";
  callSessionId: string;
  expectedStateVersion: number;
  status: FinalStatus;
  durationSeconds: number;
  transcript: string;
}>;

export type VoiceAgentEvent = ConsentEvent | ConfirmedAnswerEvent | FinalizeEvent;

export type VoiceEventResponse = Readonly<{
  success: true;
  stateVersion: number;
}>;

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Room metadata must be a JSON object");
  }
  return value as Record<string, unknown>;
}

export function boundedText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function boundedTextList(value: unknown, maxItems: number, maxItemLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => boundedText(item, "", maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function optionalBoundedIdentifier(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`${name} must contain 1-200 safe characters`);
  }
  return normalized;
}

function optionalStateVersion(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("stateVersion must be a non-negative integer");
  }
  return value;
}

export function parseVoiceRoomMetadata(rawMetadata: string | undefined): VoiceRoomMetadata {
  let value: unknown = {};
  if (rawMetadata?.trim()) {
    try {
      value = JSON.parse(rawMetadata);
    } catch {
      throw new Error("Room metadata is not valid JSON");
    }
  }
  const metadata = objectRecord(value);

  const mode: "live" | "simulation" = metadata.mode === "live" ? "live" : "simulation";
  let sessionMode: SessionMode;
  if (metadata.sessionMode === "live" || metadata.sessionMode === "test") {
    sessionMode = metadata.sessionMode;
  } else if (metadata.sessionMode === "simulation" || metadata.sessionMode === undefined) {
    sessionMode = mode === "live" ? "live" : "simulation";
  } else {
    throw new Error("Unsupported sessionMode in room metadata");
  }

  if ((mode === "live") !== (sessionMode === "live")) {
    throw new Error("Room mode and sessionMode are inconsistent");
  }
  if (sessionMode === "test" && mode !== "simulation") {
    throw new Error("Test sessions must use simulation room mode");
  }

  const persistenceMode: PersistenceMode =
    sessionMode === "live" ? "full" : sessionMode === "test" ? "finalize_only" : "none";
  const callSessionId = optionalBoundedIdentifier(metadata.callSessionId, "callSessionId");
  const stateVersion = optionalStateVersion(metadata.stateVersion);

  if (persistenceMode !== "none" && (!callSessionId || stateVersion === undefined)) {
    throw new Error(`${sessionMode} room metadata requires callSessionId and stateVersion`);
  }

  const rawCallScript = metadata.callScriptUsed;
  const callScriptUsed: CallScriptUsed =
    rawCallScript === "initial_screening" || rawCallScript === "technical_prescreen"
      ? rawCallScript
      : "default";

  return Object.freeze({
    candidateName: boundedText(metadata.candidateName, "Candidate", 100),
    jobTitle: boundedText(metadata.jobTitle, "the position", 160),
    jobDescription: boundedText(metadata.jobDescription, "", 2_000),
    customScript: boundedText(metadata.customScript, "", 1_200),
    customQuestions: boundedTextList(metadata.customQuestions, 8, 300),
    mode,
    sessionMode,
    persistenceMode,
    callSessionId,
    stateVersion,
    companyHidden: metadata.companyHidden === true,
    callScriptUsed,
  });
}

function normalizedIntentText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyConsent(text: string): ConsentDecision {
  const normalized = normalizedIntentText(text);
  if (!normalized) return "unclear";

  const declined = [
    /\b(?:no|nope|nah|decline|stop|cancel)\b/,
    /\bdo not\b/,
    /\bdon't\b/,
    /\bnot comfortable\b/,
    /\bnot consent\b/,
    /\b(?:end|hang up) (?:the )?call\b/,
    /\b(?:would|rather) not\b/,
  ].some((pattern) => pattern.test(normalized));
  if (declined) return "declined";

  const granted = [
    /^(?:yes|yeah|yep|sure|ok|okay)(?:\s|$)/,
    /\bi (?:consent|agree)\b/,
    /\bgo ahead\b/,
    /\b(?:happy|fine|comfortable) to (?:continue|proceed)\b/,
    /\bthat(?:'s| is) fine\b/,
    /\byou may (?:continue|proceed)\b/,
  ].some((pattern) => pattern.test(normalized));
  return granted ? "granted" : "unclear";
}

export function isExplicitConfirmation(text: string): boolean {
  const normalized = normalizedIntentText(text);
  if (!normalized) return false;
  if (/\b(?:no|nope|wrong|incorrect|change|actually|not)\b/.test(normalized)) return false;
  return [
    /^(?:yes|yeah|yep|correct|confirmed|exactly)(?:\s|$)/,
    /\bthat(?:'s| is) (?:correct|right|accurate)\b/,
    /\byou (?:got|have) it right\b/,
    /\bi confirm\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function normalizeConfirmedAnswer(input: {
  field: ConfirmedAnswerField;
  value: number;
  currency?: string;
}): { field: ConfirmedAnswerField; value: number; currency?: string } {
  if (!Number.isFinite(input.value) || input.value < 0) {
    throw new Error("Answer value must be a non-negative finite number");
  }
  if (input.field === "noticePeriodDays") {
    if (!Number.isInteger(input.value) || input.value > 730 || input.currency !== undefined) {
      throw new Error("Notice period must be an integer from 0 to 730 days without currency");
    }
    return { field: input.field, value: input.value };
  }

  if (input.value > 1_000_000_000) {
    throw new Error("Salary value exceeds the supported range");
  }
  const currency = input.currency?.trim().toUpperCase();
  if (!currency || !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Salary answers require a three-letter currency code");
  }
  return { field: input.field, value: input.value, currency };
}

export function signVoiceEvent(
  rawBody: string,
  secret: string,
  timestamp: string,
  nonce: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${rawBody}`, "utf8")
    .digest("hex");
}

export class VoiceEventClient {
  constructor(
    private readonly url: string,
    private readonly secret: string,
    private readonly timeoutMs = VOICE_EVENT_TIMEOUT_MS,
  ) {}

  async post(event: VoiceAgentEvent): Promise<VoiceEventResponse> {
    const rawBody = JSON.stringify(event);
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const nonce = randomUUID();
    const signature = signVoiceEvent(rawBody, this.secret, timestamp, nonce);

    let response: Response;
    try {
      response = await fetch(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-career141-timestamp": timestamp,
          "x-career141-nonce": nonce,
          "x-career141-signature": signature,
        },
        body: rawBody,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new Error("Voice event request failed", { cause: error });
    }

    if (!response.ok) {
      throw new Error(`Voice event endpoint rejected the request with status ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error("Voice event endpoint returned invalid JSON", { cause: error });
    }
    const result = objectRecord(payload);
    if (
      result.success !== true ||
      typeof result.stateVersion !== "number" ||
      !Number.isSafeInteger(result.stateVersion) ||
      result.stateVersion < 0
    ) {
      throw new Error("Voice event endpoint returned an invalid acknowledgement");
    }
    return { success: true, stateVersion: result.stateVersion };
  }
}

export class TranscriptBuffer {
  private value = "";

  constructor(private readonly startedAt: number) {}

  append(role: "assistant" | "candidate", text: string, occurredAt = Date.now()): void {
    const normalized = boundedText(text, "", 2_000);
    if (!normalized || this.value.length >= MAX_TRANSCRIPT_CHARACTERS) return;
    const elapsedSeconds = Math.max(0, Math.floor((occurredAt - this.startedAt) / 1_000));
    const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
    const seconds = String(elapsedSeconds % 60).padStart(2, "0");
    const line = `[${minutes}:${seconds}] ${role}: ${normalized}\n`;
    const remaining = MAX_TRANSCRIPT_CHARACTERS - this.value.length;
    this.value += line.slice(0, remaining);
  }

  toString(): string {
    return this.value;
  }
}

export function createConsentIdempotencyKey(): string {
  return `consent-${randomUUID()}`;
}

