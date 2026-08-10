import dotenv from 'dotenv';
dotenv.config({ path: '.env.hosted' });

const apiToken = process.env.WHATCHIMP_API_TOKEN || "21708|pmdEwn35i9WBjs8qWyDuY3jQfNLk4JjS1hHevQJ77b25caab";
const phoneId = "965783109962872";
const recipient = "94753883167";

const testMessage = `Hi Sanjeev,\n\nThank you for your interest in the Test Role.\n\nBefore we can proceed with your application, please review the role requirements below:\nInternal testing\n\nTo complete your application, we still require the following information:\n• CV / Resume | • Expected Salary\n\nPlease reply directly to this chat with the requested details. Thank you!`;

async function testSend() {
  console.log("=== TESTING WHATCHIMP SEND ENDPOINT ===");
  console.log("Token:", apiToken ? apiToken.substring(0, 10) + "..." : "MISSING");
  console.log("Phone ID:", phoneId);
  console.log("Recipient:", recipient);

  const params = new URLSearchParams({
    apiToken: apiToken,
    phone_number_id: phoneId,
    phone_number: recipient,
    message: testMessage,
  });

  try {
    const res = await fetch("https://app.whatchimp.com/api/v1/whatsapp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const text = await res.text();
    console.log(`WhatChimp Response HTTP ${res.status}:`, text);
  } catch (err) {
    console.error("WhatChimp fetch error:", err);
  }
}

testSend();
