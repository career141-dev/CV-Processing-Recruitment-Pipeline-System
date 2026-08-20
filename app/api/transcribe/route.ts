export const runtime = "edge";

const MAX_AUDIO_BYTES = 10_000_000;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Accurate voice recognition is not configured." }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "The audio request was not valid." }, { status: 400 });
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "The audio request was not valid." }, { status: 400 });
  }

  const upstreamForm = new FormData();
  upstreamForm.append("file", audio, audio.name || "candidate.webm");
  upstreamForm.append("model", "gpt-4o-mini-transcribe");
  upstreamForm.append("language", "en");
  upstreamForm.append("response_format", "json");

  const upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    signal: request.signal,
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstreamForm,
  });

  if (!upstream.ok) {
    const requestId = upstream.headers.get("x-request-id");
    return Response.json(
      { error: `Accurate voice recognition is temporarily unavailable.${requestId ? ` Reference: ${requestId}` : ""}` },
      { status: upstream.status || 502 },
    );
  }

  const result = await upstream.json() as { text?: unknown };
  if (typeof result.text !== "string" || !result.text.trim()) {
    return Response.json({ error: "No speech was detected." }, { status: 422 });
  }

  return Response.json({ text: result.text.trim() }, { headers: { "Cache-Control": "no-store" } });
}
