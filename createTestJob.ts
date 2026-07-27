import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient("https://api.career141.com");
client.setAuth(async () => `Convex convex-self-hosted|01c7a32b0d2deae44e0fdcd9108f8b62c6c1af651cac34d644be0f3912d0ba099aa6f4369b`);

async function main() {
  try {
    console.log("Creating job...");
    
    const users = await client.query(anyApi.users.users.listUsers as any);
    const admin = users.find((u: any) => u.role === "admin" || u.role === "ta_manager" || u.role === "test_ta");
    if (!admin) throw new Error("No admin user found");
    
    const { jobId } = await client.mutation(anyApi.jobs.jobs.createJob as any, {
      title: "development tes jop",
      description: "Development Test Job for WhatsApp inbound and outbound. TA is Sudaraka.",
      primaryRecruiterId: admin._id,
      outreachWhatsAppNumber: "+94742197476",
    });
    
    console.log("Job created with ID:", jobId);
    
    console.log("Setting up job channels...");
    await client.mutation(anyApi.jobs.jobs.updateJobChannels as any, {
      jobId,
      channels: [
        {
          channelType: "whatsapp",
          isEnabled: true,
          whatsappNumber: "+94742197476"
        },
        { channelType: "email_campaign", isEnabled: false },
        { channelType: "linkedin", isEnabled: false },
        { channelType: "workable", isEnabled: false },
        { channelType: "meta_campaign", isEnabled: false }
      ]
    });
    
    console.log("Activating job...");
    await client.mutation(anyApi.jobs.jobs.updateJobDetails as any, {
      jobId,
      status: "active"
    } as any);

    console.log("Job setup complete!");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
