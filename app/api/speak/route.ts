export const runtime = "edge";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Natural voice playback is not configured." }, { status: 503 });
  }

  let body: { text?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The voice request was not valid." }, { status: 400 });
  }

  if (typeof body.text !== "string" || body.text.trim().length === 0 || body.text.length > 1_200) {
    return Response.json({ error: "The voice request was not valid." }, { status: 400 });
  }

  const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    signal: request.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: "nova",
      input: body.text.trim(),
      response_format: "mp3",
      speed: 1.0,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const requestId = upstream.headers.get("x-request-id");
    return Response.json(
      { error: `Natural voice playback is temporarily unavailable.${requestId ? ` Reference: ${requestId}` : ""}` },
      { status: upstream.status || 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
