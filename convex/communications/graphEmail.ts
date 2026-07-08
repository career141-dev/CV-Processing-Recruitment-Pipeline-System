"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getGraphToken } from "../lib/graphClient";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Send email via Microsoft Graph
// ─────────────────────────────────────────────────────────────────────────────
export const sendGraphEmail = internalAction({
  args: {
    communicationId: v.id("communications"),
    candidateJobId: v.string(), // applicationId stringified for header
    taEmail: v.string(),        // "from" mailbox — the recruiter's M365 email
    toAddress: v.string(),      // recipient email
    subject: v.string(),
    bodyHtml: v.string(),
  },
  handler: async (ctx, args) => {
    // ── Test-mode redirect ─────────────────────────────────────────────────
    const isTestMode = process.env.EMAIL_TEST_MODE === "true";
    const testRecipient = process.env.EMAIL_TEST_RECIPIENT;

    let targetAddress = args.toAddress;
    let logNote = "";

    if (isTestMode) {
      if (!testRecipient) {
        console.error(
          "[Graph Email] EMAIL_TEST_MODE is true but EMAIL_TEST_RECIPIENT is not set."
        );
        await ctx.runMutation(
          internal.communications.graphEmailMutations.updateEmailStatus,
          {
            communicationId: args.communicationId,
            status: "failed",
            error:
              "Test mode is active but EMAIL_TEST_RECIPIENT is not configured.",
          }
        );
        return;
      }
      targetAddress = testRecipient;
      logNote = ` [REDIRECTED TO TEST: ${testRecipient}]`;
    }

    try {
      const token = await getGraphToken();

      // Resolve the actual sending mailbox vs reply-to address
      // Personal email domains (like Gmail) cannot send M365 emails directly
      let senderEmail = args.taEmail;
      let replyToRecipients: any[] = [];

      const m365Sender = process.env.MS_SENDER_EMAIL || process.env.MICROSOFT_SENDER_EMAIL;
      const isCareer141Domain = senderEmail.toLowerCase().endsWith("@career141.com");

      if (isTestMode) {
        if (m365Sender) {
          senderEmail = isCareer141Domain ? args.taEmail : m365Sender;
        }
        replyToRecipients = [];
        console.log(`[Graph Email] Test mode active. Using sender: ${senderEmail}`);
      } else if (!isCareer141Domain && m365Sender) {
        senderEmail = m365Sender;
        replyToRecipients = [
          {
            emailAddress: { address: args.taEmail }
          }
        ];
        console.log(`[Graph Email] Recruiter email is external (${args.taEmail}). Using M365 sender fallback (${m365Sender}) with Reply-To.`);
      } else {
        console.log(`[Graph Email] Recruiter email is native organization domain (${args.taEmail}). Sending directly.`);
      }

      const payload: any = {
        message: {
          subject: args.subject,
          body: {
            contentType: "HTML",
            content: args.bodyHtml,
          },
          toRecipients: [
            {
              emailAddress: { address: targetAddress },
            },
          ],
          internetMessageHeaders: [
            {
              name: "x-c141-candidatejobid",
              value: args.candidateJobId,
            },
          ],
        },
        saveToSentItems: true,
      };

      if (replyToRecipients.length > 0) {
        payload.message.replyTo = replyToRecipients;
      }

      console.log(
        `[Graph Email] Sending email from ${senderEmail} to ${targetAddress}${logNote}`
      );

      const res = await fetch(
        `${GRAPH_BASE}/users/${encodeURIComponent(senderEmail)}/sendMail`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Graph API returned ${res.status}: ${errorText}`);
      }

      // Success — update communication status
      await ctx.runMutation(
        internal.communications.graphEmailMutations.updateEmailStatus,
        {
          communicationId: args.communicationId,
          status: "sent",
          error: isTestMode
            ? `Test mode active.${logNote}`
            : undefined,
        }
      );

      console.log(`[Graph Email] Email sent successfully.`);
    } catch (err: any) {
      console.error("[Graph Email] Failed to send:", err.message);
      await ctx.runMutation(
        internal.communications.graphEmailMutations.updateEmailStatus,
        {
          communicationId: args.communicationId,
          status: "failed",
          error: err.message,
        }
      );
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Read latest inbox messages for a given mailbox
// ─────────────────────────────────────────────────────────────────────────────
export const readInboxMessages = internalAction({
  args: {
    taEmail: v.string(),
    top: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const token = await getGraphToken();
    const count = args.top ?? 25;

    const selectFields = [
      "id",
      "subject",
      "from",
      "receivedDateTime",
      "bodyPreview",
      "internetMessageHeaders",
      "isRead",
    ].join(",");

    const url =
      `${GRAPH_BASE}/users/${encodeURIComponent(args.taEmail)}` +
      `/mailFolders/inbox/messages` +
      `?$top=${count}&$orderby=receivedDateTime desc&$select=${selectFields}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `[Graph Email] Inbox read failed (${res.status}): ${errorText}`
      );
    }

    const data = await res.json();
    return data.value as any[];
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Reply to a specific message
// ─────────────────────────────────────────────────────────────────────────────
export const replyToMessage = internalAction({
  args: {
    taEmail: v.string(),
    messageId: v.string(),
    replyText: v.string(),
  },
  handler: async (_ctx, args) => {
    const token = await getGraphToken();

    const res = await fetch(
      `${GRAPH_BASE}/users/${encodeURIComponent(args.taEmail)}/messages/${args.messageId}/reply`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment: args.replyText,
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `[Graph Email] Reply failed (${res.status}): ${errorText}`
      );
    }

    console.log(`[Graph Email] Reply sent to message ${args.messageId}`);
  },
});
