import {
  AGENT_MODEL,
  buildAgentInstructions,
  type AgentMessage,
  type ScreeningContext,
} from "../../../lib/agent-config";

export const runtime = "edge";

const isAgentMessage = (value: unknown): value is AgentMessage => {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (message.role === "user" || message.role === "assistant")
    && typeof message.content === "string"
    && message.content.trim().length > 0
    && message.content.length <= 4_000;
};

const isShortText = (value: unknown, maximum: number) => typeof value === "string" && value.length <= maximum;
const isConversationLanguage = (value: unknown) => ["adaptive", "en-LK", "si-LK", "ta-LK"].includes(String(value));

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
    && context.detailsToCollect.every((item) => isShortText(item, 300) && item.trim().length > 0)
    && isConversationLanguage(context.preferredLanguage)
    && isShortText(context.pronunciationGuide, 1_000);
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "The secure AI connection needs an OpenAI API key before Aura can reply." },
      { status: 503 },
    );
  }

  let body: { messages?: unknown; screening?: unknown; start?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The conversation request was not valid." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || !body.messages.every(isAgentMessage) || !isScreeningContext(body.screening)) {
    return Response.json({ error: "The screening setup or conversation was not valid." }, { status: 400 });
  }

  const messages = body.messages.slice(-24).map((message) => ({
    role: message.role,
    content: message.content.trim(),
  }));
  const input = messages.length > 0
    ? messages
    : [{
      role: "user" as const,
      content: body.start === true
        ? "Begin the call now. Give only the natural introduction, the exact position and reason for calling, then ask whether this is an okay time to talk. Do not ask any screening question yet."
        : "Continue the screening naturally.",
    }];

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AGENT_MODEL,
      instructions: buildAgentInstructions(body.screening),
      input,
      reasoning: { effort: "none" },
      max_output_tokens: 140,
      text: { verbosity: "low" },
      stream: true,
      store: false,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const requestId = upstream.headers.get("x-request-id");
    return Response.json(
      { error: `The AI service could not answer right now.${requestId ? ` Reference: ${requestId}` : ""}` },
      { status: upstream.status || 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
