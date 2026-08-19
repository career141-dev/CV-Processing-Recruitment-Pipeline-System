import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

const requestSchema = z
  .object({
    candidateId: z.string().min(1).max(128),
    jobId: z.string().min(1).max(128),
    applicationId: z.string().min(1).max(128),
    customScript: z.string().trim().max(1200).optional(),
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
    throw new Error(`${name} uses an unsupported protocol`);
  }
  return value;
}

function truncate(value: string | undefined, maximumLength: number): string {
  return (value || "").trim().slice(0, maximumLength);
}

export async function POST(request: NextRequest) {
  let reservation: { sessionId: string; token: string } | null = null;
  try {
    const authResult = await auth();
    if (!authResult.userId) {
      return NextResponse.json(
        { error: "Unauthorized recruiter access" },
        { status: 401 },
      );
    }

    const parsedRequest = requestSchema.safeParse(await request.json());
    if (!parsedRequest.success) {
      return NextResponse.json(
        { error: "A valid candidate application and job are required" },
        { status: 400 },
      );
    }

    const convexToken = await authResult.getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json(
        { error: "Unable to verify recruiter permissions" },
        { status: 401 },
      );
    }

    const { candidateId, jobId, applicationId, customScript } =
      parsedRequest.data;
    const context = await fetchQuery(
      api.aiCalls.voiceCalls.getVoiceSimulationContext,
      {
        candidateId: candidateId as Id<"candidates">,
        jobId: jobId as Id<"jobs">,
        applicationId: applicationId as Id<"applications">,
      },
      { token: convexToken },
    );

    const apiKey =
      context.livekitConfig?.apiKey ||
      process.env.LIVEKIT_API_KEY?.trim() ||
      requiredEnvironment("LIVEKIT_API_KEY");

    const apiSecret =
      context.livekitConfig?.apiSecret ||
      process.env.LIVEKIT_API_SECRET?.trim() ||
      requiredEnvironment("LIVEKIT_API_SECRET");

    const publicUrl = validateLiveKitUrl(
      context.livekitConfig?.publicUrl ||
        process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() ||
        requiredEnvironment("NEXT_PUBLIC_LIVEKIT_URL"),
      "NEXT_PUBLIC_LIVEKIT_URL",
      new Set(["ws:", "wss:"]),
    );

    const rawServerUrl =
      context.livekitConfig?.internalUrl ||
      process.env.LIVEKIT_INTERNAL_URL?.trim() ||
      publicUrl;

    const serverUrl = validateLiveKitUrl(
      rawServerUrl
        .replace(/^wss:\/\//i, "https://")
        .replace(/^ws:\/\//i, "http://"),
      "LIVEKIT_INTERNAL_URL",
      new Set(["http:", "https:"]),
    );

    const sessionId = randomUUID();
    await fetchMutation(
      api.aiCalls.voiceCalls.reserveVoiceSimulationSession,
      {
        sessionId,
        candidateId: candidateId as Id<"candidates">,
        applicationId: applicationId as Id<"applications">,
        jobId: jobId as Id<"jobs">,
      },
      { token: convexToken },
    );
    reservation = { sessionId, token: convexToken };
    const roomName = `simulation-${sessionId}`;
    const metadata = JSON.stringify({
      schemaVersion: 1,
      sessionId,
      mode: "simulation",
      candidateId,
      candidateName: truncate(context.candidateName, 160) || "Candidate",
      applicationId,
      jobId,
      jobTitle: truncate(context.jobTitle, 240) || "Position",
      jobDescription: truncate(context.jobDescription, 2000),
      customQuestions: context.customQuestions
        .map((question) => truncate(question, 300))
        .filter(Boolean)
        .slice(0, 8),
      customScript: truncate(customScript, 1200),
      recruiterUserId: authResult.userId,
      createdAt: Date.now(),
    });

    const roomService = new RoomServiceClient(serverUrl, apiKey, apiSecret, {
      requestTimeout: 5,
    });
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 60,
      departureTimeout: 30,
      maxParticipants: 3,
      metadata,
    });

    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: `simulator-${authResult.userId.slice(0, 10)}-${sessionId.slice(0, 8)}`,
      name: "Recruiter voice simulator",
      ttl: "10m",
      metadata: JSON.stringify({ mode: "simulation", sessionId }),
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
        mode: "simulation",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    if (reservation) {
      await fetchMutation(
        api.aiCalls.voiceCalls.releaseVoiceSimulationReservation,
        { sessionId: reservation.sessionId },
        { token: reservation.token },
      ).catch(() => undefined);
    }
    console.error("[Voice Token] Failed to create simulation session:", error);
    const detail = error?.message || String(error || "");
    return NextResponse.json(
      { error: detail ? `Unable to create voice simulation session: ${detail}` : "Unable to create the voice simulation session" },
      { status: 500 },
    );
  }
}
