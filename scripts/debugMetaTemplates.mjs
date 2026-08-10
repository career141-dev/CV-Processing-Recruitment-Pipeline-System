import dotenv from "dotenv";
dotenv.config({ path: ".env.hosted" });

async function checkApprovedTemplates() {
  const token = "EAAVsiEb3mHEBSIuLifLIqEvWVh9P0EkUnxKufE7fFRgay0IwCTZAPOTjv3gYxSk4iC2mNOKs8JTT3Qb0ZAdTHsP4WbZCiNZAiw4WOj5vLPQ9CSI4uiivAWKDhLnVzN6toTXdfvMRkZAUibXh3Rgg2bJkFOQ7YUbZAp005nlKdX9fbM7sZBcyZBjWBIzUST8t2QZDZD";
  const phoneId = "965783109962872";

  try {
    const phoneRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}?fields=id,display_phone_number,name_status,status&access_token=${token}`);
    console.log("Phone Info:", await phoneRes.json());

    // Try sending career141_initial_outreach with en_US and en
    for (const langCode of ["en", "en_US", "en_GB"]) {
      console.log(`Testing template send with language: "${langCode}"...`);
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: "94753883167",
          type: "template",
          template: {
            name: "career141_initial_outreach",
            language: { code: langCode },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: "Sanjeev" },
                  { type: "text", text: "Follow-up Test" },
                  { type: "text", text: "Internal job testing" },
                  { type: "text", text: "• CV" }
                ]
              }
            ]
          }
        })
      });
      console.log(`Lang "${langCode}" Response Status:`, res.status, await res.json());
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

checkApprovedTemplates();
