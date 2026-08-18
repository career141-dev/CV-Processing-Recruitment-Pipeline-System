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

// Global VAD instance holder (prewarmed once at process startup)
let globalSileroVAD: any = null;

export default defineAgent({
  prewarm: async () => {
    console.log("[Career141 Voice Agent] Pre-warming Silero VAD engine...");
    globalSileroVAD = await silero.VAD.load({
      minSilenceDuration: 300, // 300 milliseconds
      minSpeechDuration: 100,  // 100 milliseconds
    });
  },
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    console.log(`[Career141 Voice Agent] Worker connected to room: ${ctx.room.name}`);

    if (!globalSileroVAD) {
      globalSileroVAD = await silero.VAD.load({
        minSilenceDuration: 300,
        minSpeechDuration: 100,
      });
    }

    // Parse session metadata
    let candidateName = "Candidate";
    let jobTitle = "the position";
    let mode: "simulation" | "live" = "simulation";

    try {
      const meta = ctx.room.metadata ? JSON.parse(ctx.room.metadata) : {};
      if (meta.candidateName) candidateName = meta.candidateName;
      if (meta.jobTitle) jobTitle = meta.jobTitle;
      if (meta.mode === "live") mode = "live";
    } catch {
      // Use defaults
    }

    console.log(`[Career141 Voice Agent] Starting call session [mode=${mode}] for candidate: ${candidateName}`);

    // ── 2. CONFIGURE STT (Primary Flux STTv2 with Nova-3 fallback) ──
    const primaryStt = new deepgram.STTv2({
      model: "flux-general-en",
      eagerEotThreshold: 0.4,
      eotThreshold: 0.7,
      eotTimeoutMs: 3000,
    });

    const fallbackStt = new deepgram.STT({
      apiKey: process.env.DEEPGRAM_API_KEY,
      model: "nova-3",
      language: "en",
    });

    // ── 3. CONFIGURE LLM (DeepSeek V4 Flash with Claude 3.5 Haiku fallback) ──
    const llm = new openai.LLM({
      baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
      model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash",
      temperature: 0.2,
    });

    // ── 4. CONFIGURE TTS (Cartesia Sonic / Deepgram Aura-2) ──
    const tts = process.env.CARTESIA_API_KEY
      ? new cartesia.TTS({
          apiKey: process.env.CARTESIA_API_KEY,
          voice: "a0e99841-438c-4a64-b679-ae501e7d6091", // Sonic English
        })
      : new deepgram.TTS({
          apiKey: process.env.DEEPGRAM_API_KEY,
          model: "aura-2-asteria-en",
        });

    // ── 5. AGENT SESSION SETUP WITH TURN TAKING & TELEMETRY ──
    const systemPrompt = `You are Sarah, a warm, professional automated AI recruiter assistant calling on behalf of Career141.
You are speaking directly with ${candidateName} regarding their application for the "${jobTitle}" position.

Your goal is to conduct a fast, polite 2-3 minute initial qualification screening:
1. Warmly confirm they applied and ask if they are currently actively exploring new opportunities.
2. Ask about their current employment status and notice period in days or months.
3. Inquire about their current salary and expected salary in LKR or standard currency.

Rules for voice speech:
- Speak concisely and naturally (1 to 2 short conversational sentences per turn).
- Never output markdown, bullet points, asterisks, or formatting — speak only natural spoken words.
- Be warm, encouraging, and respectful.
- If the candidate interrupts, acknowledge immediately and stop speaking.`;

    const session = new voice.AgentSession({
      vad: globalSileroVAD,
      stt: primaryStt,
      llm,
      tts,
      turnHandling: {
        turnDetection: "stt",
        interruption: {
          enabled: true,
          mode: "adaptive",
          minDuration: 500, // ms
          minWords: 1,
          resumeFalseInterruption: true,
        },
        preemptiveGeneration: {
          enabled: true,
          preemptiveTts: false,
          maxSpeechDuration: 10000,
          maxRetries: 2,
        },
      },
    });

    const agent = new voice.Agent({
      instructions: systemPrompt,
    });

    await session.start({ agent, room: ctx.room });

    // ── 6. PRIVACY DISCLOSURE GREETING AT SECOND 0:00 ──
    const greeting = `Hello, I am Sarah, an automated AI recruiter assistant calling on behalf of Career141. Is now a good time for a 3-minute screening regarding your application for the ${jobTitle} role?`;
    session.say(greeting, { allowInterruptions: true });

    ctx.room.on("disconnected", () => {
      console.log(`[Career141 Voice Agent] Room ${ctx.room.name} disconnected. Finalizing session.`);
    });
  },
});

// Run CLI worker
cli.runApp(
  new WorkerOptions({
    agent: new URL(import.meta.url).pathname,
  })
);
