import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const audioBuffer = await req.arrayBuffer();

    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return NextResponse.json({ error: "Empty audio payload" }, { status: 400 });
    }

    const contentType = req.headers.get("content-type") || "audio/webm";

    // 1. Primary: Deepgram Nova-2 STT
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (deepgramApiKey) {
      try {
        const url =
          "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&filler_words=false";
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Token ${deepgramApiKey}`,
            "Content-Type": contentType,
          },
          body: audioBuffer,
        });

        if (response.ok) {
          const data = await response.json();
          const transcript =
            data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || "";

          console.log(
            `[Deepgram STT] Success — transcript: "${transcript.substring(0, 80)}${transcript.length > 80 ? "..." : ""}"`
          );

          return NextResponse.json({
            success: true,
            transcript,
            confidence: data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0,
            words: data.results?.channels?.[0]?.alternatives?.[0]?.words || [],
            provider: "deepgram",
          });
        } else {
          const errText = await response.text();
          console.warn("[Deepgram STT] Error response, falling back to Fish Audio ASR:", response.status, errText);
        }
      } catch (err: any) {
        console.warn("[Deepgram STT] Exception, falling back to Fish Audio ASR:", err?.message);
      }
    }

    // 2. Fallback: Fish Audio ASR
    const fishApiKey = process.env.FISH_AUDIO_API_KEY;
    if (fishApiKey) {
      try {
        const formData = new FormData();
        const audioBlob = new Blob([audioBuffer], { type: contentType });
        formData.append("audio", audioBlob, "audio.webm");
        formData.append("language", "en");
        formData.append("ignore_timestamps", "true");

        const response = await fetch("https://api.fish.audio/v1/asr", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${fishApiKey}`,
          },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          const transcript = (data.text || "").trim();

          console.log(
            `[Fish Audio ASR] Fallback Success — transcript: "${transcript.substring(0, 80)}${transcript.length > 80 ? "..." : ""}"`
          );

          return NextResponse.json({
            success: true,
            transcript,
            confidence: 1,
            words: [],
            provider: "fish-audio",
          });
        } else {
          const errText = await response.text();
          console.error("[Fish Audio ASR] Error response:", response.status, errText);
        }
      } catch (err: any) {
        console.error("[Fish Audio ASR] Exception:", err?.message);
      }
    }

    return NextResponse.json(
      { error: "No working STT provider configured or available" },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("[Transcribe Route] Exception:", error);
    return NextResponse.json(
      { error: error.message || "Internal transcription error" },
      { status: 500 }
    );
  }
}
