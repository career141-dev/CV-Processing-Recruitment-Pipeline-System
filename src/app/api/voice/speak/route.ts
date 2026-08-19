import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "The legacy batch speech endpoint has been retired. Use the authenticated LiveKit streaming voice session.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
