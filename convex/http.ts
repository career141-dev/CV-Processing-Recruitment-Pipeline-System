import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { handleMetaWhatsappWebhook } from "./communications/metaWhatsappAgent";

const http = httpRouter();

// Meta Webhook Verification
http.route({
  path: "/api/whatsapp",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }),
});

// Meta Webhook Inbound Events
http.route({
  path: "/api/whatsapp",
  method: "POST",
  handler: handleMetaWhatsappWebhook,
});

// A simple REST endpoint to test Job Creation via Postman
http.route({
  path: "/api/test-job",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      // Look up a fallback user to assign as the recruiter for this test
      const defaultUser = await ctx.runQuery(api.users.getTeamMembers);
      if (!defaultUser || defaultUser.length === 0) {
        return new Response(JSON.stringify({ 
          error: "No users found in database. Please log in via the UI at least once to create a user." 
        }), { status: 400 });
      }

      // Step 1: Create Job
      const { jobId, keyword } = await ctx.runMutation(api.jobs.createJob, {
        title: body.title || "Postman API Tester",
        clientName: body.clientName || "API Inc.",
        clientIndustry: body.clientIndustry || "Technology",
        recruitmentType: "both",
        isConfidential: false,
        jobDescription: body.jobDescription || "Test description generated via Postman REST request.",
        requiredSkills: body.requiredSkills || ["Postman", "REST APIs"],
        niceToHaveSkills: ["GraphQL", "Convex"],
        seniorityLevel: "mid_level",
        experienceMinYears: 3,
        experienceMaxYears: 5,
        location: "Remote",
        salaryMin: 50000,
        salaryMax: 90000,
        salaryCurrency: "USD",
        primaryRecruiterId: defaultUser[0]._id as any,
      });

      // Step 2: Update Channels
      await ctx.runMutation(api.jobs.updateJobChannels, {
        jobId,
        channels: body.channels || [
          {
            channelType: "whatsapp",
            isEnabled: true,
            whatsappNumber: "+1234567890",
          },
          {
            channelType: "email",
            isEnabled: true,
            emailInbox: "postman@career141.com",
          }
        ]
      });

      // Step 3: Update AI Config
      await ctx.runMutation(api.jobs.updateJobAiConfig, {
        jobId,
        minMatchScoreToShow: body.aiConfig?.minMatchScoreToShow ?? 60,
        reverseMatchOnPublish: body.aiConfig?.reverseMatchOnPublish ?? true,
        scoreWeightSkills: 40,
        scoreWeightExperience: 30,
        scoreWeightJobTitle: 15,
        scoreWeightIndustry: 10,
        scoreWeightLocation: 5,
        agent3Enabled: true,
        agent3Day2Channel: "email",
        agent3Day7Channel: "whatsapp",
        agent3AfterDay7: "trigger_agent5",
        agent5Enabled: true,
        agent5Trigger: "all_new_applicants",
        agent5CallScript: "default",
        agent5CustomQuestions: ["What is your notice period?"],
        agent5NoAnswerAction: "trigger_agent3",
        agent5HideCompany: false,
        directorReviewEnabled: false,
        clientReviewEnabled: false,
        clientAccessLevel: "view_only",
        esaCheckEnabled: true,
        rejectionLoopAction: "restart_from_new_cvs",
        slaNoNewCvsDays: 5,
        slaTaReviewDays: 2,
        slaAiCallDays: 1,
        slaSecondShortlistDays: 2,
        slaDirectorReviewDays: 3,
        slaClientReviewDays: 5,
        slaEsaDays: 3,
        slaInterviewDays: 3,
        slaOfferDays: 2,
      });

      // Step 4: Publish Job instantly for this test
      await ctx.runMutation(api.jobs.publishJob, { jobId });

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Job successfully created and published via Postman!",
        jobId, 
        keyword 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Twilio Call Status Callback — auto-advances AI Call → 2nd Shortlist on success
http.route({
  path: "/api/twilio-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.text();
      const params = new URLSearchParams(body);

      const callStatus = params.get("CallStatus"); // completed | no-answer | busy | failed | canceled
      const callSid = params.get("CallSid");
      const digits = params.get("Digits"); // IVR response: 1=interested, 2=declined, 3=connect recruiter

      // Find the aiCalls record matching this CallSid
      const aiCallRecord = callSid
        ? await ctx.runQuery(api.applications.findAiCallBySid, { twilioCallSid: callSid })
        : null;

      if (!aiCallRecord) {
        console.warn("[Twilio] No aiCalls record found for CallSid:", callSid);
        return new Response("OK", { status: 200 });
      }

      const applicationId = aiCallRecord.applicationId;
      const ivrResponse = digits === "1"
        ? "pressed_1_interested"
        : digits === "2"
        ? "pressed_2_declined"
        : digits === "3"
        ? "pressed_3_connect_recruiter"
        : "no_response";

      // Map Twilio callStatus → our enum
      const mappedStatus =
        callStatus === "completed" ? "completed"
        : callStatus === "no-answer" ? "no_answer"
        : callStatus === "busy" ? "no_answer"
        : callStatus === "failed" ? "failed"
        : callStatus === "canceled" ? "failed"
        : "in_progress";

      // Update the aiCalls record
      await ctx.runMutation(api.applications.updateAiCallStatus, {
        aiCallId: aiCallRecord._id,
        callStatus: mappedStatus as any,
        ivrResponse: ivrResponse as any,
        twilioCallSid: callSid ?? undefined,
      });

      // Auto-advance: completed + pressed_1 → second_shortlist
      if (applicationId && mappedStatus === "completed" && ivrResponse === "pressed_1_interested") {
        await ctx.runMutation(api.pipeline.stages.setPipelineStage, {
          applicationId,
          newStage: "second_shortlist",
          note: "Auto-advanced: AI call completed, candidate pressed 1 (Interested)",
        });
      }

      // Auto-reject: pressed_2 (declined)
      if (applicationId && ivrResponse === "pressed_2_declined") {
        await ctx.runMutation(api.applications.rejectApplication, {
          applicationId,
          reason: "Candidate pressed 2 — Declined during AI call",
          stage: "ai_call",
        });
      }

      return new Response("OK", { status: 200 });
    } catch (e: any) {
      console.error("[Twilio] Callback error:", e);
      return new Response("Error", { status: 500 });
    }
  }),
});

