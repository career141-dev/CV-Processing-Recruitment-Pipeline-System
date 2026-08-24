import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

function getConvexClient(): ConvexHttpClient {
  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL?.trim() || "https://api.career141.com";
  return new ConvexHttpClient(convexUrl);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const key = searchParams.get("key");

  if (!key) {
    return new NextResponse("Missing key", { status: 400 });
  }

  try {
    const convex = getConvexClient();
    const signedUrl = await convex.action(api.storage.r2.generateDownloadUrl, { key });
    return NextResponse.redirect(signedUrl);
  } catch (error: any) {
    console.error("Error generating signed URL:", error);
    return new NextResponse(error.message, { status: 500 });
  }
}
