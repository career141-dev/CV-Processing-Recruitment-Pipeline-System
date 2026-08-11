import { NextRequest, NextResponse } from "next/server";

// Clean and phonetically normalize text for natural human speech delivery
function prepareTextForSpeech(rawText: string): string {
  let cleaned = rawText
    // Ensure company name is always pronounced as "Career One-Four-One"
    .replace(/\bCareer\s*141\b/gi, "Career One-Four-One")
    .replace(/\b141\b/g, "One-Four-One")
    // Convert slashes in common tech terms & job titles so TTS never speaks "slash"
    .replace(/\bUI\s*\/\s*UX\b/gi, "UI UX")
    .replace(/\bUX\s*\/\s*UI\b/gi, "UX UI")
    .replace(/\bCI\s*\/\s*CD\b/gi, "CI CD")
    .replace(/\bQA\s*\/\s*QC\b/gi, "QA QC")
    .replace(/\bML\s*\/\s*AI\b/gi, "AI and Machine Learning")
    .replace(/\bAI\s*\/\s*ML\b/gi, "AI and Machine Learning")
    .replace(/\bFrontend\s*\/\s*Backend\b/gi, "Frontend and Backend")
    .replace(/\bBackend\s*\/\s*Frontend\b/gi, "Backend and Frontend")
    .replace(/\band\s*\/\s*or\b/gi, "and or")
    .replace(/\bw\s*\/\s*o\b/gi, "without")
    .replace(/\bw\s*\/\b/gi, "with")
    // Replace any remaining word/word with "word and word"
    .replace(/([a-zA-Z0-9]+)\s*\/\s*([a-zA-Z0-9]+)/g, "$1 and $2")
    // Replace standalone slashes with a natural pause
    .replace(/\s*\/\s*/g, ", ")
    // Convert symbols to spoken words
    .replace(/&/g, " and ")
    .replace(/(\d+)\s*\+/g, "$1 plus ")
    .replace(/%/g, " percent ")
    // Convert dashes and em-dashes into natural conversational breathing pauses
    .replace(/[—–]/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    // Convert 250,000 / 250000 into spoken friendly words
    .replace(/\b(\d{1,3}),?000\s*(?:LKR|rupees)?\b/gi, "$1 thousand LKR")
    .replace(/\b(\d+)\s*lakhs?\b/gi, "$1 lakh")
    // Expand abbreviations
    .replace(/\bTA\b/g, "talent acquisition")
    .replace(/\bJD\b/g, "job description")
    .replace(/\bCV\b/g, "C V")
    // Strip code formatting, markdown, quotes, asterisks, brackets
    .replace(/[*_#`~[\]{}()]/g, " ")
    .replace(/["']/g, "")
    .replace(/\s*•\s*/g, ", ")
    // Clean up multiple punctuation marks (e.g. ??? -> ?)
    .replace(/\?+/g, "?")
    .replace(/!+/g, "!")
    .replace(/\.+/g, ".")
    // Add natural breath pauses around punctuation
    .replace(/([.?!])\s+/g, "$1  ")
    .replace(/,\s*/g, ", ")
    // Collapse excess spaces
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const spokenTranscript = prepareTextForSpeech(text);

    // 1. Try Cartesia TTS if CARTESIA_API_KEY is configured
    const cartesiaApiKey = process.env.CARTESIA_API_KEY;
    if (cartesiaApiKey) {
      try {
        const cartesiaVoiceId =
          voiceId && voiceId.length > 20 && !voiceId.startsWith("aura-")
            ? voiceId
            : "a0e99841-438c-4a64-b679-ae501e7d6091"; // Sonic English default voice

        const cartesiaRes = await fetch("https://api.cartesia.ai/tts/bytes", {
          method: "POST",
          headers: {
            "X-API-Key": cartesiaApiKey,
            "Cartesia-Version": "2024-06-10",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model_id: "sonic-english",
            transcript: spokenTranscript,
            voice: {
              mode: "id",
              id: cartesiaVoiceId,
            },
            output_format: {
              container: "mp3",
              bit_rate: 128000,
              sample_rate: 44100,
            },
          }),
        });

        if (cartesiaRes.ok) {
          const audioArrayBuffer = await cartesiaRes.arrayBuffer();
          return new NextResponse(audioArrayBuffer, {
            status: 200,
            headers: {
              "Content-Type": "audio/mp3",
              "Content-Length": audioArrayBuffer.byteLength.toString(),
            },
          });
        } else {
          const errText = await cartesiaRes.text();
          console.warn("[Cartesia TTS] Error response, falling back to Deepgram:", cartesiaRes.status, errText);
        }
      } catch (err: any) {
        console.warn("[Cartesia TTS] Exception, falling back to Deepgram:", err?.message);
      }
    }

    // 2. Deepgram Aura TTS Fallback
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      return NextResponse.json(
        { error: "Neither CARTESIA_API_KEY nor DEEPGRAM_API_KEY is configured" },
        { status: 500 }
      );
    }

    const selectedModel = voiceId && voiceId.startsWith("aura-") ? voiceId : "aura-asteria-en";
    const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(selectedModel)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${deepgramApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: spokenTranscript,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Deepgram TTS] API error:", response.status, errText);
      return NextResponse.json({ error: `Deepgram TTS error: ${errText}` }, { status: response.status });
    }

    const audioArrayBuffer = await response.arrayBuffer();

    return new NextResponse(audioArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mp3",
        "Content-Length": audioArrayBuffer.byteLength.toString(),
      },
    });
  } catch (error: any) {
    console.error("[Voice Speak] Exception:", error);
    return NextResponse.json({ error: error.message || "Internal TTS synthesis error" }, { status: 500 });
  }
}
