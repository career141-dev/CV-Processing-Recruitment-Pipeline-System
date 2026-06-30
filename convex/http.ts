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

export default http;
