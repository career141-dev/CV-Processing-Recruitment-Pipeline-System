import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { api, internal } from "../_generated/api";

// Internal query to fetch the correct phone_number_id based on the whatsapp number string from the database
export const getWhatChimpPhoneId = internalQuery({
  args: { targetWhatsAppNumber: v.string() },
  handler: async (ctx, args) => {
    const cleanNumber = args.targetWhatsAppNumber.startsWith('+') 
      ? args.targetWhatsAppNumber 
      : `+${args.targetWhatsAppNumber.replace(/[^0-9]/g, "")}`;
    
    const dbNumber = await ctx.db
      .query("whatsappNumbers")
      .withIndex("by_phone", (q) => q.eq("phone", cleanNumber))
      .first();
      
    if (dbNumber) {
      return dbNumber.whatchimpPhoneId;
    }
    
    // Fallback mapping for known numbers during transition
    const legacyClean = args.targetWhatsAppNumber.replace(/[^0-9]/g, "");
    const knownNumbers: Record<string, string> = {
      "94742197476": "965783109962872",
    };
    
    if (knownNumbers[legacyClean]) {
      return knownNumbers[legacyClean];
    }
    
    console.error(`[WhatChimp] No phone_number_id mapped for ${args.targetWhatsAppNumber}`);
    return null;
  }
});

// Internal action to tag a candidate in WhatChimp
export const assignAiFollowUpLabel = internalAction({
  args: {
    candidatePhone: v.string(),
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    try {
      const apiToken = process.env.WHATCHIMP_API_TOKEN;
      if (!apiToken) return;

      // 1. Find the assigned WhatsApp number from the job
      const outboundNumber = await ctx.runQuery(internal.communications.whatsappOutbound.getJobOutboundWhatsAppNumber, { jobId: args.jobId });
      
      let phoneId = process.env.WHATCHIMP_PHONE_NUMBER_ID;
      
      if (outboundNumber) {
        const fetchedId = await ctx.runQuery(internal.communications.whatsappOutbound.getWhatChimpPhoneId, { 
          targetWhatsAppNumber: outboundNumber 
        });
        if (fetchedId) phoneId = fetchedId;
      }
      
      if (!phoneId) {
        console.error("[WhatChimp Labels] No phone_number_id available for labeling");
        return;
      }

      // 2. Fetch all labels to find "AI Follow-ups"
      const labelListRes = await fetch("https://app.whatchimp.com/api/v1/whatsapp/label/list", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ apiToken, phone_number_id: phoneId }),
      });
      
      let labelId = null;
      if (labelListRes.ok) {
        const labelData = await labelListRes.json();
        const labels = Array.isArray(labelData.message) ? labelData.message : [];
        const existingLabel = labels.find((l: any) => l.label_name && l.label_name.toLowerCase() === "ai follow-ups");
        
        if (existingLabel) {
          labelId = existingLabel.id;
        }
      }

      // 3. Create the label if it doesn't exist
      if (!labelId) {
        const createRes = await fetch("https://app.whatchimp.com/api/v1/whatsapp/label/create", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ apiToken, phone_number_id: phoneId, label_name: "AI Follow-ups" }),
        });
        
        if (createRes.ok) {
          const newLabelListRes = await fetch("https://app.whatchimp.com/api/v1/whatsapp/label/list", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ apiToken, phone_number_id: phoneId }),
          });
          if (newLabelListRes.ok) {
            const newLabelData = await newLabelListRes.json();
            const newLabels = Array.isArray(newLabelData.message) ? newLabelData.message : [];
            const newExisting = newLabels.find((l: any) => l.label_name && l.label_name.toLowerCase() === "ai follow-ups");
            if (newExisting) labelId = newExisting.id;
          }
        }
      }

      if (!labelId) {
        console.error("[WhatChimp Labels] Failed to find or create 'AI Follow-ups' label");
        return;
      }

      // 4. Assign the label to the subscriber
      const cleanTargetPhone = args.candidatePhone.replace(/[^0-9]/g, "");
      const assignRes = await fetch("https://app.whatchimp.com/api/v1/whatsapp/subscriber/chat/assign-labels", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ 
          apiToken, 
          phone_number_id: phoneId, 
          phone_number: cleanTargetPhone, 
          label_ids: String(labelId) 
        }),
      });

      if (!assignRes.ok) {
        console.error("[WhatChimp Labels] Failed to assign label:", await assignRes.text());
      } else {
        console.log(`[WhatChimp Labels] Successfully assigned 'AI Follow-ups' label to ${cleanTargetPhone}`);
      }
    } catch (e: any) {
      console.error("[WhatChimp Labels] Error in assignAiFollowUpLabel:", e);
    }
  }
});

import { internalQuery } from "../_generated/server";
export const getJobWhatsAppChannel = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobChannels")
      .withIndex("by_job", (q: any) => q.eq("jobId", args.jobId))
      .filter((q: any) => q.eq(q.field("channelType"), "whatsapp"))
      .collect();
  }
});

export const getJobOutboundWhatsAppNumber = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    
    // 1. Prioritize explicit TA Outreach Number configured on the Job
    if (job.outreachWhatsAppNumber) {
      return job.outreachWhatsAppNumber;
    }
    
    // 2. Fallback to inbound channel configuration for backward compatibility
    const channels = await ctx.db
      .query("jobChannels")
      .withIndex("by_job", (q: any) => q.eq("jobId", args.jobId))
      .filter((q: any) => q.eq(q.field("channelType"), "whatsapp"))
      .collect();
      
    const activeChannel = channels.find((ch: any) => ch.isEnabled && ch.whatsappNumber);
    return activeChannel ? activeChannel.whatsappNumber : null;
  }
});

