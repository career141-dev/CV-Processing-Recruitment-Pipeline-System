import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { phone, body } = await request.json();

    if (!phone || !body) {
      return NextResponse.json({ error: "Missing required fields: phone, body" }, { status: 400 });
    }

    const apiToken = process.env.WHATCHIMP_API_TOKEN || "21708|pmdEwn35i9WBjs8qWyDuY3jQfNLk4JjS1hHevQJ77b25caab";
    const rawPhoneId = process.env.WHATCHIMP_PHONE_NUMBER_ID || "965783109962872";
    const phoneId = rawPhoneId.replace(/\D/g, "");

    const formattedPhone = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;

    console.log(`[Next.js API WhatsApp] Sending message to ${formattedPhone} via WhatChimp phone ID ${phoneId}`);

    const res = await fetch(`https://app.whatchimp.com/api/v1/whatsapp/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_number_id: phoneId,
        recipient: formattedPhone,
        message: body,
      }),
    });

    const resText = await res.text();
    if (!res.ok) {
      console.error(`[Next.js API WhatsApp Error]: HTTP ${res.status} - ${resText}`);
      return NextResponse.json({ error: `WhatChimp API error: ${resText}` }, { status: 500 });
    }

    console.log(`[Next.js API WhatsApp Success]: ${resText}`);
    return NextResponse.json({ success: true, response: resText });
  } catch (err: any) {
    console.error("[Next.js API WhatsApp Exception]:", err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
