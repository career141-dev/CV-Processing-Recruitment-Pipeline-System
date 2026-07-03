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
    const candidate = await ctx.runQuery(api.candidates.getCandidate, {
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

    // 3. Send message to local WhatsApp bridge
    try {
      console.log(`[WhatsApp Outbound] Sending message to +${targetPhone.replace(/[^0-9]/g, '')}${logNote}`);
      
      const bridgeUrl = process.env.WHATSAPP_BRIDGE_URL || "http://localhost:3001";
      const res = await fetch(`${bridgeUrl}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          to: targetPhone,
          message: args.body,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Local bridge returned status ${res.status}: ${errorText}`);
      }

      // Success
      await ctx.runMutation(internal.communications.whatsappOutbound.updateStatus, {
        communicationId: args.communicationId,
        status: "sent",
        error: isTestMode ? `Test mode active.${logNote}` : undefined,
      });
      console.log(`[WhatsApp Outbound] Message successfully sent to local bridge.`);
    } catch (err: any) {
      console.error("[WhatsApp Outbound] Failed to dispatch via local bridge:", err.message);
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
