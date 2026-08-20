"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { ScreeningContext } from "@/lib/agent-config";

type AgentStatus = "idle" | "requesting" | "listening" | "thinking" | "speaking" | "error";
type MessageRole = "user" | "assistant";
type Message = { id: string; role: MessageRole; text: string; time: string };
type SpeechQueueItem = { text: string; audio: Promise<Blob | null>; cycle: number };
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type RecognitionError = { error: string };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: null | (() => void);
  onend: null | (() => void);
  onresult: null | ((event: RecognitionEvent) => void);
  onerror: null | ((event: RecognitionError) => void);
};
type RecognitionConstructor = new () => Recognition;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

const DEFAULT_GOALS = `Confirm continued interest in the role
Understand the candidate's most relevant recent experience
Confirm notice period or earliest available start date
Confirm preferred work location or working arrangement
Collect availability for a next-stage interview`;

const statusCopy: Record<AgentStatus, { label: string; description: string }> = {
  idle: { label: "Screening ready", description: "Add the job context, then start a practice screening." },
  requesting: { label: "Waiting for microphone", description: "Allow microphone access once to rehearse the call by voice." },
  listening: { label: "Listening to candidate", description: "Answer as the candidate. Aura will move through the screening naturally." },
  thinking: { label: "Choosing the next question", description: "Aura is checking what has already been answered." },
  speaking: { label: "Aura is speaking", description: "Listen to the question, then reply naturally or type a test answer below." },
  error: { label: "Needs attention", description: "Review the message and try the screening again." },
};

const nowLabel = () => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date());
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const END_OF_TURN_DELAY_MS = 720;

