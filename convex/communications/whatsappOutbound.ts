import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { api, internal } from "../_generated/api";

export const sendWhatsApp = internalAction({
  args: {
    communicationId: v.id("communications"),
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Fetch candidate contact details
    const candidate = await ctx.runQuery(api.candidates.candidates.getCandidate, {
      id: args.candidateId,
    });

    if (!candidate || !candidate.phone) {
      console.error(`[WhatsApp Outbound] Candidate ${args.candidateId} has no phone number or was not found.`);
      await ctx.runMutation(internal.communications.whatsappOutbound.updateStatus, {
        communicationId: args.communicationId,
        status: "failed",
        error: "Candidate has no phone number or was not found",
      });
      return;
    }

    // 2. Resolve destination phone number based on test mode
    const isTestMode = process.env.WHATSAPP_TEST_MODE === "true";
    const testRecipient = process.env.WHATSAPP_TEST_RECIPIENT;

    let targetPhone = candidate.phone;
    let logNote = "";

    if (isTestMode) {
      if (!testRecipient) {
        console.error("[WhatsApp Outbound] WHATSAPP_TEST_MODE is true but WHATSAPP_TEST_RECIPIENT is not set.");
        await ctx.runMutation(internal.communications.whatsappOutbound.updateStatus, {
          communicationId: args.communicationId,
          status: "failed",
          error: "Test mode is active but WHATSAPP_TEST_RECIPIENT is not set in environment variables.",
        });
        return;
      }
      targetPhone = testRecipient;
      logNote = ` [REDIRECTED TO TEST NUMBER: ${testRecipient}]`;
    }

    // 3. Send message to WhatChimp API
    try {
      const apiKey = process.env.WHATCHIMP_API_TOKEN;
      const phoneId = process.env.WHATCHIMP_PHONE_NUMBER_ID;

      if (!apiKey || !phoneId) {
        console.error("[WhatsApp Outbound] WhatChimp configuration is missing.");
        await ctx.runMutation(internal.communications.whatsappOutbound.updateStatus, {
          communicationId: args.communicationId,
          status: "failed",
          error: "WhatChimp WHATCHIMP_API_TOKEN or WHATCHIMP_PHONE_NUMBER_ID is not configured in environment variables.",
        });
        return;
      }

      console.log(`[WhatsApp Outbound] Sending message to +${targetPhone.replace(/[^0-9]/g, '')}${logNote} via WhatChimp`);
      
      const cleanPhone = targetPhone.replace(/[^0-9]/g, "");
      const cleanPhoneId = phoneId.replace(/[^0-9]/g, "");

      const res = await fetch("https://app.whatchimp.com/api/v1/whatsapp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          apiToken: apiKey,
          phone_number_id: cleanPhoneId,
          phone_number: cleanPhone,
          message: args.body,
        }).toString(),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`WhatChimp API returned status ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      console.log(`[WhatsApp Outbound] WhatChimp response:`, JSON.stringify(data));

      if (data && (data.status === 0 || data.status === "0" || data.success === false)) {
        throw new Error(data.message || "WhatChimp API returned failure status.");
      }

      // Success
      await ctx.runMutation(internal.communications.whatsappOutbound.updateStatus, {
        communicationId: args.communicationId,
        status: "sent",
        error: isTestMode ? `Test mode active.${logNote} [Msg ID: ${data?.message_id || data?.messageId || 'unknown'}]` : undefined,
      });
      console.log(`[WhatsApp Outbound] Message successfully sent via WhatChimp.`);
    } catch (err: any) {
      console.error("[WhatsApp Outbound] Failed to dispatch via WhatChimp:", err.message);
      await ctx.runMutation(internal.communications.whatsappOutbound.updateStatus, {
        communicationId: args.communicationId,
        status: "failed",
        error: err.message,
      });
    }
  },
});

export const updateStatus = internalMutation({
  args: {
    communicationId: v.id("communications"),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("delivered")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.communicationId, {
      deliveryStatus: args.status,
      status: args.status === "failed" ? "failed" : "sent",
      errorMessage: args.error,
    });
  },
});

export const checkAndRecordFollowUpReply = internalMutation({
  args: {
    senderPhone: v.string(),
    textBody: v.string(),
  },
  handler: async (ctx, args) => {
    let targetPhone = args.senderPhone;
    const isTestMode = process.env.WHATSAPP_TEST_MODE === "true";
    const testRecipient = process.env.WHATSAPP_TEST_RECIPIENT;

    const cleanNum = (p: string) => p.replace(/[^0-9]/g, "");

    if (isTestMode && testRecipient && cleanNum(args.senderPhone) === cleanNum(testRecipient)) {
      const lastOutbound = await ctx.db
        .query("communications")
        .filter((q: any) => 
          q.and(
            q.eq(q.field("direction"), "outbound"),
            q.eq(q.field("channel"), "whatsapp")
          )
        )
        .order("desc")
        .first();

      if (lastOutbound) {
        const testCandidate = await ctx.db.get(lastOutbound.candidateId);
        if (testCandidate && testCandidate.phone) {
          targetPhone = testCandidate.phone;
          console.log(`[WhatsApp Test Mode] Mapped test sender ${args.senderPhone} to actual candidate phone: ${targetPhone}`);
        }
      }
    }

    const phoneClean = targetPhone.replace(/[^0-9]/g, "");

    // Find candidate by phone
    let candidate = await ctx.db
      .query("candidates")
      .withIndex("by_phone", (q: any) => q.eq("phone", targetPhone))
      .first();

    if (!candidate) {
      const candidates = await ctx.db.query("candidates").collect();
      candidate = candidates.find(c => {
        if (!c.phone) return false;
        const cPhoneClean = c.phone.replace(/[^0-9]/g, "");
        return cPhoneClean.endsWith(phoneClean) || phoneClean.endsWith(cPhoneClean);
      }) || null;
    }

    if (!candidate) return { isFollowUpReply: false };

    // Find active follow-up or auto-rejected application
    const activeApp = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidate!._id))
      .filter((q: any) =>
        q.or(
          q.eq(q.field("currentStage"), "follow_up"),
          q.and(
            q.eq(q.field("currentStage"), "rejected"),
            q.eq(q.field("taRejectionReason"), "Did not complete requirements within 7-day window")
          )
        )
      )
      .first();

    if (!activeApp) return { isFollowUpReply: false };

    // Insert inbound communication
    await ctx.db.insert("communications", {
      candidateId: candidate._id,
      applicationId: activeApp._id,
      jobId: activeApp.jobId,
      direction: "inbound",
      channel: "whatsapp",
      body: args.textBody,
      deliveryStatus: "read",
      sentAt: Date.now(),
      stoppedSequence: false,
    });

    // Run text extraction in background to parse details
    await ctx.scheduler.runAfter(0, internal.communications.inboundExtraction.extractDetailsFromText, {
      candidateId: candidate._id,
      textBody: args.textBody,
    });

    return { isFollowUpReply: true };
  },
});

export const processLocalWhatsappInbound = internalMutation({
  args: {
    senderPhone: v.string(),
    textBody: v.string(),
  },
  handler: async (ctx, args) => {
    let targetPhone = args.senderPhone;
    const isTestMode = process.env.WHATSAPP_TEST_MODE === "true";
    const testRecipient = process.env.WHATSAPP_TEST_RECIPIENT;

    const cleanNum = (p: string) => p.replace(/[^0-9]/g, "");

    if (isTestMode && testRecipient && cleanNum(args.senderPhone) === cleanNum(testRecipient)) {
      const lastOutbound = await ctx.db
        .query("communications")
        .filter((q: any) => 
          q.and(
            q.eq(q.field("direction"), "outbound"),
            q.eq(q.field("channel"), "whatsapp")
          )
        )
        .order("desc")
        .first();

      if (lastOutbound) {
        const testCandidate = await ctx.db.get(lastOutbound.candidateId);
        if (testCandidate && testCandidate.phone) {
          targetPhone = testCandidate.phone;
          console.log(`[WhatsApp Test Mode] Mapped test sender ${args.senderPhone} to actual candidate phone: ${targetPhone}`);
        }
      }
    }

    const phoneClean = targetPhone.replace(/[^0-9]/g, "");

    // Find candidate by phone number
    let candidate = await ctx.db
      .query("candidates")
      .withIndex("by_phone", (q: any) => q.eq("phone", targetPhone))
      .first();

    if (!candidate) {
      const candidates = await ctx.db.query("candidates").collect();
      candidate = candidates.find(c => {
        if (!c.phone) return false;
        const cPhoneClean = c.phone.replace(/[^0-9]/g, "");
        return cPhoneClean.endsWith(phoneClean) || phoneClean.endsWith(cPhoneClean);
      }) || null;
    }

    let activeApp = null;
    let job = null;

    if (candidate) {
      // Find active application
      activeApp = await ctx.db
        .query("applications")
        .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidate!._id))
        .filter((q: any) => q.eq(q.field("isActive"), true))
        .first();

      if (!activeApp) {
        // Fallback to any application
        activeApp = await ctx.db
          .query("applications")
          .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidate!._id))
          .first();
      }

      if (activeApp) {
        job = await ctx.db.get(activeApp.jobId);
      }
    }

    // Save inbound communication to the database if candidate exists
    let inboundCommId = null;
    if (candidate) {
      inboundCommId = await ctx.db.insert("communications", {
        candidateId: candidate._id,
        applicationId: activeApp?._id,
        jobId: activeApp?.jobId,
        direction: "inbound",
        channel: "whatsapp",
        body: args.textBody,
        deliveryStatus: "read",
        sentAt: Date.now(),
        stoppedSequence: false,
      });
    }

    // Get last 5 messages for chat history context
    let history: any[] = [];
    if (candidate) {
      const messages = await ctx.db
        .query("communications")
        .withIndex("by_candidate_time", (q: any) => q.eq("candidateId", candidate!._id))
        .order("desc")
        .take(6); // take(6) is a terminal method in Convex returning the array

      const previousMessages = inboundCommId
        ? messages.filter((m: any) => m._id !== inboundCommId)
        : messages;

      history = previousMessages
        .slice(0, 5)
        .reverse()
        .map((m: any) => ({
          direction: m.direction,
          body: m.body,
        }));
    }

    return {
      candidate: candidate
        ? {
            _id: candidate._id,
            fullName: candidate.fullName,
            email: candidate.email,
            phone: candidate.phone,
            currentJobTitle: candidate.currentJobTitle,
            skills: candidate.skills,
            summary: candidate.summary,
          }
        : null,
      applicationId: activeApp?._id || null,
      jobId: activeApp?.jobId || null,
      job: job
        ? {
            _id: job._id,
            title: job.title,
            jobDescription: job.jobDescription,
            keyword: job.keyword,
          }
        : null,
      history,
    };
  },
});

export const recordLocalWhatsappOutbound = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    applicationId: v.optional(v.id("applications")),
    jobId: v.optional(v.id("jobs")),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("communications", {
      candidateId: args.candidateId,
      applicationId: args.applicationId,
      jobId: args.jobId,
      direction: "outbound",
      channel: "whatsapp",
      body: args.body,
      deliveryStatus: "sent",
      sentAt: Date.now(),
      senderAgent: "system",
      stoppedSequence: false,
    });
  },
});

