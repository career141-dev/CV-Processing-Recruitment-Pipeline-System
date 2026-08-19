"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import {
  Participant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  TranscriptionSegment,
} from "livekit-client";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export interface VoiceTestApplication {
  applicationId: Id<"applications">;
  jobId: Id<"jobs">;
  jobTitle: string;
}

interface VoiceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: Id<"candidates">;
  candidateName: string;
  applications: VoiceTestApplication[];
}

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  timestamp: string;
}

type CallState = "idle" | "connecting" | "active" | "ended" | "error";
type SpeakingParty = "assistant" | "user" | null;

const MAX_SIMULATION_SECONDS = 5 * 60;

function getCleanSpokenFirstName(fullName?: string | null): string {
  if (!fullName || typeof fullName !== "string") return "Candidate";
  const tokens = fullName
    .replace(/[,\-_.]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const substantiveNames = tokens.filter(
    (token) => token.length > 2 && !/^(Mr|Mrs|Ms|Dr|Prof|Miss)$/i.test(token),
  );
  const chosen =
    substantiveNames[0] || tokens[tokens.length - 1] || "Candidate";
  return chosen.charAt(0).toUpperCase() + chosen.slice(1).toLowerCase();
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder
    .toString()
    .padStart(2, "0")}`;
}

function nowLabel(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VoiceTestModal({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  applications,
}: VoiceTestModalProps) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>(
    applications.length === 1 ? applications[0].applicationId : "",
  );
  const [customScript, setCustomScript] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [speakingParty, setSpeakingParty] = useState<SpeakingParty>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const generateVoiceReply = useAction(api.aiCalls.voiceEngine.generateVoicePrescreeningReply);

  const [engineMode, setEngineMode] = useState<"livekit" | "browser_vad">("livekit");
  const [extractedData, setExtractedData] = useState<Record<string, any>>({});

  const roomRef = useRef<Room | null>(null);
  const startAbortControllerRef = useRef<AbortController | null>(null);
  const startGenerationRef = useRef(0);
  const audioElementsRef = useRef<Set<HTMLMediaElement>>(new Set());
  const transcriptIdsRef = useRef<Set<string>>(new Set());
  const finalizedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxCallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reservationSessionIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);

  // Browser VAD Audio Engine Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechDetectedRef = useRef(false);
  const isAiSpeakingRef = useRef(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const releaseSimulationReservation = useMutation(
    api.aiCalls.voiceCalls.releaseVoiceSimulationReservation,
  );

  const cleanFirstName = getCleanSpokenFirstName(candidateName);
  const selectedApplication = useMemo(
    () =>
      applications.find(
        (application) => application.applicationId === selectedApplicationId,
      ),
    [applications, selectedApplicationId],
  );

  const simulationContext = useQuery(
    api.aiCalls.voiceCalls.getVoiceSimulationContext,
    selectedApplication
      ? {
          candidateId,
          jobId: selectedApplication.jobId,
          applicationId: selectedApplication.applicationId,
        }
      : "skip",
  );
  const customQuestions = simulationContext?.customQuestions ?? [];

  const clearTimers = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (maxCallTimerRef.current) {
      clearTimeout(maxCallTimerRef.current);
      maxCallTimerRef.current = null;
    }
  }, []);

  const releaseRoom = useCallback(async () => {
    startAbortControllerRef.current?.abort();
    startAbortControllerRef.current = null;
    clearTimers();

    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = "";
      } catch {}
      activeAudioRef.current = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }

    const room = roomRef.current;
    roomRef.current = null;

    if (room) {
      room.removeAllListeners();
      try {
        await room.localParticipant.setMicrophoneEnabled(false);
      } catch {
        // The track may already be stopped after a network disconnect.
      }
      try {
        await room.disconnect(true);
      } catch {
        // Disconnection is best-effort during teardown.
      }
    }

    for (const element of audioElementsRef.current) {
      element.pause();
      element.srcObject = null;
      element.remove();
    }
    audioElementsRef.current.clear();

    const reservationSessionId = reservationSessionIdRef.current;
    reservationSessionIdRef.current = null;
    if (reservationSessionId) {
      await releaseSimulationReservation({
        sessionId: reservationSessionId,
      }).catch(() => undefined);
    }
  }, [clearTimers, releaseSimulationReservation]);

  const finishSimulation = useCallback(async () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;

    if (startedAtRef.current !== null) {
      setCallDuration(
        Math.min(
          MAX_SIMULATION_SECONDS,
          Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)),
        ),
      );
    }

    await releaseRoom();
    setLiveTranscript("");
    setCallState("ended");
  }, [releaseRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveTranscript]);

  useEffect(() => {
    return () => {
      finalizedRef.current = true;
      void releaseRoom();
    };
  }, [releaseRoom]);

  if (!isOpen) return null;

  const addFinalTranscriptions = (
    segments: TranscriptionSegment[],
    participant: Participant | undefined,
    room: Room,
  ) => {
    const participantIdentity = participant?.identity || "unknown";
    const role: ChatMessage["role"] =
      participantIdentity === room.localParticipant.identity
        ? "user"
        : "assistant";
    const finalMessages: ChatMessage[] = [];

    for (const segment of segments) {
      const segmentKey = `${participantIdentity}:${segment.id}`;
      if (!segment.final || transcriptIdsRef.current.has(segmentKey)) continue;
      const text = segment.text.trim();
      if (!text) continue;
      transcriptIdsRef.current.add(segmentKey);
      finalMessages.push({
        id: segmentKey,
        role,
        text,
        timestamp: nowLabel(),
      });
    }

    if (finalMessages.length > 0) {
      setMessages((current) => [...current, ...finalMessages]);
    }

    setLiveTranscript(
      segments
        .filter((segment) => !segment.final)
        .map((segment) => segment.text.trim())
        .filter(Boolean)
        .join(" "),
    );
  };

  const handleStartCall = async () => {
    if (!selectedApplication || !simulationContext || callState !== "idle")
      return;

    const startGeneration = ++startGenerationRef.current;
    const abortController = new AbortController();
    startAbortControllerRef.current?.abort();
    startAbortControllerRef.current = abortController;
    finalizedRef.current = false;
    transcriptIdsRef.current.clear();
    setMessages([]);
    setLiveTranscript("");
    setCallDuration(0);
    setErrorMessage("");
    setSpeakingParty(null);
    startedAtRef.current = null;
    setCallState("connecting");

    try {
      const tokenResponse = await fetch("/api/voice/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          candidateId,
          jobId: selectedApplication.jobId,
          applicationId: selectedApplication.applicationId,
          customScript: customScript.trim() || undefined,
        }),
      });

      const tokenPayload = (await tokenResponse.json()) as {
        token?: string;
        url?: string;
        sessionId?: string;
        error?: string;
      };
      if (
        !tokenResponse.ok ||
        !tokenPayload.token ||
        !tokenPayload.url ||
        !tokenPayload.sessionId
      ) {
        throw new Error(
          tokenPayload.error || "The voice service could not create a session.",
        );
      }
      reservationSessionIdRef.current = tokenPayload.sessionId;
      if (
        abortController.signal.aborted ||
        finalizedRef.current ||
        startGenerationRef.current !== startGeneration
      ) {
        await releaseRoom();
        return;
      }

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind !== Track.Kind.Audio) return;
        const element = track.attach();
        element.autoplay = true;
        audioElementsRef.current.add(element);
        audioContainerRef.current?.appendChild(element);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        for (const element of track.detach()) {
          audioElementsRef.current.delete(element);
          element.remove();
        }
      });

      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        addFinalTranscriptions(segments, participant, room);
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const localIsSpeaking = speakers.some(
          (participant) =>
            participant.identity === room.localParticipant.identity,
        );
        const assistantIsSpeaking = speakers.some(
          (participant) =>
            participant.identity !== room.localParticipant.identity,
        );
        setSpeakingParty(
          assistantIsSpeaking ? "assistant" : localIsSpeaking ? "user" : null,
        );
      });

      room.on(RoomEvent.Disconnected, () => {
        if (finalizedRef.current) return;
        finalizedRef.current = true;
        clearTimers();
        roomRef.current = null;
        setSpeakingParty(null);
        setErrorMessage(
          "The streaming session disconnected. No candidate data was changed.",
        );
        setCallState("error");
        void releaseRoom();
      });

      await room.connect(tokenPayload.url, tokenPayload.token);
      if (
        abortController.signal.aborted ||
        finalizedRef.current ||
        startGenerationRef.current !== startGeneration
      ) {
        await releaseRoom();
        return;
      }
      await room.startAudio();
      await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      if (
        abortController.signal.aborted ||
        finalizedRef.current ||
        startGenerationRef.current !== startGeneration
      ) {
        await releaseRoom();
        return;
      }

      startAbortControllerRef.current = null;
      startedAtRef.current = Date.now();
      durationTimerRef.current = setInterval(() => {
        if (startedAtRef.current === null) return;
        setCallDuration(
          Math.min(
            MAX_SIMULATION_SECONDS,
            Math.floor((Date.now() - startedAtRef.current) / 1000),
          ),
        );
      }, 1000);
      maxCallTimerRef.current = setTimeout(() => {
        void finishSimulation();
      }, MAX_SIMULATION_SECONDS * 1000);
      setEngineMode("livekit");
      setCallState("active");
    } catch (error) {
      const wasCancelled =
        finalizedRef.current || abortController.signal.aborted;
      if (wasCancelled) {
        await releaseRoom();
        return;
      }
      console.warn("[Voice Simulation] LiveKit room unavailable, falling back to browser VAD audio engine:", error);
      await startBrowserVadSimulation();
    }
  };

  const playAiVoice = async (text: string, isFinalWrapup = false) => {
    try {
      if (finalizedRef.current) return;
      isAiSpeakingRef.current = true;
      setSpeakingParty("assistant");
      setCallState("active");

      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("TTS request failed");

      const blob = await res.blob();
      if (finalizedRef.current) return;
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;

      audio.onended = () => {
        isAiSpeakingRef.current = false;
        activeAudioRef.current = null;
        setSpeakingParty(null);
        if (finalizedRef.current) return;
        if (isFinalWrapup) {
          void finishSimulation();
        } else {
          void startListeningWithVAD();
        }
      };

      await audio.play();
    } catch (err) {
      console.error("[Voice Modal] Speak error:", err);
      isAiSpeakingRef.current = false;
      activeAudioRef.current = null;
      setSpeakingParty(null);
      if (finalizedRef.current) return;
      if (isFinalWrapup) {
        void finishSimulation();
      } else {
        void startListeningWithVAD();
      }
    }
  };

  const startListeningWithVAD = async () => {
    try {
      if (isAiSpeakingRef.current || finalizedRef.current) return;
      setSpeakingParty("user");
      speechDetectedRef.current = false;
      audioChunksRef.current = [];

      if (!micStreamRef.current) {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      }

      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }

      const audioCtx = audioContextRef.current;
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(micStreamRef.current);
      source.connect(analyser);

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch {}
      }

      const mediaRecorder = new MediaRecorder(micStreamRef.current, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 2000) {
          if (!isAiSpeakingRef.current && !finalizedRef.current) void startListeningWithVAD();
          return;
        }
        await processCandidateAudio(audioBlob);
      };

      if (mediaRecorder.state === "inactive") {
        mediaRecorder.start(200);
      }

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const SILENCE_THRESHOLD_MS = 600;
      const VOLUME_TRIGGER_LEVEL = 12;

      const checkVolume = () => {
        if (isAiSpeakingRef.current || finalizedRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const averageVolume = Math.round(sum / dataArray.length);

        if (averageVolume > VOLUME_TRIGGER_LEVEL) {
          if (!speechDetectedRef.current) {
            speechDetectedRef.current = true;
          }
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (speechDetectedRef.current) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
              }
            }, SILENCE_THRESHOLD_MS);
          }
        }

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.error("[Voice Modal] VAD error:", err);
    }
  };

  const processCandidateAudio = async (audioBlob: Blob) => {
    if (finalizedRef.current) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    setLiveTranscript("Analyzing candidate voice...");

    try {
      const transcribeRes = await fetch("/api/voice/transcribe", {
        method: "POST",
        headers: { "Content-Type": "audio/webm" },
        body: audioBlob,
      });

      const transcribeData = await transcribeRes.json();
      const userText = transcribeData.transcript?.trim();

      if (!userText || userText.length < 2) {
        setLiveTranscript("");
        void startListeningWithVAD();
        return;
      }

      setLiveTranscript("");
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: userText,
        timestamp: nowLabel(),
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      const chatData = await generateVoiceReply({
        candidateName: cleanFirstName,
        jobTitle: selectedApplication?.jobTitle || "Position",
        jobDescription: simulationContext?.jobDescription,
        customQuestions,
        alreadyCollected: extractedData,
        customScript: customScript.trim() || undefined,
        messages: updatedMessages.map((m) => ({ role: m.role, content: m.text })),
      });

      if (chatData?.extracted) {
        setExtractedData((prev) => ({ ...prev, ...chatData.extracted }));
      }

      const aiReply = chatData?.spokenResponse || "Thank you. Let's proceed.";
      const aiMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: aiReply,
        timestamp: nowLabel(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      const isWrapup = chatData?.isPrescreeningComplete === true;
      await playAiVoice(aiReply, isWrapup);
    } catch (err) {
      console.error("[Voice Modal] Processing error:", err);
      void startListeningWithVAD();
    }
  };

  const startBrowserVadSimulation = async () => {
    finalizedRef.current = false;
    setEngineMode("browser_vad");
    setMessages([]);
    setLiveTranscript("");
    setCallDuration(0);
    setErrorMessage("");
    setSpeakingParty(null);
    setCallState("active");

    startedAtRef.current = Date.now();
    durationTimerRef.current = setInterval(() => {
      if (startedAtRef.current === null) return;
      setCallDuration(
        Math.min(
          MAX_SIMULATION_SECONDS,
          Math.floor((Date.now() - startedAtRef.current) / 1000),
        ),
      );
    }, 1000);

    maxCallTimerRef.current = setTimeout(() => {
      void finishSimulation();
    }, MAX_SIMULATION_SECONDS * 1000);

    const greeting = `Hello, I am Sarah, an automated AI recruiter assistant calling on behalf of Career141 regarding your application for the ${selectedApplication?.jobTitle || "position"} role. Do you consent to continue with a short three-minute screening?`;
    const initialMsg: ChatMessage = {
      id: `assistant-init-${Date.now()}`,
      role: "assistant",
      text: greeting,
      timestamp: nowLabel(),
    };
    setMessages([initialMsg]);
    await playAiVoice(greeting);
  };

  const handleClose = async () => {
    if (callState === "active" || callState === "connecting") {
      await finishSimulation();
    } else {
      await releaseRoom();
    }
    onClose();
  };

  const jobIsLoading = Boolean(
    selectedApplication && simulationContext === undefined,
  );
  const canStart = Boolean(
    selectedApplication && simulationContext && callState === "idle",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-test-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-600/20 text-indigo-400">
              <span className="material-symbols-outlined">call</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  id="voice-test-title"
                  className="text-base font-semibold text-slate-100"
                >
                  Real-time AI voice simulation
                </h3>
                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                  LiveKit streaming
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Speaking as{" "}
                <span className="font-semibold text-indigo-300">
                  {cleanFirstName}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close voice simulation"
            onClick={() => void handleClose()}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-3 text-xs leading-relaxed text-amber-100">
          This is an in-browser simulation, not a phone call. Microphone audio
          and transcripts are processed by the configured AI providers. Ending
          this test will not update the candidate, application, pipeline, or
          call history.
        </div>

        {callState === "idle" && (
          <div className="space-y-4 border-b border-slate-800 p-5">
            <div>
              <label
                htmlFor="voice-application"
                className="mb-1.5 block text-xs font-semibold text-slate-300"
              >
                Application to simulate
              </label>
              <select
                id="voice-application"
                value={selectedApplicationId}
                onChange={(event) =>
                  setSelectedApplicationId(event.target.value)
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Select a real candidate application</option>
                {applications.map((application) => (
                  <option
                    key={application.applicationId}
                    value={application.applicationId}
                  >
                    {application.jobTitle}
                  </option>
                ))}
              </select>
              {applications.length === 0 && (
                <p className="mt-1.5 text-xs text-rose-300">
                  Add this candidate to a job before running a voice simulation.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="voice-notes"
                className="mb-1.5 block text-xs font-semibold text-slate-300"
              >
                Additional recruiter notes (optional)
              </label>
              <textarea
                id="voice-notes"
                value={customScript}
                maxLength={2000}
                onChange={(event) => setCustomScript(event.target.value)}
                placeholder="For example: ask about React experience and weekend availability."
                className="h-20 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {selectedApplication && simulationContext && (
              <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-300">
                <p className="font-semibold text-slate-100">
                  {selectedApplication.jobTitle}
                </p>
                <p className="mt-1 line-clamp-3 text-slate-400">
                  {simulationContext.jobDescription ||
                    "No job description is available."}
                </p>
                {customQuestions.length > 0 && (
                  <p className="mt-2 text-indigo-300">
                    {customQuestions.length} configured screening question
                    {customQuestions.length === 1 ? "" : "s"} will be included.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="min-h-[260px] flex-1 space-y-4 overflow-y-auto bg-slate-900/50 p-5">
          {messages.length === 0 &&
            callState !== "error" &&
            callState !== "ended" && (
              <div className="flex h-full min-h-[210px] flex-col items-center justify-center gap-3 text-center text-slate-400">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800/60 text-2xl">
                  🎙️
                </div>
                <p className="max-w-md text-xs leading-relaxed">
                  The transcript will appear here as the streaming agent and
                  browser participant speak.
                </p>
              </div>
            )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col ${message.role === "assistant" ? "items-start" : "items-end"}`}
            >
              <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-slate-400">
                <span>
                  {message.role === "assistant" ? "Sarah (AI)" : cleanFirstName}
                </span>
                <span>•</span>
                <span>{message.timestamp}</span>
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  message.role === "assistant"
                    ? "rounded-tl-sm border border-slate-700/50 bg-slate-800 text-slate-100"
                    : "rounded-tr-sm bg-indigo-600 text-white"
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}

          {liveTranscript && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-900/30 px-3 py-2 text-xs italic text-indigo-200">
              {liveTranscript}
            </div>
          )}

          {callState === "ended" && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              Simulation ended after {formatDuration(callDuration)}. No
              production records were changed.
            </div>
          )}

          {callState === "error" && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"
            >
              {errorMessage}
            </div>
          )}
          <div ref={messagesEndRef} />
          <div ref={audioContainerRef} className="hidden" aria-hidden="true" />
        </div>

        {(callState === "connecting" || callState === "active") && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950 px-5 py-3 text-xs text-slate-300"
          >
            <span className="font-mono text-slate-100">
              {formatDuration(callDuration)}
            </span>
            <span>
              {callState === "connecting"
                ? "Connecting to the streaming worker…"
                : speakingParty === "assistant"
                  ? "Sarah is speaking — interruption is enabled"
                  : speakingParty === "user"
                    ? "Listening to the browser participant…"
                    : "Connected and listening…"}
            </span>
            <span className="text-slate-500">Maximum 05:00</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950 p-4">
          <span className="text-xs text-slate-400">
            Flux STT · DeepSeek · Inworld/Aura TTS
          </span>
          <div className="flex items-center gap-3">
            {callState === "idle" && (
              <button
                type="button"
                onClick={() => void handleStartCall()}
                disabled={!canStart}
                title={jobIsLoading ? "Loading job details" : undefined}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {jobIsLoading ? "Loading job…" : "Start simulation"}
              </button>
            )}
            {(callState === "connecting" || callState === "active") && (
              <button
                type="button"
                onClick={() => void finishSimulation()}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
              >
                End simulation
              </button>
            )}
            {(callState === "ended" || callState === "error") && (
              <button
                type="button"
                onClick={() => void handleClose()}
                className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
