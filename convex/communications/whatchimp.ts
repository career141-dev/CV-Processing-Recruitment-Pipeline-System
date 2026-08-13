import { httpAction, mutation, query, action, internalAction, internalMutation } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { getOpenAI, getModelForTask } from "../lib/llm";
import { sendMetaFreeText } from "./metaDirectSender";

export function matchJobFromText(jobs: any[], textBody: string): { matchedJob: any | null; matchedKeyword: string; isAmbiguous: boolean } {
  const upperText = textBody.trim().toUpperCase();
  const strippedUpper = upperText.replace(/^APPLY\s+/i, "").trim();

  if (!strippedUpper) return { matchedJob: null, matchedKeyword: "", isAmbiguous: false };

  interface CandidateMatch {
    job: any;
    matchedKeyword: string;
    matchType: "exact" | "prefix" | "substring";
    matchedLength: number;
  }

  const matches: CandidateMatch[] = [];

  for (const job of jobs) {
    const kUpper = (job.keyword || "").trim().toUpperCase();
    const tUpper = (job.title || "").trim().toUpperCase();

    // 1. Check Keyword
    if (kUpper.length >= 2) {
      if (strippedUpper === kUpper) {
        matches.push({ job, matchedKeyword: job.keyword, matchType: "exact", matchedLength: kUpper.length });
      } else if (upperText.startsWith(kUpper) || strippedUpper.startsWith(kUpper)) {
        matches.push({ job, matchedKeyword: job.keyword, matchType: "prefix", matchedLength: kUpper.length });
      } else if (upperText.includes(kUpper)) {
        matches.push({ job, matchedKeyword: job.keyword, matchType: "substring", matchedLength: kUpper.length });
      }
    }

    // 2. Check Title
    if (tUpper.length >= 3) {
      if (strippedUpper === tUpper) {
        matches.push({ job, matchedKeyword: job.title, matchType: "exact", matchedLength: tUpper.length });
      } else if (upperText.startsWith(tUpper) || strippedUpper.startsWith(tUpper)) {
        matches.push({ job, matchedKeyword: job.title, matchType: "prefix", matchedLength: tUpper.length });
      } else if (upperText.includes(tUpper)) {
        matches.push({ job, matchedKeyword: job.title, matchType: "substring", matchedLength: tUpper.length });
      }
    }
  }

  if (matches.length === 0) {
    return { matchedJob: null, matchedKeyword: "", isAmbiguous: false };
  }

  const matchTypeScore = { exact: 3, prefix: 2, substring: 1 };
  matches.sort((a, b) => {
    const typeDiff = matchTypeScore[b.matchType] - matchTypeScore[a.matchType];
    if (typeDiff !== 0) return typeDiff;
    return b.matchedLength - a.matchedLength;
  });

  const bestMatch = matches[0];

  if (matches.length > 1) {
    const secondMatch = matches[1];
    if (
      secondMatch.job._id !== bestMatch.job._id &&
      matchTypeScore[secondMatch.matchType] === matchTypeScore[bestMatch.matchType] &&
      secondMatch.matchedLength === bestMatch.matchedLength
    ) {
      console.warn(`[Job Matching] Ambiguous match detected for text "${textBody}": Job A="${bestMatch.job.title}" vs Job B="${secondMatch.job.title}". Flagging as ambiguous.`);
      return { matchedJob: null, matchedKeyword: "", isAmbiguous: true };
    }
  }

  return { matchedJob: bestMatch.job, matchedKeyword: bestMatch.matchedKeyword, isAmbiguous: false };
}


