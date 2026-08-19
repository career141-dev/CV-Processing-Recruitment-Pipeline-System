import { NextRequest, NextResponse } from "next/server";

function prepareTextForSpeech(rawText: string): string {
  return rawText
    .replace(/\bCareer\s*141\b/gi, "Career One-Four-One")
    .replace(/\b141\b/g, "One-Four-One")
    .replace(/\bUI\s*\/\s*UX\b/gi, "UI UX")
    .replace(/\bUX\s*\/\s*UI\b/gi, "UX UI")
    .replace(/\bCI\s*\/\s*CD\b/gi, "CI CD")
    .replace(/\bQA\s*\/\s*QC\b/gi, "QA QC")
    .replace(/\bML\s*\/\s*AI\b/gi, "AI and Machine Learning")
    .replace(/\bAI\s*\/\s*ML\b/gi, "AI and Machine Learning")
    .replace(/\bFrontend\s*\/\s*Backend\b/gi, "Frontend and Backend")
    .replace(/\bBackend\s*\/\s*Frontend\b/gi, "Backend and Frontend")
    .replace(/[*_#`~[\]{}()]/g, " ")
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const spokenTranscript = prepareTextForSpeech(text);

    // 1. Fish Audio TTS (primary)
    const fishAudioApiKey = process.env.FISH_AUDIO_API_KEY || process.env.FISHAUDIO_API_KEY;
    if (fishAudioApiKey) {
      try {
        const DEFAULT_FISH_VOICE_ID = "fb52b0c3c8a44e41b234da575d009d4c";
        const selectedReferenceId =
          voiceId && !voiceId.startsWith("aura-") && voiceId !== "default" && voiceId.length >= 20
            ? voiceId
            : DEFAULT_FISH_VOICE_ID;

        const fishRes = await fetch("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${fishAudioApiKey}`,
            "Content-Type": "application/json",
            model: "s2.1-pro-free",
          },
          body: JSON.stringify({
            text: spokenTranscript,
            format: "mp3",
            mp3_bitrate: 128,
            normalize: true,
            latency: "normal",
            reference_id: selectedReferenceId,
          }),
        });

        if (fishRes.ok) {
          const audioArrayBuffer = await fishRes.arrayBuffer();
          return new NextResponse(audioArrayBuffer, {
            status: 200,
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Length": audioArrayBuffer.byteLength.toString(),
              "X-TTS-Provider": "fish-audio",
            },
          });
        }
      } catch (err: any) {
        console.warn("[Fish Audio TTS] Error, falling back to Deepgram:", err?.message);
      }
    }

    // 2. Deepgram Aura TTS (fallback)
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      return NextResponse.json(
        { error: "No TTS provider configured. Set FISH_AUDIO_API_KEY or DEEPGRAM_API_KEY." },
        { status: 500 }
      );
    }

    const selectedModel =
      voiceId && voiceId.startsWith("aura-") ? voiceId : "aura-asteria-en";
    const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(selectedModel)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${deepgramApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: spokenTranscript }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Deepgram TTS error: ${errText}` },
        { status: response.status }
      );
    }

    const audioArrayBuffer = await response.arrayBuffer();

    return new NextResponse(audioArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mp3",
        "Content-Length": audioArrayBuffer.byteLength.toString(),
        "X-TTS-Provider": "deepgram",
      },
    });
  } catch (error: any) {
    console.error("[Voice Speak] Exception:", error);
    return NextResponse.json(
      { error: error.message || "Internal TTS synthesis error" },
      { status: 500 }
    );
  }
}
