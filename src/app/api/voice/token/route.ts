import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function POST(req: NextRequest) {
  try {
    const { roomName, participantName, metadata } = await req.json();

    if (!roomName || !participantName) {
      return NextResponse.json(
        { error: "roomName and participantName are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY || "career141_livekit_key";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "career141_livekit_secret_8f4a1c9e2b7d5a3f60e1d8c2";
    const livekitUrl =
      process.env.NEXT_PUBLIC_LIVEKIT_URL ||
      process.env.LIVEKIT_URL ||
      (process.env.NODE_ENV === "production" ? "wss://voice.career141.com" : "ws://127.0.0.1:7880");

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
      metadata: typeof metadata === "string" ? metadata : JSON.stringify(metadata || {}),
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      token,
      url: livekitUrl,
    });
  } catch (error: any) {
    console.error("[LiveKit Token] Error creating token:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create LiveKit token" },
      { status: 500 }
    );
  }
}
