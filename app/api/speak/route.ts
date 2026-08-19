export const runtime = "edge";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Natural voice playback is not configured." }, { status: 503 });
  }

  let body: { text?: unknown; language?: unknown; pronunciationGuide?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The voice request was not valid." }, { status: 400 });
  }

  if (typeof body.text !== "string" || body.text.trim().length === 0 || body.text.length > 1_200
    || !["en-LK", "si-LK", "ta-LK"].includes(String(body.language))
    || typeof body.pronunciationGuide !== "string" || body.pronunciationGuide.length > 1_000) {
    return Response.json({ error: "The voice request was not valid." }, { status: 400 });
  }

  const languageInstructions = {
    "en-LK": "Speak in a warm, professional, natural Sri Lankan English accent. Keep it subtle and authentic, never exaggerated. Use clear Sri Lankan pronunciation and a relaxed recruiting-call rhythm.",
    "si-LK": "Speak in warm, natural, modern spoken Sinhala as used in Sri Lanka. Keep the delivery conversational and pronounce English job titles and company names carefully.",
    "ta-LK": "Speak in warm, natural Sri Lankan Tamil. Keep the delivery conversational rather than formal, and pronounce English job titles and company names carefully.",
  }[String(body.language)];
  const pronunciationNotes = body.pronunciationGuide.trim()
    ? ` Follow these pronunciation notes where relevant: ${body.pronunciationGuide.trim()}`
    : "";

  const requestSpeech = (payload: Record<string, unknown>) => fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let upstream = await requestSpeech({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: body.text.trim(),
      instructions: `${languageInstructions} Sound calm, friendly and human, with natural pauses and intonation.${pronunciationNotes}`,
      response_format: "mp3",
  });

  if (!upstream.ok) {
    upstream = await requestSpeech({
      model: "tts-1",
      voice: "nova",
      input: body.text.trim(),
      response_format: "mp3",
      speed: 1.0,
    });
  }

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
