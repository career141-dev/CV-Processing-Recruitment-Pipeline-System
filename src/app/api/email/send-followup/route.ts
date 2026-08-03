import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { candidateEmail, subject, body } = await request.json();

    if (!candidateEmail || !subject || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const tenantId = process.env.MS_GRAPH_TENANT_ID || process.env.MS_TENANT_ID;
    const clientId = process.env.MS_GRAPH_CLIENT_ID || process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET || process.env.MS_CLIENT_SECRET;
    const senderEmail = process.env.OUTBOUND_EMAIL_SENDER || process.env.MS_SENDER_EMAIL || "binath@career141.com";

    if (!tenantId || !clientId || !clientSecret) {
      return NextResponse.json({ error: "Missing MS Graph credentials in environment" }, { status: 500 });
    }

    // 1. Get OAuth Token from Microsoft
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        scope: "https://graph.microsoft.com/.default",
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("[MS Graph Token Error]:", errorText);
      return NextResponse.json({ error: `Failed to fetch MS Graph token: ${errorText}` }, { status: 500 });
    }

    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    // 2. Send Mail via MS Graph API
    const sendMailRes = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: "Text",
            content: body,
          },
          toRecipients: [
            {
              emailAddress: {
                address: candidateEmail,
              },
            },
          ],
        },
        saveToSentItems: "true",
      }),
    });

    if (!sendMailRes.ok) {
      const sendMailError = await sendMailRes.text();
      console.error("[MS Graph sendMail Error]:", sendMailError);
      return NextResponse.json({ error: `MS Graph sendMail failed: ${sendMailError}` }, { status: 500 });
    }

    console.log(`[Next.js API] Successfully sent outbound follow-up email from ${senderEmail} to ${candidateEmail}`);
    return NextResponse.json({ success: true, sender: senderEmail, recipient: candidateEmail });
  } catch (err: any) {
    console.error("[Next.js API Email Error]:", err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
