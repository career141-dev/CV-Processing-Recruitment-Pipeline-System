import { httpAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import OpenAI from "openai";

export const handleLocalWhatsappWebhook = httpAction(async (ctx, request) => {
  try {
    const body = await request.json();
    const { from, text = "", file, fileName, mimeType, to } = body;

    if (!from || (!text && !file)) {
      return new Response(JSON.stringify({ error: "Missing from, text or file parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[Local WhatsApp Action] Inbound message from +${from}. Text: "${text}". Has File: ${!!file}`);

    // Process inbound file attachment if present
    if (file) {
      console.log(`[Local WhatsApp Action] Processing inbound file: ${fileName} (${mimeType})`);
      const fileBuffer = Buffer.from(file, "base64");
      const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
      const fileHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const fileBlob = new Blob([fileBuffer], { type: mimeType || "application/pdf" });
      const storageId = await ctx.storage.store(fileBlob);

      await ctx.runMutation(internal.cvs.ingestion.insertCvRecord, {
        toNumber: to || "Common Number",
        fromNumber: from,
        originalSenderPhone: from,
        fileName: fileName || "cv.pdf",
        storageId,
        fileHash,
        fileSize: fileBuffer.byteLength,
      });
      console.log(`[Local WhatsApp Action] Inbound file ingested successfully under storageId: ${storageId}`);
    }

    // 1. Process the inbound message and fetch candidate/job context from DB
    const context = await ctx.runMutation(internal.communications.whatsappOutbound.processLocalWhatsappInbound, {
      senderPhone: from,
      textBody: text || `[Attached File: ${fileName || "document"}]`,
    });

    // Run text extraction in background to parse details if text is present
    if (text && context.candidate) {
      await ctx.scheduler.runAfter(0, internal.communications.inboundExtraction.extractDetailsFromText, {
        candidateId: context.candidate._id,
        textBody: text,
      });
    }

    // 2. Setup NVIDIA LLM Client
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      console.error("[Local WhatsApp LLM] NVIDIA_API_KEY is not configured.");
      return new Response(JSON.stringify({ error: "NVIDIA_API_KEY not set on server" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const openai = new OpenAI({
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey,
    });

    // 3. Construct System Prompt
    let systemPrompt = `You are an AI recruitment assistant for Career141, a premium recruitment agency.
You are communicating with a candidate via WhatsApp.
Keep your responses:
1. Concise and readable on mobile (1-3 short paragraphs max, bullet points if helpful).
2. Professional, warm, and helpful.
3. Natural and human-like. Do not sound robotic. Do not mention system details, variables, or database flags.
4. Directly answer the candidate's query. If you do not know the answer and it is not in the context, politely mention that you will check with the recruiter and get back to them.`;

    if (context.candidate) {
      systemPrompt += `\n\nCandidate Profile:
- Name: ${context.candidate.fullName || "Unknown"}
- Email: ${context.candidate.email || "N/A"}
- Phone: ${context.candidate.phone || "N/A"}
- Current Job Title: ${context.candidate.currentJobTitle || "N/A"}`;
      
      if (context.candidate.skills && context.candidate.skills.length > 0) {
        systemPrompt += `\n- Skills: ${context.candidate.skills.join(", ")}`;
      }
    } else {
      systemPrompt += `\n\nCandidate Context:
- The phone number +${from} is not associated with any candidate profile in our system. Ask them politely to provide their name and email, or forward their CV to this number to apply for open roles.`;
    }

    if (context.job) {
      systemPrompt += `\n\nJob Details:
- Title: ${context.job.title}
- Keyword/Code: ${context.job.keyword}
- Description: ${context.job.jobDescription}`;
    }

    // 4. Construct Messages Payload including Chat History
    const messages: any[] = [
      { role: "system", content: systemPrompt }
    ];

    // Add chat history
    if (context.history && context.history.length > 0) {
      for (const msg of context.history) {
        messages.push({
          role: msg.direction === "inbound" ? "user" : "assistant",
          content: msg.body
        });
      }
    }

    // Add current user message
    messages.push({ role: "user", content: text });

    console.log(`[Local WhatsApp LLM] Invoking NVIDIA NIM with candidate context...`);

    // 5. Call LLM
    const completion = await openai.chat.completions.create({
      model: "meta/llama-3.1-70b-instruct",
      messages,
      temperature: 0.5,
      max_tokens: 500,
    });

    const replyText = completion.choices[0]?.message?.content?.trim() || "Thank you for your message. We have received it and will get back to you shortly.";

    console.log(`[Local WhatsApp LLM] Reply generated: "${replyText}"`);

    // 6. Record the outbound response in DB if candidate exists
    if (context.candidate) {
      await ctx.runMutation(internal.communications.whatsappOutbound.recordLocalWhatsappOutbound, {
        candidateId: context.candidate._id,
        applicationId: context.applicationId || undefined,
        jobId: context.jobId || undefined,
        body: replyText,
      });
    }

    // 7. Return reply to bridge
    return new Response(JSON.stringify({ reply: replyText }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Local WhatsApp Webhook Error]:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
