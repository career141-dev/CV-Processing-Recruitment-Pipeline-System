import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetUrl = `http://127.0.0.1:3210/http/api/whatsapp${url.search}`;
  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": request.headers.get("content-type") || "text/plain",
      },
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "text/plain" },
    });
  } catch (err: any) {
    return new Response(`Proxy error: ${err?.message}`, { status: 500 });
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const targetUrl = `http://127.0.0.1:3210/http/api/whatsapp${url.search}`;
  try {
    const rawBody = await request.text();
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
        "x-whatchimp-secret": request.headers.get("x-whatchimp-secret") || "",
        "x-webhook-secret": request.headers.get("x-webhook-secret") || "",
      },
      body: rawBody,
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "text/plain" },
    });
  } catch (err: any) {
    return new Response(`Proxy error: ${err?.message}`, { status: 500 });
  }
}
