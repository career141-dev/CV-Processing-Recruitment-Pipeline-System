"use client";

import React, { useState, useEffect, useRef } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { Room, RoomEvent, Track, RemoteTrack, RemoteParticipant } from "livekit-client";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface VoiceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: Id<"candidates">;
  jobId: Id<"jobs">;
  applicationId?: Id<"applications">;
  candidateName: string;
  jobTitle: string;
  jobDescription?: string;
}

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
  timestamp: string;
}

function getCleanSpokenFirstName(fullName?: string | null): string {
  if (!fullName || typeof fullName !== "string") return "there";
  const tokens = fullName
    .replace(/[,\-_.]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const substantiveNames = tokens.filter(
    (t) => t.length > 2 && !/^(Mr|Mrs|Ms|Dr|Prof|Miss)$/i.test(t)
  );
  const chosen = substantiveNames[0] || tokens[tokens.length - 1] || "there";
  return chosen.charAt(0).toUpperCase() + chosen.slice(1).toLowerCase();
}

// Fish Audio voice presets with fixed reference_ids to maintain a consistent voice throughout the call
const VOICE_PRESETS = [
  { id: "fb52b0c3c8a44e41b234da575d009d4c", name: "Sarah (Professional Female Recruiter)" },
];

export function VoiceTestModal({
  isOpen,
  onClose,
  candidateId,
  jobId,
  applicationId,
  candidateName,
  jobTitle,
  jobDescription,
}: VoiceTestModalProps) {
  const [callState, setCallState] = useState<"idle" | "connecting" | "speaking" | "listening" | "processing" | "ended">("idle");
  const [engineMode, setEngineMode] = useState<"livekit" | "browser_vad">("livekit");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [micVolume, setMicVolume] = useState(0);
  const [isSpeakingDetected, setIsSpeakingDetected] = useState(false);
  const [customScript, setCustomScript] = useState("");
  const [selectedVoiceId, setSelectedVoiceId] = useState(VOICE_PRESETS[0].id);

  const cleanFirstName = getCleanSpokenFirstName(candidateName);

  // Load Job details and custom questions defined by TA
  const job = useQuery(api.jobs.jobs.getJob, jobId ? { jobId } : "skip");
  const jobCustomQuestions: string[] = job?.agent5CustomQuestions || (job as any)?.customFollowUpQuestions || [];

  // Persistent Extracted Data across the conversation
  const [extractedData, setExtractedData] = useState<{
    currentSalary?: number;
    expectedSalary?: number;
    noticePeriodDays?: number;
    noticePeriodText?: string;
    customQuestionAnswers?: Array<{ question: string; answer: string }>;
  }>({});

  const roomRef = useRef<Room | null>(null);

  const recordSession = useMutation(api.aiCalls.voiceCalls.recordVoiceCallSession);
  const generateVoiceReply = useAction(api.aiCalls.voiceEngine.generateVoicePrescreeningReply);

  // Audio & VAD Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechDetectedRef = useRef(false);
  const isAiSpeakingRef = useRef(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Ref to hold current state to avoid stale closures in VAD callbacks
  const stateRef = useRef({
    extractedData,
    messages,
    candidateName: cleanFirstName,
    jobTitle,
    jobDescription: jobDescription || job?.jobDescription,
    jobCustomQuestions,
    customScript,
    selectedVoiceId,
    candidateId,
    jobId,
  });

  useEffect(() => {
    stateRef.current = {
      extractedData,
      messages,
      candidateName: cleanFirstName,
      jobTitle,
      jobDescription: jobDescription || job?.jobDescription,
      jobCustomQuestions,
      customScript,
      selectedVoiceId,
      candidateId,
      jobId,
    };
  }, [extractedData, messages, cleanFirstName, jobTitle, jobDescription, job, jobCustomQuestions, customScript, selectedVoiceId, candidateId, jobId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveTranscript, callState]);

  useEffect(() => {
    if (callState === "speaking" || callState === "listening" || callState === "processing") {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  const cleanupAudio = () => {
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch {}
      roomRef.current = null;
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
  };

  useEffect(() => {
    return () => cleanupAudio();
  }, []);

  if (!isOpen) return null;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Play synthesized Cartesia voice
  const playAiVoice = async (text: string, isFinalWrapup = false) => {
    try {
      isAiSpeakingRef.current = true;
      setCallState("speaking");

      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voiceId: stateRef.current.selectedVoiceId,
        }),
      });

      if (!res.ok) throw new Error("Fish Audio TTS request failed");

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        isAiSpeakingRef.current = false;
        if (isFinalWrapup) {
          handleEndCall();
        } else {
          startListeningWithVAD();
        }
      };

      audio.play();
    } catch (err) {
      console.error("[Voice Modal] Speak error:", err);
      isAiSpeakingRef.current = false;
      if (isFinalWrapup) {
        handleEndCall();
      } else {
        startListeningWithVAD();
      }
    }
  };

  // Start continuous recording with Voice Activity Detection (VAD)
  const startListeningWithVAD = async () => {
    try {
      if (isAiSpeakingRef.current) return;
      setCallState("listening");
      setIsSpeakingDetected(false);
      speechDetectedRef.current = false;
      audioChunksRef.current = [];

      if (!micStreamRef.current) {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
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

      // Find supported mimeType for browser MediaRecorder
      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        }
      }

      // Stop previous recorder instance if active
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
          if (!isAiSpeakingRef.current) startListeningWithVAD();
          return;
        }
        await processCandidateAudio(audioBlob);
      };

      if (mediaRecorder.state === "inactive") {
        mediaRecorder.start(200);
      }

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const SILENCE_THRESHOLD_MS = 600; // Snappy 600ms natural human pause
      const VOLUME_TRIGGER_LEVEL = 12;

      const checkVolume = () => {
        if (isAiSpeakingRef.current) {
          setMicVolume(0);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const averageVolume = Math.round(sum / dataArray.length);
        setMicVolume(averageVolume);

        if (averageVolume > VOLUME_TRIGGER_LEVEL) {
          if (!speechDetectedRef.current) {
            speechDetectedRef.current = true;
            setIsSpeakingDetected(true);
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
      console.error("[Voice Modal] VAD Start error:", err);
    }
  };

  // Process completed candidate audio chunk
  const processCandidateAudio = async (audioBlob: Blob) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    setCallState("processing");
    setLiveTranscript("Analyzing candidate voice...");

    try {
      // 1. Deepgram Nova-2 Transcription
      const transcribeRes = await fetch("/api/voice/transcribe", {
        method: "POST",
        headers: { "Content-Type": "audio/webm" },
        body: audioBlob,
      });

      const transcribeData = await transcribeRes.json();
      const userText = transcribeData.transcript?.trim();

      if (!userText || userText.length < 2) {
        setLiveTranscript("");
        startListeningWithVAD();
        return;
      }

      setLiveTranscript("");
      const userMsg: ChatMessage = {
        role: "user",
        text: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      const current = stateRef.current;
      const updatedMessages = [...current.messages, userMsg];
      setMessages(updatedMessages);

      // 2. Query Senior Recruiter Brain via Convex Action (with resilient retry boundary)
      let chatData: any = null;
      let actionRetries = 3;
      while (actionRetries > 0 && !chatData) {
        try {
          chatData = await generateVoiceReply({
            candidateName: cleanFirstName,
            jobTitle: current.jobTitle,
            jobDescription: current.jobDescription,
            customQuestions: current.jobCustomQuestions,
            alreadyCollected: current.extractedData,
            customScript: current.customScript.trim() || undefined,
            messages: updatedMessages.map((m) => ({ role: m.role, content: m.text })),
          });
        } catch (err: any) {
          actionRetries--;
          console.warn(`[Voice Modal] Socket flicker on action. Retrying (${3 - actionRetries}/3)...`, err?.message);
          if (actionRetries === 0) throw err;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      // Merge newly extracted fields and custom question answers
      const clientNotice = (!chatData.extracted?.noticePeriodDays && !chatData.extracted?.noticePeriodText)
        ? (function(text: string) {
            const lower = text.toLowerCase().trim();
            if (/\b(immediate|immediately|right away|available now)\b/.test(lower)) {
              return { noticePeriodDays: 0, noticePeriodText: "Immediate" };
            }
            const monthMatch = lower.match(/\b(one|two|three|four|five|six|\d+)\s*months?\b/);
            if (monthMatch) {
              const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
              const num = wordToNum[monthMatch[1]] || parseInt(monthMatch[1], 10) || 1;
              return { noticePeriodDays: num * 30, noticePeriodText: `${num} ${num === 1 ? "Month" : "Months"}` };
            }
            const weekMatch = lower.match(/\b(one|two|three|four|\d+)\s*weeks?\b/);
            if (weekMatch) {
              const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };
              const num = wordToNum[weekMatch[1]] || parseInt(weekMatch[1], 10) || 2;
              return { noticePeriodDays: num * 7, noticePeriodText: `${num} ${num === 1 ? "Week" : "Weeks"}` };
            }
            const dayMatch = lower.match(/\b(\d+)\s*days?\b/);
            if (dayMatch) {
              const num = parseInt(dayMatch[1], 10) || 30;
              return { noticePeriodDays: num, noticePeriodText: `${num} Days` };
            }
            return null;
          })(userText)
        : null;

      const effectiveNoticeDays = chatData.extracted?.noticePeriodDays !== undefined && chatData.extracted?.noticePeriodDays !== null
        ? chatData.extracted.noticePeriodDays
        : clientNotice?.noticePeriodDays;

      const effectiveNoticeText = chatData.extracted?.noticePeriodText || clientNotice?.noticePeriodText;

      setExtractedData((prev) => {
        const existingCustom = prev.customQuestionAnswers || [];
        const newCustom = chatData.extracted?.customQuestionAnswers || [];
        const mergedCustom = [...existingCustom];
        for (const nc of newCustom) {
          const idx = mergedCustom.findIndex((m) => m.question === nc.question);
          if (idx >= 0) mergedCustom[idx] = nc;
          else mergedCustom.push(nc);
        }

        return {
          ...prev,
          ...(chatData.extracted?.currentSalary ? { currentSalary: chatData.extracted.currentSalary } : {}),
          ...(chatData.extracted?.expectedSalary ? { expectedSalary: chatData.extracted.expectedSalary } : {}),
          ...(effectiveNoticeDays !== undefined ? { noticePeriodDays: effectiveNoticeDays } : {}),
          ...(effectiveNoticeText ? { noticePeriodText: effectiveNoticeText } : {}),
          customQuestionAnswers: mergedCustom,
        };
      });

      const aiReply = chatData.spokenResponse || "Thank you. Let's proceed.";
      const aiMsg: ChatMessage = {
        role: "assistant",
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, aiMsg]);

      // 3. Synthesize & Speak reply via Deepgram Aura
      const isWrapup = chatData.isPrescreeningComplete === true;
      await playAiVoice(aiReply, isWrapup);
    } catch (err) {
      console.error("[Voice Modal] Turn processing error:", err);
      startListeningWithVAD();
    }
  };

  const handleDoneSpeakingManual = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleStartCall = async () => {
    setCallState("connecting");
    setMessages([]);
    setCallDuration(0);
    setExtractedData({});

    try {
      // 1. Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // 2. Attempt real-time LiveKit WebRTC connection
      try {
        const tokenRes = await fetch("/api/voice/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: `screening-${candidateId}-${Date.now()}`,
            participantName: `recruiter-${cleanFirstName}`,
            metadata: {
              candidateName: cleanFirstName,
              jobTitle,
              jobDescription: jobDescription || job?.jobDescription,
              customScript: customScript.trim() || undefined,
              customQuestions: jobCustomQuestions,
            },
          }),
        });

        if (tokenRes.ok) {
          const { token, url } = await tokenRes.json();
          const room = new Room({
            adaptiveStream: true,
            dynacast: true,
          });

          roomRef.current = room;

          room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
            if (track.kind === Track.Kind.Audio) {
              const el = track.attach();
              document.body.appendChild(el);
              setCallState("speaking");
            }
          });

          room.on(RoomEvent.Disconnected, () => {
            handleEndCall();
          });

          await room.connect(url, token);
          await room.localParticipant.setMicrophoneEnabled(true);
          setCallState("listening");
          setEngineMode("livekit");
          return;
        }
      } catch (lkErr: any) {
        console.warn("[Voice Modal] LiveKit room connect unavailable, switching to browser audio engine:", lkErr?.message);
      }

      // 3. Fallback to Browser VAD Engine
      setEngineMode("browser_vad");
      setCallState("speaking");

      const greeting = `Hi ${cleanFirstName}, this is Sarah from Career One-Four-One calling regarding your application for the ${jobTitle} position. Are you interested in this role?`;

      setMessages([
        {
          role: "assistant",
          text: greeting,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      await playAiVoice(greeting);
    } catch (err: any) {
      alert("Microphone permission required for voice prescreening test: " + err.message);
      setCallState("idle");
    }
  };

  const handleEndCall = async () => {
    cleanupAudio();
    setCallState("ended");

    const current = stateRef.current;
    const fullTranscript = current.messages
      .map((m) => `${m.role === "assistant" ? "Sarah (AI)" : cleanFirstName}: ${m.text}`)
      .join("\n");

    try {
      await recordSession({
        candidateId,
        jobId,
        applicationId,
        transcript: fullTranscript,
        durationSeconds: callDuration,
        currentSalary: current.extractedData.currentSalary,
        expectedSalary: current.extractedData.expectedSalary,
        noticePeriodDays: current.extractedData.noticePeriodDays,
        noticePeriodText: current.extractedData.noticePeriodText,
        customQuestionAnswers: (current.extractedData.customQuestionAnswers || []).map((qa: any) => ({
          question: String(qa?.question || ""),
          answer: qa?.answer != null ? String(qa.answer) : "",
        })),
      });
    } catch (err) {
      console.error("[Voice Modal] DB record error:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <span className="material-symbols-outlined">call</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-base">Senior AI Recruiter Prescreening</h3>
                <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${engineMode === 'livekit' ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                  {engineMode === "livekit" ? "⚡ LiveKit WebRTC" : "Career141 Voice"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Candidate: <span className="text-indigo-300 font-semibold">{cleanFirstName}</span> • Job:{" "}
                <span className="text-slate-300 font-medium">{jobTitle}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedVoiceId}
              onChange={(e) => setSelectedVoiceId(e.target.value)}
              disabled={callState !== "idle"}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 disabled:opacity-50 cursor-pointer"
            >
              {VOICE_PRESETS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                cleanupAudio();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Live Extracted Entities Bar */}
        <div className="bg-slate-950/80 px-5 py-2.5 border-b border-slate-800/80 flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-indigo-400">memory</span>
              Live Extracted Data:
            </span>
            <div className="flex items-center gap-2">
              <div className={`px-2 py-0.5 rounded-md border flex items-center gap-1 transition-colors ${extractedData.currentSalary ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300' : 'bg-slate-800/50 border-slate-700/50 text-slate-500'}`}>
                <span>Current:</span>
                <span className="font-semibold">{extractedData.currentSalary ? `${extractedData.currentSalary.toLocaleString()} LKR` : 'Pending'}</span>
              </div>
              <div className={`px-2 py-0.5 rounded-md border flex items-center gap-1 transition-colors ${extractedData.expectedSalary ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-slate-800/50 border-slate-700/50 text-slate-500'}`}>
                <span>Expected:</span>
                <span className="font-semibold">{extractedData.expectedSalary ? `${extractedData.expectedSalary.toLocaleString()} LKR` : 'Pending'}</span>
              </div>
              <div className={`px-2 py-0.5 rounded-md border flex items-center gap-1 transition-colors ${extractedData.noticePeriodDays !== undefined ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-slate-800/50 border-slate-700/50 text-slate-500'}`}>
                <span>Notice:</span>
                <span className="font-semibold">{extractedData.noticePeriodText || (extractedData.noticePeriodDays !== undefined ? `${extractedData.noticePeriodDays} Days` : 'Pending')}</span>
              </div>
            </div>
          </div>

          {/* Job Specific Custom Questions Bar */}
          {jobCustomQuestions.length > 0 && (
            <div className="pt-1.5 border-t border-slate-800/60 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-indigo-400 font-semibold">Job Requirements:</span>
              {jobCustomQuestions.map((q, idx) => {
                const ans = extractedData.customQuestionAnswers?.find((a) => a.question === q);
                return (
                  <div
                    key={idx}
                    className={`px-2 py-0.5 rounded-md text-[11px] border flex items-center gap-1 ${ans ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-slate-800/40 border-slate-700/40 text-slate-400'}`}
                  >
                    <span>Q{idx + 1}:</span>
                    <span className="truncate max-w-[140px] font-medium">{ans ? ans.answer : q}</span>
                    {ans && <span className="text-emerald-400">✓</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Conversation Transcript Display */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 min-h-[260px] max-h-[360px] bg-slate-900/50">
          {messages.length === 0 && callState === "idle" && (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-300 text-2xl mb-1">
                🎙️
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Consultative Senior Recruiter Engine</h4>
              <p className="text-xs max-w-md text-slate-400 leading-relaxed">
                Sarah answers candidate questions about the job, handles indirect answers diplomatically, and asks all TA screening requirements.
              </p>

              {/* Custom Script Editor Box */}
              <div className="w-full max-w-md mt-2 text-left bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                    <span>⚙️ Additional Recruiter Notes & Questions (Optional)</span>
                  </label>
                </div>
                <textarea
                  value={customScript}
                  onChange={(e) => setCustomScript(e.target.value)}
                  placeholder="e.g. Ask if they have 3+ years of React experience and if they can start next week..."
                  className="w-full h-16 bg-slate-900 border border-slate-700/70 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>
          )}

          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.role === "assistant" ? "items-start" : "items-end"}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                <span>{m.role === "assistant" ? "Sarah (Senior Recruiter)" : cleanFirstName}</span>
                <span>•</span>
                <span>{m.timestamp}</span>
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "assistant"
                    ? "bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700/50 shadow-sm"
                    : "bg-indigo-600 text-white rounded-tr-sm shadow-md"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {liveTranscript && (
            <div className="flex flex-col items-end">
              <div className="max-w-[80%] rounded-2xl px-4 py-2 text-xs italic bg-indigo-900/40 text-indigo-200 border border-indigo-500/20 animate-pulse">
                {liveTranscript}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Visual Waveform & Dynamic VAD Activity Bar */}
        {callState !== "idle" && callState !== "ended" && (
          <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-slate-200">{formatDuration(callDuration)}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-300 flex items-center gap-2">
                {callState === "speaking" && (
                  <span className="text-indigo-400 font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm animate-bounce">volume_up</span>
                    Sarah Speaking (Career 1-4-1)...
                  </span>
                )}
                {callState === "listening" && (
                  <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isSpeakingDetected ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
                    {isSpeakingDetected ? "Hearing candidate voice (speak freely)..." : "Listening for response..."}
                  </span>
                )}
                {callState === "processing" && (
                  <span className="text-amber-400 font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                    Consultative reasoning & extracting answers...
                  </span>
                )}
              </span>
            </div>

            {callState === "listening" && isSpeakingDetected && (
              <button
                onClick={handleDoneSpeakingManual}
                className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-lg text-[11px] font-medium transition cursor-pointer"
              >
                Done Speaking ↵
              </button>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Fish Audio S2.1 Pro + Deepgram Fallback</span>
          </div>

          <div className="flex items-center gap-3">
            {callState === "idle" && (
              <button
                onClick={handleStartCall}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">call</span>
                Start AI Call
              </button>
            )}

            {(callState === "speaking" || callState === "listening" || callState === "processing") && (
              <button
                onClick={handleEndCall}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-rose-900/30 transition active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">call_end</span>
                End & Save Call
              </button>
            )}

            {callState === "ended" && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-emerald-400 font-medium">✓ Call Recorded & Candidate Updated!</span>
                <button
                  onClick={() => {
                    cleanupAudio();
                    onClose();
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
