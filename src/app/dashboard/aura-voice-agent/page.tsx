"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Participant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  TranscriptionSegment,
} from "livekit-client";
import type { ScreeningContext } from "@/lib/agent-config";

type AgentStatus = "idle" | "requesting" | "listening" | "thinking" | "speaking" | "error";
type MessageRole = "user" | "assistant";
type Message = { id: string; role: MessageRole; text: string; time: string };

const DEFAULT_GOALS = `Confirm continued interest in the role
Understand the candidate's most relevant recent experience
Confirm notice period or earliest available start date
Confirm preferred work location or working arrangement
Collect availability for a next-stage interview`;

const statusCopy: Record<AgentStatus, { label: string; description: string }> = {
  idle: { label: "Screening ready", description: "Add the job context, then start a practice screening." },
  requesting: { label: "Connecting to LiveKit WebRTC…", description: "Securing real-time audio channel and initializing candidate stream." },
  listening: { label: "Listening to candidate", description: "Answer as the candidate. Aura will move through the screening naturally." },
  thinking: { label: "Choosing the next question", description: "Aura is checking what has already been answered." },
  speaking: { label: "Aura is speaking", description: "Listen to the question, then reply naturally or type a test answer below." },
  error: { label: "Needs attention", description: "Review the message and try the screening again." },
};