// ==========================================
// ELEVENLABS WEBHOOKS
// ==========================================

const verifyElevenLabsSecret = (request: Request) => {
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== process.env.ELEVENLABS_WEBHOOK_SECRET) {
    throw new Error("Unauthorized");
  }
};

http.route({
  path: "/api/elevenlabs/save-intake",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      verifyElevenLabsSecret(request);
      const body = await request.json();
      
      const {
        candidate_id,
        application_id,
        current_salary,
        expected_salary,
        notice_period_days,
      } = body;
      if (!candidate_id) throw new Error("Missing candidate_id");

      // 1. Write to global candidate profile
      await ctx.runMutation(api.candidates.updateCandidateDetails, {
        candidateId: candidate_id as any,
        currentSalary: current_salary,
        expectedSalary: expected_salary,
        noticePeriodDays: notice_period_days,
      });

      // 2. If application_id is present, update per-application flags too
      if (application_id) {
        const flagUpdates: any = {};
        if (current_salary !== undefined && current_salary !== null) flagUpdates.followUpCurrentSalary = true;
        if (expected_salary !== undefined && expected_salary !== null) flagUpdates.followUpExpectedSalary = true;
        if (notice_period_days !== undefined && notice_period_days !== null) flagUpdates.followUpNoticePeriod = true;

        if (Object.keys(flagUpdates).length > 0) {
          await ctx.runMutation(api.applications.setApplicationFlags, {
            applicationId: application_id as any,
            ...flagUpdates,
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: e.message === "Unauthorized" ? 401 : 500 });
    }
  }),
});

http.route({
  path: "/api/elevenlabs/mark-declined",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      verifyElevenLabsSecret(request);
      const body = await request.json();
      
      const { candidate_id, application_id, reason } = body;
      if (!candidate_id) throw new Error("Missing candidate_id");

      if (reason === "opt_out") {
        await ctx.runMutation(api.candidates.setDoNotContact, {
          candidateId: candidate_id as any,
          reason: "Opted out via AI Call",
        });
        
        if (application_id) {
          await ctx.runMutation(api.applications.rejectApplication, {
            applicationId: application_id as any,
            reason: "Candidate opted out via AI Call",
            stage: "rejected",
          });
        }
      } else if (reason === "bad_timing" || reason === "not_interested") {
        if (application_id) {
          const now = Date.now();
          await ctx.runMutation(api.pipeline.stages.setPipelineStage, {
            applicationId: application_id as any,
            newStage: "follow_up",
            note: `AI call declined. Reason: ${reason}`,
          });
          // Set the 7-day clock entry point
          await ctx.runMutation(api.applications.setFollowUpEnteredAt, {
            applicationId: application_id as any,
            enteredAt: now,
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: e.message === "Unauthorized" ? 401 : 500 });
    }
  }),
});

