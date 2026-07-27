import { NextResponse } from 'next/server';
import { fetchMutation } from 'convex/nextjs';
import { api, anyApi } from '../../../../convex/_generated/api';

export async function GET() {
  try {
    const result = await fetchMutation(anyApi.seedTimeline.addDemoCandidate as any);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
