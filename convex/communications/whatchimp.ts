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
        const cleanSender = cleanFromNumber;

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
              params.append("phone_number_id", phoneNumberId);
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
  const extractMessageText = (msg: any) => {
    if (typeof msg === "string") return msg;
    if (typeof msg === "object" && msg !== null) {
      if (typeof msg.text === "string") return msg.text;
      if (typeof msg.caption === "string") return msg.caption;
      if (typeof msg.body === "string") return msg.body;
    }
    return undefined;
  };

  const extractMediaUrl = (msg: any) => {
    if (typeof msg === "object" && msg !== null) {
      if (typeof msg.url === "string") return msg.url;
      if (typeof msg.media_url === "string") return msg.media_url;
      if (typeof msg.file_url === "string") return msg.file_url;
      if (typeof msg.link === "string") return msg.link;
    }
    return undefined;
  };

  const from = body.chat_id || body.from || body.phone || body.sender || body.phone_number || (body.subscriber_id && body.subscriber_id.split("-")[0]) || body.subscriber_id;
  
  let text = extractMessageText(body.user_message) || extractMessageText(body.message) || extractMessageText(body.body) || extractMessageText(body.text) || (typeof body.message_text === "string" ? body.message_text : undefined);
  if (typeof text !== "string") {
    text = "";
  }

  const mediaUrl = extractMediaUrl(body.user_message) || extractMediaUrl(body.message) || extractMediaUrl(body.body) || body.media_url || body.file_url || body.mediaUrl || body.fileUrl;
  const fileName = body.filename || body.fileName || (mediaUrl ? mediaUrl.split("/").pop() : "cv.pdf") || "cv.pdf";
  const mimeType = body.mime_type || body.mimeType || "application/pdf";
  const to = body.to || body.receiver || body.whatsapp_bot_username || body.display_phone_number || "WhatChimp Number";

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

  // Resolve candidate details (skip for media/document messages — textBody is not meaningful there)
  const checkResult = !mediaUrl ? await ctx.runMutation(internal.communications.whatsappOutbound.checkAndRecordFollowUpReply, {
    senderPhone: cleanFrom,
    textBody: text || "",
  }) : null;

  if (checkResult && checkResult.isFollowUpReply) {
    console.log(`[WhatChimp Webhook] Recorded follow-up reply from +${cleanFrom}`);
    return new Response("OK", { status: 200 });
  }

  // Handle incoming CV document
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
      const storageBlob = new Blob([fileBuffer], { type: mimeType || "application/pdf" });
      const storageId = await ctx.storage.store(storageBlob);

      // 4. Extract keyword if message text is present
      const firstWord = text ? text.trim().split(/\s+/)[0]?.toUpperCase() : "";
      let resolvedJobId = null;

      if (firstWord) {
        const job = await ctx.runQuery(api.jobs.jobs.getByKeyword, { keyword: firstWord });
        if (job && job.status === "active") {
          resolvedJobId = job._id;
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
        // No active session — candidate did not send a keyword first. Reject and instruct them.
        console.warn(`[WhatChimp Webhook] No active session for +${cleanFrom}. CV rejected — keyword required first.`);
        const apiToken = process.env.WHATCHIMP_API_TOKEN;
        const phoneNumberId = process.env.WHATCHIMP_PHONE_NUMBER_ID;
        if (apiToken && phoneNumberId) {
          const params = new URLSearchParams();
          params.append("apiToken", apiToken);
          params.append("phone_number_id", phoneNumberId.replace(/[^0-9]/g, ""));
          params.append("phone_number", cleanFrom);
          params.append("message", "To apply for a position, please first send the job keyword (e.g. BRAND24) and then upload your CV.");
          await fetch("https://app.whatchimp.com/api/v1/whatsapp/send", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params,
          }).then(r => r.text()).catch(console.error);
        }
        return new Response("OK", { status: 200 });
      }

      // 5. Ingest into central pipeline (only reached when a valid session/job exists)
      const ingestionResult = await ctx.runMutation(api.pipeline.ingestion.processCvIngestion, {
        jobId: resolvedJobId,
        sourceChannel: "whatsapp",
        rawSender: cleanFrom,
        storageId,
        fileHash,
        fileName,
        fileType: mimeType || "application/pdf",
        fileSizeBytes,
      });
      console.log(`[WhatChimp Webhook] Ingested CV for candidate +${cleanFrom} (jobId: ${resolvedJobId}). Result:`, ingestionResult);

      // 6. Send acknowledgment back to candidate
      const apiToken = process.env.WHATCHIMP_API_TOKEN;
      const phoneNumberId = process.env.WHATCHIMP_PHONE_NUMBER_ID;
      if (apiToken && phoneNumberId) {
        let replyMessage = "Thank you! Your CV has been successfully received and is being processed by our system. We will contact you if there is a match.";
        
        if (ingestionResult && (ingestionResult as any).reason === "duplicate_file") {
           replyMessage = "We already have this exact CV on file for this position. We'll be in touch if your profile matches our requirements. Thank you!";
        }
        
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
        }).then(r => r.text()).catch(console.error);
      }
    } catch (err: any) {
      console.error("[WhatChimp Webhook] Inbound media processing error:", err.message);
    }
  } else {
    // If text message only (e.g. initial keyword check)
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
