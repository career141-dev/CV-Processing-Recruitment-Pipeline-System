import { httpAction, mutation, query } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";

export const handleWhatChimpWebhook = httpAction(async (ctx, request) => {
  const bodyText = await request.text();
  console.log("[WhatChimp Webhook] Raw body received:", bodyText);

  let body: any;
  try {
    body = JSON.parse(bodyText);
  } catch (err: any) {
    console.error("[WhatChimp Webhook] Failed to parse JSON:", err.message);
    return new Response("Invalid JSON", { status: 400 });
  }

  const configuredPhone = process.env.WHATCHIMP_PHONE_NUMBER_ID || "";
  const cleanConfigured = configuredPhone.replace(/[^0-9]/g, "");
  const businessPhone = cleanConfigured || "94753778899"; // Fallback to original registered number

  // 1. Check if it's a standard Meta WhatsApp Webhook payload
  if (body.entry && body.entry[0]?.changes && body.entry[0].changes[0]?.value?.messages) {
    console.log("[WhatChimp Webhook] Auto-detected standard Meta payload format.");
    const value = body.entry[0].changes[0].value;
    const toNumber = value.metadata?.display_phone_number || "WhatChimp Number";

    for (const message of value.messages) {
      const fromNumber = message.from;
      const cleanFromNumber = fromNumber.replace(/[^0-9]/g, "");

      if (cleanFromNumber === businessPhone || (cleanConfigured && cleanFromNumber === cleanConfigured)) {
        console.log("[WhatChimp Webhook] Ignoring Meta message from business number itself.");
        continue;
      }

      if (message.type === "document" || message.type === "image") {
        const originalSenderPhone = message.context?.from ?? message.from;
        const mediaItem = message.document ?? message.image;

        console.log(`[WhatChimp Webhook] Inbound media detected: ID=${mediaItem.id}, Type=${message.type}`);
        await ctx.scheduler.runAfter(0, internal.cvs.ingestion.processInboundCV, {
          messageId: message.id,
          toNumber,
          fromNumber,
          originalSenderPhone,
          mediaId: mediaItem.id,
          mimeType: mediaItem.mime_type,
          fileName: mediaItem.filename ?? null,
        });
      } else if (message.type === "text") {
        const textBody = message.text?.body || "";
        const cleanSender = String(fromNumber).replace(/[^0-9]/g, "");

        const firstWord = textBody.trim().split(/\s+/)[0]?.toUpperCase() || "";
        let isKeyword = false;

        if (firstWord) {
          const job = await ctx.runQuery(api.jobs.jobs.getByKeyword, { keyword: firstWord });
          if (job && job.status === "active") {
            isKeyword = true;
            console.log(`[WhatChimp Webhook] Received Meta keyword ${firstWord} from +${cleanSender} for job ${job.title}`);
            
            // Create/Update Session
            await ctx.runMutation(api.communications.whatchimp.upsertSession, {
              phone: cleanSender,
              jobId: job._id,
              keyword: firstWord,
            });

            const apiToken = process.env.WHATCHIMP_API_TOKEN;
            const phoneNumberId = process.env.WHATCHIMP_PHONE_NUMBER_ID;
            if (apiToken && phoneNumberId) {
              const replyMessage = `Thank you for your interest in the ${job.title} position.\n\nPlease upload your latest CV to continue your application.`;
              const params = new URLSearchParams();
              params.append("apiToken", apiToken);
              params.append("phone_number_id", phoneNumberId.replace(/[^0-9]/g, ""));
              params.append("phone_number", cleanSender);
              params.append("message", replyMessage);

              await fetch("https://app.whatchimp.com/api/v1/whatsapp/send", {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded"
                },
                body: params
              }).then(r => r.text()).catch(console.error);
            }
          }
        }

        if (!isKeyword) {
          await ctx.scheduler.runAfter(0, internal.communications.whatsappOutbound.checkAndRecordFollowUpReply, {
            senderPhone: cleanSender,
            textBody,
          });
        }
      }
    }
    return new Response("OK", { status: 200 });
  }

  // 2. Check if it's a flat custom WhatChimp payload format
  const from = body.chat_id || body.from || body.phone || body.sender || body.phone_number || body.subscriber_id;
  const text = body.user_message || body.message || body.body || body.text || body.message_text;
  const mediaUrl = body.media_url || body.file_url || body.mediaUrl || body.fileUrl;
  const fileName = body.filename || body.fileName || "cv.pdf";
  const mimeType = body.mime_type || body.mimeType || "application/pdf";
  const to = body.to || body.receiver || body.display_phone_number || body.whatsapp_bot_username || "WhatChimp Number";

  if (!from) {
    console.warn("[WhatChimp Webhook] No sender identifier found in payload.");
    return new Response("Sender not found", { status: 400 });
  }

  const cleanFrom = String(from).replace(/[^0-9]/g, "");
  const cleanTo = String(to).replace(/[^0-9]/g, "");

  console.log(`[WhatChimp Webhook] Flat payload parsed: From=+${cleanFrom}, Text="${text}", Has Media=${!!mediaUrl}`);

  if (cleanFrom === businessPhone || (cleanConfigured && cleanFrom === cleanConfigured)) {
    console.log("[WhatChimp Webhook] Ignoring outbound/status notification from the business number itself.");
    return new Response("OK", { status: 200 });
  }

  // Resolve candidate details and record follow-up reply (text extraction runs in background)
  const checkResult = await ctx.runMutation(internal.communications.whatsappOutbound.checkAndRecordFollowUpReply, {
    senderPhone: cleanFrom,
    textBody: text || "",
  });

  const isFollowUpReply = checkResult?.isFollowUpReply === true;

  // Handle incoming CV document — process for ALL candidates, including follow-up
  if (mediaUrl) {
    console.log(`[WhatChimp Webhook] Inbound media URL detected: ${mediaUrl}`);
    try {
      // 1. Download file from mediaUrl
      const fileResponse = await fetch(mediaUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file from WhatChimp media URL. Status: ${fileResponse.status}`);
      }
      const fileBlob = await fileResponse.blob();
      const fileSizeBytes = fileBlob.size;
      const fileBuffer = await fileBlob.arrayBuffer();

      // 2. Hash file
      const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
      const fileHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // 3. Store in Convex Native Storage
      const storageId = await ctx.storage.store(fileBlob);

      // 4. Resolve jobId — use follow-up application's job if available, keyword resolution, or active session
      let resolvedJobId = checkResult?.jobId ?? null;

      if (!resolvedJobId) {
        const firstWord = text ? text.trim().split(/\s+/)[0]?.toUpperCase() : "";
        if (firstWord) {
          const job = await ctx.runQuery(api.jobs.jobs.getByKeyword, { keyword: firstWord });
          if (job && job.status === "active") {
            resolvedJobId = job._id;
          }
        }
      }

      if (!resolvedJobId) {
        // Look up active session
        const session = await ctx.runQuery(api.communications.whatchimp.getSessionByPhone, {
          phone: cleanFrom,
        });
        if (session) {
          resolvedJobId = session.jobId;
          console.log(`[WhatChimp Webhook] Resolved job ID ${resolvedJobId} from session for +${cleanFrom}`);
          // Delete session now that it is consumed
          await ctx.runMutation(api.communications.whatchimp.deleteSession, {
            phone: cleanFrom,
          });
        }
      }

      if (!resolvedJobId) {
        console.warn(`[WhatChimp Webhook] Incoming resume from +${cleanFrom} could not be matched to an active job keyword or session.`);
        const activeJobs = await ctx.runQuery(api.jobs.jobs.list);
        const firstActive = activeJobs.find((j: any) => j.status === "active");
        if (firstActive) {
          resolvedJobId = firstActive._id;
          console.log(`[WhatChimp Webhook] Defaulted to active job: ${firstActive.title} (${firstActive.keyword})`);
        }
      }

      if (resolvedJobId) {
        // 5. Ingest into central pipeline
        await ctx.runMutation(api.pipeline.ingestion.processCvIngestion, {
          jobId: resolvedJobId,
          sourceChannel: "whatsapp",
          rawSender: cleanFrom,
          storageId,
          fileHash,
          fileName,
          fileType: mimeType || "application/pdf",
          fileSizeBytes,
        });
        console.log(`[WhatChimp Webhook] Ingested CV for candidate +${cleanFrom} under job ${resolvedJobId}`);
      } else {
        console.warn(`[WhatChimp Webhook] Inbound CV skipped: no active job found.`);
      }
    } catch (err: any) {
      console.error("[WhatChimp Webhook] Inbound media processing error:", err.message);
    }
  } else if (!isFollowUpReply) {
    // Text-only message from a non-follow-up candidate — keyword check and auto-response
    const firstWord = text ? text.trim().split(/\s+/)[0]?.toUpperCase() : "";
    if (firstWord) {
      const job = await ctx.runQuery(api.jobs.jobs.getByKeyword, { keyword: firstWord });
      if (job && job.status === "active") {
        console.log(`[WhatChimp Webhook] Received keyword ${firstWord} from +${cleanFrom} for job ${job.title}`);
        
        // 1. Create/Update WhatsApp Session mapping phone to job ID
        await ctx.runMutation(api.communications.whatchimp.upsertSession, {
          phone: cleanFrom,
          jobId: job._id,
          keyword: firstWord,
        });

        const apiToken = process.env.WHATCHIMP_API_TOKEN;
        const phoneNumberId = process.env.WHATCHIMP_PHONE_NUMBER_ID;
        if (apiToken && phoneNumberId) {
          const replyMessage = `Thank you for your interest in the ${job.title} position.\n\nPlease upload your latest CV to continue your application.`;
          const params = new URLSearchParams();
          params.append("apiToken", apiToken);
          params.append("phone_number_id", phoneNumberId.replace(/[^0-9]/g, ""));
          params.append("phone_number", cleanFrom);
          params.append("message", replyMessage);

          await fetch("https://app.whatchimp.com/api/v1/whatsapp/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: params
          }).then(r => r.text()).then(t => console.log("[WhatChimp Webhook] Sent auto-response:", t)).catch(console.error);
        }
      }
    }
  }

  return new Response("OK", { status: 200 });
});

export const getSessionByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("whatsappSessions")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();
  },
});

export const upsertSession = mutation({
  args: {
    phone: v.string(),
    jobId: v.id("jobs"),
    keyword: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappSessions")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        jobId: args.jobId,
        keyword: args.keyword,
        lastInteractionAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("whatsappSessions", {
        phone: args.phone,
        jobId: args.jobId,
        keyword: args.keyword,
        lastInteractionAt: now,
      });
    }
  },
});

export const deleteSession = mutation({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappSessions")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
