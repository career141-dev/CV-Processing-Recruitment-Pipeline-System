"use node";

import { internalAction } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

export const triggerIntakeCall = internalAction({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; conversationId: string }> => {
    // 1. Fetch data for dynamic variables
    const candidate: any = await ctx.runQuery(api.candidates.getCandidate, { id: args.candidateId });
    const job: any = await ctx.runQuery(api.jobs.getJob, { jobId: args.jobId });
    
    if (!candidate || !candidate.phone) {
      throw new Error("Candidate has no phone number");
    }

    if (!job) {
      throw new Error("Job not found");
    }

    const agentId = process.env.ELEVENLABS_INTAKE_AGENT_ID;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!agentId || !apiKey) {
      throw new Error("ElevenLabs credentials not configured");
    }

    // 2. Call ElevenLabs API
    const response = await fetch("https://api.elevenlabs.io/v1/convai/outbound-call", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        recipient_phone_number: candidate.phone,
        dynamic_variables: {
          candidate_name: candidate.fullName || "Candidate",
          job_title: job.title || "the open role",
          company_name: "Career141",
          candidate_id: args.candidateId,
          job_id: args.jobId,
          application_id: args.applicationId,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ElevenLabs] Failed to trigger call:", errorText);
      throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
    }

    const data: any = await response.json();
    const conversationId: string = data.conversation_id;

    // 3. Log the call in our DB
    // We already have a mutation in applications to update this!
    // But we need to make sure we create or update an aiCall.
    // Wait, the UI might have already created an aiCalls record and then called this.
    // Let's just return the conversation ID, and the caller can update the aiCall record.
    return {
      success: true,
      conversationId
    };
  }
});

export const triggerFollowUpCall = internalAction({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    attemptNumber: v.number(),
    lastContactChannel: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; conversationId?: string; skipped?: boolean }> => {
    const candidate: any = await ctx.runQuery(api.candidates.getCandidate, { id: args.candidateId });
    const job: any = await ctx.runQuery(api.jobs.getJob, { jobId: args.jobId });
    const application: any = await ctx.runQuery(api.applications.getApplication, { id: args.applicationId });
    
    if (!candidate || !candidate.phone) {
      throw new Error("Candidate has no phone number");
    }
    if (!job) {
      throw new Error("Job not found");
    }
    if (!application) {
      throw new Error("Application not found");
    }

    // Determine missing fields
    const missing: string[] = [];
    if (!application.followUpCurrentSalary) missing.push("current salary");
    if (!application.followUpExpectedSalary) missing.push("expected salary");
    if (!application.followUpNoticePeriod) missing.push("notice period");

    if (missing.length === 0) {
      console.log(`Skipping follow-up call for ${args.applicationId}: all fields already captured.`);
      return { success: true, skipped: true };
    }

    const agentId = process.env.ELEVENLABS_FOLLOWUP_AGENT_ID;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!agentId || !apiKey) {
      console.error("ElevenLabs Follow-Up credentials not configured");
      return { success: false };
    }

    const response = await fetch("https://api.elevenlabs.io/v1/convai/outbound-call", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        recipient_phone_number: candidate.phone,
        dynamic_variables: {
          candidate_name: candidate.fullName || "Candidate",
          job_title: job.title || "the open role",
          company_name: "Career141",
          missing_fields_list: missing.join(", "),
          attempt_number: String(args.attemptNumber),
          last_contact_channel: args.lastContactChannel,
          candidate_id: args.candidateId,
          job_id: args.jobId,
          application_id: args.applicationId,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ElevenLabs] Failed to trigger follow-up call:", errorText);
      return { success: false };
    }

    const data: any = await response.json();
    return {
      success: true,
      conversationId: data.conversation_id
    };
  }
});
