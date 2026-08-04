import { httpAction, mutation, query, action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { getOpenAI, getModelForTask } from "../lib/llm";

export const handleWhatChimpWebhook = httpAction(async (ctx, request) => {
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
    console.log("[WhatChimp Webhook] Ignoring Meta status-only webhook (delivery/read receipt).");
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
              metaSourceUrl: message.referral?.source_url,
              metaSourceId: message.referral?.source_id,
              metaHeadline: message.referral?.headline,
            });

            const apiToken = process.env.WHATCHIMP_API_TOKEN;
            const fetchedPhoneId = await ctx.runQuery(internal.communications.whatsappOutbound.getWhatChimpPhoneId, { 
              targetWhatsAppNumber: toNumber 
            });
            const phoneNumberId = fetchedPhoneId || process.env.WHATCHIMP_PHONE_NUMBER_ID;

            if (apiToken && phoneNumberId && !job.muteDefaultWhatsappReply) {
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
            } else if (job.muteDefaultWhatsappReply) {
              console.log(`[WhatChimp Webhook] Skipped default reply for ${firstWord} because muteDefaultWhatsappReply is true`);
            }
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

  // 1.5 Check for WhatChimp-specific status/echo webhooks that have no meaningful content
  // These include delivery notifications, typing indicators, and system messages
  const wcEventType = body.event_type || body.event || body.type || body.action || payload?.event_type;
  if (wcEventType && typeof wcEventType === "string" && ["message_status", "status_update", "delivery", "read", "sent", "delivered", "failed", "typing", "presence"].includes(wcEventType.toLowerCase())) {
    console.log(`[WhatChimp Webhook] Ignoring WhatChimp event type: ${wcEventType}`);
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

  // Pre-check: if text starts with a known job keyword, it's a new applicant — skip follow-up check
  let isNewKeywordMessage = false;
  if (!mediaUrl && text) {
    const firstWordUpper = text.trim().split(/\s+/)[0]?.toUpperCase() || "";
    if (firstWordUpper) {
      const activeJobsCheck = await ctx.runQuery(api.jobs.jobs.getActiveJobsBasicInfo);
      isNewKeywordMessage = activeJobsCheck.some((j: any) => j.keyword && j.keyword.toUpperCase() === firstWordUpper);
    }
  }

  // 1. First, check if this is an active Candidate Follow-Up Reply (ONLY if text is not empty)
  const checkResult = (!mediaUrl && !isNewKeywordMessage && text && text.trim().length > 0) ? await ctx.runMutation(internal.communications.whatsappOutbound.checkAndRecordFollowUpReply, {
    senderPhone: cleanFrom,
    textBody: text,
  }) : null;

  const isFollowUpReply = checkResult?.isFollowUpReply === true;

  // 2. Only ignore if it is a TA/Business number AND NOT an active candidate follow-up reply
  if (!isFollowUpReply) {
    const isTaNumberCustom = await ctx.runQuery(internal.settings.whatsappNumbers.isTaNumber, { phone: cleanFrom });
    if (cleanFrom === businessPhone || (cleanConfigured && cleanFrom === cleanConfigured) || isTaNumberCustom) {
      console.log("[WhatChimp Webhook] Ignoring outbound/status notification from the business/TA number itself.");
      return new Response("OK", { status: 200 });
    }
  }

  // 2. Pre-Application Conversational AI (Only if NOT an active candidate follow-up reply)
  let isPreAppChat = false;
  if (!mediaUrl && !isNewKeywordMessage && !isFollowUpReply && text) {
    const session = await ctx.runQuery(api.communications.whatchimp.getSessionByPhone, {
      phone: cleanFrom,
    });
    if (session) {
      const job = await ctx.runQuery(api.jobs.jobs.getJob, { jobId: session.jobId });
      if (job && !job.muteDefaultWhatsappReply) {
        isPreAppChat = true;
        console.log(`[WhatChimp Webhook] Pre-application chat detected for +${cleanFrom}. Dispatching LLM handler.`);
        await ctx.scheduler.runAfter(0, internal.communications.whatchimp.handlePreApplicationChat, {
          phone: cleanFrom,
          textBody: text,
          jobId: session.jobId,
        });
      } else {
        console.log(`[WhatChimp Webhook] Pre-app chat skipped for +${cleanFrom} because muteDefaultWhatsappReply is enabled.`);
      }
    }
  }

  // Handle incoming CV document — process for ALL candidates, including follow-up
  if (mediaUrl) {
    const isNonDocumentMedia = String(fileName).toLowerCase().match(/\.(jpeg|jpg|png|webp|gif|mp4|mp3|ogg|wav)$/) != null || 
                               (typeof body.user_message === 'object' && body.user_message !== null && ["image", "sticker", "video", "audio", "reaction"].includes(body.user_message.type));
                               
    if (isNonDocumentMedia) {
      console.log(`[WhatChimp Webhook] Ignoring non-document media (image/sticker/video): ${fileName}`);
      return new Response("OK", { status: 200 });
    }

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

      // 3. Store in Cloudflare R2
      const base64Data = Buffer.from(fileBuffer).toString("base64");
      const s3Key = await ctx.runAction(internal.storage.r2.uploadBufferToR2, {
        fileName: fileName ?? "cv.pdf",
        contentType: mimeType || "application/pdf",
        base64Data,
      });

      // 4. Extract keyword if message text is present
      let resolvedJobId: string | null | undefined = null;
      let isPaused = false;
      let metaSourceUrl, metaSourceId, metaHeadline;

      if (text) {
        const upperText = text.toUpperCase();
        const activeJobs = await ctx.runQuery(api.jobs.jobs.getActiveJobsBasicInfo);
        for (const job of activeJobs) {
          if (job.keyword && upperText.includes(job.keyword.toUpperCase())) {
            resolvedJobId = job._id;
            if (job.pausedChannels?.includes("whatsapp")) isPaused = true;
            break;
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
          metaSourceUrl = session.metaSourceUrl;
          metaSourceId = session.metaSourceId;
          metaHeadline = session.metaHeadline;
          console.log(`[WhatChimp Webhook] Resolved job ID ${resolvedJobId} from session for +${cleanFrom}`);
          // Delete session now that it is consumed
          await ctx.runMutation(api.communications.whatchimp.deleteSession, {
            phone: cleanFrom,
          });
          const activeJobs = await ctx.runQuery(api.jobs.jobs.getActiveJobsBasicInfo);
          const matchedJob = activeJobs.find((j: any) => j._id === resolvedJobId);
          if (matchedJob?.pausedChannels?.includes("whatsapp")) isPaused = true;
        }
      }

      if (isPaused) {
        console.log(`[WhatChimp Webhook] Job ${resolvedJobId} has WhatsApp paused. Dropping CV to general pool.`);
        resolvedJobId = undefined; // Drop to general pool
      } else if (resolvedJobId === null) {
        // No active session — candidate did not send a keyword first. Reject silently.
        console.warn(`[WhatChimp Webhook] No active session for +${cleanFrom}. CV rejected silently — no keyword was sent first.`);
        return new Response("OK", { status: 200 });
      }

      // 5. Ingest into central pipeline (only reached when a valid session/job exists)
      const ingestionResult = await ctx.runMutation(api.pipeline.ingestion.processCvIngestion, {
        jobId: resolvedJobId as any,
        sourceChannel: "whatsapp",
        rawSender: cleanFrom,
        s3Key: s3Key,
        storageProvider: "r2",
        fileHash,
        fileName,
        fileType: mimeType || "application/pdf",
        fileSizeBytes,
        metaSourceUrl,
        metaSourceId,
        metaHeadline,
      });
      console.log(`[WhatChimp Webhook] Ingested CV for candidate +${cleanFrom} (jobId: ${resolvedJobId}). Result:`, ingestionResult);

      // 6. Send acknowledgment back to candidate
      const apiToken = process.env.WHATCHIMP_API_TOKEN;
      const fetchedPhoneId = await ctx.runQuery(internal.communications.whatsappOutbound.getWhatChimpPhoneId, { 
        targetWhatsAppNumber: cleanTo 
      });
      const phoneNumberId = fetchedPhoneId || process.env.WHATCHIMP_PHONE_NUMBER_ID;
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
    if (text) {
      const upperText = text.toUpperCase();
      const activeJobs = await ctx.runQuery(api.jobs.jobs.getActiveJobsBasicInfo);
      
      let matchedJob = null;
      let matchedKeyword = "";
      
      for (const job of activeJobs) {
        if (job.keyword && upperText.includes(job.keyword.toUpperCase())) {
          matchedJob = job;
          matchedKeyword = job.keyword;
          break;
        }
      }

      if (matchedJob) {
        console.log(`[WhatChimp Webhook] Found keyword ${matchedKeyword} in message from +${cleanFrom} for job ${matchedJob.title}`);
        
        // Fetch full job record to check muteDefaultWhatsappReply flag
        const fullJob = await ctx.runQuery(api.jobs.jobs.getJob, { jobId: matchedJob._id });

        // 1. Create/Update WhatsApp Session mapping phone to job ID
        await ctx.runMutation(api.communications.whatchimp.upsertSession, {
          phone: cleanFrom,
          jobId: matchedJob._id,
          keyword: matchedKeyword,
          metaSourceUrl: body.referral?.source_url || body.user_message?.referral?.source_url,
          metaSourceId: body.referral?.source_id || body.user_message?.referral?.source_id,
          metaHeadline: body.referral?.headline || body.user_message?.referral?.headline,
        });

        const apiToken = process.env.WHATCHIMP_API_TOKEN;
        const phoneNumberId = process.env.WHATCHIMP_PHONE_NUMBER_ID;
        
        // Disabled globally per user request: External flows (WhatChimp/Meta) will handle all welcome messages.
        // Career141 will only send the final acknowledgment after receiving the CV document.
        /*
        if (apiToken && phoneNumberId && !fullJob?.muteDefaultWhatsappReply) {
          const replyMessage = `Thank you for your interest in the ${matchedJob.title} position.\n\nPlease upload your latest CV to continue your application.`;
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
        } else if (fullJob?.muteDefaultWhatsappReply) {
          console.log(`[WhatChimp Webhook] Skipped default reply for ${matchedKeyword} (flat path) because muteDefaultWhatsappReply is true`);
        }
        */
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
      let phoneNumberId = process.env.WHATCHIMP_PHONE_NUMBER_ID;
      if (outboundNumber) {
        const fetchedId = await ctx.runQuery(internal.communications.whatsappOutbound.getWhatChimpPhoneId, { 
          targetWhatsAppNumber: outboundNumber 
        });
        if (fetchedId) {
          phoneNumberId = fetchedId;
          console.log(`[PreApp Chat] Using dynamically resolved phone ID ${phoneNumberId} for job outreach number ${outboundNumber}`);
        }
      }
      
      if (apiToken && phoneNumberId) {
        const params = new URLSearchParams();
        params.append("apiToken", apiToken);
        params.append("phone_number_id", phoneNumberId.replace(/[^0-9]/g, ""));
        params.append("phone_number", args.phone);
        params.append("message", replyMessage);

        await fetch("https://app.whatchimp.com/api/v1/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params
        }).then(r => r.text()).catch(console.error);
      }
    } catch (e: any) {
      console.error("[PreApp Chat] Error:", e);
    }
  }
});


