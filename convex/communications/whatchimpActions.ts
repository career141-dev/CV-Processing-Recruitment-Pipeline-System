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

/**
 * High-memory, async Node.js handler for incoming WhatsApp media documents.
 * Runs in Node runtime (512MB+ RAM) to effortlessly process any size PDF without OOM crashes.
 */
export const processInboundMedia = internalAction({
  args: {
    mediaUrl: v.string(),
    fileName: v.string(),
    mimeType: v.string(),
    cleanFrom: v.string(),
    cleanTo: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const { mediaUrl, fileName, mimeType, cleanFrom, cleanTo, text } = args;
    try {
      console.log(`[processInboundMedia] Downloading media from ${mediaUrl} for +${cleanFrom}...`);
      const fileResponse = await fetch(mediaUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file from WhatChimp media URL. Status: ${fileResponse.status}`);
      }
      const arrayBuffer = await fileResponse.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      // Instant native crypto SHA-256
      const crypto = await import("crypto");
      const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      // Upload directly to Cloudflare R2 via PutObjectCommand (Node buffer stream)
      const { getS3Client } = await import("../storage/r2");
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const s3 = getS3Client();
      const safeName = (fileName || "cv.pdf").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const date = new Date();
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const s3Key = `cvs/${yearMonth}/${Date.now()}-${safeName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: s3Key,
        ContentType: mimeType || "application/pdf",
        Body: fileBuffer,
      });
      await s3.send(command);
      console.log(`[processInboundMedia] Uploaded ${fileName} to R2 key ${s3Key} (${fileBuffer.length} bytes)`);

      // Resolve Job
      let resolvedJobId: string | null | undefined = null;
      let metaSourceUrl, metaSourceId, metaHeadline;

      if (text) {
        const upperText = text.toUpperCase();
        const activeJobs = await ctx.runQuery(api.jobs.jobs.getActiveJobsBasicInfo);
        for (const job of activeJobs) {
          const pausedChannels: string[] = (job as any).pausedChannels || [];
          if (pausedChannels.includes("whatsapp")) continue;
          if (job.keyword && upperText.includes(job.keyword.toUpperCase())) {
            resolvedJobId = job._id;
            break;
          }
        }
      }

      if (!resolvedJobId) {
        const session = await ctx.runQuery(api.communications.whatchimp.getSessionByPhone, {
          phone: cleanFrom,
        });
        if (session) {
          resolvedJobId = session.jobId;
          metaSourceUrl = session.metaSourceUrl;
          metaSourceId = session.metaSourceId;
          metaHeadline = session.metaHeadline;
          console.log(`[processInboundMedia] Resolved job ID ${resolvedJobId} from session for +${cleanFrom}`);
        }
      }

      const ingestionResult = await ctx.runMutation(api.pipeline.ingestion.processCvIngestion, {
        jobId: resolvedJobId ? (resolvedJobId as any) : undefined,
        fileName: fileName || "cv.pdf",
        fileSizeBytes: fileBuffer.length,
        fileType: mimeType || "application/pdf",
        fileHash,
        s3Key,
        storageProvider: "r2",
        sourceChannel: "whatsapp",
        rawSender: cleanFrom,
        metaSourceUrl,
        metaSourceId,
        metaHeadline,
      });
      console.log(`[processInboundMedia] Ingested CV for candidate +${cleanFrom} (jobId: ${resolvedJobId}). Result:`, ingestionResult);

      // WhatsApp reply confirmation
      const fetchedPhoneId = await ctx.runQuery(internal.communications.whatsappOutbound.getMetaPhoneNumberId, { 
        targetWhatsAppNumber: cleanTo 
      });
      const phoneNumberId = fetchedPhoneId || process.env.META_PHONE_NUMBER_ID || "965783109962872";
      if (phoneNumberId) {
        let replyMessage = "Thank you! Your CV has been successfully received and is being processed by our system. We will contact you if there is a match.";
        if (ingestionResult && (ingestionResult as any).reason === "duplicate_file") {
           replyMessage = "We already have this exact CV on file for this position. We'll be in touch if your profile matches our requirements. Thank you!";
        }
        const metaAccessToken = process.env.META_ACCESS_TOKEN || "";
        await sendMetaFreeText(phoneNumberId, cleanFrom, replyMessage, metaAccessToken)
          .then(r => { if (!r.success) console.error("[WhatsApp Webhook] CV ack reply failed:", r.error); })
          .catch(console.error);
      }
    } catch (err: any) {
      console.error("[processInboundMedia] Error processing media:", err.message || err);
    }
  },
});