const selectNaturalVoice = (voices: SpeechSynthesisVoice[]) => {
  const preferredNames = [
    "Google US English", "Microsoft Aria", "Microsoft Jenny", "Samantha",
    "Ava", "Allison", "Serena", "Daniel", "Karen", "Tessa", "Moira",
  ];
  return voices
    .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
    .map((voice) => {
      const preferredIndex = preferredNames.findIndex((name) => voice.name.toLowerCase().includes(name.toLowerCase()));
      const score = (preferredIndex >= 0 ? 200 - preferredIndex : 0)
        + (/natural|neural|premium|enhanced/i.test(voice.name) ? 120 : 0)
        + (voice.lang.toLowerCase() === "en-us" ? 20 : 0)
        + (!voice.localService ? 12 : 0);
      return { voice, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.voice ?? null;
};

const fileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The file could not be read."));
  reader.onerror = () => reject(new Error("The file could not be read."));
  reader.readAsDataURL(file);
});

const headingValue = (text: string, label: string) => {
  const match = text.match(new RegExp(`(?:^|\\n)${label}\\s*:\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim() ?? "";
};

const prepareNaturalSpeech = async (text: string) => {
  const response = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error("Natural voice playback was unavailable.");
  return response.blob();
};

export default function AuraVoiceAgentPage() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [interimText, setInterimText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [detailsText, setDetailsText] = useState(DEFAULT_GOALS);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [preparingFile, setPreparingFile] = useState(false);
  const [typedReply, setTypedReply] = useState("");

  const messagesRef = useRef(messages);
  const screeningContextRef = useRef<ScreeningContext | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const sessionActiveRef = useRef(false);
  const turnBusyRef = useRef(false);
  const speakingRef = useRef(false);
  const speechQueueRef = useRef<SpeechQueueItem[]>([]);
  const speechBufferRef = useRef("");
  const firstSpeechQueuedRef = useRef(false);
  const streamCompleteRef = useRef(false);
  const requestAbortRef = useRef<AbortController | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const currentTranscriptRef = useRef("");
  const speechCycleRef = useRef(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const handleTurnRef = useRef<(text: string) => Promise<void>>(async () => undefined);
  const speakNextRef = useRef<() => void>(() => undefined);
  const finishTurnRef = useRef<() => void>(() => undefined);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    const loadVoices = () => { preferredVoiceRef.current = selectNaturalVoice(window.speechSynthesis.getVoices()); };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    if (!sessionActiveRef.current || turnBusyRef.current || speakingRef.current) return;
    currentTranscriptRef.current = "";
    clearSilenceTimer();
    setStatus("listening");
    try { recognitionRef.current?.start(); } catch { /* Already listening. */ }
  }, [clearSilenceTimer]);

  useEffect(() => {
    finishTurnRef.current = () => {
      turnBusyRef.current = false;
      speakingRef.current = false;
      streamCompleteRef.current = false;
      requestAbortRef.current = null;
      if (sessionActiveRef.current) window.setTimeout(startListening, 180);
    };
  }, [startListening]);

  useEffect(() => {
    speakNextRef.current = async () => {
      if (speakingRef.current) return;
      const next = speechQueueRef.current.shift();
      if (!next) {
        if (streamCompleteRef.current && turnBusyRef.current) finishTurnRef.current();
        return;
      }
      speakingRef.current = true;
      setStatus("speaking");

      const finishItem = () => {
        if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
        currentAudioRef.current = null;
        speakingRef.current = false;
        speakNextRef.current();
      };

      const playBrowserFallback = () => {
        if (!("speechSynthesis" in window)) {
          setErrorMessage("Voice playback is not available in this browser. Try the latest Chrome or Edge.");
          setStatus("error");
          turnBusyRef.current = false;
          speakingRef.current = false;
          return;
        }
        const utterance = new SpeechSynthesisUtterance(next.text);
        const preferredVoice = preferredVoiceRef.current ?? selectNaturalVoice(window.speechSynthesis.getVoices());
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.rate = 1.04;
        utterance.pitch = 0.98;
        utterance.onend = finishItem;
        utterance.onerror = finishItem;
        window.speechSynthesis.speak(utterance);
      };

      const audioBlob = await next.audio;
      if (next.cycle !== speechCycleRef.current || !sessionActiveRef.current) {
        speakingRef.current = false;
        speakNextRef.current();
        return;
      }
      if (!audioBlob) {
        playBrowserFallback();
        return;
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      currentAudioUrlRef.current = audioUrl;
      audio.onended = finishItem;
      audio.onerror = () => {
        if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
        currentAudioRef.current = null;
        playBrowserFallback();
      };
      try {
        await audio.play();
      } catch {
        audio.onerror?.(new Event("error"));
      }
    };
  }, []);

  const queueSpeech = useCallback((delta: string, flush = false) => {
    speechBufferRef.current += delta;
    let sentence = speechBufferRef.current.match(/^([\s\S]*?[.!?])(?=\s|$)/);
    while (sentence) {
      const spokenText = sentence[1].trim();
      speechBufferRef.current = speechBufferRef.current.slice(sentence[1].length).trimStart();
      if (spokenText) {
        speechQueueRef.current.push({
          text: spokenText,
          audio: prepareNaturalSpeech(spokenText).catch(() => null),
          cycle: speechCycleRef.current,
        });
        firstSpeechQueuedRef.current = true;
      }
      sentence = speechBufferRef.current.match(/^([\s\S]*?[.!?])(?=\s|$)/);
    }
    if (flush && speechBufferRef.current.trim()) {
      const spokenText = speechBufferRef.current.trim();
      speechQueueRef.current.push({
        text: spokenText,
        audio: prepareNaturalSpeech(spokenText).catch(() => null),
        cycle: speechCycleRef.current,
      });
      speechBufferRef.current = "";
    }
    speakNextRef.current();
  }, []);

  const replaceMessage = useCallback((id: string, text: string) => {
    messagesRef.current = messagesRef.current.map((message) => message.id === id ? { ...message, text } : message);
    setMessages(messagesRef.current);
  }, []);

  const requestAgentReply = useCallback(async (conversation: Message[], start = false) => {
    const screening = screeningContextRef.current;
    if (!screening || turnBusyRef.current || !sessionActiveRef.current) return;

    clearSilenceTimer();
    turnBusyRef.current = true;
    speechCycleRef.current += 1;
    streamCompleteRef.current = false;
    speechQueueRef.current = [];
    speechBufferRef.current = "";
    firstSpeechQueuedRef.current = false;
    setInterimText("");
    setErrorMessage("");
    setStatus("thinking");
    try { recognitionRef.current?.stop(); } catch { /* Already stopped. */ }

    const assistantId = makeId();
    const assistantMessage: Message = { id: assistantId, role: "assistant", text: "…", time: nowLabel() };
    messagesRef.current = [...conversation, assistantMessage];
    setMessages(messagesRef.current);
    const controller = new AbortController();
    requestAbortRef.current = controller;
    let completeText = "";

    try {
      const response = await fetch("/api/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start,
          screening,
          messages: conversation.map(({ role, text }) => ({ role, content: text })),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const problem = await response.json().catch(() => ({ error: "Aura could not connect to the AI service." }));
        throw new Error(problem.error || "Aura could not connect to the AI service.");
      }
      if (!response.body) throw new Error("The AI service returned no response stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          const event = JSON.parse(data) as { type?: string; delta?: string; error?: { message?: string } };
          if (event.type === "response.output_text.delta" && event.delta) {
            completeText += event.delta;
            replaceMessage(assistantId, completeText);
            queueSpeech(event.delta);
          }
          if (event.type === "error") throw new Error(event.error?.message || "The AI response was interrupted.");
        }
        if (done) break;
      }
      if (!completeText.trim()) {
        completeText = "Sorry, I didn't get a usable response. Could you say that again?";
        replaceMessage(assistantId, completeText);
      }
      streamCompleteRef.current = true;
      queueSpeech("", true);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "Aura could not complete the response.";
      replaceMessage(assistantId, message);
      setErrorMessage(message);
      setStatus("error");
      turnBusyRef.current = false;
      requestAbortRef.current = null;
    }
  }, [clearSilenceTimer, queueSpeech, replaceMessage]);

  const handleCandidateTurn = useCallback(async (spokenText: string) => {
    const cleanText = spokenText.trim();
    if (!cleanText || turnBusyRef.current || !sessionActiveRef.current) return;
    clearSilenceTimer();
    currentTranscriptRef.current = "";
    setInterimText("");
    setTypedReply("");
    const userMessage: Message = { id: makeId(), role: "user", text: cleanText, time: nowLabel() };
    const conversation = [...messagesRef.current, userMessage];
    messagesRef.current = conversation;
    setMessages(conversation);
    await requestAgentReply(conversation);
  }, [clearSilenceTimer, requestAgentReply]);

  useEffect(() => { handleTurnRef.current = handleCandidateTurn; }, [handleCandidateTurn]);

  const createRecognition = useCallback(() => {
    const RecognitionApi = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!RecognitionApi) throw new Error("Voice testing needs the latest Chrome or Edge for this prototype.");
    const recognition = new RecognitionApi();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onstart = () => setStatus("listening");
    recognition.onresult = (event) => {
      if (turnBusyRef.current) return;
      let transcript = "";
      let hasFinalResult = false;
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        transcript += result[0].transcript;
        hasFinalResult ||= result.isFinal;
      }
      const cleanTranscript = transcript.trim();
      currentTranscriptRef.current = cleanTranscript;
      setInterimText(cleanTranscript);
      clearSilenceTimer();
      if (hasFinalResult && cleanTranscript) {
        void handleTurnRef.current(cleanTranscript);
      } else if (cleanTranscript) {
        silenceTimerRef.current = window.setTimeout(() => {
          const completedTurn = currentTranscriptRef.current.trim();
          if (completedTurn && !turnBusyRef.current) void handleTurnRef.current(completedTurn);
        }, END_OF_TURN_DELAY_MS);
      }
    };
    recognition.onerror = (event) => {
      if (["aborted", "no-speech"].includes(event.error)) return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        sessionActiveRef.current = false;
        setSessionActive(false);
        setErrorMessage("Microphone access was blocked. Allow it in your browser settings, then try again.");
        setStatus("error");
      }
    };
    recognition.onend = () => {
      if (sessionActiveRef.current && !turnBusyRef.current && !speakingRef.current) {
        const completedTurn = currentTranscriptRef.current.trim();
        if (completedTurn) void handleTurnRef.current(completedTurn);
        else window.setTimeout(startListening, 120);
      }
    };
    recognitionRef.current = recognition;
  }, [clearSilenceTimer, startListening]);

  const getScreeningContext = () => ({
    candidateName: candidateName.trim(),
    companyName: companyName.trim(),
    jobTitle: jobTitle.trim(),
    jobDescription: jobDescription.trim().slice(0, 18_000),
    detailsToCollect: detailsText.split("\n")
      .map((item) => item.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 12),
  });

  const startConversation = async () => {
    const context = getScreeningContext();
    if (context.jobDescription.length < 40) {
      setErrorMessage("Add or upload the job description before starting the screening.");
      return;
    }
    if (!context.companyName || !context.jobTitle) {
      setErrorMessage("Add the company and job title so Aura can clearly explain why it is calling.");
      return;
    }
    if (context.detailsToCollect.length === 0) {
      setErrorMessage("Add at least one detail for Aura to collect.");
      return;
    }
    setStatus("requesting");
    setErrorMessage("");
    try {
      if (!recognitionRef.current) createRecognition();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      screeningContextRef.current = context;
      messagesRef.current = [];
      setMessages([]);
      sessionActiveRef.current = true;
      setSessionActive(true);
      await requestAgentReply([], true);
    } catch (error) {
      sessionActiveRef.current = false;
      setSessionActive(false);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Aura could not access your microphone.");
    }
  };

  const endConversation = () => {
    sessionActiveRef.current = false;
    setSessionActive(false);
    turnBusyRef.current = false;
    speechCycleRef.current += 1;
    speakingRef.current = false;
    speechQueueRef.current = [];
    speechBufferRef.current = "";
    firstSpeechQueuedRef.current = false;
    streamCompleteRef.current = false;
    clearSilenceTimer();
    currentTranscriptRef.current = "";
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.pause();
    }
    currentAudioRef.current = null;
    if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current);
    currentAudioUrlRef.current = null;
    window.speechSynthesis?.cancel();
    try { recognitionRef.current?.abort(); } catch { /* Already stopped. */ }
    setInterimText("");
    setTypedReply("");
    setStatus("idle");
  };

  const interruptReply = () => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    speechCycleRef.current += 1;
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.pause();
    }
    currentAudioRef.current = null;
    if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current);
    currentAudioUrlRef.current = null;
    window.speechSynthesis?.cancel();
    speechQueueRef.current = [];
    speechBufferRef.current = "";
    firstSpeechQueuedRef.current = false;
    streamCompleteRef.current = false;
    clearSilenceTimer();
    currentTranscriptRef.current = "";
    speakingRef.current = false;
    turnBusyRef.current = false;
    startListening();
  };

  const submitTypedReply = (event: FormEvent) => {
    event.preventDefault();
    void handleCandidateTurn(typedReply);
  };

  const uploadJobDescription = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8_000_000) {
      setErrorMessage("Please choose a job description smaller than 8 MB.");
      return;
    }
    setPreparingFile(true);
    setErrorMessage("");
    setUploadedFileName(file.name);
    try {
      const isText = file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name);
      let prepared = "";
      if (isText) {
        prepared = await file.text();
      } else {
        const response = await fetch("/api/prepare-jd", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, fileData: await fileAsDataUrl(file) }),
        });
        const payload = await response.json().catch(() => ({ error: "Aura could not read that file." }));
        if (!response.ok) throw new Error(payload.error || "Aura could not read that file.");
        prepared = payload.jobDescription;
      }
      prepared = prepared.trim().slice(0, 18_000);
      if (prepared.length < 40) throw new Error("That file did not contain enough readable job information.");
      setJobDescription(prepared);
      if (!companyName) setCompanyName(headingValue(prepared, "Company"));
      if (!jobTitle) setJobTitle(headingValue(prepared, "Job title"));
    } catch (error) {
      setUploadedFileName("");
      setErrorMessage(error instanceof Error ? error.message : "Aura could not prepare that job description.");
    } finally {
      setPreparingFile(false);
    }
  };

  useEffect(() => () => {
    sessionActiveRef.current = false;
    speechCycleRef.current += 1;
    clearSilenceTimer();
    requestAbortRef.current?.abort();
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.pause();
    }
    if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current);
    window.speechSynthesis?.cancel();
    recognitionRef.current?.abort();
  }, [clearSilenceTimer]);

  const copy = statusCopy[status];

  return (
    <main className={`voice-shell status-${status} p-6 max-w-7xl mx-auto`}>
      <nav className="topbar flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800" aria-label="Primary navigation">
        <a className="brand flex items-center gap-2 font-bold text-xl text-slate-900 dark:text-slate-100" href="#top" aria-label="Aura screening lab home">
          <span className="brand-mark flex items-center gap-1" aria-hidden="true">
            <i className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <i className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
            <i className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
          </span>
          <span>AURA VOICE AGENT</span>
        </a>
        <div className="future-chip text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-500/40 font-semibold flex items-center gap-1.5">
          <span className="signal-dot w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Candidate Screening Lab
        </div>
      </nav>

      <section className="screening-hero mb-8" id="top">
        <div className="hero-intro mb-6">
          <div className="eyebrow text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold mb-1 flex items-center gap-2">
            <span>Model Rehearsal</span>
            <span className="eyebrow-line w-8 h-px bg-emerald-500/40" />
            <span>Recruitment Screening</span>
          </div>
          <div className="hero-heading-row flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                Give Aura the brief.<br />Then test the screening call.
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                Upload a job description, choose what the screening should collect, and answer as a candidate. The agent adapts without turning the call into a questionnaire.
              </p>
            </div>
          </div>
        </div>

        <fieldset className="setup-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4" disabled={sessionActive}>
          <div className="setup-heading flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <p className="panel-kicker text-xs font-semibold text-slate-400 uppercase">Before the conversation</p>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Screening Setup</h2>
            </div>
            <span className="step-chip text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg font-mono">01 · Brief</span>
          </div>
          <div className="field-grid grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex flex-col text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="mb-1">Candidate name <em className="text-slate-400 font-normal">optional</em></span>
              <input className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-500" value={candidateName} onChange={(event) => setCandidateName(event.target.value)} placeholder="e.g. Sam" />
            </label>
            <label className="flex flex-col text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="mb-1">Company</span>
              <input className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-500" required value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="e.g. Northstar" />
            </label>
            <label className="flex flex-col text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="mb-1">Job title</span>
              <input className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-500" required value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="e.g. Product Designer" />
            </label>
          </div>
          <div className="context-grid grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="textarea-field flex flex-col text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="mb-1">Job description</span>
              <textarea className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-mono" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the JD here, or upload it below…" rows={8} />
              <span className="field-note text-[11px] text-slate-400 mt-1">The model uses this as reference context, not as instructions.</span>
            </label>
            <label className="textarea-field goals-field flex flex-col text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="mb-1">Details to collect <em className="text-slate-400 font-normal">one per line</em></span>
              <textarea className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-mono" value={detailsText} onChange={(event) => setDetailsText(event.target.value)} rows={8} />
              <span className="field-note text-[11px] text-slate-400 mt-1">Edit these to match the real screening. Aura asks only for missing items.</span>
            </label>
          </div>
          <div className="setup-actions flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <label className="upload-button cursor-pointer bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 transition-colors">
              <input type="file" accept=".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => void uploadJobDescription(event.target.files?.[0])} className="hidden" />
              <span aria-hidden="true">↑</span>{preparingFile ? "Preparing JD…" : uploadedFileName || "Upload JD"}
            </label>
            <button className="start-button w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-950/20" type="button" onClick={() => void startConversation()} disabled={preparingFile}>
              <span className="button-icon" aria-hidden="true">🎙</span>Start practice screening<span className="button-arrow" aria-hidden="true">↗</span>
            </button>
          </div>
          {errorMessage && !sessionActive && <p className="error-banner text-xs text-red-500 bg-red-50 dark:bg-red-950/50 p-3 rounded-xl border border-red-200 dark:border-red-800" role="alert">{errorMessage}</p>}
        </fieldset>
      </section>

      <section className="conversation-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4" aria-labelledby="conversation-title">
        <header className="panel-header flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <p className="panel-kicker text-xs font-semibold text-slate-400 uppercase">02 · Rehearsal</p>
            <h2 id="conversation-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">Candidate Conversation</h2>
          </div>
          <div className="session-status text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{copy.label}</div>
        </header>

        <div className="call-status bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <strong className="text-slate-900 dark:text-slate-100 block">{copy.label}</strong>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">{interimText ? `“${interimText}”` : copy.description}</p>
          </div>
          <div className="conversation-controls flex items-center gap-2">
            {status === "speaking" && <button className="interrupt-button bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors" type="button" onClick={interruptReply}>Interrupt</button>}
            {sessionActive && <button className="end-button bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors" type="button" onClick={endConversation}>End screening</button>}
          </div>
        </div>

        <div className="message-list space-y-3 max-h-96 overflow-y-auto p-3 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800" aria-live="polite">
          {messages.length === 0 && (
            <div className="empty-transcript text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
              <strong className="block text-slate-700 dark:text-slate-300 font-bold mb-1">No rehearsal yet</strong>
              <span>Aura will open the call after you start the screening.</span>
            </div>
          )}
          {messages.map((message) => (
            <article className={`message flex items-start gap-3 text-xs p-3 rounded-xl ${message.role === "assistant" ? "bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"}`} key={message.id}>
              <div className={`avatar w-7 h-7 rounded-lg flex items-center justify-center font-bold shrink-0 ${message.role === "assistant" ? "bg-emerald-600 text-white" : "bg-slate-700 text-white"}`} aria-hidden="true">
                {message.role === "assistant" ? "A" : "C"}
              </div>
              <div className="message-body flex-1">
                <div className="message-meta flex justify-between items-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  <strong>{message.role === "assistant" ? "Aura" : candidateName || "Candidate"}</strong>
                  <span>{message.time}</span>
                </div>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{message.text}</p>
              </div>
            </article>
          ))}
          {interimText && (
            <article className="message user-message interim-message flex items-start gap-3 text-xs p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700">
              <div className="avatar w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center font-bold shrink-0">C</div>
              <div className="message-body flex-1">
                <div className="message-meta flex justify-between items-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  <strong>Candidate</strong>
                  <span>Listening…</span>
                </div>
                <p className="text-slate-800 dark:text-slate-200 italic">{interimText}</p>
              </div>
            </article>
          )}
        </div>

        <form className="typed-reply space-y-1.5" onSubmit={submitTypedReply}>
          <label htmlFor="candidate-reply" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Test a candidate reply by typing</label>
          <div className="flex gap-2">
            <input id="candidate-reply" className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50" value={typedReply} onChange={(event) => setTypedReply(event.target.value)} placeholder={sessionActive ? "Type an answer or just speak…" : "Start a screening first"} disabled={!sessionActive || turnBusyRef.current} />
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-colors" disabled={!sessionActive || !typedReply.trim() || turnBusyRef.current}>Send</button>
          </div>
        </form>
        {errorMessage && sessionActive && <p className="error-banner conversation-error text-xs text-red-500 bg-red-50 dark:bg-red-950/50 p-3 rounded-xl border border-red-200 dark:border-red-800" role="alert">{errorMessage}</p>}
        <div className="panel-footer flex flex-wrap gap-4 text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800">
          <span>Natural OpenAI voice</span>
          <span>One question at a time</span>
          <span>JD-grounded answers</span>
          <span>No candidate scoring</span>
        </div>
      </section>

      <footer className="site-footer text-center text-xs text-slate-400 dark:text-slate-500 pt-6">
        <p>Model-first recruitment screening prototype. Phone connectivity comes later.</p>
        <span>Private prototype · 2026</span>
      </footer>
    </main>
  );
}