http.route({
  path: "/api/elevenlabs/post-call-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      verifyElevenLabsSecret(request);
      const body = await request.json();
      
      const conversationId = body.conversation_id;
      const status = body.status; // "done" | "failed"
      // Data extracted by ElevenLabs agent and passed back in the webhook
      const currentSalary = body.current_salary;
      const expectedSalary = body.expected_salary;
      const noticePeriodDays = body.notice_period_days;
      
      const aiCall = await ctx.runQuery(api.applications.findAiCallByElevenLabsId, { conversationId });
      if (!aiCall) {
        console.warn("[ElevenLabs] No aiCalls record found for conversation:", conversationId);
        return new Response("OK", { status: 200 });
      }

      let mappedStatus = "in_progress";
      if (status === "done" || status === "success") mappedStatus = "completed";
      else if (status === "failed") mappedStatus = "failed";

      await ctx.runMutation(api.applications.updateAiCallStatus, {
        aiCallId: aiCall._id,
        callStatus: mappedStatus as any,
      });

      // Path 2 routing: complete call → check if all 3 fields captured
      if (mappedStatus === "completed" && aiCall.applicationId) {
        const allThreeCaptured =
          (currentSalary !== undefined && currentSalary !== null) &&
          (expectedSalary !== undefined && expectedSalary !== null) &&
          (noticePeriodDays !== undefined && noticePeriodDays !== null);

        // Write salary/notice to candidate global profile
        if (currentSalary !== undefined || expectedSalary !== undefined || noticePeriodDays !== undefined) {
          await ctx.runMutation(api.candidates.updateCandidateDetails, {
            candidateId: aiCall.candidateId,
            currentSalary,
            expectedSalary,
            noticePeriodDays,
          });
        }

        const now = Date.now();

        if (allThreeCaptured) {
          // All 3 collected on first AI call → skip Follow-up, go straight to 2nd Shortlist
          await ctx.runMutation(api.applications.setApplicationFlags, {
            applicationId: aiCall.applicationId,
            followUpCurrentSalary: true,
            followUpExpectedSalary: true,
            followUpNoticePeriod: true,
          });
          await ctx.runMutation(api.pipeline.stages.setPipelineStage, {
            applicationId: aiCall.applicationId,
            newStage: "second_shortlist",
            note: "AI call completed — all 3 fields captured. Skipping Follow-up.",
          });
        } else {
          // Partial or no answer → move to Follow-up and start 7-day clock
          const flagUpdates: any = {};
          if (currentSalary !== undefined && currentSalary !== null) flagUpdates.followUpCurrentSalary = true;
          if (expectedSalary !== undefined && expectedSalary !== null) flagUpdates.followUpExpectedSalary = true;
          if (noticePeriodDays !== undefined && noticePeriodDays !== null) flagUpdates.followUpNoticePeriod = true;

          if (Object.keys(flagUpdates).length > 0) {
            await ctx.runMutation(api.applications.setApplicationFlags, {
              applicationId: aiCall.applicationId,
              ...flagUpdates,
            });
          }

          await ctx.runMutation(api.pipeline.stages.setPipelineStage, {
            applicationId: aiCall.applicationId,
            newStage: "follow_up",
            note: "AI call completed — missing data fields. Entering Follow-up.",
          });
          // Set precise 7-day clock start
          await ctx.runMutation(api.applications.setFollowUpEnteredAt, {
            applicationId: aiCall.applicationId,
            enteredAt: now,
          });
        }
      } else if (mappedStatus === "failed" || mappedStatus === "no_answer") {
        // Call not answered or failed → move to Follow-up
        if (aiCall.applicationId) {
          const now = Date.now();
          await ctx.runMutation(api.pipeline.stages.setPipelineStage, {
            applicationId: aiCall.applicationId,
            newStage: "follow_up",
            note: `AI call ${mappedStatus} — entering Follow-up for outreach.`,
          });
          await ctx.runMutation(api.applications.setFollowUpEnteredAt, {
            applicationId: aiCall.applicationId,
            enteredAt: now,
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: e.message === "Unauthorized" ? 401 : 500 });
    }
  }),
});

export default http;
