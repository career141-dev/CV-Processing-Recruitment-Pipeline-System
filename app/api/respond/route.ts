import { AGENT_INSTRUCTIONS, AGENT_MODEL, type AgentMessage } from "../../../lib/agent-config";

export const runtime = "edge";

const isAgentMessage = (value: unknown): value is AgentMessage => {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (message.role === "user" || message.role === "assistant")
    && typeof message.content === "string"
    && message.content.trim().length > 0
    && message.content.length <= 4_000;
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "The secure AI connection needs an OpenAI API key before Aura can reply." },
      { status: 503 },
    );
  }

  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The conversation request was not valid." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || !body.messages.every(isAgentMessage)) {
    return Response.json({ error: "The conversation messages were not valid." }, { status: 400 });
  }

  const messages = body.messages.slice(-12).map((message) => ({
    role: message.role,
    content: message.content.trim(),
  }));

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AGENT_MODEL,
      instructions: AGENT_INSTRUCTIONS,
      input: messages,
      reasoning: { effort: "none" },
      max_output_tokens: 180,
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

