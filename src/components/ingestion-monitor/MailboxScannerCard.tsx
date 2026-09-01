"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Mail,
  Search,
  Play,
  Pause,
  Square,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  FileX,
  Cpu,
  Inbox,
  Send,
  Sliders,
  Terminal,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const QUICK_MAILBOXES = [
  "azeem@career141.com",
  "cv@career141.com",
  "careers@career141.com",
  "info@career141.com",
];

export default function MailboxScannerCard() {
  const [mailboxEmail, setMailboxEmail] = useState("azeem@career141.com");
  const [folder, setFolder] = useState<"inbox" | "sentitems" | "all">("inbox");
  const [dryRun, setDryRun] = useState(false);
  const [maxMessages, setMaxMessages] = useState<number>(150);
  const [isStarting, setIsStarting] = useState(false);
  const [isReparsing, setIsReparsing] = useState(false);
  const [isResettingCheckpoint, setIsResettingCheckpoint] = useState(false);

  // Convex Hooks
  const startScanAction = useAction(api.communications.emailBackfill.startMailboxScan);
  const requestControl = useMutation(api.communications.emailBackfillMutations.requestJobControl);
  const unextractedCount = useQuery(api.candidates.candidates.getUnextractedCandidatesCount, {}) ?? 0;
  const reparseAllUnextracted = useMutation(api.candidates.candidates.reparseAllUnextractedCandidates);
  
  // Persistent Checkpoint for current mailbox + folder
  const checkpoint = useQuery(api.communications.emailBackfillMutations.getMailboxCheckpoint, {
    mailboxEmail: mailboxEmail.trim().toLowerCase(),
    folder,
  });
  const resetCheckpointMutation = useMutation(api.communications.emailBackfillMutations.resetMailboxCheckpoint);

  // Reactive query for the latest scan job for the selected mailbox
  const latestJob = useQuery(api.communications.emailBackfillMutations.getLatestScanJob, {
    mailboxEmail: mailboxEmail || undefined,
  });

  const isRunning = latestJob?.status === "running";
  const isPaused = latestJob?.status === "paused";

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

  const handleStartScan = async (forceRediscovery = false) => {
    if (!mailboxEmail || !mailboxEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    try {
      setIsStarting(true);
      const res = await startScanAction({
        mailboxEmail: mailboxEmail.trim().toLowerCase(),
        folder,
        maxMessages,
        dryRun,
        forceRediscovery,
      });

      if (res?.success) {
        if (res.resumed) {
          toast.success(`Resumed mailbox scan for ${mailboxEmail} from where it left off!`);
        } else {
          toast.success(`Started discovery scan for ${mailboxEmail}!`);
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
        mailboxEmail: mailboxEmail.trim().toLowerCase(),
        folder,
      });
      toast.info(`Reset checkpoint for ${mailboxEmail} (${folder}). Next scan will start from the beginning.`);
    } catch (err: any) {
      toast.error(`Failed to reset checkpoint: ${err?.message || err}`);
    } finally {
      setIsResettingCheckpoint(false);
    }
  };

  const handleControlAction = async (actionType: "pause" | "resume" | "stop") => {
    if (!latestJob?._id) return;
    try {
      await requestControl({
        jobId: latestJob._id,
        action: actionType,
      });
      toast.info(`Requested scan ${actionType}.`);
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
                Found unparsed candidate stubs (Unknown / No contact) with uploaded CVs in storage.
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

      {/* PERSISTENT CHECKPOINT RESUMPTION BANNER */}
      {checkpoint && checkpoint.totalDiscoveredAttachmentEmails > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                Persistent Checkpoint Active
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-800 dark:text-blue-200">
                  {checkpoint.totalExtractedCount} / {checkpoint.totalDiscoveredAttachmentEmails} Extracted
                </span>
              </p>
              <p className="text-[11px] text-blue-600/90 dark:text-blue-400/90 mt-0.5">
                {checkpoint.totalDiscoveredAttachmentEmails - checkpoint.totalExtractedCount > 0
                  ? `${checkpoint.totalDiscoveredAttachmentEmails - checkpoint.totalExtractedCount} attachment emails remaining in ${folder.toUpperCase()}. Scanning will automatically continue from #${checkpoint.totalExtractedCount + 1}.`
                  : `All ${checkpoint.totalDiscoveredAttachmentEmails} attachment emails extracted!`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {checkpoint.totalDiscoveredAttachmentEmails - checkpoint.totalExtractedCount > 0 && (
              <button
                type="button"
                onClick={() => handleStartScan(false)}
                disabled={isRunning || isStarting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-xs transition disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-white" /> Continue from #{checkpoint.totalExtractedCount + 1}
              </button>
            )}
            <button
              type="button"
              onClick={handleResetCheckpoint}
              disabled={isRunning || isResettingCheckpoint}
              className="px-2.5 py-1.5 rounded-lg bg-surface-container-high border border-border text-text-secondary hover:text-text-primary text-xs transition"
              title="Reset checkpoint to start over from beginning"
            >
              {isResettingCheckpoint ? "Resetting..." : "Reset"}
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
                Multi-Signal AI
              </span>
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Inspect historical mailbox folders via Microsoft Graph API, strictly target files with CV / Resume naming, classify content with weighted scoring + DeepSeek V4 Flash, and ingest confirmed candidate CVs into Agent 1 & Agent 6.
            </p>
          </div>
        </div>

        {/* Quick Mode Indicator */}
        <div className="flex items-center gap-2">
          {dryRun ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" /> Dry Run Mode (No DB Writes)
            </span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Live Ingestion Mode
            </span>
          )}
        </div>
      </div>

      {/* SCAN CONTROLS CONFIGURATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Email Address Input */}
        <div className="lg:col-span-5 space-y-2">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
            Target Mailbox Address
          </label>
          <div className="relative">
            <input
              type="email"
              value={mailboxEmail}
              onChange={(e) => setMailboxEmail(e.target.value)}
              placeholder="e.g. azeem@career141.com"
              disabled={isRunning}
              className="w-full py-2 px-3 pl-9 text-sm bg-surface-container-low dark:bg-surface-container border border-border rounded-lg text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
            <Mail className="w-4 h-4 text-text-disabled absolute left-3 top-2.5" />
          </div>

          {/* Quick Select Buttons */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK_MAILBOXES.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setMailboxEmail(em)}
                disabled={isRunning}
                className={`text-[11px] px-2 py-0.5 rounded transition border ${
                  mailboxEmail === em
                    ? "bg-primary text-white border-primary"
                    : "bg-surface-container border-border text-text-secondary hover:bg-surface-container-high"
                } disabled:opacity-50`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        {/* Folder Selector */}
        <div className="lg:col-span-3 space-y-2">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
            Folder Scope
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-container-low dark:bg-surface-container border border-border rounded-lg">
            <button
              onClick={() => setFolder("inbox")}
              disabled={isRunning}
              className={`flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-md transition ${
                folder === "inbox"
                  ? "bg-surface-container-lowest dark:bg-surface-container-high text-text-primary shadow-xs border border-border"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Inbox className="w-3.5 h-3.5" /> Inbox
            </button>
            <button
              onClick={() => setFolder("sentitems")}
              disabled={isRunning}
              className={`flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-md transition ${
                folder === "sentitems"
                  ? "bg-surface-container-lowest dark:bg-surface-container-high text-text-primary shadow-xs border border-border"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Send className="w-3.5 h-3.5" /> Sent
            </button>
            <button
              onClick={() => setFolder("all")}
              disabled={isRunning}
              className={`flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-md transition ${
                folder === "all"
                  ? "bg-surface-container-lowest dark:bg-surface-container-high text-text-primary shadow-xs border border-border"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Mode & Max Messages */}
        <div className="lg:col-span-2 space-y-2">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
            Batch Depth
          </label>
          <select
            value={maxMessages}
            onChange={(e) => setMaxMessages(Number(e.target.value))}
            disabled={isRunning}
            className="w-full py-2 px-3 text-sm bg-surface-container-low dark:bg-surface-container border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          >
            <option value={150}>150 Emails (Test Batch)</option>
            <option value={500}>500 Emails (Medium Batch)</option>
            <option value={1000}>1,000 Emails (Daily Run)</option>
            <option value={-1}>All Remaining Emails</option>
            <option value={50}>50 Emails (Sample)</option>
          </select>
          {/* Quick preset chips */}
          <div className="flex flex-wrap gap-1 pt-0.5">
            <button
              type="button"
              onClick={() => setMaxMessages(150)}
              disabled={isRunning}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded transition border ${
                maxMessages === 150
                  ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30"
                  : "bg-surface-container border-border text-text-secondary hover:bg-surface-container-high"
              } disabled:opacity-50`}
            >
              150
            </button>
            <button
              type="button"
              onClick={() => setMaxMessages(500)}
              disabled={isRunning}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded transition border ${
                maxMessages === 500
                  ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30"
                  : "bg-surface-container border-border text-text-secondary hover:bg-surface-container-high"
              } disabled:opacity-50`}
            >
              500
            </button>
            <button
              type="button"
              onClick={() => setMaxMessages(1000)}
              disabled={isRunning}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded transition border ${
                maxMessages === 1000
                  ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30"
                  : "bg-surface-container border-border text-text-secondary hover:bg-surface-container-high"
              } disabled:opacity-50`}
            >
              1,000
            </button>
            <button
              type="button"
              onClick={() => setMaxMessages(-1)}
              disabled={isRunning}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded transition border ${
                maxMessages === -1
                  ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30"
                  : "bg-surface-container border-border text-text-secondary hover:bg-surface-container-high"
              } disabled:opacity-50`}
            >
              All
            </button>
          </div>
        </div>

        {/* Action Button */}
        <div className="lg:col-span-2 flex flex-col justify-end space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dryRunCheck"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={isRunning}
              className="rounded border-border text-primary focus:ring-primary/20"
            />
            <label htmlFor="dryRunCheck" className="text-xs text-text-secondary select-none cursor-pointer">
              Dry Run only
            </label>
          </div>
          <button
            onClick={() => handleStartScan(false)}
            disabled={isRunning || isStarting}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-semibold text-xs shadow-sm transition disabled:opacity-50"
          >
            {isStarting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Starting...
              </>
            ) : isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> {latestJob?.phase === "discovery" ? "Discovering..." : "Extracting..."}
              </>
            ) : checkpoint && checkpoint.totalExtractedCount > 0 && checkpoint.totalExtractedCount < checkpoint.totalDiscoveredAttachmentEmails ? (
              <>
                <Play className="w-4 h-4 fill-white" /> Continue (#{checkpoint.totalExtractedCount + 1})
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" /> Start Mailbox Scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* LIVE PROGRESS & STATUS DASHBOARD */}
      {latestJob && (
        <div className="bg-surface-container-low dark:bg-surface-container border border-border rounded-xl p-5 space-y-5">
          {/* Status Header & Control Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  latestJob.status === "running"
                    ? latestJob.phase === "discovery"
                      ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                    : latestJob.status === "done"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : latestJob.status === "paused"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                }`}
              >
                {latestJob.status === "running" && <RefreshCw className="w-3 h-3 animate-spin" />}
                {latestJob.status === "done" && <CheckCircle2 className="w-3 h-3" />}
                {latestJob.status === "paused" && <Pause className="w-3 h-3" />}
                {latestJob.status === "stopped" && <Square className="w-3 h-3" />}
                {latestJob.phase === "discovery" && latestJob.status === "running"
                  ? "PHASE 1: DISCOVERING"
                  : `STATUS: ${latestJob.status.toUpperCase()}`}
              </span>

              {latestJob.discoveredAttachmentEmails !== undefined && latestJob.discoveredAttachmentEmails > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-surface-container-high border border-border text-text-primary">
                  <Mail className="w-3 h-3 text-orange-500" /> Goal: {latestJob.targetAttachmentEmails || latestJob.discoveredAttachmentEmails} / {latestJob.discoveredAttachmentEmails} Attachment Emails
                </span>
              )}

              <span className="text-xs text-text-secondary font-medium truncate max-w-md">
                {latestJob.currentStage || "Processing..."}
              </span>
            </div>

            {/* In-Flight & Control Actions */}
            {latestJob.status === "running" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleControlAction("pause")}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20 flex items-center gap-1 transition"
                >
                  <Pause className="w-3 h-3" /> Pause
                </button>
                <button
                  onClick={() => handleControlAction("stop")}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20 flex items-center gap-1 transition"
                >
                  <Square className="w-3 h-3" /> Stop
                </button>
              </div>
            )}
            {latestJob.status === "paused" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleControlAction("resume")}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center gap-1 transition"
                >
                  <Play className="w-3 h-3 fill-emerald-600" /> Resume
                </button>
                <button
                  onClick={() => handleControlAction("stop")}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20 flex items-center gap-1 transition"
                >
                  <Square className="w-3 h-3" /> Stop
                </button>
              </div>
            )}
            {(latestJob.status === "stopped" || latestJob.status === "error") && (
              <div className="flex items-center gap-2">
                {latestJob.nextCursorUrl && (latestJob.processedAttachmentEmails || latestJob.scannedMessages || 0) < (latestJob.targetAttachmentEmails || latestJob.totalMessages || maxMessages) && (
                  <button
                    onClick={() => handleControlAction("resume")}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/20 flex items-center gap-1 transition"
                  >
                    <Play className="w-3 h-3 fill-blue-600" /> Resume from #{latestJob.processedAttachmentEmails || latestJob.scannedMessages || 0}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Progress Bar & Goal Display */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-text-secondary">
              {latestJob.phase === "discovery" ? (
                <span>
                  Discovered: {latestJob.discoveredAttachmentEmails || 0} attachment emails ({latestJob.discoveredTotalEmails || 0} total messages evaluated)
                </span>
              ) : (
                <span>
                  Extracted: {latestJob.processedAttachmentEmails || latestJob.scannedMessages || 0} / {latestJob.targetAttachmentEmails || latestJob.totalMessages || maxMessages} attachment emails ({latestJob.totalAttachments || 0} files evaluated)
                </span>
              )}
              <span>
                {latestJob.phase === "discovery"
                  ? "Indexing folder..."
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
                <span className="text-[11px] font-bold uppercase tracking-wider">High Confidence CVs</span>
              </div>
              <p className="text-xl font-extrabold text-text-primary mt-1">
                {latestJob.classifiedHighConfidence}
              </p>
              <p className="text-[10px] text-text-secondary mt-0.5">
                {latestJob.dryRun ? "Matched (Dry Run)" : "Ingested to Agent 1"}
              </p>
            </div>

            <div className="p-3 bg-surface-container-lowest dark:bg-surface-container-high rounded-lg border border-border">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Flagged for Review</span>
              </div>
              <p className="text-xl font-extrabold text-text-primary mt-1">
                {latestJob.flaggedNeedsReview}
              </p>
              <p className="text-[10px] text-text-secondary mt-0.5">Ambiguous Score Band</p>
            </div>

            <div className="p-3 bg-surface-container-lowest dark:bg-surface-container-high rounded-lg border border-border">
              <div className="flex items-center gap-2 text-text-secondary">
                <FileX className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Skipped Attachments</span>
              </div>
              <p className="text-xl font-extrabold text-text-primary mt-1">
                {latestJob.skippedLowConfidence}
              </p>
              <p className="text-[10px] text-text-secondary mt-0.5">Non-CV / Invoices / Logs</p>
            </div>

            <div className="p-3 bg-surface-container-lowest dark:bg-surface-container-high rounded-lg border border-border">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Cpu className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">DeepSeek Calls</span>
              </div>
              <p className="text-xl font-extrabold text-text-primary mt-1">
                {latestJob.llmCallsCount}
              </p>
              <p className="text-[10px] text-text-secondary mt-0.5">Ambiguous Confirmations</p>
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
            <div className="h-44 overflow-y-auto bg-surface-container-lowest dark:bg-black/40 border border-border rounded-lg p-3 font-mono text-[11px] space-y-1.5">
              {latestJob.recentLogs && latestJob.recentLogs.length > 0 ? (
                latestJob.recentLogs.map((log: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-text-disabled shrink-0">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