async function resolveTestModePhone(ctx: any, senderPhone: string): Promise<string> {
  const isTestMode = process.env.WHATSAPP_TEST_MODE === "true" && process.env.NODE_ENV !== "production";
  const testRecipient = process.env.WHATSAPP_TEST_RECIPIENT;
  const cleanNum = (p: string) => p.replace(/[^0-9]/g, "");

  if (isTestMode && testRecipient && cleanNum(senderPhone) === cleanNum(testRecipient)) {
    const lastOutbound = await ctx.db
      .query("communications")
      .withIndex("by_direction_channel_time", (q: any) =>
        q.eq("direction", "outbound").eq("channel", "whatsapp")
      )
      .order("desc")
      .first();

    if (lastOutbound) {
      const testCandidate = await ctx.db.get(lastOutbound.candidateId);
      if (testCandidate && testCandidate.phone) {
        console.log(`[WhatsApp Test Mode] Mapped test sender ${senderPhone} to actual candidate phone: ${testCandidate.phone}`);
        return testCandidate.phone;
      }
    }
  }
  return senderPhone;
}

async function findCandidateByPhone(ctx: any, targetPhone: string) {
  let candidate = await ctx.db
    .query("candidates")
    .withIndex("by_phone", (q: any) => q.eq("phone", targetPhone))
    .first();

  if (!candidate) {
    const phoneClean = targetPhone.replace(/[^0-9]/g, "");
    candidate = await ctx.db
      .query("candidates")
      .withIndex("by_phoneClean", (q: any) => q.eq("phoneClean", phoneClean))
      .first();
  }
  return candidate;
}

export const sendWhatsApp = internalAction({
  args: {
    communicationId: v.id("communications"),
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    // Check communication status & stage guard — DO NOT send automated follow-up if candidate moved out of follow_up stage (e.g. to ta_shortlist)
    const commRecord = await ctx.runQuery(internal.communications.whatsappOutbound.getCommunicationRecord, { communicationId: args.communicationId });
    if (commRecord?.stoppedSequence || commRecord?.deliveryStatus === "failed") {
      console.log(`[WhatsApp Outbound] Communication ${args.communicationId} was cancelled/stopped. Skipping delivery.`);
      return;
    }

    if (commRecord?.applicationId) {
      const appRecord = await ctx.runQuery(internal.communications.whatsappOutbound.getApplicationRecord, { applicationId: commRecord.applicationId });
      if (appRecord && appRecord.currentStage !== "follow_up") {
        console.log(`[WhatsApp Outbound] Application ${commRecord.applicationId} is in stage "${appRecord.currentStage}" (not "follow_up"). Aborting WhatsApp follow-up delivery.`);
        await ctx.runMutation(internal.communications.whatsappOutbound.updateStatus, {
          communicationId: args.communicationId,
          status: "failed",
          error: `Cancelled: Application is in stage ${appRecord.currentStage}`,
        });
        return;
      }
    }

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

    // Always send WhatsApp message to candidate profile phone number
    let targetPhone = candidate.phone;
    let logNote = "";

    // 3. Send message to WhatChimp API
    try {
      const baseApiToken = process.env.WHATCHIMP_API_TOKEN;
      if (!baseApiToken) {
        throw new Error("WHATCHIMP_API_TOKEN is not configured.");
      }

      // Fetch job's designated outbound TA number (or fallback)
      const outboundNumber = await ctx.runQuery(internal.communications.whatsappOutbound.getJobOutboundWhatsAppNumber, { jobId: args.jobId });
      
      let apiKey = baseApiToken;
      let phoneId = process.env.WHATCHIMP_PHONE_NUMBER_ID;

      if (outboundNumber) {
        const fetchedId = await ctx.runQuery(internal.communications.whatsappOutbound.getWhatChimpPhoneId, { 
          targetWhatsAppNumber: outboundNumber 
        });
        if (fetchedId) {
          phoneId = fetchedId;
          console.log(`[WhatsApp Outbound] Using TA assigned number: ${outboundNumber} (ID: ${phoneId})`);
        }
      }

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
      });
      console.log(`[WhatsApp Outbound] Message successfully sent via WhatChimp.`);

      // 4. Async tag the candidate in WhatChimp Lists/Labels
      await ctx.scheduler.runAfter(0, internal.communications.whatsappOutbound.assignAiFollowUpLabel, {
        candidatePhone: targetPhone,
        jobId: args.jobId,
      });

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
    const targetPhone = await resolveTestModePhone(ctx, args.senderPhone);
    const candidate = await findCandidateByPhone(ctx, targetPhone);

    if (!candidate) return { isFollowUpReply: false, candidateId: null, jobId: null };

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

    if (!activeApp) return { isFollowUpReply: false, candidateId: null, jobId: null };

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

    return { isFollowUpReply: true, candidateId: candidate._id, jobId: activeApp.jobId };
  },
});

export const processLocalWhatsappInbound = internalMutation({
  args: {
    senderPhone: v.string(),
    textBody: v.string(),
  },
  handler: async (ctx, args) => {
    const targetPhone = await resolveTestModePhone(ctx, args.senderPhone);
    const candidate = await findCandidateByPhone(ctx, targetPhone);

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

export const getCommunicationRecord = internalQuery({
  args: { communicationId: v.id("communications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.communicationId);
  },
});

export const getApplicationRecord = internalQuery({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.applicationId);
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

