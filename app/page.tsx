"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { ScreeningContext } from "../lib/agent-config";

type AgentStatus = "idle" | "requesting" | "listening" | "thinking" | "speaking" | "error";
type MessageRole = "user" | "assistant";
type Message = { id: string; role: MessageRole; text: string; time: string };
type SpeechQueueItem = { text: string; audio: Promise<Response | null>; controller: AbortController; cycle: number };
type SpeechAlternative = { transcript: string; confidence?: number };
type SpeechResult = { isFinal: boolean; length: number; [index: number]: SpeechAlternative };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type RecognitionError = { error: string };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
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
const FINAL_END_OF_TURN_DELAY_MS = 360;
const INTERIM_END_OF_TURN_DELAY_MS = 600;
const LOW_CONFIDENCE_THRESHOLD = 0.78;

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

const prepareNaturalSpeech = async (text: string, signal: AbortSignal) => {
  const response = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!response.ok) throw new Error("Natural voice playback was unavailable.");
  return response;
};

export default function Home() {
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
  const transcriptNeedsAccuracyRef = useRef(false);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedAudioChunksRef = useRef<Blob[]>([]);
  const transcriptionAbortRef = useRef<AbortController | null>(null);
  const speechCycleRef = useRef(0);
  const currentSpeechControllerRef = useRef<AbortController | null>(null);
  const currentSpeechReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const currentAudioContextRef = useRef<AudioContext | null>(null);
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const handleTurnRef = useRef<(text: string, verifyTranscript?: boolean) => Promise<void>>(async () => undefined);
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

  const startCandidateRecording = useCallback(() => {
    const stream = microphoneStreamRef.current;
    if (!stream || typeof MediaRecorder === "undefined" || mediaRecorderRef.current?.state === "recording") return;
    const supportedType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
      .find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, supportedType ? { mimeType: supportedType } : undefined);
    recordedAudioChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedAudioChunksRef.current.push(event.data);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
  }, []);

  const stopCandidateRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return Promise.resolve<Blob | null>(null);
    mediaRecorderRef.current = null;
    return new Promise<Blob | null>((resolve) => {
      const finish = () => {
        const chunks = recordedAudioChunksRef.current;
        recordedAudioChunksRef.current = [];
        resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || "audio/webm" }) : null);
      };
      recorder.onstop = finish;
      recorder.onerror = () => resolve(null);
      recorder.stop();
    });
  }, []);

  const transcribeCandidateAudio = useCallback(async (audio: Blob) => {
    const controller = new AbortController();
    transcriptionAbortRef.current = controller;
    const extension = audio.type.includes("mp4") ? "m4a" : "webm";
    const formData = new FormData();
    formData.append("audio", audio, `candidate.${extension}`);
    try {
      const response = await fetch("/api/transcribe", { method: "POST", body: formData, signal: controller.signal });
      if (!response.ok) throw new Error("Accurate transcription was unavailable.");
      const result = await response.json() as { text?: unknown };
      return typeof result.text === "string" ? result.text.trim() : "";
    } finally {
      if (transcriptionAbortRef.current === controller) transcriptionAbortRef.current = null;
    }
  }, []);

  const stopSpeechPlayback = useCallback(() => {
    currentSpeechControllerRef.current?.abort();
    currentSpeechControllerRef.current = null;
    speechQueueRef.current.forEach((item) => item.controller.abort());
    const reader = currentSpeechReaderRef.current;
    currentSpeechReaderRef.current = null;
    if (reader) void reader.cancel().catch(() => undefined);
    const audioContext = currentAudioContextRef.current;
    currentAudioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") void audioContext.close().catch(() => undefined);
    window.speechSynthesis?.cancel();
  }, []);

  const startListening = useCallback(() => {
    if (!sessionActiveRef.current || turnBusyRef.current || speakingRef.current) return;
    currentTranscriptRef.current = "";
    transcriptNeedsAccuracyRef.current = false;
    clearSilenceTimer();
    setStatus("listening");
    startCandidateRecording();
    try { recognitionRef.current?.start(); } catch { /* Already listening. */ }
  }, [clearSilenceTimer, startCandidateRecording]);

  useEffect(() => {
    finishTurnRef.current = () => {
      turnBusyRef.current = false;
      speakingRef.current = false;
      streamCompleteRef.current = false;
      requestAbortRef.current = null;
      if (sessionActiveRef.current) window.setTimeout(startListening, 100);
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
      currentSpeechControllerRef.current = next.controller;
      let finished = false;

      const finishItem = () => {
        if (finished) return;
        finished = true;
        currentSpeechControllerRef.current = null;
        currentSpeechReaderRef.current = null;
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

      const speechResponse = await next.audio;
      if (next.cycle !== speechCycleRef.current || !sessionActiveRef.current) {
        currentSpeechControllerRef.current = null;
        speakingRef.current = false;
        speakNextRef.current();
        return;
      }
      if (!speechResponse?.body || typeof AudioContext === "undefined") {
        playBrowserFallback();
        return;
      }

      let audioStarted = false;
      try {
        const existingContext = currentAudioContextRef.current;
        const audioContext = existingContext && existingContext.state !== "closed"
          ? existingContext
          : new AudioContext({ latencyHint: "interactive" });
        if (audioContext !== existingContext) currentAudioContextRef.current = audioContext;
        await audioContext.resume();
        const reader = speechResponse.body.getReader();
        currentSpeechReaderRef.current = reader;
        // Give the stream a small head start so brief network jitter cannot create audible gaps.
        let scheduledUntil = audioContext.currentTime + 0.1;
        let carry = new Uint8Array(0);
        let finalSource: AudioBufferSourceNode | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (next.cycle !== speechCycleRef.current || !sessionActiveRef.current) {
            await reader.cancel().catch(() => undefined);
            return;
          }

          const combined = new Uint8Array(carry.length + value.length);
          combined.set(carry);
          combined.set(value, carry.length);
          const usableBytes = combined.length - (combined.length % 2);
          carry = usableBytes < combined.length ? combined.slice(usableBytes) : new Uint8Array(0);
          if (usableBytes === 0) continue;

          const sampleCount = usableBytes / 2;
          const audioBuffer = audioContext.createBuffer(1, sampleCount, 24_000);
          const samples = audioBuffer.getChannelData(0);
          const view = new DataView(combined.buffer, combined.byteOffset, usableBytes);
          for (let index = 0; index < sampleCount; index += 1) {
            samples[index] = view.getInt16(index * 2, true) / 32_768;
          }

          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);
          scheduledUntil = Math.max(scheduledUntil, audioContext.currentTime + 0.045);
          source.start(scheduledUntil);
          scheduledUntil += audioBuffer.duration;
          finalSource = source;
          audioStarted = true;
        }

        currentSpeechReaderRef.current = null;
        if (!finalSource) throw new Error("The voice stream was empty.");
        finalSource.onended = finishItem;
      } catch {
        if (audioStarted) finishItem();
        else playBrowserFallback();
      }
    };
  }, []);

  const queueSpeech = useCallback((delta: string, flush = false) => {
    speechBufferRef.current += delta;
    // Start the first complete sentence while the rest of the reply is still arriving.
    // Holding everything else for one final request limits voice changes to one seam at most.
    if (!firstSpeechQueuedRef.current) {
      const firstSentence = speechBufferRef.current.match(/^([\s\S]*?[.!?])(?=\s|$)/);
      if (firstSentence) {
        const spokenText = firstSentence[1].trim();
        speechBufferRef.current = speechBufferRef.current.slice(firstSentence[1].length).trimStart();
        if (spokenText) {
          const controller = new AbortController();
          speechQueueRef.current.push({
            text: spokenText,
            audio: prepareNaturalSpeech(spokenText, controller.signal).catch(() => null),
            controller,
            cycle: speechCycleRef.current,
          });
          firstSpeechQueuedRef.current = true;
          speakNextRef.current();
        }
      }
    }
    if (flush && speechBufferRef.current.trim()) {
      const spokenText = speechBufferRef.current.trim();
      const controller = new AbortController();
      speechQueueRef.current.push({
        text: spokenText,
        audio: prepareNaturalSpeech(spokenText, controller.signal).catch(() => null),
        controller,
        cycle: speechCycleRef.current,
      });
      firstSpeechQueuedRef.current = true;
      speechBufferRef.current = "";
      speakNextRef.current();
    }
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
        speechBufferRef.current = completeText;
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

  const handleCandidateTurn = useCallback(async (spokenText: string, verifyTranscript = false) => {
    let cleanText = spokenText.trim();
    if (!cleanText || turnBusyRef.current || !sessionActiveRef.current) return;
    turnBusyRef.current = true;
    clearSilenceTimer();
    try { recognitionRef.current?.stop(); } catch { /* Already stopped. */ }
    const recordedAudio = await stopCandidateRecording();
    if (verifyTranscript && recordedAudio && recordedAudio.size > 1_000) {
      setStatus("thinking");
      try {
        const accurateText = await transcribeCandidateAudio(recordedAudio);
        if (accurateText) cleanText = accurateText;
      } catch {
        // The browser transcript remains a fast fallback if the accuracy pass is unavailable.
      }
    }
    if (!sessionActiveRef.current) {
      turnBusyRef.current = false;
      return;
    }
    currentTranscriptRef.current = "";
    setInterimText("");
    setTypedReply("");
    const userMessage: Message = { id: makeId(), role: "user", text: cleanText, time: nowLabel() };
    const conversation = [...messagesRef.current, userMessage];
    messagesRef.current = conversation;
    setMessages(conversation);
    turnBusyRef.current = false;
    await requestAgentReply(conversation);
  }, [clearSilenceTimer, requestAgentReply, stopCandidateRecording, transcribeCandidateAudio]);

  useEffect(() => { handleTurnRef.current = handleCandidateTurn; }, [handleCandidateTurn]);

  const createRecognition = useCallback(() => {
    const RecognitionApi = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!RecognitionApi) throw new Error("Voice testing needs the latest Chrome or Edge for this prototype.");
    const recognition = new RecognitionApi();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.lang = "en-US";
    recognition.onstart = () => setStatus("listening");
    recognition.onresult = (event) => {
      if (turnBusyRef.current) return;
      let finalTranscript = "";
      let interimTranscript = "";
      let hasInterimResult = false;
      let needsAccuracyPass = false;
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const best = result[0];
        if (result.isFinal) {
          finalTranscript += `${best.transcript} `;
          const confidence = typeof best.confidence === "number" ? best.confidence : 0;
          if (confidence > 0 && confidence < LOW_CONFIDENCE_THRESHOLD) needsAccuracyPass = true;
          const alternative = result.length > 1 ? result[1] : undefined;
          if (alternative && best.transcript.trim().toLowerCase() !== alternative.transcript.trim().toLowerCase()) {
            const alternativeConfidence = typeof alternative.confidence === "number" ? alternative.confidence : 0;
            if (confidence === 0 || alternativeConfidence >= confidence - 0.12) needsAccuracyPass = true;
          }
        } else {
          interimTranscript += `${best.transcript} `;
          hasInterimResult = true;
        }
      }
      const cleanTranscript = `${finalTranscript}${interimTranscript}`.replace(/\s+/g, " ").trim();
      currentTranscriptRef.current = cleanTranscript;
      transcriptNeedsAccuracyRef.current = needsAccuracyPass;
      setInterimText(cleanTranscript);
      clearSilenceTimer();
      if (cleanTranscript) {
        silenceTimerRef.current = window.setTimeout(() => {
          const completedTurn = currentTranscriptRef.current.trim();
          if (completedTurn && !turnBusyRef.current) {
            void handleTurnRef.current(completedTurn, transcriptNeedsAccuracyRef.current);
          }
        }, hasInterimResult ? INTERIM_END_OF_TURN_DELAY_MS : FINAL_END_OF_TURN_DELAY_MS);
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
        if (completedTurn) void handleTurnRef.current(completedTurn, transcriptNeedsAccuracyRef.current);
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
      if (typeof AudioContext !== "undefined"
        && (!currentAudioContextRef.current || currentAudioContextRef.current.state === "closed")) {
        currentAudioContextRef.current = new AudioContext({ latencyHint: "interactive" });
        await currentAudioContextRef.current.resume();
      }
      if (!recognitionRef.current) createRecognition();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      microphoneStreamRef.current = stream;
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
    stopSpeechPlayback();
    speechQueueRef.current = [];
    speechBufferRef.current = "";
    firstSpeechQueuedRef.current = false;
    streamCompleteRef.current = false;
    clearSilenceTimer();
    currentTranscriptRef.current = "";
    transcriptNeedsAccuracyRef.current = false;
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    transcriptionAbortRef.current?.abort();
    transcriptionAbortRef.current = null;
    void stopCandidateRecording();
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current = null;
    try { recognitionRef.current?.abort(); } catch { /* Already stopped. */ }
    setInterimText("");
    setTypedReply("");
    setStatus("idle");
  };

  const interruptReply = () => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    speechCycleRef.current += 1;
    stopSpeechPlayback();
    speechQueueRef.current = [];
    speechBufferRef.current = "";
    firstSpeechQueuedRef.current = false;
    streamCompleteRef.current = false;
    clearSilenceTimer();
    currentTranscriptRef.current = "";
    transcriptNeedsAccuracyRef.current = false;
    speakingRef.current = false;
    turnBusyRef.current = false;
    startListening();
  };

  const submitTypedReply = (event: FormEvent) => {
    event.preventDefault();
    void handleCandidateTurn(typedReply, false);
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
    transcriptionAbortRef.current?.abort();
    void stopCandidateRecording();
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current = null;
    stopSpeechPlayback();
    recognitionRef.current?.abort();
  }, [clearSilenceTimer, stopCandidateRecording, stopSpeechPlayback]);

  const copy = statusCopy[status];
  const candidateInputDisabled = !sessionActive || ["requesting", "thinking", "speaking"].includes(status);

  return (
    <main className={`voice-shell status-${status}`}>
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Aura screening lab home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>AURA</span>
        </a>
        <div className="future-chip"><span className="signal-dot" />Candidate screening lab</div>
      </nav>

      <section className="screening-hero" id="top">
        <div className="hero-intro">
          <div className="eyebrow"><span>Model rehearsal</span><span className="eyebrow-line" /><span>Recruitment screening</span></div>
          <div className="hero-heading-row">
            <div>
              <h1>Give Aura the brief.<br />Then test the call.</h1>
              <p>Upload a job description, choose what the screening should collect, and answer as a candidate. The agent adapts without turning the call into a questionnaire.</p>
            </div>
            <div className="mini-orb" aria-hidden="true">
              <div className="waveform">
                {Array.from({ length: 9 }).map((_, index) => <span key={index} style={{ "--wave-index": index } as CSSProperties} />)}
              </div>
            </div>
          </div>
        </div>

        <fieldset className="setup-card" disabled={sessionActive}>
          <div className="setup-heading">
            <div><p className="panel-kicker">Before the conversation</p><h2>Screening setup</h2></div>
            <span className="step-chip">01 · Brief</span>
          </div>
          <div className="field-grid">
            <label><span>Candidate name <em>optional</em></span><input value={candidateName} onChange={(event) => setCandidateName(event.target.value)} placeholder="e.g. Sam" /></label>
            <label><span>Company</span><input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="e.g. Northstar" /></label>
            <label><span>Job title</span><input required value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="e.g. Product Designer" /></label>
          </div>
          <div className="context-grid">
            <label className="textarea-field">
              <span>Job description</span>
              <textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the JD here, or upload it below…" rows={10} />
              <span className="field-note">The model uses this as reference context, not as instructions.</span>
            </label>
            <label className="textarea-field goals-field">
              <span>Details to collect <em>one per line</em></span>
              <textarea value={detailsText} onChange={(event) => setDetailsText(event.target.value)} rows={10} />
              <span className="field-note">Edit these to match the real screening. Aura asks only for missing items.</span>
            </label>
          </div>
          <div className="setup-actions">
            <label className="upload-button">
              <input type="file" accept=".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => void uploadJobDescription(event.target.files?.[0])} />
              <span aria-hidden="true">↑</span>{preparingFile ? "Preparing JD…" : uploadedFileName || "Upload JD"}
            </label>
            <button className="start-button" type="button" onClick={() => void startConversation()} disabled={preparingFile}>
              <span className="button-icon" aria-hidden="true" />Start practice screening<span className="button-arrow" aria-hidden="true">↗</span>
            </button>
          </div>
          {errorMessage && !sessionActive && <p className="error-banner" role="alert">{errorMessage}</p>}
        </fieldset>
      </section>

      <section className="conversation-panel" aria-labelledby="conversation-title">
        <header className="panel-header">
          <div><p className="panel-kicker">02 · Rehearsal</p><h2 id="conversation-title">Candidate conversation</h2></div>
          <div className="session-status"><span />{copy.label}</div>
        </header>

        <div className="call-status">
          <div className="status-orb"><span /></div>
          <div><strong>{copy.label}</strong><p>{interimText ? `“${interimText}”` : copy.description}</p></div>
          <div className="conversation-controls">
            {status === "speaking" && <button className="interrupt-button" type="button" onClick={interruptReply}>Interrupt</button>}
            {sessionActive && <button className="end-button" type="button" onClick={endConversation}>End screening</button>}
          </div>
        </div>

        <div className="message-list" aria-live="polite">
          {messages.length === 0 && <div className="empty-transcript"><strong>No rehearsal yet</strong><span>Aura will open the call after you start the screening.</span></div>}
          {messages.map((message) => (
            <article className={`message ${message.role}-message`} key={message.id}>
              <div className="avatar" aria-hidden="true">{message.role === "assistant" ? "A" : "C"}</div>
              <div className="message-body">
                <div className="message-meta"><strong>{message.role === "assistant" ? "Aura" : candidateName || "Candidate"}</strong><span>{message.time}</span></div>
                <p>{message.text}</p>
              </div>
            </article>
          ))}
          {interimText && <article className="message user-message interim-message"><div className="avatar">C</div><div className="message-body"><div className="message-meta"><strong>Candidate</strong><span>Listening…</span></div><p>{interimText}</p></div></article>}
        </div>

        <form className="typed-reply" onSubmit={submitTypedReply}>
          <label htmlFor="candidate-reply">Test a candidate reply by typing</label>
          <div><input id="candidate-reply" value={typedReply} onChange={(event) => setTypedReply(event.target.value)} placeholder={sessionActive ? "Type an answer or just speak…" : "Start a screening first"} disabled={candidateInputDisabled} /><button type="submit" disabled={candidateInputDisabled || !typedReply.trim()}>Send</button></div>
        </form>
        {errorMessage && sessionActive && <p className="error-banner conversation-error" role="alert">{errorMessage}</p>}
        <div className="panel-footer"><span>Natural OpenAI voice</span><span>One question at a time</span><span>JD-grounded answers</span><span>No candidate scoring</span></div>
      </section>

      <footer className="site-footer"><p>Model-first recruitment screening prototype. Phone connectivity comes later.</p><span>Private prototype · 2026</span></footer>
    </main>
  );
}
