import dotenv from 'dotenv';
dotenv.config({ path: '.env.hosted' });

const apiToken = process.env.WHATCHIMP_API_TOKEN || "21708|pmdEwn35i9WBjs8qWyDuY3jQfNLk4JjS1hHevQJ77b25caab";
const phoneId = "965783109962872";
const recipient = "94753883167";

async function testPayloads() {
  const payloads = [
    {
      name: "template_name + parameters JSON",
      body: {
        apiToken,
        phone_number_id: phoneId,
        phone_number: recipient,
        template_name: "career141_initial_outreach",
        parameters: JSON.stringify(["Sanjeev", "Follow-up Test", "Internal testing", "• CV"]),
        language: "en"
      }
    },
    {
      name: "template_name + template_params",
      body: {
        apiToken,
        phone_number_id: phoneId,
        phone_number: recipient,
        template: "career141_initial_outreach",
        template_params: JSON.stringify(["Sanjeev", "Follow-up Test", "Internal testing", "• CV"]),
        language_code: "en"
      }
    },
    {
      name: "type=template + template_id",
      body: {
        apiToken,
        phone_number_id: phoneId,
        phone_number: recipient,
        type: "template",
        name: "career141_initial_outreach",
        params: JSON.stringify(["Sanjeev", "Follow-up Test", "Internal testing", "• CV"])
      }
    }
  ];

  for (const p of payloads) {
    try {
      const res = await fetch("https://app.whatchimp.com/api/v1/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(p.body).toString(),
      });
      console.log(`${p.name} -> Status ${res.status}: ${await res.text()}`);
    } catch (e) {
      console.log(`${p.name} -> Error: ${e.message}`);
    }
  }
}

testPayloads();
