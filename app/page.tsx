"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type AgentStatus = "idle" | "requesting" | "listening" | "thinking" | "speaking" | "error";
type MessageRole = "user" | "assistant";
type Message = { id: string; role: MessageRole; text: string; time: string };
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

const initialMessages: Message[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "Hi, I’m Aura. Start the conversation and speak naturally — no buttons between turns.",
    time: "Ready now",
  },
];

const statusCopy: Record<AgentStatus, { label: string; description: string }> = {
  idle: {
    label: "Ready when you are",
    description: "Tap once to begin. Aura listens for natural pauses, responds aloud, and gets ready for your next thought automatically.",
  },
  requesting: {
    label: "Waiting for microphone",
    description: "Allow microphone access once, then the rest of the conversation stays hands-free.",
  },
  listening: {
    label: "Listening",
    description: "Speak naturally. Aura will detect when you pause and respond without another tap.",
  },
  thinking: {
    label: "Preparing a reply",
    description: "Aura is forming a short response and will begin speaking as soon as the first phrase is ready.",
  },
  speaking: {
    label: "Aura is speaking",
    description: "The microphone will resume automatically as soon as Aura finishes.",
  },
  error: {
    label: "Needs attention",
    description: "Check the message below, then try starting the conversation again.",
  },
};

const nowLabel = () => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date());
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function Home() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [interimText, setInterimText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionActive, setSessionActive] = useState(false);

  const messagesRef = useRef(messages);
  const recognitionRef = useRef<Recognition | null>(null);
  const sessionActiveRef = useRef(false);
  const turnBusyRef = useRef(false);
  const speakingRef = useRef(false);
  const speechQueueRef = useRef<string[]>([]);
  const speechBufferRef = useRef("");
  const streamCompleteRef = useRef(false);
  const requestAbortRef = useRef<AbortController | null>(null);
  const handleTurnRef = useRef<(text: string) => Promise<void>>(async () => undefined);
  const speakNextRef = useRef<() => void>(() => undefined);
  const finishTurnRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const startListening = useCallback(() => {
    if (!sessionActiveRef.current || turnBusyRef.current || speakingRef.current) return;
    setStatus("listening");
    try {
      recognitionRef.current?.start();
    } catch {
      // The browser throws if recognition is already running; that state is safe to keep.
    }
  }, []);

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
    speakNextRef.current = () => {
      if (speakingRef.current) return;
      const nextText = speechQueueRef.current.shift();

      if (!nextText) {
        if (streamCompleteRef.current && turnBusyRef.current) finishTurnRef.current();
        return;
      }

      if (!("speechSynthesis" in window)) {
        setErrorMessage("Voice playback is not available in this browser. Try the latest Chrome or Edge.");
        setStatus("error");
        turnBusyRef.current = false;
        return;
      }

      speakingRef.current = true;
      setStatus("speaking");
      const utterance = new SpeechSynthesisUtterance(nextText);
      utterance.rate = 1.04;
      utterance.pitch = 1;
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find((voice) => voice.lang.startsWith("en") && voice.localService) ?? voices.find((voice) => voice.lang.startsWith("en"));
      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.onend = () => {
        speakingRef.current = false;
        speakNextRef.current();
      };
      utterance.onerror = () => {
        speakingRef.current = false;
        speakNextRef.current();
      };
      window.speechSynthesis.speak(utterance);
    };
  }, []);

  const queueSpeech = (delta: string, flush = false) => {
    speechBufferRef.current += delta;
    let sentence = speechBufferRef.current.match(/^([\s\S]*?[.!?])(?=\s|$)/);
    while (sentence) {
      const spokenText = sentence[1].trim();
      speechBufferRef.current = speechBufferRef.current.slice(sentence[1].length).trimStart();
      if (spokenText) speechQueueRef.current.push(spokenText);
      sentence = speechBufferRef.current.match(/^([\s\S]*?[.!?])(?=\s|$)/);
    }
    if (flush && speechBufferRef.current.trim()) {
      speechQueueRef.current.push(speechBufferRef.current.trim());
      speechBufferRef.current = "";
    }
    speakNextRef.current();
  };

  const replaceMessage = (id: string, text: string) => {
    setMessages((current) => current.map((message) => message.id === id ? { ...message, text } : message));
  };

  useEffect(() => {
    handleTurnRef.current = async (spokenText: string) => {
      const cleanText = spokenText.trim();
      if (!cleanText || turnBusyRef.current || !sessionActiveRef.current) return;

    turnBusyRef.current = true;
    streamCompleteRef.current = false;
    speechQueueRef.current = [];
    speechBufferRef.current = "";
    setInterimText("");
    setErrorMessage("");
    setStatus("thinking");
    try { recognitionRef.current?.stop(); } catch { /* Already stopped. */ }

    const userMessage: Message = { id: makeId(), role: "user", text: cleanText, time: nowLabel() };
    const assistantId = makeId();
    const assistantMessage: Message = { id: assistantId, role: "assistant", text: "…", time: nowLabel() };
    const conversation = [...messagesRef.current, userMessage];
    messagesRef.current = [...conversation, assistantMessage];
    setMessages(messagesRef.current);

    const controller = new AbortController();
    requestAbortRef.current = controller;
    let completeText = "";

    try {
      const response = await fetch("/api/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversation.map(({ role, text }) => ({ role, content: text })) }),
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
        completeText = "I’m sorry, I didn’t get a usable response. Could you try that again?";
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
    };
  });

  const createRecognition = () => {
    const RecognitionApi = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!RecognitionApi) throw new Error("Hands-free listening needs the latest Chrome or Edge for this first version.");

    const recognition = new RecognitionApi();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onstart = () => setStatus("listening");
    recognition.onresult = (event) => {
      if (turnBusyRef.current) return;
      let interim = "";
      let final = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      setInterimText(interim.trim());
      if (final.trim()) void handleTurnRef.current(final);
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
        window.setTimeout(startListening, 180);
      }
    };
    recognitionRef.current = recognition;
  };

  const startConversation = async () => {
    setStatus("requesting");
    setErrorMessage("");
    try {
      if (!recognitionRef.current) createRecognition();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      sessionActiveRef.current = true;
      setSessionActive(true);
      startListening();
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
    speakingRef.current = false;
    speechQueueRef.current = [];
    speechBufferRef.current = "";
    streamCompleteRef.current = false;
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    window.speechSynthesis?.cancel();
    try { recognitionRef.current?.abort(); } catch { /* Already stopped. */ }
    setInterimText("");
    setErrorMessage("");
    setStatus("idle");
  };

  const interruptReply = () => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    window.speechSynthesis?.cancel();
    speechQueueRef.current = [];
    speechBufferRef.current = "";
    streamCompleteRef.current = false;
    speakingRef.current = false;
    turnBusyRef.current = false;
    startListening();
  };

  useEffect(() => () => {
    sessionActiveRef.current = false;
    requestAbortRef.current?.abort();
    window.speechSynthesis?.cancel();
    recognitionRef.current?.abort();
  }, []);

  const copy = statusCopy[status];
  const buttonLabel = sessionActive ? "End conversation" : status === "error" ? "Try again" : "Start conversation";

  return (
    <main className={`voice-shell status-${status}`}>
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Aura home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>AURA</span>
        </a>
        <div className="future-chip"><span className="signal-dot" />Phone-ready core</div>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow">
          <span>Hands-free voice agent</span><span className="eyebrow-line" /><span>Low-cost mode</span>
        </div>

        <div className="voice-stage">
          <div className="orb-wrap" aria-hidden="true">
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="voice-orb">
              <span className="orb-glow" />
              <div className="waveform">
                {Array.from({ length: 13 }).map((_, index) => (
                  <span key={index} style={{ "--wave-index": index } as CSSProperties} />
                ))}
              </div>
            </div>
          </div>

          <div className="stage-copy">
            <p className="stage-state" aria-live="polite"><span />{copy.label}</p>
            <h1>A conversation,<br />not a command.</h1>
            <p className="stage-description">{interimText ? `“${interimText}”` : copy.description}</p>
            <div className="conversation-controls">
              <button className="start-button" type="button" onClick={sessionActive ? endConversation : startConversation}>
                <span className="button-icon" aria-hidden="true" />
                {buttonLabel}
                <span className="button-arrow" aria-hidden="true">{sessionActive ? "×" : "↗"}</span>
              </button>
              {status === "speaking" && (
                <button className="interrupt-button" type="button" onClick={interruptReply}>Interrupt</button>
              )}
            </div>
            <p className="permission-note">One tap starts a hands-free session. Microphone access ends when you end it.</p>
            {errorMessage && <p className="error-banner" role="alert">{errorMessage}</p>}
          </div>
        </div>
      </section>

      <section className="conversation-panel" aria-labelledby="conversation-title">
        <header className="panel-header">
          <div><p className="panel-kicker">Live transcript</p><h2 id="conversation-title">Conversation</h2></div>
          <div className="session-status"><span />{sessionActive ? copy.label : "Waiting to start"}</div>
        </header>
        <div className="message-list" aria-live="polite">
          {messages.map((message) => (
            <article className={`message ${message.role}-message`} key={message.id}>
              <div className="avatar" aria-hidden="true">{message.role === "assistant" ? "A" : "You"}</div>
              <div className="message-body">
                <div className="message-meta"><strong>{message.role === "assistant" ? "Aura" : "You"}</strong><span>{message.time}</span></div>
                <p>{message.text}</p>
              </div>
            </article>
          ))}
          {interimText && (
            <article className="message user-message interim-message">
              <div className="avatar" aria-hidden="true">You</div>
              <div className="message-body"><div className="message-meta"><strong>You</strong><span>Listening…</span></div><p>{interimText}</p></div>
            </article>
          )}
        </div>
        <div className="panel-footer">
          <span>Browser voice</span><span>Automatic turn detection</span><span>Secure agent connection</span>
        </div>
      </section>

      <footer className="site-footer">
        <p>Designed for natural web conversations today, adaptable to phone calls later.</p>
        <span>Private prototype · 2026</span>
      </footer>
    </main>
  );
}
