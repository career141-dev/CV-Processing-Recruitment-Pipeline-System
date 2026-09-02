"use client";

import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Mail,
  Play,
  Pause,
  Square,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  FileX,
  CopyX,
  Inbox,
  Send,
  Sliders,
  Terminal,
  ShieldCheck,
  Sparkles,
  Layers,
  Server,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

const QUICK_MAILBOXES = [
  "cv@career141.com",
  "careers@career141.com",
  "info@career141.com",
];

export default function MailboxScannerCard() {
  const [mailboxEmail, setMailboxEmail] = useState("cv@career141.com");
  const [runMode, setRunMode] = useState<"manual" | "background">("manual");
  const [folder, setFolder] = useState<"inbox" | "sentitems" | "all">("all");
  const [dryRun, setDryRun] = useState(false);
  const [maxMessages, setMaxMessages] = useState<number>(150); // 150 (Test) or -1 (All)
  const [isStarting, setIsStarting] = useState(false);
  const [isReparsing, setIsReparsing] = useState(false);
  const [isResettingCheckpoint, setIsResettingCheckpoint] = useState(false);

  // Auto-scroll refs for live activity log terminal
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Convex Hooks
  const startScanMutation = useMutation(api.communications.emailBackfillMutations.startMailboxScan);
  const requestControl = useMutation(api.communications.emailBackfillMutations.requestJobControl);
  const unextractedCount = useQuery(api.communications.emailBackfillMutations.getUnextractedCandidatesCount, {}) ?? 0;
  const reparseAllUnextracted = useMutation(api.communications.emailBackfillMutations.reparseAllUnextractedCandidates);

  // Persistent Checkpoint for designated mailbox + folder
  const checkpoint = useQuery(api.communications.emailBackfillMutations.getMailboxCheckpoint, {
    mailboxEmail,
    folder,
  });
  const resetCheckpointMutation = useMutation(api.communications.emailBackfillMutations.resetMailboxCheckpoint);

  // Reactive queries for latest scan job and active background job
  const latestJob = useQuery(api.communications.emailBackfillMutations.getLatestScanJob, {
    mailboxEmail,
  });
  const activeBackgroundScan = useQuery(api.communications.emailBackfillMutations.getActiveBackgroundScan, {
    mailboxEmail,
  });

  const isRunning = latestJob?.status === "running";
  const isPaused = latestJob?.status === "paused";
  const isBackgroundRunning = !!activeBackgroundScan;

  // Auto-scroll when new logs arrive in real-time
  useEffect(() => {
    if (latestJob?.recentLogs && latestJob.recentLogs.length > 0) {
      if (logsContainerRef.current) {
        logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
      }
    }
  }, [latestJob?.recentLogs?.length]);

  const handleReparseUnextracted = async () => {
    try {
      setIsReparsing(true);
      const res = await reparseAllUnextracted();
      toast.success(`Queued re-extraction for ${res.requeuedCount} unparsed candidate CV(s)!`);
    } catch (err: any) {
      toast.error(`Failed to trigger re-extraction: ${err?.message || err}`);
    } finally {
      setIsReparsing(false);
    }
  };

  const handleStartScan = async (forceRediscovery = false, overrideMode?: "manual" | "background") => {
    const selectedMode = overrideMode || runMode;
    try {
      setIsStarting(true);
      const res = await startScanMutation({
        mailboxEmail,
        folder,
        maxMessages,
        dryRun,
        mode: selectedMode,
        forceRediscovery,
      });

      if (res?.success) {
        if (selectedMode === "background") {
          toast.success("Background extraction started! Runs continuously on the server.");
        } else if (res.resumed) {
          toast.success(`Resumed extraction for ${mailboxEmail} from where it left off!`);
        } else {
          toast.success(`Started discovery & extraction for ${mailboxEmail}!`);
        }
      }
    } catch (error: any) {
      console.error("Start scan error:", error);
      toast.error(error.message || "Failed to start mailbox scan.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleResetCheckpoint = async () => {
    try {
      setIsResettingCheckpoint(true);
      await resetCheckpointMutation({
        mailboxEmail,
        folder,
      });
      toast.info(`Reset checkpoint for ${mailboxEmail} (${folder}). Next scan will start from the beginning.`);
    } catch (err: any) {
      toast.error(`Failed to reset checkpoint: ${err?.message || err}`);
    } finally {
      setIsResettingCheckpoint(false);
    }
  };

  const handleControlAction = async (actionType: "pause" | "resume" | "stop", targetJobId?: string) => {
    const targetId = targetJobId || latestJob?._id;
    if (!targetId) return;
    try {
      await requestControl({
        jobId: targetId as any,
        action: actionType,
      });
      if (actionType === "stop") {
        toast.success("Extraction stopped successfully.");
      } else {
        toast.info(`Extraction ${actionType}d.`);
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${actionType} scan.`);
    }
  };

  // Progress calculations
  const totalMsgs = latestJob?.totalMessages && latestJob.totalMessages > 0
    ? latestJob.totalMessages
    : maxMessages;
  const progressPercent = latestJob
    ? Math.min(100, Math.round(((latestJob.scannedMessages || 0) / Math.max(1, totalMsgs)) * 100))
    : 0;

  return (
    <div className="bg-surface-container-lowest dark:bg-surface-container-low border border-border rounded-xl shadow-sm p-6 space-y-6">

      {/* UNPARSED CANDIDATES HEALING BANNER */}
      {unextractedCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                {unextractedCount} Candidate Profile{unextractedCount > 1 ? "s" : ""} Pending AI Extraction
              </p>
              <p className="text-[11px] text-amber-600/90 dark:text-amber-400/90">
                Found unparsed candidate stubs with uploaded CVs in storage.
              </p>
            </div>
          </div>
          <button
            onClick={handleReparseUnextracted}
            disabled={isReparsing}
            className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs shadow-xs transition disabled:opacity-50 shrink-0"
          >
            {isReparsing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Scheduling...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" /> Re-Extract Unparsed Candidates
              </>
            )}
          </button>
        </div>
      )}

      {/* ACTIVE BACKGROUND RUN LIVE BANNER */}
      {activeBackgroundScan && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <Server className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                  Server-Side Background Extraction Active
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-800 dark:text-purple-200 animate-pulse">
                  LIVE IN SERVER
                </span>
              </div>
              <p className="text-[11px] text-purple-600/90 dark:text-purple-300/90 mt-0.5">
                {activeBackgroundScan.currentStage || "Processing emails in background..."} &mdash;{" "}
                {activeBackgroundScan.processedAttachmentEmails || activeBackgroundScan.scannedMessages || 0} /{" "}
                {activeBackgroundScan.targetAttachmentEmails || activeBackgroundScan.totalMessages || "all"} attachment emails extracted.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleControlAction("stop", activeBackgroundScan._id)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs shadow-sm transition shrink-0"
          >
            <Square className="w-3.5 h-3.5 fill-white" /> Stop Background Scan
          </button>
        </div>
      )}

      {/* PERSISTENT CHECKPOINT RESUMPTION BANNER */}
      {checkpoint && checkpoint.totalDiscoveredAttachmentEmails > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                Persistent Checkpoint Memory Active
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-800 dark:text-blue-200">
                  {checkpoint.totalExtractedCount} / {checkpoint.totalDiscoveredAttachmentEmails} Extracted
                </span>
              </p>
              <p className="text-[11px] text-blue-600/90 dark:text-blue-400/90 mt-0.5">
                {checkpoint.totalDiscoveredAttachmentEmails - checkpoint.totalExtractedCount > 0
                  ? `${checkpoint.totalDiscoveredAttachmentEmails - checkpoint.totalExtractedCount} attachment emails remaining in ${folder.toUpperCase()}. Scanner remembers progress and will resume from #${checkpoint.totalExtractedCount + 1}.`
                  : `All ${checkpoint.totalDiscoveredAttachmentEmails} attachment emails extracted!`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetCheckpoint}
              disabled={isRunning || isResettingCheckpoint}
              className="px-2.5 py-1.5 rounded-lg bg-surface-container-high border border-border text-text-secondary hover:text-text-primary text-xs transition font-semibold"
              title="Reset checkpoint to start over from beginning"
            >
              {isResettingCheckpoint ? "Resetting..." : "Reset Memory"}
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              Historical Mailbox CV Scanner & Classifier
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Azim Mailbox
              </span>
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Two-stage validation (.pdf/.doc/.docx + 23-keyword check) with pre-upload deduplication and persistent memory across sessions.
            </p>
          </div>
        </div>

        {/* Quick Status Badges */}
        <div className="flex items-center gap-2">
          {dryRun ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" /> Dry Run Mode
            </span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Live Ingestion Mode
            </span>
          )}
        </div>
      </div>

      {/* RUN MODE SELECTION TABS */}
      <div className="flex items-center gap-2 p-1.5 bg-surface-container-high rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setRunMode("manual")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition ${
            runMode === "manual"
              ? "bg-primary text-white shadow-xs"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Manual Run (Interactive Controls &amp; Resumption)
        </button>
        <button
          type="button"
          onClick={() => setRunMode("background")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition ${
            runMode === "background"
              ? "bg-purple-600 text-white shadow-xs"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <Server className="w-4 h-4" />
          Background Run (Continuous Server Processing)
        </button>
      </div>

      {/* SCAN CONTROLS CONFIGURATION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Target Mailbox */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-primary">Target Mailbox</label>
          <div className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-border bg-surface-container-high text-text-primary font-medium">
            <Mail className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="truncate">{mailboxEmail}</span>
            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 border border-orange-500/20">
              Primary
            </span>
          </div>
          <p className="text-[10px] text-text-secondary">Exclusively pulling Azim's inbox for manual/backfill extraction.</p>
        </div>

        {/* Folder Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-primary">Mailbox Folders</label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setFolder("all")}
              disabled={isRunning}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold border transition ${
                folder === "all"
                  ? "bg-primary text-white border-primary shadow-xs"
                  : "bg-surface-container-lowest dark:bg-surface-container-high text-text-secondary border-border hover:text-text-primary"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> All Folders
            </button>
            <button
              type="button"
              onClick={() => setFolder("inbox")}
              disabled={isRunning}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold border transition ${
                folder === "inbox"
                  ? "bg-primary text-white border-primary shadow-xs"
                  : "bg-surface-container-lowest dark:bg-surface-container-high text-text-secondary border-border hover:text-text-primary"
              }`}
            >
              <Inbox className="w-3.5 h-3.5" /> Inbox
            </button>
            <button
              type="button"
              onClick={() => setFolder("sentitems")}
              disabled={isRunning}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold border transition ${
                folder === "sentitems"
                  ? "bg-primary text-white border-primary shadow-xs"
                  : "bg-surface-container-lowest dark:bg-surface-container-high text-text-secondary border-border hover:text-text-primary"
              }`}
            >
              <Send className="w-3.5 h-3.5" /> Sent
            </button>
          </div>
        </div>

        {/* Batch Sizing & Dry Run Toggle */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-text-primary">Extraction Batch Limit</label>
            <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                disabled={isRunning}
                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span className="text-[11px] font-medium">Dry Run</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMaxMessages(150)}
              disabled={isRunning}
              className={`py-2 px-2 text-center rounded-lg text-xs font-semibold border transition ${
                maxMessages === 150
                  ? "bg-primary text-white border-primary shadow-xs"
                  : "bg-surface-container-lowest dark:bg-surface-container-high text-text-secondary border-border hover:text-text-primary"
              }`}
            >
              150 (Test Batch)
            </button>
            <button
              type="button"
              onClick={() => setMaxMessages(-1)}
              disabled={isRunning}
              className={`py-2 px-2 text-center rounded-lg text-xs font-semibold border transition ${
                maxMessages === -1
                  ? "bg-primary text-white border-primary shadow-xs"
                  : "bg-surface-container-lowest dark:bg-surface-container-high text-text-secondary border-border hover:text-text-primary"
              }`}
            >
              All (Extract All CVs)
            </button>
          </div>
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <p className="text-xs text-text-secondary">
          {runMode === "manual" ? (
            isRunning ? (
              <span className="flex items-center gap-2 text-primary font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Manual run in progress &mdash; live interactive stream.
              </span>
            ) : isPaused ? (
              <span className="flex items-center gap-2 text-amber-500 font-medium">
                <Pause className="w-3.5 h-3.5" />
                Manual run paused. Click Resume to continue.
              </span>
            ) : (
              <span>Manual mode allows interactive pause, stop, and cross-day checkpoint resumption.</span>
            )
          ) : (
            isBackgroundRunning ? (
              <span className="flex items-center gap-2 text-purple-600 font-medium">
                <Server className="w-3.5 h-3.5 animate-pulse" />
                Background scan active in server &mdash; safe to close laptop.
              </span>
            ) : (
              <span>Background mode executes autonomously on the server with real-time monitor visibility.</span>
            )
          )}
        </p>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* MANUAL MODE CONTROLS */}
          {runMode === "manual" && (
            <>
              {isRunning && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleControlAction("stop")}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs shadow-md transition"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" /> Stop Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => handleControlAction("pause")}
                    className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-semibold transition"
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </button>
                </div>
              )}
              {isPaused && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleControlAction("resume")}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" /> Resume Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => handleControlAction("stop")}
                    className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" /> Stop
                  </button>
                </div>
              )}
              {!isRunning && !isPaused && (
                <>
                  {checkpoint && checkpoint.totalDiscoveredAttachmentEmails > 0 && checkpoint.totalDiscoveredAttachmentEmails - checkpoint.totalExtractedCount > 0 ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartScan(false, "manual")}
                        disabled={isStarting}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-xs transition disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        {isStarting ? "Resuming..." : `Continue (#${checkpoint.totalExtractedCount + 1})`}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartScan(true, "manual")}
                        disabled={isStarting}
                        className="px-3 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary text-xs font-semibold transition"
                        title="Force re-discovery across entire mailbox"
                      >
                        Force Re-Discovery
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartScan(false, "manual")}
                      disabled={isStarting}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover active:bg-primary-active text-white font-semibold text-xs shadow-xs transition disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      {isStarting ? "Starting Discovery..." : "Start Manual Scan"}
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {/* BACKGROUND MODE CONTROLS */}
          {runMode === "background" && (
            <>
              {isBackgroundRunning ? (
                <button
                  type="button"
                  onClick={() => handleControlAction("stop", activeBackgroundScan._id)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs shadow-md transition"
                >
                  <Square className="w-3.5 h-3.5 fill-white" /> Stop Background Scan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStartScan(false, "background")}
                  disabled={isStarting}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  <Server className="w-3.5 h-3.5" />
                  {isStarting ? "Starting Background Task..." : "Start Background Scan"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ACTIVE / COMPLETED JOB PROGRESS PANEL */}
      {latestJob && (
        <div className="space-y-4 pt-4 border-t border-border mt-2">
          {/* Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  latestJob.status === "done"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : latestJob.status === "running"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                    : latestJob.status === "paused"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                }`}
              >
                {latestJob.phase === "discovery" && latestJob.status === "running"
                  ? "PHASE 1: DISCOVERING"
                  : `STATUS: ${latestJob.status.toUpperCase()}`}
              </span>

              {latestJob.mode && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container-high border border-border text-text-secondary uppercase">
                  {latestJob.mode} MODE
                </span>
              )}

              {latestJob.discoveredAttachmentEmails !== undefined && latestJob.discoveredAttachmentEmails > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-surface-container-high border border-border text-text-primary">
                  <Mail className="w-3 h-3 text-orange-500" /> Goal: {latestJob.targetAttachmentEmails || latestJob.discoveredAttachmentEmails} / {latestJob.discoveredAttachmentEmails} Attachment Emails
                </span>
              )}

              <span className="text-xs text-text-secondary font-medium truncate max-w-md">
                {latestJob.currentStage || "Processing..."}
              </span>
            </div>
          </div>

          {/* Progress Bar & Goal Display */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-text-secondary">
              {latestJob.phase === "discovery" ? (
                <span>
                  Discovered: {latestJob.discoveredAttachmentEmails || 0} attachment emails ({latestJob.discoveredTotalEmails || 0} scanned)
                </span>
              ) : (
                <span>
                  Extracted: {latestJob.processedAttachmentEmails || latestJob.scannedMessages || 0} / {latestJob.targetAttachmentEmails || latestJob.totalMessages || maxMessages} attachment emails ({latestJob.totalAttachments || 0} files evaluated)
                </span>
              )}
              <span>
                {latestJob.phase === "discovery"
                  ? "Discovering attachments..."
                  : `${Math.min(
                      100,
                      Math.round(
                        ((latestJob.processedAttachmentEmails || latestJob.scannedMessages || 0) /
                          Math.max(1, latestJob.targetAttachmentEmails || latestJob.totalMessages || maxMessages)) *
                          100
                      )
                    )}%`}
              </span>
            </div>
            <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
              {latestJob.phase === "discovery" ? (
                <div className="h-full w-full bg-purple-500/60 animate-pulse rounded-full" />
              ) : (
                <div
                  className={`h-full transition-all duration-300 ${
                    latestJob.status === "running" ? "bg-orange-500" : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((latestJob.processedAttachmentEmails || latestJob.scannedMessages || 0) /
                          Math.max(1, latestJob.targetAttachmentEmails || latestJob.totalMessages || maxMessages)) *
                          100
                      )
                    )}%`,
                  }}
                />
              )}
            </div>
          </div>

          {/* Live Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-surface-container-lowest dark:bg-surface-container-high rounded-lg border border-border">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <FileCheck className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Matched CVs</span>
              </div>
              <p className="text-xl font-extrabold text-text-primary mt-1">
                {latestJob.classifiedHighConfidence}
              </p>
              <p className="text-[10px] text-text-secondary mt-0.5">
                &ge;3 Keywords &rarr; Ingested
              </p>
            </div>

            <div className="p-3 bg-surface-container-lowest dark:bg-surface-container-high rounded-lg border border-border">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <CopyX className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Duplicates Skipped</span>
              </div>
              <p className="text-xl font-extrabold text-text-primary mt-1">
                {latestJob.deduplicatedCount || 0}
              </p>
              <p className="text-[10px] text-text-secondary mt-0.5">SHA-256 in DB</p>
            </div>

            <div className="p-3 bg-surface-container-lowest dark:bg-surface-container-high rounded-lg border border-border">
              <div className="flex items-center gap-2 text-text-secondary">
                <FileX className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Non-CV Skipped</span>
              </div>
              <p className="text-xl font-extrabold text-text-primary mt-1">
                {latestJob.skippedLowConfidence}
              </p>
              <p className="text-[10px] text-text-secondary mt-0.5">&lt;3 Keywords &rarr; notACv</p>
            </div>

            <div className="p-3 bg-surface-container-lowest dark:bg-surface-container-high rounded-lg border border-border">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Mail className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Evaluated</span>
              </div>
              <p className="text-xl font-extrabold text-text-primary mt-1">
                {latestJob.totalAttachments}
              </p>
              <p className="text-[10px] text-text-secondary mt-0.5">Attachments Inspected</p>
            </div>
          </div>

          {/* Real-time Streaming Logs Terminal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-text-secondary uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-text-disabled" /> Live Activity Log
              </span>
              <span className="text-[10px] lowercase text-text-disabled">auto-updating</span>
            </div>
            <div
              ref={logsContainerRef}
              className="h-44 overflow-y-auto bg-surface-container-lowest dark:bg-black/50 border border-border rounded-lg p-3 font-mono text-[11px] space-y-1.5 scroll-smooth"
            >
              {latestJob.recentLogs && latestJob.recentLogs.length > 0 ? (
                latestJob.recentLogs.map((log: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-text-disabled shrink-0 font-sans">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span
                      className={`break-all ${
                        log.type === "success"
                          ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                          : log.type === "warning"
                          ? "text-amber-600 dark:text-amber-400"
                          : log.type === "error"
                          ? "text-red-600 dark:text-red-400 font-semibold"
                          : "text-text-secondary"
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-text-disabled italic py-4 text-center">
                  Waiting for scan activity...
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