export const handleWhatChimpWebhook = httpAction(async (ctx, request) => {
  const webhookSecret = process.env.WHATCHIMP_WEBHOOK_SECRET;
  if (webhookSecret) {
    const receivedSecret = request.headers.get("x-whatchimp-secret") || request.headers.get("x-webhook-secret") || new URL(request.url).searchParams.get("secret");
    if (receivedSecret !== webhookSecret) {
      console.warn("[WhatChimp Webhook] Unauthorized request missing valid secret.");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const bodyText = await request.text();
  console.log("[WhatChimp Webhook] Raw body received (first 500 chars):", bodyText.substring(0, 500));

  let body: any;
  try {
    body = JSON.parse(bodyText);
  } catch (err: any) {
    console.error("[WhatChimp Webhook] Failed to parse JSON:", err.message);
    return new Response("Invalid JSON", { status: 400 });
  }

  const configuredPhone = process.env.WHATCHIMP_PHONE_NUMBER_ID || "";
  const cleanConfigured = configuredPhone.replace(/[^0-9]/g, "");
  const businessPhone = cleanConfigured;

  // 0. Early return for Meta status-only webhooks (delivery receipts, read receipts)
  // These have entry[0].changes[0].value.statuses but NO .messages — they contain zero text
  if (body.entry && body.entry[0]?.changes && body.entry[0].changes[0]?.value?.statuses && !body.entry[0].changes[0]?.value?.messages) {
    const statusObj = body.entry[0].changes[0].value.statuses[0];
    console.log("[Meta Status Webhook] Status update received:", JSON.stringify(statusObj));
    if (statusObj?.errors) {
      console.error("[Meta Status Webhook ERROR]:", JSON.stringify(statusObj.errors));
    }
    return new Response("OK", { status: 200 });
  }

  // 1. Check if it's a standard Meta WhatsApp Webhook payload
  if (body.entry && body.entry[0]?.changes && body.entry[0].changes[0]?.value?.messages) {
    console.log("[WhatChimp Webhook] Auto-detected standard Meta payload format.");
    const value = body.entry[0].changes[0].value;
    const toNumber = value.metadata?.display_phone_number || "WhatChimp Number";

    for (const message of value.messages) {
      const fromNumber = message.from;
      const cleanFromNumber = fromNumber.replace(/[^0-9]/g, "");

      const isCandidateReply = await ctx.runQuery(internal.communications.whatsappOutbound.isCandidatePhone, { phone: cleanFromNumber });
      const isTaNumber = await ctx.runQuery(internal.settings.whatsappNumbers.isTaNumber, { phone: cleanFromNumber });

      if (!isCandidateReply && (cleanFromNumber === businessPhone || (cleanConfigured && cleanFromNumber === cleanConfigured) || isTaNumber)) {
        console.log("[WhatChimp Webhook] Ignoring Meta message from business/TA number itself.");
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
        const textBody = message.text?.body || message.body || message.text || "";
        const cleanSender = cleanFromNumber;
        console.log(`[WhatChimp Webhook] Meta text message from +${cleanSender}: "${String(textBody).substring(0, 200)}" (type=${message.type}, has text.body=${!!message.text?.body})`);

        const activeJobs = await ctx.runQuery(api.jobs.jobs.getActiveJobsBasicInfo);
        const { matchedJob, matchedKeyword } = matchJobFromText(activeJobs, textBody);


        let isKeyword = false;
        if (matchedJob && matchedJob.status === "active") {
          isKeyword = true;
          console.log(`[WhatChimp Webhook] Received Meta keyword "${matchedKeyword}" from +${cleanSender} for job ${matchedJob.title}`);
          
          // Create/Update Session
          await ctx.runMutation(api.communications.whatchimp.upsertSession, {
            phone: cleanSender,
            jobId: matchedJob._id,
            keyword: matchedKeyword,
            metaSourceUrl: message.referral?.source_url,
            metaSourceId: message.referral?.source_id,
            metaHeadline: message.referral?.headline,
          });

          const fetchedPhoneId = await ctx.runQuery(internal.communications.whatsappOutbound.getMetaPhoneNumberId, { 
            targetWhatsAppNumber: toNumber 
          });
          const phoneNumberId = fetchedPhoneId || process.env.META_PHONE_NUMBER_ID || "965783109962872";

          const fullJob = await ctx.runQuery(api.jobs.jobs.getJob, { jobId: matchedJob._id });

          if (phoneNumberId && !fullJob?.muteDefaultWhatsappReply) {
            const replyMessage = `Thank you for your interest in the ${matchedJob.title} position.\n\nPlease upload your latest CV to continue your application.`;
            const metaAccessToken = process.env.META_ACCESS_TOKEN || "";
            await sendMetaFreeText(phoneNumberId, cleanSender, replyMessage, metaAccessToken)
              .then(r => { if (!r.success) console.error("[WhatsApp Webhook] Keyword reply failed:", r.error); })
              .catch(console.error);
          } else if (fullJob?.muteDefaultWhatsappReply) {
            console.log(`[WhatChimp Webhook] Skipped default reply for ${matchedKeyword} because muteDefaultWhatsappReply is true`);
          }
        }

        if (!isKeyword) {
          const checkResult = await ctx.runMutation(internal.communications.whatsappOutbound.checkAndRecordFollowUpReply, {
            senderPhone: cleanSender,
            textBody,
          });

          if (!checkResult?.isFollowUpReply) {
             const session = await ctx.runQuery(api.communications.whatchimp.getSessionByPhone, { phone: cleanSender });
             if (session) {
                console.log(`[WhatChimp Webhook] Pre-application chat detected for +${cleanSender}. Dispatching LLM handler.`);
                await ctx.scheduler.runAfter(0, internal.communications.whatchimp.handlePreApplicationChat, {
                  phone: cleanSender,
                  textBody,
                  jobId: session.jobId,
                });
             }
          }
        }
      }
    }
    return new Response("OK", { status: 200 });
  }

  // 2. Check if it's a flat custom WhatChimp payload format
  const payload = (typeof body.data === "object" && body.data !== null) ? body.data :
                  (typeof body.payload === "object" && body.payload !== null) ? body.payload : body;

  // 1.5 Check for WhatChimp-specific status/echo/outgoing webhooks that should not be processed as candidate inbound
  const isAgentOutbound = !!(payload.agent_name || payload.agent_id || body.agent_name || body.agent_id);
  if (isAgentOutbound) {
    console.log(`[WhatChimp Webhook] Ignoring WhatChimp outbound agent/bot event`);
    return new Response("OK", { status: 200 });
  }

  const wcEventType = String(body.webhook_type || body.event_type || body.event || body.type || body.action || payload?.webhook_type || payload?.event_type || "").toLowerCase();
  if (wcEventType && ["outgoing_message", "outgoing", "sent_message", "message_status", "status_update", "delivery", "read", "sent", "delivered", "failed", "typing", "presence"].includes(wcEventType)) {
    console.log(`[WhatChimp Webhook] Ignoring WhatChimp outgoing/status event type: ${wcEventType}`);
    return new Response("OK", { status: 200 });
  }

  const extractMessageText = (msg: any): string | undefined => {
    if (typeof msg === "string") return msg;
    if (typeof msg === "object" && msg !== null) {
      if (typeof msg.text === "string") return msg.text;
      if (typeof msg.caption === "string") return msg.caption;
      if (typeof msg.body === "string") return msg.body;
      if (typeof msg.message === "string") return msg.message;
      if (typeof msg.content === "string") return msg.content;
      if (typeof msg.message_text === "string") return msg.message_text;
      if (typeof msg.text_body === "string") return msg.text_body;
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

  const from = payload.chat_id || payload.from || payload.phone || payload.sender || payload.phone_number || payload.mobile || 
               (payload.subscriber_id && typeof payload.subscriber_id === "string" && payload.subscriber_id.split("-")[0]) || payload.subscriber_id ||
               body.chat_id || body.from || body.phone || body.sender || body.phone_number || body.mobile ||
               (body.subscriber_id && typeof body.subscriber_id === "string" && body.subscriber_id.split("-")[0]) || body.subscriber_id;
  
  let text = extractMessageText(payload.user_message) || 
             extractMessageText(payload.message) || 
             extractMessageText(payload.body) || 
             extractMessageText(payload.text) || 
             extractMessageText(payload.content) || 
             extractMessageText(payload.message_text) || 
             extractMessageText(payload.text_body) || 
             extractMessageText(payload.data?.message) || 
             extractMessageText(payload.data?.text) || 
             extractMessageText(body.user_message) || 
             extractMessageText(body.message) || 
             extractMessageText(body.body) || 
             extractMessageText(body.text) || 
             extractMessageText(body.content) || 
             extractMessageText(body.message_text) || "";
  if (typeof text !== "string") {
    text = "";
  }

  const mediaUrl = extractMediaUrl(payload.user_message) || extractMediaUrl(payload.message) || extractMediaUrl(payload.body) || payload.media_url || payload.file_url || payload.mediaUrl || payload.fileUrl ||
                   extractMediaUrl(body.user_message) || extractMediaUrl(body.message) || extractMediaUrl(body.body) || body.media_url || body.file_url || body.mediaUrl || body.fileUrl;
  const fileName = payload.filename || payload.fileName || body.filename || body.fileName || (mediaUrl ? mediaUrl.split("/").pop() : "cv.pdf") || "cv.pdf";
  const mimeType = payload.mime_type || payload.mimeType || body.mime_type || body.mimeType || "application/pdf";
  const to = payload.to || payload.receiver || payload.whatsapp_bot_username || payload.display_phone_number || body.to || body.receiver || body.whatsapp_bot_username || body.display_phone_number || "WhatChimp Number";

  if (!from) {
    console.warn("[WhatChimp Webhook] No sender identifier found in payload.");
    return new Response("Sender not found", { status: 400 });
  }

  const cleanFrom = String(from).replace(/[^0-9]/g, "");
  const cleanTo = String(to).replace(/[^0-9]/g, "");

  console.log(`[WhatChimp Webhook] Flat payload parsed: From=+${cleanFrom}, Text="${text?.substring(0, 200)}", TextLength=${text?.length || 0}, Has Media=${!!mediaUrl}`);

  // GUARD: If there's no text, no media, and no sender — this is a status/echo webhook, skip it
  if (!text && !mediaUrl) {
    console.log(`[WhatChimp Webhook] No text and no media from +${cleanFrom}. Likely a status/echo webhook. Skipping.`);
    return new Response("OK", { status: 200 });
  }

  // Non-media text message processing (Keywords, Pre-App Questions, Follow-up Replies)
  if (!mediaUrl && text) {
    const evalResult = await ctx.runMutation(internal.communications.whatchimp.processInboundTextWebhook, {
      cleanFrom,
      cleanTo,
      text,
    });

    if (evalResult.action === "send_keyword_reply") {
      if (!evalResult.muteDefaultReply) {
        const fetchedPhoneId = await ctx.runQuery(internal.communications.whatsappOutbound.getMetaPhoneNumberId, { 
          targetWhatsAppNumber: cleanTo 
        });
        const phoneNumberId = fetchedPhoneId || process.env.META_PHONE_NUMBER_ID || "965783109962872";
        const replyMessage = `Thank you for your interest in the ${evalResult.jobTitle} position.\n\nPlease upload your latest CV to continue your application.`;
        const metaAccessToken = process.env.META_ACCESS_TOKEN || "";
        await sendMetaFreeText(phoneNumberId, cleanFrom, replyMessage, metaAccessToken)
          .then(r => { if (!r.success) console.error("[WhatsApp Webhook] Keyword reply failed:", r.error); })
          .catch(console.error);
      }
      return new Response("OK", { status: 200 });
    }

    if (evalResult.action === "dispatch_pre_app_chat") {
      console.log(`[WhatChimp Webhook] Pre-application chat detected for +${cleanFrom}. Dispatching LLM handler.`);
      await ctx.scheduler.runAfter(0, internal.communications.whatchimp.handlePreApplicationChat, {
        phone: cleanFrom,
        textBody: text,
        jobId: evalResult.jobId as any,
      });
      return new Response("OK", { status: 200 });
    }

    if (evalResult.action === "send_job_prompt") {
      console.log(`[WhatChimp Webhook] No keyword and no session for +${cleanFrom}. Sending job prompt.`);
      const fetchedPhoneId = await ctx.runQuery(internal.communications.whatsappOutbound.getMetaPhoneNumberId, { 
        targetWhatsAppNumber: cleanTo 
      });
      const phoneNumberId = fetchedPhoneId || process.env.META_PHONE_NUMBER_ID || "965783109962872";
      const replyMessage = `Hello! Thank you for reaching out to Career141.\n\nWhich position are you interested in applying for? Please reply with the job title or keyword (e.g., Graphic Designer, Video Editor) or upload your CV as a PDF to apply!`;
      const metaAccessToken = process.env.META_ACCESS_TOKEN || "";
      await sendMetaFreeText(phoneNumberId, cleanFrom, replyMessage, metaAccessToken)
        .then(r => { if (!r.success) console.error("[WhatsApp Webhook] Job prompt reply failed:", r.error); })
        .catch(console.error);
      return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  }

  // Handle incoming CV document
  if (mediaUrl) {
    const isNonDocumentMedia = String(fileName).toLowerCase().match(/\.(jpeg|jpg|png|webp|gif|mp4|mp3|ogg|wav)$/) != null || 
                               (typeof body.user_message === 'object' && body.user_message !== null && ["image", "sticker", "video", "audio", "reaction"].includes(body.user_message.type));
                               
    if (isNonDocumentMedia) {
      console.log(`[WhatChimp Webhook] Ignoring non-document media: ${fileName}`);
      return new Response("OK", { status: 200 });
    }

    console.log(`[WhatChimp Webhook] Inbound media URL detected: ${mediaUrl}`);
    try {
      const fileResponse = await fetch(mediaUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file from WhatChimp media URL. Status: ${fileResponse.status}`);
      }
      const fileBlob = await fileResponse.blob();
      const fileBuffer = await fileBlob.arrayBuffer();

      const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
      const fileHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const bytes = new Uint8Array(fileBuffer);
      let binary = "";
      const len = bytes.byteLength;
      const chunkSize = 0x8000; // 32KB chunks
      for (let i = 0; i < len; i += chunkSize) {
        binary += String.fromCharCode.apply(
          null,
          bytes.subarray(i, Math.min(i + chunkSize, len)) as any
        );
      }
      const base64Data = btoa(binary);

      const s3Key = await ctx.runAction(internal.storage.r2.uploadBufferToR2, {
        fileName: fileName ?? "cv.pdf",
        contentType: mimeType || "application/pdf",
        base64Data,
      });

      let resolvedJobId: string | null | undefined = null;
      let isPaused = false;
      let metaSourceUrl, metaSourceId, metaHeadline;

      if (text) {
        const upperText = text.toUpperCase();
        const activeJobs = await ctx.runQuery(api.jobs.jobs.getActiveJobsBasicInfo);
        for (const job of activeJobs) {
          // Only route to jobs where WhatsApp is an active (not paused) source
          const pausedChannels: string[] = (job as any).pausedChannels || [];
          if (pausedChannels.includes("whatsapp")) continue;
          if (job.keyword && upperText.includes(job.keyword.toUpperCase())) {
            resolvedJobId = job._id;
            if ((job as any).pausedChannels?.includes("whatsapp")) isPaused = true;
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
          console.log(`[WhatChimp Webhook] Resolved job ID ${resolvedJobId} from session for +${cleanFrom}`);
        }
      }

      const ingestionResult = await ctx.runMutation(api.pipeline.ingestion.processCvIngestion, {
        jobId: resolvedJobId ? (resolvedJobId as any) : undefined,
        fileName: fileName ?? "cv.pdf",
        fileSizeBytes: fileBuffer.byteLength,
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
      console.log(`[WhatChimp Webhook] Ingested CV for candidate +${cleanFrom} (jobId: ${resolvedJobId}). Result:`, ingestionResult);

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
      console.error("[WhatChimp Webhook] Inbound media processing error:", err.message);
    }
  }

  return new Response("OK", { status: 200 });
});

export const processInboundTextWebhook = internalMutation({
  args: {
    cleanFrom: v.string(),
    cleanTo: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const { cleanFrom, cleanTo, text } = args;

    // 1. Fetch active & paused jobs directly from DB
    const activeJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const pausedJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "on_hold"))
      .collect();
    const allJobs = [...activeJobs, ...pausedJobs];

    // 2. Check for Keyword / Title Match
    const { matchedJob, matchedKeyword } = matchJobFromText(allJobs, text);

    if (matchedJob) {
      const existingSession = await ctx.db
        .query("whatsappSessions")
        .withIndex("by_phone", (q) => q.eq("phone", cleanFrom))
        .first();

      if (existingSession) {
        await ctx.db.patch(existingSession._id, {
          jobId: matchedJob._id,
          keyword: matchedKeyword,
          lastInteractionAt: Date.now(),
        });
      } else {
        await ctx.db.insert("whatsappSessions", {
          phone: cleanFrom,
          jobId: matchedJob._id,
          keyword: matchedKeyword,
          lastInteractionAt: Date.now(),
        });
      }

      return {
        action: "send_keyword_reply",
        jobTitle: matchedJob.title as string,
        muteDefaultReply: matchedJob.muteDefaultWhatsappReply === true,
      };
    }

    // 3. Check for Active Candidate Follow-Up Reply
    const candidate = await ctx.db
      .query("candidates")
      .withIndex("by_phoneClean", (q) => q.eq("phoneClean", cleanFrom))
      .first() || await ctx.db
      .query("candidates")
      .withIndex("by_phone", (q) => q.eq("phone", "+" + cleanFrom))
      .first();

    if (candidate) {
      const apps = await ctx.db
        .query("applications")
        .withIndex("by_candidateId", (q) => q.eq("candidateId", candidate._id))
        .collect();

      const activeApp = apps.find(
        (a) => a.currentStage !== "rejected" && a.currentStage !== "placed"
      );

      if (activeApp) {
        // Deduplication check (30 seconds)
        const thirtySecAgo = Date.now() - 30 * 1000;
        const recentInbound = await ctx.db
          .query("communications")
          .withIndex("by_candidate_time", (q) => q.eq("candidateId", candidate._id))
          .order("desc")
          .first();

        if (!recentInbound || Number(recentInbound.sentAt) <= thirtySecAgo || recentInbound.body !== text) {
          await ctx.db.insert("communications", {
            candidateId: candidate._id,
            applicationId: activeApp._id,
            jobId: activeApp.jobId,
            direction: "inbound",
            channel: "whatsapp",
            body: text,
            deliveryStatus: "read",
            sentAt: Date.now(),
            stoppedSequence: false,
          });

          await ctx.db.patch(activeApp._id, {
            lastCandidateReplyAt: Date.now(),
          });

          if (text.trim().length > 2) {
            await ctx.scheduler.runAfter(0, internal.communications.inboundExtraction.extractDetailsFromText, {
              candidateId: candidate._id,
              textBody: text,
            });
          }
        }

        return { action: "ignore" };
      }
    }

    // 4. Pre-App Chat Session (if session exists for candidate)
    let session = await ctx.db
      .query("whatsappSessions")
      .withIndex("by_phone", (q) => q.eq("phone", cleanFrom))
      .first();

    if (session) {
      const job = await ctx.db.get(session.jobId);
      if (job && !job.muteDefaultWhatsappReply) {
        return { action: "dispatch_pre_app_chat", jobId: job._id };
      }
    }

    // IF NO KEYWORD AND NO EXISTING SESSION: Prompt candidate for job title
    return { action: "send_job_prompt" };
  },
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
    metaSourceUrl: v.optional(v.string()),
    metaSourceId: v.optional(v.string()),
    metaHeadline: v.optional(v.string()),
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
        metaSourceUrl: args.metaSourceUrl ?? existing.metaSourceUrl,
        metaSourceId: args.metaSourceId ?? existing.metaSourceId,
        metaHeadline: args.metaHeadline ?? existing.metaHeadline,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("whatsappSessions", {
        phone: args.phone,
        jobId: args.jobId,
        keyword: args.keyword,
        lastInteractionAt: now,
        metaSourceUrl: args.metaSourceUrl,
        metaSourceId: args.metaSourceId,
        metaHeadline: args.metaHeadline,
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

export const getConfiguredNumbers = action({
  args: {},
  handler: async (ctx) => {
    const apiToken = process.env.WHATCHIMP_API_TOKEN;
    if (!apiToken) {
      console.warn("[WhatChimp] No WHATCHIMP_API_TOKEN configured");
      return [];
    }
    
    try {
      // Pass apiToken as a query parameter for the GET request
      const response = await fetch(`https://app.whatchimp.com/api/v1/whatsapp/numbers?apiToken=${encodeURIComponent(apiToken)}`);
      if (!response.ok) {
        console.error("[WhatChimp] Failed to fetch numbers, status:", response.status);
        return [];
      }
      
      const data = await response.json();
      // Assuming the response is an array of number objects like [{ number: "94770000001", id: "123" }, ...]
      // or { data: [...] }
      const numbersList = Array.isArray(data) ? data : (data.data || []);
      
      // Extract just the phone strings, cleaning them up
      return numbersList
        .map((n: any) => n.phone_number || n.number || n.phone || n.display_phone_number || typeof n === 'string' ? n : null)
        .filter(Boolean)
        .map((n: string) => "+" + n.replace(/[^0-9]/g, ""));
    } catch (err: any) {
      console.error("[WhatChimp] Error fetching numbers:", err.message);
      return [];
    }
  },
});

export const testFetchWhatChimp = action({
  args: {},
  handler: async (ctx) => {
    const apiToken = process.env.WHATCHIMP_API_TOKEN;
    if (!apiToken) return { error: "No API token" };
    try {
      const response = await fetch(`https://app.whatchimp.com/api/v1/whatsapp/numbers?apiToken=${encodeURIComponent(apiToken)}`);
      const text = await response.text();
      return { status: response.status, body: text };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});

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

      const openai = getOpenAI("jd_matching"); // Use a fast chat model
      const model = getModelForTask("jd_matching");

      const systemPrompt = `You are an intelligent recruitment assistant for Career141. 
The candidate is interested in the "${job.title}" position. 
Job Description: ${job.jobDescription.substring(0, 2000)}
Salary: ${job.salaryMin ? job.salaryMin + " to " + job.salaryMax + " " + (job.salaryCurrency || "") : "Not specified"}
Location: ${job.location || "Not specified"}

The candidate has NOT uploaded their CV yet. They just asked a question.
Answer their question politely and accurately based ONLY on the provided job details. Keep it very concise (1-2 short sentences max). Do not hallucinate details.
ALWAYS end your message by reminding them to "Please upload your CV as a PDF to apply!"`;

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: args.textBody }
        ],
        temperature: 0.5,
      });

      const replyMessage = completion.choices[0]?.message?.content?.trim();
      if (!replyMessage) return;

      console.log(`[PreApp Chat] Replying to +${args.phone}: ${replyMessage.substring(0, 100)}...`);

      const apiToken = process.env.WHATCHIMP_API_TOKEN;
      
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


