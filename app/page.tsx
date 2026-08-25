"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { ScreeningContext } from "../lib/agent-config";

type AgentStatus = "idle" | "requesting" | "listening" | "thinking" | "speaking" | "error";
type MessageRole = "user" | "assistant";
type Message = { id: string; role: MessageRole; text: string; time: string };
type RealtimeEvent = {
  type?: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  error?: { message?: string };
  response?: {
    status?: string;
    status_details?: { error?: { message?: string } };
    output?: Array<{ content?: Array<{ transcript?: string; text?: string }> }>;
  };
};

const DEFAULT_GOALS = `Confirm continued interest in the role
Understand the candidate's most relevant recent experience
Confirm notice period or earliest available start date
Confirm preferred work location or working arrangement
Collect availability for a next-stage interview`;

const statusCopy: Record<AgentStatus, { label: string; description: string }> = {
  idle: { label: "Screening ready", description: "Add the job context, then start a practice screening." },
  requesting: { label: "Connecting the call", description: "Allow microphone access once while Aura prepares the live conversation." },
  listening: { label: "Listening to candidate", description: "Answer naturally. Aura can hear pauses, tone, and interruptions." },
  thinking: { label: "Choosing the next question", description: "Aura is responding through the live voice connection." },
  speaking: { label: "Aura is speaking", description: "You can interrupt naturally at any time, just like a phone call." },
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

const eventTranscript = (event: RealtimeEvent) => {
  const output = event.response?.output ?? [];
  return output
    .flatMap((item) => item.content ?? [])
    .map((content) => content.transcript ?? content.text ?? "")
    .join(" ")
    .trim();
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

  const messagesRef = useRef<Message[]>([]);
  const sessionActiveRef = useRef(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const connectionAbortRef = useRef<AbortController | null>(null);
  const assistantDraftRef = useRef<{ itemId: string; messageId: string; text: string } | null>(null);

  const updateMessages = useCallback((next: Message[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const addMessage = useCallback((role: MessageRole, text: string) => {
    const message: Message = { id: makeId(), role, text, time: nowLabel() };
    updateMessages([...messagesRef.current, message]);
    return message.id;
  }, [updateMessages]);

  const replaceMessage = useCallback((id: string, text: string) => {
    updateMessages(messagesRef.current.map((message) => message.id === id ? { ...message, text } : message));
  }, [updateMessages]);

  const sendRealtimeEvent = useCallback((event: Record<string, unknown>) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") throw new Error("The live voice connection is not ready yet.");
    channel.send(JSON.stringify(event));
  }, []);

  const closeRealtimeSession = useCallback(() => {
    connectionAbortRef.current?.abort();
    connectionAbortRef.current = null;
    const channel = dataChannelRef.current;
    dataChannelRef.current = null;
    if (channel && channel.readyState !== "closed") channel.close();
    const peer = peerConnectionRef.current;
    peerConnectionRef.current = null;
    if (peer && peer.connectionState !== "closed") peer.close();
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    remoteAudioRef.current = null;
    assistantDraftRef.current = null;
  }, []);

  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    if (!sessionActiveRef.current) return;

    if (event.type === "input_audio_buffer.speech_started") {
      setInterimText("");
      setStatus("listening");
      return;
    }
    if (event.type === "input_audio_buffer.speech_stopped") {
      setStatus("thinking");
      return;
    }
    if (event.type === "conversation.item.input_audio_transcription.delta" && event.delta) {
      setInterimText((current) => `${current}${event.delta}`.replace(/\s+/g, " ").trimStart());
      return;
    }
    if (event.type === "conversation.item.input_audio_transcription.completed") {
      const transcript = event.transcript?.trim();
      setInterimText("");
      if (transcript) addMessage("user", transcript);
      return;
    }
    if (event.type === "response.created") {
      setStatus("thinking");
      return;
    }
    if (event.type === "response.output_audio.delta" || event.type === "response.output_audio_transcript.delta") {
      setStatus("speaking");
      if (event.type !== "response.output_audio_transcript.delta" || !event.delta) return;
      const itemId = event.item_id ?? "assistant-current";
      let draft = assistantDraftRef.current;
      if (!draft || draft.itemId !== itemId) {
        const messageId = addMessage("assistant", event.delta);
        draft = { itemId, messageId, text: event.delta };
      } else {
        draft = { ...draft, text: `${draft.text}${event.delta}` };
        replaceMessage(draft.messageId, draft.text);
      }
      assistantDraftRef.current = draft;
      return;
    }
    if (event.type === "response.output_audio_transcript.done") {
      const transcript = event.transcript?.trim();
      const draft = assistantDraftRef.current;
      if (transcript && draft) replaceMessage(draft.messageId, transcript);
      assistantDraftRef.current = null;
      return;
    }
    if (event.type === "response.done") {
      const failure = event.response?.status_details?.error?.message;
      if (event.response?.status === "failed") {
        setErrorMessage(failure || "Aura could not complete that response.");
        setStatus("error");
        return;
      }
      if (event.response?.status === "cancelled" || event.response?.status === "incomplete") {
        assistantDraftRef.current = null;
        setStatus("listening");
        return;
      }
      const fallbackTranscript = eventTranscript(event);
      if (fallbackTranscript && !assistantDraftRef.current
        && messagesRef.current.at(-1)?.text !== fallbackTranscript) {
        addMessage("assistant", fallbackTranscript);
      }
      assistantDraftRef.current = null;
      setStatus("listening");
      return;
    }
    if (event.type === "error") {
      setErrorMessage(event.error?.message || "The live voice connection was interrupted.");
      setStatus("error");
    }
  }, [addMessage, replaceMessage]);

  const getScreeningContext = (): ScreeningContext => ({
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
    const screening = getScreeningContext();
    if (screening.jobDescription.length < 40) {
      setErrorMessage("Add or upload the job description before starting the screening.");
      return;
    }
    if (!screening.companyName || !screening.jobTitle) {
      setErrorMessage("Add the company and job title so Aura can clearly explain why it is calling.");
      return;
    }
    if (screening.detailsToCollect.length === 0) {
      setErrorMessage("Add at least one detail for Aura to collect.");
      return;
    }
    if (typeof RTCPeerConnection === "undefined") {
      setErrorMessage("Realtime voice needs a current version of Chrome, Edge, Safari, or Firefox.");
      return;
    }

    closeRealtimeSession();
    setStatus("requesting");
    setErrorMessage("");
    setInterimText("");
    updateMessages([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      microphoneStreamRef.current = stream;

      const peer = new RTCPeerConnection();
      peerConnectionRef.current = peer;
      const remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      remoteAudio.playsInline = true;
      remoteAudioRef.current = remoteAudio;
      peer.ontrack = (trackEvent) => {
        remoteAudio.srcObject = trackEvent.streams[0];
        void remoteAudio.play().catch(() => undefined);
      };
      peer.onconnectionstatechange = () => {
        if (!sessionActiveRef.current) return;
        if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
          setErrorMessage("The live voice connection ended. Start the screening again to reconnect.");
          setStatus("error");
        }
      };
      stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));

      const dataChannel = peer.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;
      dataChannel.onmessage = (messageEvent) => {
        try {
          handleRealtimeEvent(JSON.parse(messageEvent.data) as RealtimeEvent);
        } catch {
          // Ignore malformed diagnostic events while keeping the call alive.
        }
      };
      dataChannel.onerror = () => {
        if (!sessionActiveRef.current) return;
        setErrorMessage("The live conversation channel was interrupted.");
        setStatus("error");
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const controller = new AbortController();
      connectionAbortRef.current = controller;
      const response = await fetch("/api/realtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: offer.sdp, screening }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const problem = await response.json().catch(() => ({ error: "Aura could not open the live voice session." }));
        throw new Error(problem.error || "Aura could not open the live voice session.");
      }
      const answerSdp = await response.text();
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });

      await new Promise<void>((resolve, reject) => {
        if (dataChannel.readyState === "open") {
          resolve();
          return;
        }
        const timeout = window.setTimeout(() => reject(new Error("The live voice session took too long to connect.")), 12_000);
        dataChannel.onopen = () => {
          window.clearTimeout(timeout);
          resolve();
        };
      });

      sessionActiveRef.current = true;
      setSessionActive(true);
      setStatus("thinking");
      sendRealtimeEvent({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions: "Begin the call now. Give only a natural introduction, clearly name the company and exact position, explain that this is about the candidate's application, then ask whether now is a good time for a quick chat. Do not ask a screening question yet.",
        },
      });
    } catch (error) {
      closeRealtimeSession();
      sessionActiveRef.current = false;
      setSessionActive(false);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Aura could not access the microphone or start the call.");
    }
  };

  const endConversation = useCallback(() => {
    sessionActiveRef.current = false;
    setSessionActive(false);
    closeRealtimeSession();
    setInterimText("");
    setTypedReply("");
    setStatus("idle");
  }, [closeRealtimeSession]);

  const interruptReply = () => {
    try {
      sendRealtimeEvent({ type: "response.cancel" });
      sendRealtimeEvent({ type: "output_audio_buffer.clear" });
    } catch {
      // Speaking into the microphone still triggers automatic WebRTC barge-in.
    }
    assistantDraftRef.current = null;
    setStatus("listening");
  };

  const submitTypedReply = (event: FormEvent) => {
    event.preventDefault();
    const text = typedReply.trim();
    if (!text || !sessionActiveRef.current) return;
    try {
      if (status === "speaking") {
        sendRealtimeEvent({ type: "response.cancel" });
        sendRealtimeEvent({ type: "output_audio_buffer.clear" });
      }
      addMessage("user", text);
      setTypedReply("");
      setStatus("thinking");
      sendRealtimeEvent({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
      });
      sendRealtimeEvent({ type: "response.create", response: { output_modalities: ["audio"] } });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Aura could not send that reply.");
      setStatus("error");
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
    closeRealtimeSession();
  }, [closeRealtimeSession]);

  const copy = statusCopy[status];
  const candidateInputDisabled = !sessionActive || status === "requesting";

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
        <div className="panel-footer"><span>Realtime OpenAI voice</span><span>Natural interruption</span><span>JD-grounded answers</span><span>No candidate scoring</span></div>
      </section>

      <footer className="site-footer"><p>Model-first recruitment screening prototype. Phone connectivity comes later.</p><span>Private prototype · 2026</span></footer>
    </main>
  );
}
