import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const screeningTokenSchema = z
  .object({
    candidateName: z.string().max(160).optional(),
    companyName: z.string().min(1).max(180),
    jobTitle: z.string().min(1).max(200),
    jobDescription: z.string().min(20).max(20_000),
    detailsToCollect: z.array(z.string().max(300)).min(1).max(15),
  })
  .strict();

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Voice service is not configured: ${name} is required`);
  }
  return value;
}

function validateLiveKitUrl(
  value: string,
  name: string,
  allowedProtocols: ReadonlySet<string>,
): string {
  const parsed = new URL(value);
  if (!allowedProtocols.has(parsed.protocol)) {
    throw new Error(`${name} uses an unsupported protocol: ${parsed.protocol}`);
  }
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await auth();
    const recruiterUserId = authResult.userId || "recruiter-sim";

    let bodyData: unknown;
    try {
      bodyData = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 },
      );
    }

    const parsed = screeningTokenSchema.safeParse(bodyData);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid screening configuration", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { candidateName, companyName, jobTitle, jobDescription, detailsToCollect } = parsed.data;

    const apiKey = process.env.LIVEKIT_API_KEY?.trim() || requiredEnvironment("LIVEKIT_API_KEY");
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim() || requiredEnvironment("LIVEKIT_API_SECRET");

    const publicUrl = validateLiveKitUrl(
      process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() || requiredEnvironment("NEXT_PUBLIC_LIVEKIT_URL"),
      "NEXT_PUBLIC_LIVEKIT_URL",
      new Set(["ws:", "wss:"]),
    );

    const rawServerUrl = process.env.LIVEKIT_INTERNAL_URL?.trim() || publicUrl;
    const serverUrl = validateLiveKitUrl(
      rawServerUrl
        .replace(/^wss:\/\//i, "https://")
        .replace(/^ws:\/\//i, "http://"),
      "LIVEKIT_INTERNAL_URL",
      new Set(["http:", "https:"]),
    );

    const sessionId = randomUUID();
    const roomName = `aura-${sessionId.slice(0, 12)}`;

    const roomMetadata = JSON.stringify({
      schemaVersion: 1,
      sessionId,
      agentType: "aura-screening",
      candidateName: candidateName?.trim() || "Candidate",
      companyName: companyName.trim(),
      jobTitle: jobTitle.trim(),
      jobDescription: jobDescription.trim().slice(0, 4000),
      detailsToCollect,
      recruiterUserId,
      createdAt: Date.now(),
    });

    const roomService = new RoomServiceClient(serverUrl, apiKey, apiSecret, {
      requestTimeout: 5,
    });

    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 120,
      departureTimeout: 30,
      maxParticipants: 4,
      metadata: roomMetadata,
    });

    const participantIdentity = `recruiter-${recruiterUserId.slice(0, 8)}-${sessionId.slice(0, 6)}`;
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: candidateName?.trim() || "Candidate",
      ttl: "20m",
      metadata: JSON.stringify({ mode: "screening", sessionId }),
    });

    accessToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return NextResponse.json(
      {
        token: await accessToken.toJwt(),
        url: publicUrl,
        roomName,
        sessionId,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    console.error("[Aura LiveKit Token Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate LiveKit screening session token" },
      { status: 500 },
    );
  }
}
