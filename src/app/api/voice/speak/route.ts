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

    // 1. Deepgram Aura-2 TTS (Ultra-low latency primary: ~200ms)
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (deepgramApiKey) {
      try {
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

        if (response.ok) {
          const audioArrayBuffer = await response.arrayBuffer();
          return new NextResponse(audioArrayBuffer, {
            status: 200,
            headers: {
              "Content-Type": "audio/mp3",
              "Content-Length": audioArrayBuffer.byteLength.toString(),
              "X-TTS-Provider": "deepgram-aura",
            },
          });
        }
      } catch (err: any) {
        console.error("[Deepgram TTS] Error:", err?.message);
      }
    }

    return NextResponse.json(
      { error: "No working TTS provider configured. Check DEEPGRAM_API_KEY." },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("[Voice Speak] Exception:", error);
    return NextResponse.json(
      { error: error.message || "Internal TTS synthesis error" },
      { status: 500 }
    );
  }
}
