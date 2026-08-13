"use node";
import { internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { sendMetaFreeText } from "./metaDirectSender";

export const handlePreApplicationChat = internalAction({
  args: {
    phone: v.string(),
    textBody: v.string(),
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    try {
      const job = await ctx.runQuery(api.jobs.jobs.getJob, { jobId: args.jobId });
      if (!job) return;

      let replyMessage = "";

      try {
        const { executeLLMWithNvidiaFallback } = await import("../lib/llm");
        const systemPrompt = `You are an intelligent recruitment assistant for Career141. 
The candidate is interested in the "${job.title}" position. 
Job Description: ${job.jobDescription ? job.jobDescription.substring(0, 2000) : "Not specified"}
Salary: ${job.salaryMin ? job.salaryMin + " to " + job.salaryMax + " " + (job.salaryCurrency || "") : "Not specified"}
Location: ${job.location || "Not specified"}

The candidate has NOT uploaded their CV yet. They just asked: "${args.textBody}".
Answer their question politely and accurately based ONLY on the provided job details. Keep it very concise (1-2 short sentences max). Do not hallucinate details.
ALWAYS end your message by reminding them: "Please upload your CV as a PDF to apply!"`;

        const llmResult = await executeLLMWithNvidiaFallback(ctx, "email_auto_reply", {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: args.textBody }
          ],
          temperature: 0.3,
          max_tokens: 300,
        });

        replyMessage = llmResult?.content?.trim() || "";
      } catch (llmErr: any) {
        console.warn("[PreApp Chat] LLM call failed, using intelligent template response:", llmErr?.message || llmErr);
        const locInfo = job.location ? `This role is based in ${job.location}.` : "";
        replyMessage = `Thank you for your inquiry regarding the ${job.title} position! ${locInfo} Please upload your latest CV to continue your application.`;
      }

      if (!replyMessage) {
        const locInfo = job.location ? `This role is based in ${job.location}.` : "";
        replyMessage = `Thank you for your inquiry regarding the ${job.title} position! ${locInfo} Please upload your latest CV to continue your application.`;
      }

      console.log(`[PreApp Chat] Replying to +${args.phone}: ${replyMessage.substring(0, 100)}...`);

      const outboundNumber = await ctx.runQuery(internal.communications.whatsappOutbound.getJobOutboundWhatsAppNumber, { jobId: args.jobId });
      let phoneNumberId = process.env.META_PHONE_NUMBER_ID || "965783109962872";
      if (outboundNumber) {
        const fetchedId = await ctx.runQuery(internal.communications.whatsappOutbound.getMetaPhoneNumberId, { 
          targetWhatsAppNumber: outboundNumber 
        });
        if (fetchedId) {
          phoneNumberId = fetchedId;
          console.log(`[PreApp Chat] Using dynamically resolved phone ID ${phoneNumberId} for job outreach number ${outboundNumber}`);
        }
      }
      
      if (phoneNumberId) {
        const metaAccessToken = process.env.META_ACCESS_TOKEN || "";
        await sendMetaFreeText(phoneNumberId, args.phone, replyMessage, metaAccessToken)
          .then(r => { if (!r.success) console.error("[PreApp Chat] Meta send failed:", r.error); })
          .catch(console.error);
      }
    } catch (e: any) {
      console.error("[PreApp Chat] Error:", e);
    }
  }
});
