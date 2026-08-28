import { buildAgentInstructions, type ScreeningContext } from "@/lib/agent-config";

export const runtime = "edge";

const REALTIME_MODEL = "gpt-realtime-2.1-mini";

const isShortText = (value: unknown, maximum: number) => typeof value === "string" && value.length <= maximum;

const isScreeningContext = (value: unknown): value is ScreeningContext => {
  if (!value || typeof value !== "object") return false;
  const context = value as Record<string, unknown>;
  return isShortText(context.candidateName, 120)
    && isShortText(context.companyName, 160)
    && typeof context.companyName === "string"
    && context.companyName.trim().length > 0
    && isShortText(context.jobTitle, 180)
    && typeof context.jobTitle === "string"
    && context.jobTitle.trim().length > 0
    && isShortText(context.jobDescription, 18_000)
    && typeof context.jobDescription === "string"
    && context.jobDescription.trim().length >= 40
    && Array.isArray(context.detailsToCollect)
    && context.detailsToCollect.length >= 1
    && context.detailsToCollect.length <= 12
    && context.detailsToCollect.every((item) => isShortText(item, 300) && item.trim().length > 0);
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "The secure Realtime voice connection is not configured." }, { status: 503 });
  }

  let body: { sdp?: unknown; screening?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The Realtime connection request was not valid." }, { status: 400 });
  }

  if (typeof body.sdp !== "string" || body.sdp.length < 20 || body.sdp.length > 100_000
    || !isScreeningContext(body.screening)) {
    return Response.json({ error: "The Realtime connection request was not valid." }, { status: 400 });
  }

  const screening = body.screening;

  const session = {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
    instructions: buildAgentInstructions(screening),
    max_output_tokens: 800,
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: {
          model: "gpt-4o-transcribe",
          language: "en",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.72,
          prefix_padding_ms: 300,
          silence_duration_ms: 650,
          create_response: false,
          interrupt_response: false,
        },
      },
      output: { voice: "marin" },
    },
  };

  const form = new FormData();
  form.set("sdp", body.sdp);
  form.set("session", JSON.stringify(session));

  const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    signal: request.signal,
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const responseBody = await upstream.text();
  if (!upstream.ok) {
    const requestId = upstream.headers.get("x-request-id");
    return Response.json(
      { error: `Aura could not start the Realtime voice session.${requestId ? ` Reference: ${requestId}` : ""}` },
      { status: upstream.status || 502 },
    );
  }

  return new Response(responseBody, {
    status: 200,
    headers: {
      "Content-Type": "application/sdp",
      "Cache-Control": "no-store",
    },
  });
}
