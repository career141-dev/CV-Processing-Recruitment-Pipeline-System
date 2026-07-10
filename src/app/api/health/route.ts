import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function GET() {
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { status: "error", message: "Convex URL not configured" },
        { status: 500 }
      );
    }

    const client = new ConvexHttpClient(convexUrl);

    // Call the health query
    // In Convex, if this works, we know the DB is reachable and alive
    const result = await client.query(api.health.ping);

    if (result === "ok") {
      return NextResponse.json({ status: "ok", convex: "ok" }, { status: 200 });
    } else {
      return NextResponse.json(
        { status: "error", convex: "unexpected_response" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { status: "error", convex: "fail", error: String(error) },
      { status: 503 }
    );
  }
}
