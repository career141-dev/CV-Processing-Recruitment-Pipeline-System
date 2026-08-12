import {
  type JobContext,
  WorkerOptions,
  cli,
  defineAgent,
  voice,
} from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as openai from "@livekit/agents-plugin-openai";
import * as cartesia from "@livekit/agents-plugin-cartesia";
import * as silero from "@livekit/agents-plugin-silero";
import dotenv from "dotenv";

dotenv.config();

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    console.log(`[Career141 Voice Agent] Worker connected to room: ${ctx.room.name}`);

    // Extract metadata from room if provided
    let candidateName = "Candidate";
    let jobTitle = "the position";
    let jobDescription = "";
    let customScript = "";
    let customQuestions: string[] = [];

    try {
      const meta = ctx.room.metadata ? JSON.parse(ctx.room.metadata) : {};
      if (meta.candidateName) candidateName = meta.candidateName;
      if (meta.jobTitle) jobTitle = meta.jobTitle;
      if (meta.jobDescription) jobDescription = meta.jobDescription;
      if (meta.customScript) customScript = meta.customScript;
      if (Array.isArray(meta.customQuestions)) customQuestions = meta.customQuestions;
    } catch {
      // Use defaults
    }

    const systemPrompt = `You are Sarah, a warm, professional Senior Talent Acquisition Consultant at Career141.
You are speaking directly with ${candidateName} regarding their application for the "${jobTitle}" role.

Your goal is to conduct a fast, polite 2-3 minute initial qualification screening:
1. Warmly confirm they applied and ask if they are currently actively exploring new opportunities.
2. Ask about their current employment status and notice period.
3. Inquire about their current salary and expected salary (in LKR or standard currency).
${customQuestions.length > 0 ? `4. Ask the following role-specific questions naturally: ${customQuestions.join("; ")}` : ""}
${customScript ? `Follow this specific guidance where applicable: ${customScript}` : ""}

Rules for voice speech:
- Speak concisely and naturally (1 to 2 short conversational sentences per turn).
- Never output markdown, bullet points, asterisks, or formatting — speak only natural spoken words.
- Be warm, encouraging, and respectful.
- If the candidate interrupts, immediately acknowledge what they said.`;

    const vad = await silero.VAD.load();

    const stt = new deepgram.STT({
      apiKey: process.env.DEEPGRAM_API_KEY,
      model: "nova-2-general",
      language: "en",
    });

    const llm = new openai.LLM({
      baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
      model: "deepseek/deepseek-chat",
      temperature: 0.3,
    });

    const tts = process.env.CARTESIA_API_KEY
      ? new cartesia.TTS({
          apiKey: process.env.CARTESIA_API_KEY,
          voice: "a0e99841-438c-4a64-b679-ae501e7d6091", // Sonic English
        })
      : new deepgram.TTS({
          apiKey: process.env.DEEPGRAM_API_KEY,
          model: "aura-asteria-en",
        });

    const session = new voice.AgentSession({
      vad,
      stt,
      llm,
      tts,
    });

    const agent = new voice.Agent({
      instructions: systemPrompt,
    });

    await session.start({ agent, room: ctx.room });

    // Initial greeting
    const greeting = `Hi ${candidateName}, this is Sarah from Career141 calling about your application for the ${jobTitle} role. Do you have two minutes for a quick chat?`;
    session.say(greeting, { allowInterruptions: true });

    ctx.room.on("disconnected", () => {
      console.log(`[Career141 Voice Agent] Room ${ctx.room.name} disconnected. Finalizing session.`);
    });
  },
});

// Run CLI when executed directly
cli.runApp(
  new WorkerOptions({
    agent: new URL(import.meta.url).pathname,
  })
);
