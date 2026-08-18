import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  try {
    // 1. Recruiter Authentication Guard
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized recruiter access" }, { status: 401 });
    }

    const body = await req.json();
    const candidateName = body.participantName || body.candidateName || "Candidate";
    const candidateId = body.candidateId || "simulation";
    const mode = body.mode || "simulation";

    // 2. Deterministic Room Isolation with unique UUID
    const roomName = `simulation-${candidateId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const apiKey = process.env.LIVEKIT_API_KEY || "career141_livekit_key";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "career141_livekit_secret_8f4a1c9e2b7d5a3f60e1d8c2";
    const livekitUrl =
      process.env.NEXT_PUBLIC_LIVEKIT_URL ||
      process.env.LIVEKIT_URL ||
      (process.env.NODE_ENV === "production" ? "wss://voice.career141.com" : "ws://127.0.0.1:7880");

    // 3. Create token with short 10-minute TTL and restricted room grant
    const at = new AccessToken(apiKey, apiSecret, {
      identity: `recruiter-${userId.substring(0, 10)}-${Date.now()}`,
      name: candidateName,
      ttl: "10m", // 10 minutes short token lifetime
      metadata: JSON.stringify({
        candidateId,
        candidateName,
        jobTitle: body.jobTitle || "Position Application",
        mode,
        createdAt: Date.now(),
      }),
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
      roomName,
    });
  } catch (error: any) {
    console.error("[LiveKit Token] Error creating token:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create LiveKit token" },
      { status: 500 }
    );
  }
}

