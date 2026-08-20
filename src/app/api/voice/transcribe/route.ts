import { NextRequest, NextResponse } from "next/server";

/**
 * Primary: Deepgram nova-2 (low-latency, streaming-capable).
 * Fallback: OpenAI Whisper (via OpenRouter or direct) when Deepgram is down.
 */

async function transcribeWithDeepgram(
  audioBuffer: ArrayBuffer,
  contentType: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": contentType,
        },
        body: audioBuffer,
      },
    );

    if (!response.ok) {
      console.warn(`[Voice Transcribe] Deepgram returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
  } catch (err: any) {
    console.warn("[Voice Transcribe] Deepgram failed:", err?.message);
    return null;
  }
}

async function transcribeWithWhisper(
  audioBuffer: ArrayBuffer,
  contentType: string,
  apiKey: string,
): Promise<string | null> {
  try {
    // Convert ArrayBuffer to Blob with proper MIME type for the multipart form
    const ext = contentType.includes("webm")
      ? "webm"
      : contentType.includes("mp4")
        ? "mp4"
        : "webm";
    const blob = new Blob([audioBuffer], { type: contentType });

    const formData = new FormData();
    formData.append("file", blob, `audio.${ext}`);
    formData.append("model", "whisper-1");
    formData.append("language", "en");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      console.warn(`[Voice Transcribe] Whisper returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data?.text || "";
  } catch (err: any) {
    console.warn("[Voice Transcribe] Whisper failed:", err?.message);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const audioBuffer = await req.arrayBuffer();
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return NextResponse.json({ error: "Empty audio payload" }, { status: 400 });
    }

    const contentType = req.headers.get("content-type") || "audio/webm";

    // Primary: Deepgram
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (deepgramApiKey) {
      const transcript = await transcribeWithDeepgram(audioBuffer, contentType, deepgramApiKey);
      if (transcript !== null) {
        return NextResponse.json({ transcript, provider: "deepgram" });
      }
    }

    // Fallback: OpenAI Whisper
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      const transcript = await transcribeWithWhisper(audioBuffer, contentType, openaiApiKey);
      if (transcript !== null) {
        return NextResponse.json({ transcript, provider: "whisper" });
      }
    }

    return NextResponse.json(
      { error: "No working STT provider configured. Check DEEPGRAM_API_KEY or OPENAI_API_KEY." },
      { status: 500 },
    );
  } catch (error: any) {
    console.error("[Voice Transcribe] Exception:", error);
    return NextResponse.json(
      { error: error.message || "Internal transcription error" },
      { status: 500 },
    );
  }
}