const nowLabel = () => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date());
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const messagesRef = useRef(messages);
  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const attachedAudioElementsRef = useRef<Set<HTMLMediaElement>>(new Set());
  const transcriptIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const cleanupAudioTracks = useCallback(() => {
    for (const el of attachedAudioElementsRef.current) {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch {
        // Ignore
      }
    }
    attachedAudioElementsRef.current.clear();
  }, []);

  const disconnectRoom = useCallback(() => {
    cleanupAudioTracks();
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch {
        // Ignore
      }
      roomRef.current = null;
    }
  }, [cleanupAudioTracks]);

  const endConversation = useCallback(() => {
    disconnectRoom();
    setSessionActive(false);
    setStatus("idle");
    setInterimText("");
    setTypedReply("");
    setActiveSessionId(null);
  }, [disconnectRoom]);

  const getScreeningContext = (): ScreeningContext => ({
    candidateName: candidateName.trim(),
    companyName: companyName.trim(),
    jobTitle: jobTitle.trim(),
    jobDescription: jobDescription.trim().slice(0, 18_000),
    detailsToCollect: detailsText
      .split("\n")
      .map((item) => item.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 12),
  });

  const addFinalTranscription = useCallback(
    (segments: TranscriptionSegment[], participant?: Participant) => {
      for (const segment of segments) {
        if (!segment.text?.trim()) continue;
        if (segment.final) {
          if (transcriptIdsRef.current.has(segment.id)) continue;
          transcriptIdsRef.current.add(segment.id);

          const isAssistant =
            participant?.identity?.toLowerCase().startsWith("agent") ||
            participant?.identity?.toLowerCase().startsWith("aura") ||
            participant?.identity?.toLowerCase().startsWith("assistant");

          setMessages((prev) => [
            ...prev,
            {
              id: segment.id || makeId(),
              role: isAssistant ? "assistant" : "user",
              text: segment.text.trim(),
              time: nowLabel(),
            },
          ]);
          setInterimText("");
        } else {
          setInterimText(segment.text);
        }
      }
    },
    [],
  );

  const startConversation = async () => {
    const context = getScreeningContext();
    if (context.jobDescription.length < 20) {
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
    setMessages([]);
    transcriptIdsRef.current.clear();

    try {
      // 1. Request LiveKit Room Token
      const res = await fetch("/api/aura/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to connect to LiveKit token service." }));
        throw new Error(errorData.error || "Unable to acquire LiveKit room token.");
      }

      const tokenPayload = await res.json();
      const { token, url, sessionId } = tokenPayload;
      setActiveSessionId(sessionId);

      // 2. Initialize LiveKit WebRTC Room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      // Handle subscribed incoming remote audio tracks from LiveKit Agent
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind !== Track.Kind.Audio) return;
        const element = track.attach();
        element.autoplay = true;
        attachedAudioElementsRef.current.add(element);
        audioContainerRef.current?.appendChild(element);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        for (const element of track.detach()) {
          attachedAudioElementsRef.current.delete(element);
          element.remove();
        }
      });

      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        addFinalTranscription(segments, participant);
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const localIsSpeaking = speakers.some(
          (participant) => participant.identity === room.localParticipant.identity,
        );
        const assistantIsSpeaking = speakers.some(
          (participant) => participant.identity !== room.localParticipant.identity,
        );

        if (assistantIsSpeaking) {
          setStatus("speaking");
        } else if (localIsSpeaking) {
          setStatus("listening");
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        setSessionActive(false);
        setStatus("idle");
        roomRef.current = null;
      });

      // 3. Connect to LiveKit WebRTC Server
      await room.connect(url, token);

      // 4. Enable Local Microphone Stream
      await room.startAudio();
      await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      setSessionActive(true);
      setStatus("listening");

      // Initial opening greeting in UI
      setMessages([
        {
          id: makeId(),
          role: "assistant",
          text: `Hello ${context.candidateName || "there"}, this is Aura calling on behalf of ${context.companyName} regarding the ${context.jobTitle} position. Do you have a few minutes for a quick initial conversation?`,
          time: nowLabel(),
        },
      ]);
    } catch (error: any) {
      console.error("[LiveKit Voice Error]:", error);
      disconnectRoom();
      setSessionActive(false);
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not connect to LiveKit WebRTC audio service. Please check server configuration.",
      );
    }
  };

  const submitTypedReply = (event: FormEvent) => {
    event.preventDefault();
    const clean = typedReply.trim();
    if (!clean || !sessionActive) return;

    // Add candidate message to local log
    setMessages((prev) => [
      ...prev,
      { id: makeId(), role: "user", text: clean, time: nowLabel() },
    ]);
    setTypedReply("");

    // Publish data payload to LiveKit room
    if (roomRef.current?.state === "connected") {
      try {
        const strData = JSON.stringify({ type: "candidate_reply", text: clean });
        const encoder = new TextEncoder();
        void roomRef.current.localParticipant.publishData(encoder.encode(strData), { reliable: true });
      } catch (err) {
        console.warn("[LiveKit Data Publish Error]:", err);
      }
    }
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
      if (prepared.length < 20) throw new Error("That file did not contain enough readable job information.");
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
    disconnectRoom();
  }, [disconnectRoom]);

  const copy = statusCopy[status];

  return (
    <main className={`voice-shell status-${status} p-6 max-w-7xl mx-auto`}>
      {/* Hidden audio element container for incoming LiveKit WebRTC audio streams */}
      <div ref={audioContainerRef} className="hidden" aria-hidden="true" />

      <nav className="topbar flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800" aria-label="Primary navigation">
        <a className="brand flex items-center gap-2 font-bold text-xl text-slate-900 dark:text-slate-100" href="#top" aria-label="Aura screening lab home">
          <span className="brand-mark flex items-center gap-1" aria-hidden="true">
            <i className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <i className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
            <i className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
          </span>
          <span>AURA VOICE AGENT</span>
        </a>
        <div className="flex items-center gap-2">
          <div className="text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-500/40 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {sessionActive ? "LiveKit WebRTC Active" : "LiveKit Engine Ready"}
          </div>
        </div>
      </nav>

      <section className="screening-hero mb-8" id="top">
        <div className="hero-intro mb-6">
          <div className="eyebrow text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold mb-1 flex items-center gap-2">
            <span>Self-Hosted LiveKit WebRTC</span>
            <span className="eyebrow-line w-8 h-px bg-emerald-500/40" />
            <span>AI Voice Screening</span>
          </div>
          <div className="hero-heading-row flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                LiveKit WebRTC Screening Lab
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                Configure the job context, start the real-time LiveKit audio session, and speak with Aura as the candidate.
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
              <input className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-500" required value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="e.g. Career141" />
            </label>
            <label className="flex flex-col text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="mb-1">Job title</span>
              <input className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-500" required value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="e.g. Senior Software Engineer" />
            </label>
          </div>
          <div className="context-grid grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="textarea-field flex flex-col text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="mb-1">Job description</span>
              <textarea className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-mono" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the JD here, or upload it below…" rows={7} />
              <span className="field-note text-[11px] text-slate-400 mt-1">Grounds Aura's answers during the call.</span>
            </label>
            <label className="textarea-field goals-field flex flex-col text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="mb-1">Details to collect <em className="text-slate-400 font-normal">one per line</em></span>
              <textarea className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-mono" value={detailsText} onChange={(event) => setDetailsText(event.target.value)} rows={7} />
              <span className="field-note text-[11px] text-slate-400 mt-1">Checklist items Aura will collect sequentially.</span>
            </label>
          </div>
          <div className="setup-actions flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <label className="upload-button cursor-pointer bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 transition-colors">
              <input type="file" accept=".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => void uploadJobDescription(event.target.files?.[0])} className="hidden" />
              <span aria-hidden="true">↑</span>{preparingFile ? "Preparing JD…" : uploadedFileName || "Upload JD"}
            </label>
            <button className="start-button w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-950/20" type="button" onClick={() => void startConversation()} disabled={preparingFile}>
              <span className="button-icon" aria-hidden="true">🎙</span>Start LiveKit Screening<span className="button-arrow" aria-hidden="true">↗</span>
            </button>
          </div>
          {errorMessage && !sessionActive && <p className="error-banner text-xs text-red-500 bg-red-50 dark:bg-red-950/50 p-3 rounded-xl border border-red-200 dark:border-red-800" role="alert">{errorMessage}</p>}
        </fieldset>
      </section>

      <section className="conversation-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4" aria-labelledby="conversation-title">
        <header className="panel-header flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <p className="panel-kicker text-xs font-semibold text-slate-400 uppercase">02 · Live Rehearsal</p>
            <h2 id="conversation-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">LiveKit Audio Stream</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-md font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {activeSessionId ? `Session: ${activeSessionId.slice(0, 8)}` : "No session"}
            </span>
            <div className="session-status text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{copy.label}</div>
          </div>
        </header>

        <div className="call-status bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <strong className="text-slate-900 dark:text-slate-100 block">{copy.label}</strong>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">{interimText ? `“${interimText}”` : copy.description}</p>
          </div>
          <div className="conversation-controls flex items-center gap-2">
            {sessionActive && <button className="end-button bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors text-xs" type="button" onClick={endConversation}>End Screening</button>}
          </div>
        </div>

        <div className="message-list space-y-3 max-h-96 overflow-y-auto p-3 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800" aria-live="polite">
          {messages.length === 0 && (
            <div className="empty-transcript text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
              <strong className="block text-slate-700 dark:text-slate-300 font-bold mb-1">No active session</strong>
              <span>Click “Start LiveKit Screening” above to connect audio.</span>
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
                  <span>Speaking…</span>
                </div>
                <p className="text-slate-800 dark:text-slate-200 italic">{interimText}</p>
              </div>
            </article>
          )}
        </div>

        <form className="typed-reply space-y-1.5" onSubmit={submitTypedReply}>
          <label htmlFor="candidate-reply" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Test candidate reply via data channel</label>
          <div className="flex gap-2">
            <input id="candidate-reply" className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50" value={typedReply} onChange={(event) => setTypedReply(event.target.value)} placeholder={sessionActive ? "Type text or just speak through microphone…" : "Start a LiveKit session first"} disabled={!sessionActive} />
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-colors" disabled={!sessionActive || !typedReply.trim()}>Send</button>
          </div>
        </form>
        {errorMessage && sessionActive && <p className="error-banner conversation-error text-xs text-red-500 bg-red-50 dark:bg-red-950/50 p-3 rounded-xl border border-red-200 dark:border-red-800" role="alert">{errorMessage}</p>}
        <div className="panel-footer flex flex-wrap gap-4 text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800">
          <span>LiveKit WebRTC Full-Duplex Audio</span>
          <span>Echo Cancellation & Noise Suppression</span>
          <span>Candidate Voice Activity Detection</span>
        </div>
      </section>

      <footer className="site-footer text-center text-xs text-slate-400 dark:text-slate-500 pt-6">
        <p>LiveKit WebRTC Screening Session · Self-Hosted Infrastructure</p>
      </footer>
    </main>
  );
}
