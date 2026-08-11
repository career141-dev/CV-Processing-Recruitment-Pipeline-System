import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "DEEPGRAM_API_KEY is not configured" }, { status: 500 });
    }

    const contentType = req.headers.get("content-type") || "audio/webm";
    const audioBuffer = await req.arrayBuffer();

    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return NextResponse.json({ error: "Empty audio payload" }, { status: 400 });
    }

    // Call Deepgram Nova-2 STT with smart formatting and punctuation
    const url = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&filler_words=false";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": contentType,
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Deepgram STT] API error:", response.status, errText);
      return NextResponse.json({ error: `Deepgram error: ${errText}` }, { status: response.status });
    }

    const data = await response.json();
    const transcript =
      data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || "";

    return NextResponse.json({
      success: true,
      transcript,
      confidence: data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0,
      words: data.results?.channels?.[0]?.alternatives?.[0]?.words || [],
    });
  } catch (error: any) {
    console.error("[Deepgram STT] Exception:", error);
    return NextResponse.json({ error: error.message || "Internal transcription error" }, { status: 500 });
  }
}
