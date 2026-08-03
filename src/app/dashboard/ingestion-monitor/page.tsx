"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  RefreshCw,
  Upload,
  FolderUp,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Info,
  Building2,
  Key,
  X,
  Play,
  Pause,
  Square,
  RotateCcw,
  Copy,
  SkipForward,
  XCircle,
  Link2,
  Mail,
  MessageCircle,
  Share2,
  Activity,
  AlertTriangle,
  FileText,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import RealTimeBatchLog from "@/components/ingestion-monitor/RealTimeBatchLog";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

const SOURCE_OPTIONS = ["Manual", "Headhunting", "Referral", "Agency", "Direct Email"];

type SourceTabKey = "workable" | "manual" | "folder" | "linkedin" | "whatsapp" | "meta" | "email" | "portal";

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-2 bg-border rounded-full overflow-hidden mt-1.5">
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatBox({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold tabular-nums text-text-primary">{value.toLocaleString()}</p>
        <p className="text-xs text-text-secondary">{label}</p>
      </div>
    </div>
  );
}

export default function IngestionMonitorPage() {
  const stats = useQuery(api.stats.stats.getIngestionStats);
  const toggles = useQuery(api.admin.settings.getSystemSettings);
  const updateToggles = useMutation(api.admin.settings.updateChannelToggles);

  const resumeFailedUploads = useAction(api.cvs.cvExtraction.resumeFailedUploads);
  const startBatchExtraction = useAction(api.cvs.cvExtraction.startBatchExtraction);
  const activeBatchId = useQuery(api.cvs.batches.getLatestActiveBatch);

  const { user } = useUser();
  const startBulkImport = useAction(api.integrations.workableActions.startBulkImport);
  const pauseImport = useAction(api.integrations.workableActions.pauseImport);
  const resumeImport = useAction(api.integrations.workableActions.resumeImport);
  const retryImport = useAction(api.integrations.workableActions.retryImport);
  const retrySkippedAction = useAction(api.integrations.workableActions.retrySkipped);
  const stopImport = useAction(api.integrations.workableActions.stopImport);
  const clearImportHistory = useMutation(api.integrations.workable.clearImportHistory);

  // Reactive query for Workable import status
  const importStatus = useQuery(
    api.integrations.workable.getLatestImportStatus,
    {}
  );

  const generateUploadUrl = useAction(api.storage.r2.generateUploadUrl);
  const saveUpload = useMutation(api.cvs.cvUploads.saveUpload);
  const createBatch = useMutation(api.cvs.batches.createBatch);
  const updateBatchProgress = useMutation(api.cvs.batches.updateBatchProgress);

  const [retrying, setRetrying] = useState(false);
  const [activeSourceTab, setActiveSourceTab] = useState<SourceTabKey>("workable");
  const [activeBottomTab, setActiveBottomTab] = useState<"errors" | "permanent" | "activity">("errors");

  // Workable State
  const [subdomain, setSubdomain] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [maxCandidates, setMaxCandidates] = useState<number>(500);
  const [isWorkableImporting, setIsWorkableImporting] = useState(false);

  // Manual Upload State
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [importBatchId, setImportBatchId] = useState<Id<"ingestionBatches"> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Upload Tags
  const [source, setSource] = useState("Manual");
  const [campaignLabel, setCampaignLabel] = useState("");
  const [assignToJob, setAssignToJob] = useState("");
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);

  // Workable Subdomain Effect
  useEffect(() => {
    if (importStatus?.subdomain) {
      setSubdomain(importStatus.subdomain);
    }
  }, [importStatus?.subdomain]);

  useEffect(() => {
    if (activeBatchId && !importBatchId) {
      setImportBatchId(activeBatchId);
    }
  }, [activeBatchId, importBatchId]);

  const handleWorkableImport = async () => {
    if (!subdomain || !apiKey || !user?.id) {
      toast.error("Please enter both subdomain and API key");
      return;
    }
    setIsWorkableImporting(true);
    try {
      await startBulkImport({ subdomain, apiKey, userId: user.id, maxCandidates });
      toast.success(`Workable import started (target limit: ${maxCandidates} candidates)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start import");
    } finally {
      setIsWorkableImporting(false);
    }
  };

  const handlePauseWorkable = async () => {
    if (!importStatus) return;
    try {
      await pauseImport({ importId: importStatus._id as any });
      toast.info("Workable import paused.");
    } catch (err) {
      toast.error("Failed to pause import");
    }
  };

  const handleResumeWorkable = async () => {
    if (!importStatus) return;
    setIsWorkableImporting(true);
    try {
      await resumeImport({
        importId: importStatus._id as any,
        subdomain: subdomain || undefined,
        apiKey: apiKey || undefined,
      });
      toast.success("Workable import resumed from exact position.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resume import");
    } finally {
      setIsWorkableImporting(false);
    }
  };

  const handleRetryWorkable = async () => {
    if (!importStatus) return;
    setIsWorkableImporting(true);
    try {
      await retryImport({
        importId: importStatus._id as any,
        subdomain: subdomain || undefined,
        apiKey: apiKey || undefined,
      });
      toast.info("Import retrying from where it left off.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry");
    } finally {
      setIsWorkableImporting(false);
    }
  };

  const handleRetrySkipped = async () => {
    if (!importStatus) return;
    setIsWorkableImporting(true);
    try {
      await retrySkippedAction({
        importId: importStatus._id as any,
        subdomain: subdomain || undefined,
        apiKey: apiKey || undefined,
      });
      toast.info("Retrying skipped candidates from the beginning.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry skipped");
    } finally {
      setIsWorkableImporting(false);
    }
  };

  const handleStopWorkable = async () => {
    if (!importStatus) return;
    try {
      await stopImport({ importId: importStatus._id as any });
      toast.warning("Workable import stopped. Only candidates processed so far remain in DB.");
    } catch (err) {
      toast.error("Failed to stop import");
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("⚠️ This will delete your import job history (not candidates). Sure?")) return;
    try {
      await clearImportHistory();
      toast.success("Import history cleared");
    } catch (err) {
      toast.error("Cleanup failed");
    }
  };

  const totalProcessed = importStatus
    ? importStatus.imported + importStatus.skipped + importStatus.deduplicated + importStatus.failed
    : 0;

  // Manual Upload Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
  };

  const handleManualUpload = async () => {
    if (files.length === 0 || !user?.id) return;

    const filesToUpload = [...files];
    const uploadSource = source || "Manual";
    const uploadCampaignLabel = campaignLabel;
    const uploadAssignToJob = assignToJob;

    setIsUploading(true);
    setFiles([]);
    setSource("Manual");
    setCampaignLabel("");
    setAssignToJob("");

    let successCount = 0;
    try {
      const batchId = await createBatch({
        sourceChannel: uploadSource,
        totalCount: filesToUpload.length,
        jobId: (uploadAssignToJob as Id<"jobs">) || undefined,
      });
      setImportBatchId(batchId);
      setActiveBottomTab("activity");

      for (const file of filesToUpload) {
        try {
          let { url: uploadUrl, key: s3Key } = await generateUploadUrl({
            fileName: file.name,
            contentType: file.type,
          });
          const resp = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });

          if (!resp.ok) throw new Error("Upload failed");

          await saveUpload({
            s3Key,
            storageProvider: "r2",
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            source: uploadSource,
            campaignLabel: uploadCampaignLabel || undefined,
            assignToJob: uploadAssignToJob || undefined,
            uploadedBy: user.id,
            batchId,
          });

          successCount++;
        } catch (err) {
          console.error("Upload failed for file:", file.name, err);
          await updateBatchProgress({
            batchId,
            status: "failed",
          });
        }
      }

      if (successCount > 0) {
        await startBatchExtraction({ batchId });
      }

      if (successCount === filesToUpload.length) {
        toast.success(`${successCount} CVs uploaded. Paced batch extraction started.`);
      } else {
        toast.warning(`Uploaded ${successCount} out of ${filesToUpload.length} CVs.`);
      }
    } catch (err) {
      toast.error("Upload process encountered an error.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!stats || !toggles) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { statsBySource, activeUploads, failedUploads, failedRetryUploads } = stats as any;

  const handleRetryFailed = async () => {
    if (failedUploads.length === 0) return;
    setRetrying(true);
    try {
      const batchId = await createBatch({
        sourceChannel: "Retry Failed",
        totalCount: failedUploads.length,
      });
      setImportBatchId(batchId);
      setActiveBottomTab("activity");
      await resumeFailedUploads({ batchId });
      toast.success("Retry queued! Background process started.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to queue retries.");
    } finally {
      setRetrying(false);
    }
  };

  const handleToggle = async (channel: "whatsappIngestion" | "emailIngestion", newValue: boolean) => {
    try {
      await updateToggles({ toggles: { ...toggles, [channel]: newValue } });
      toast.success(
        `${channel === "whatsappIngestion" ? "WhatsApp" : "Email"} ingestion ${newValue ? "resumed" : "paused"}.`
      );
    } catch (err) {
      toast.error(`Failed to update ${channel} toggle.`);
    }
  };

  const formatTime = (ts: number | null) => {
    if (!ts) return "N/A";
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs} hr ago`;
  };

  const groupFailures = (uploads: any[]) => {
    return uploads.reduce((acc: any, curr: any) => {
      const s = curr.source || "Manual";
      if (!acc[s]) acc[s] = [];
      acc[s].push(curr);
      return acc;
    }, {});
  };

  const failedBySource = groupFailures(failedUploads);
  const failedRetryBySource = groupFailures(failedRetryUploads || []);

  const getStats = (channel: string) => statsBySource[channel] || { todayCount: 0, lastReceived: null };
  const getErrorCount = (channel: string) => {
    let searchKey = channel;
    if (channel === "Career Portal / Web Form" || channel === "Link") searchKey = "Link";
    if (channel === "LinkedIn Inbox" || channel === "linkedin") searchKey = "linkedin";

    const count1 = (failedBySource[searchKey] || []).length;
    const count2 = (failedRetryBySource[searchKey] || []).length;
    return count1 + count2;
  };

  const workableStats = getStats("Workable");
  const manualStats = getStats("Manual");
  const linkStats = getStats("Link");
  const emailStats = getStats("Email");
  const whatsappStats = getStats("WhatsApp");
  const metaStats = getStats("Meta");
  const linkedinStats = getStats("linkedin");

  const totalToday =
    workableStats.todayCount +
    manualStats.todayCount +
    linkStats.todayCount +
    emailStats.todayCount +
    whatsappStats.todayCount +
    metaStats.todayCount +
    linkedinStats.todayCount;

  const totalFailed = failedUploads.length + (failedRetryUploads?.length || 0);

  const TABS_CONFIG: Array<{ key: SourceTabKey; label: string; icon: React.ElementType; badge?: string; errorCount: number }> = [
    { key: "workable", label: "Workable", icon: RefreshCw, badge: workableStats.todayCount > 0 ? `${workableStats.todayCount}` : undefined, errorCount: getErrorCount("Workable") },
    { key: "manual", label: "Direct Upload", icon: Upload, badge: manualStats.todayCount > 0 ? `${manualStats.todayCount}` : undefined, errorCount: getErrorCount("Manual") },
    { key: "folder", label: "External Drive / Folder", icon: FolderUp, badge: "18k Bulk", errorCount: 0 },
    { key: "linkedin", label: "LinkedIn", icon: Share2, badge: linkedinStats.todayCount > 0 ? `${linkedinStats.todayCount}` : undefined, errorCount: getErrorCount("linkedin") },
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, badge: whatsappStats.todayCount > 0 ? `${whatsappStats.todayCount}` : undefined, errorCount: getErrorCount("WhatsApp") },
    { key: "meta", label: "Meta Campaigns", icon: Activity, badge: metaStats.todayCount > 0 ? `${metaStats.todayCount}` : undefined, errorCount: getErrorCount("Meta") },
    { key: "email", label: "Email (Office 365)", icon: Mail, badge: emailStats.todayCount > 0 ? `${emailStats.todayCount}` : undefined, errorCount: getErrorCount("Email") },
    { key: "portal", label: "Career Portal / Web Form", icon: Link2, badge: linkStats.todayCount > 0 ? `${linkStats.todayCount}` : undefined, errorCount: getErrorCount("Link") },
  ];

  return (
    <div className="self-stretch bg-background min-h-screen w-full flex flex-col">
      <PageHeader title="" />

      <div className="px-6 pb-24 md:pb-6 mx-auto w-full max-w-7xl">
        {/* Section A: Header Metrics Bar */}
        <header className="mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4">
            <div>
              <h1 className="text-[24px] leading-8 font-semibold text-text-primary">Ingestion Monitor</h1>
              <p className="text-[13px] text-text-secondary mt-1">Real-time status of all CV intake channels and the parsing queue.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard/ingestion-monitor/folder-upload"
                className="py-2.5 px-4 bg-[#006E1C] hover:bg-[#005415] text-white font-bold text-xs rounded-lg transition flex items-center gap-2 shadow-sm"
              >
                <FolderUp className="w-4 h-4" />
                <span>Upload from Directory (18k Bulk)</span>
              </Link>
              <div className="flex items-center gap-3 bg-surface px-4 py-2.5 rounded-lg border border-border shadow-sm">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[11px] font-bold tracking-widest text-green-600 dark:text-green-400">LIVE SYNC</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface border border-border p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Total CVs Today</p>
                <p className="text-2xl font-bold text-text-primary mt-1">{totalToday}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-surface border border-border p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Active Uploads</p>
                <p className="text-2xl font-bold text-text-primary mt-1">{activeUploads.length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-500 dark:text-blue-400">
                <Upload className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-surface border border-border p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Failed Parses</p>
                <p className="text-2xl font-bold text-red-500 mt-1">{totalFailed}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center text-red-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-surface border border-border p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Pending Batches</p>
                <p className="text-2xl font-bold text-amber-500 dark:text-amber-400 mt-1">{activeBatchId ? 1 : 0}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400">
                <Loader2 className={`w-5 h-5 ${activeBatchId ? "animate-spin" : ""}`} />
              </div>
            </div>
          </div>
        </header>

        {/* Section B: Source Tabs Header */}
        <div className="mb-6 bg-surface border border-border rounded-xl p-1.5 flex gap-1.5 overflow-x-auto shadow-sm custom-scrollbar">
          {TABS_CONFIG.map((t) => {
            const IconComponent = t.icon;
            const isActive = activeSourceTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveSourceTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-primary-container text-on-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-container-high"
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span>{t.label}</span>
                {t.badge && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? "bg-on-primary/20 text-on-primary" : "bg-surface-container-high text-text-secondary"}`}>
                    {t.badge}
                  </span>
                )}
                {t.errorCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title={`${t.errorCount} extraction errors`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Section C: Tab Content Views */}
        <div className="mb-8 bg-surface border border-border rounded-2xl p-6 shadow-sm">
          {/* TAB 1: Workable */}
          {activeSourceTab === "workable" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Workable Integration
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Connect Workable SPI API to extract candidates, resume attachments, and sync directly to Cloudflare R2.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary bg-surface-container-low px-3 py-1.5 rounded-lg border border-border">
                  <span>Today: {workableStats.todayCount} CVs</span>
                  <span>•</span>
                  <span>Last received: {formatTime(workableStats.lastReceived)}</span>
                </div>
              </div>

              {!importStatus ? (
                <div className="space-y-5">
                  <div className="bg-[#E1F5FE] border border-[#B3E5FC] rounded-xl p-4 text-[#0277BD]">
                    <p className="text-sm font-bold flex items-center gap-2 mb-2">
                      <Info className="w-4 h-4 shrink-0" /> Workable Extraction Engine Highlights
                    </p>
                    <ol className="text-xs space-y-1 list-decimal list-inside font-medium ml-1">
                      <li>Connects via Bearer token to your Workable SPI v3 API.</li>
                      <li>Uses 5-tier fallback algorithm to capture all candidate CV attachments.</li>
                      <li>Stores files in Cloudflare R2 Storage and executes AI detail parsing with DeepSeek V4-Flash.</li>
                      <li>Runs continuous pagination with auto-resume rate-limit protection (429 backoff).</li>
                      <li>Stop or Pause anytime—resumes from the exact saved cursor.</li>
                    </ol>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold text-text-primary flex items-center gap-2 mb-1.5">
                        <Building2 className="w-4 h-4 text-text-secondary" /> Workable Subdomain
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="mycompany"
                          value={subdomain}
                          onChange={(e) => setSubdomain(e.target.value)}
                          className="text-text-primary bg-background text-[13px] py-2 px-3 rounded-md border border-border flex-1 focus:outline-none focus:border-primary-container"
                        />
                        <span className="flex items-center text-[13px] text-text-secondary bg-surface-container-low px-3 rounded-md border border-border whitespace-nowrap font-medium">
                          .workable.com
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-bold text-text-primary flex items-center gap-2 mb-1.5">
                        <Key className="w-4 h-4 text-text-secondary" /> API Key
                      </label>
                      <input
                        type="password"
                        placeholder="your-workable-api-key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="text-text-primary bg-background text-[13px] py-2 px-3 rounded-md border border-border w-full focus:outline-none focus:border-primary-container"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-text-primary flex items-center gap-2 mb-1.5">
                      <Activity className="w-4 h-4 text-text-secondary" /> Import Limit (Candidates per run)
                    </label>
                    <select
                      value={maxCandidates}
                      onChange={(e) => setMaxCandidates(Number(e.target.value))}
                      className="text-text-primary bg-background text-[13px] py-2 px-3 rounded-md border border-border w-full focus:outline-none focus:border-primary-container font-medium max-w-md"
                    >
                      <option value={100}>100 Candidates (Quick Test)</option>
                      <option value={500}>500 Candidates (Recommended Initial Target)</option>
                      <option value={1000}>1,000 Candidates</option>
                      <option value={5000}>5,000 Candidates</option>
                      <option value={50000}>50,000 Candidates</option>
                      <option value={0}>Unlimited (Extract All Candidates)</option>
                    </select>
                  </div>

                  <div className="pt-2 flex justify-start gap-3">
                    <Button onClick={handleWorkableImport} disabled={isWorkableImporting}>
                      {isWorkableImporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Starting Import...
                        </>
                      ) : (
                        `Start Workable Import (${maxCandidates === 0 ? "Unlimited" : maxCandidates})`
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-text-primary">Workable Import Live Progress</h3>
                    {importStatus.status === "running" && (
                      <div className="flex items-center gap-1.5 bg-[#E8F5E9] text-[#1B5E20] px-3 py-1 rounded-md border border-[#C8E6C9]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="text-xs font-bold uppercase tracking-wider">Running (Ingesting & Queuing AI Parsing)</span>
                      </div>
                    )}
                    {importStatus.status === "paused" && (
                      <div className="flex items-center gap-1.5 bg-[#FFF3E0] text-[#E65100] px-3 py-1 rounded-md border border-[#FFE0B2]">
                        <Pause className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold uppercase tracking-wider">Paused</span>
                      </div>
                    )}
                    {importStatus.status === "stopped" && (
                      <div className="flex items-center gap-1.5 bg-[#FFF3E0] text-[#E65100] px-3 py-1 rounded-md border border-[#FFE0B2]">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold uppercase tracking-wider">Stopped</span>
                      </div>
                    )}
                    {importStatus.status === "done" && (
                      <div className="flex items-center gap-1.5 bg-[#E8F5E9] text-[#1B5E20] px-3 py-1 rounded-md border border-[#C8E6C9]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold uppercase tracking-wider">Complete</span>
                      </div>
                    )}
                    {importStatus.status === "error" && (
                      <div className="flex items-center gap-1.5 bg-[#FFEBEE] text-[#D32F2F] px-3 py-1 rounded-md border border-[#FFCDD2]">
                        <XCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold uppercase tracking-wider">Error</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-text-secondary mb-1">
                      <span>Imported & Queued CVs</span>
                      <span>
                        {importStatus.imported.toLocaleString()} / {(importStatus.maxCandidates || importStatus.totalCandidates || 100).toLocaleString()}
                      </span>
                    </div>
                    <ProgressBar value={importStatus.imported} max={importStatus.maxCandidates || importStatus.totalCandidates || 100} color="bg-[#006E1C]" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatBox label="Imported CVs" value={importStatus.imported} icon={CheckCircle2} color="bg-[#E8F5E9] text-[#1B5E20]" />
                    <StatBox label="Duplicates" value={importStatus.deduplicated} icon={Copy} color="bg-[#E1F5FE] text-[#0277BD]" />
                    <StatBox label="Skipped (No CV)" value={importStatus.skipped} icon={SkipForward} color="bg-[#FFF3E0] text-[#E65100]" />
                    <StatBox label="Failed" value={importStatus.failed} icon={XCircle} color="bg-[#FFEBEE] text-[#D32F2F]" />
                  </div>

                  {importStatus.errorMessage && importStatus.status === "error" && (
                    <div className="flex items-start gap-2 bg-[#FFEBEE] border border-[#FFCDD2] rounded-lg p-3 text-xs font-medium text-[#D32F2F]">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      {importStatus.errorMessage}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {importStatus.status === "running" && (
                      <>
                        <button
                          onClick={handlePauseWorkable}
                          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white py-2 px-4 rounded-lg text-xs font-bold transition-all shadow-sm"
                        >
                          <Pause className="w-4 h-4" fill="currentColor" />
                          <span>Pause Import</span>
                        </button>
                        <button
                          onClick={handleStopWorkable}
                          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg text-xs font-bold transition-all shadow-sm"
                        >
                          <Square className="w-3.5 h-3.5" fill="currentColor" />
                          <span>Stop Import</span>
                        </button>
                      </>
                    )}

                    {importStatus.status === "paused" && (
                      <>
                        <button
                          onClick={handleResumeWorkable}
                          disabled={isWorkableImporting}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                        >
                          {isWorkableImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" fill="currentColor" />}
                          <span>Resume Import</span>
                        </button>
                        <button
                          onClick={handleStopWorkable}
                          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg text-xs font-bold transition-all shadow-sm"
                        >
                          <Square className="w-3.5 h-3.5" fill="currentColor" />
                          <span>Stop Import</span>
                        </button>
                      </>
                    )}

                    {importStatus.status === "stopped" && (
                      <>
                        <button
                          onClick={handleResumeWorkable}
                          disabled={isWorkableImporting}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                        >
                          {isWorkableImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" fill="currentColor" />}
                          <span>Resume Import</span>
                        </button>
                        <button
                          onClick={handleClearHistory}
                          className="flex items-center gap-2 text-xs font-bold text-text-secondary hover:text-red-600 py-2 px-4 rounded-lg border border-border hover:bg-surface-container-high transition-all"
                        >
                          <Square className="w-3.5 h-3.5" fill="currentColor" />
                          <span>Clear & Start Over</span>
                        </button>
                      </>
                    )}

                    {importStatus.status === "error" && (
                      <>
                        <button
                          onClick={handleRetryWorkable}
                          disabled={isWorkableImporting}
                          className="flex items-center gap-2 bg-primary-container text-on-primary py-2 px-4 rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                        >
                          {isWorkableImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                          <span>Retry Import</span>
                        </button>
                        <button
                          onClick={handleClearHistory}
                          className="flex items-center gap-2 text-xs font-bold text-text-secondary hover:text-red-600 py-2 px-4 rounded-lg border border-border hover:bg-surface-container-high transition-all"
                        >
                          <span>Clear History</span>
                        </button>
                      </>
                    )}

                    {importStatus.status === "done" && (
                      <button
                        onClick={handleClearHistory}
                        className="flex items-center gap-2 bg-primary-container text-on-primary py-2 px-4 rounded-lg text-xs font-bold transition-all shadow-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Start New Import</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Direct Upload (Manual) */}
          {activeSourceTab === "manual" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <Upload className="w-5 h-5 text-blue-500 dark:text-blue-400" /> Direct File Upload
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Drag and drop bulk candidate CV files (PDF, DOCX, RTF, TXT) for instant AI extraction.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary bg-surface-container-low px-3 py-1.5 rounded-lg border border-border">
                  <span>Today: {manualStats.todayCount} CVs</span>
                  <span>•</span>
                  <span>Last Batch: {formatTime(manualStats.lastReceived)}</span>
                </div>
              </div>

              {/* Bulk Folder Upload Banner */}
              <div className="bg-[#006E1C]/5 border border-[#006E1C]/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#006E1C] text-white rounded-lg shrink-0">
                    <FolderUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">Bulk Upload from Local / External Directory (18,000 Candidates)</h3>
                    <p className="text-xs text-text-secondary">
                      Select a root directory containing candidate folders. Automatically locates resumes in <code className="font-mono bg-background-accent px-1.5 py-0.5 rounded">Downloads/</code> folders and uploads in 100-candidate batches.
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/ingestion-monitor/folder-upload"
                  className="py-2.5 px-4 bg-[#006E1C] hover:bg-[#005415] text-white font-bold text-xs rounded-lg transition flex items-center gap-2 shrink-0 shadow-sm"
                >
                  <FolderUp className="w-4 h-4" />
                  <span>Upload from Directory</span>
                </Link>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary-container bg-surface-container-low hover:bg-surface-container-high transition-all rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer text-center"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  accept=".pdf,.docx,.doc,.rtf,.txt"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-text-primary mb-1">
                  Click to select files or drag & drop here
                </p>
                <p className="text-xs text-text-secondary max-w-sm">
                  Supported formats: PDF, DOCX, DOC, RTF, TXT (Up to 50MB per file)
                </p>
              </div>

              {files.length > 0 && (
                <div className="space-y-4 bg-surface-container-low p-4 rounded-xl border border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-text-primary">{files.length} Files Selected</span>
                    <button onClick={() => setFiles([])} className="text-xs font-semibold text-red-500 hover:underline">
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {files.map((f, i) => (
                      <div key={i} className="flex justify-between items-center bg-surface p-2 rounded-lg border border-border text-xs">
                        <span className="truncate max-w-xs font-medium text-text-primary">{f.name}</span>
                        <span className="text-text-secondary font-mono">{(f.size / 1024).toFixed(0)} KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase mb-1.5 block">Source Tag</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="text-text-primary bg-background text-[13px] py-2 px-3 rounded-md border border-border w-full focus:outline-none focus:border-primary-container font-medium"
                  >
                    {SOURCE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase mb-1.5 block">Campaign Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Q3 Hiring Spree"
                    value={campaignLabel}
                    onChange={(e) => setCampaignLabel(e.target.value)}
                    className="text-text-primary bg-background text-[13px] py-2 px-3 rounded-md border border-border w-full focus:outline-none focus:border-primary-container"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase mb-1.5 block">Assign to Job (Optional)</label>
                  <input
                    type="text"
                    placeholder="Job ID"
                    value={assignToJob}
                    onChange={(e) => setAssignToJob(e.target.value)}
                    className="text-text-primary bg-background text-[13px] py-2 px-3 rounded-md border border-border w-full focus:outline-none focus:border-primary-container"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleManualUpload} disabled={files.length === 0 || isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Uploading & Processing...
                    </>
                  ) : (
                    `Upload & Parse ${files.length > 0 ? `${files.length} Files` : "CVs"}`
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: LinkedIn */}
          {activeSourceTab === "linkedin" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-blue-600 dark:text-blue-400" /> LinkedIn Integration
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Extract candidate profiles directly from LinkedIn Recruiter & InMail via Career141 Chrome Extension.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary bg-surface-container-low px-3 py-1.5 rounded-lg border border-border">
                  <span>Today: {linkedinStats.todayCount} CVs</span>
                  <span>•</span>
                  <span>Last Received: {formatTime(linkedinStats.lastReceived)}</span>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">LinkedIn Inbox Monitor Active</h4>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Polling incoming LinkedIn candidate emails at <span className="font-bold text-blue-600 dark:text-blue-400">linkedin@career141.com</span>.
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-3 py-1 rounded-full text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Active Monitoring
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatBox label="Captured Today" value={linkedinStats.todayCount} icon={CheckCircle2} color="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" />
                <StatBox label="Extraction Errors" value={getErrorCount("linkedin")} icon={AlertCircle} color="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" />
              </div>
            </div>
          )}

          {/* TAB 4: WhatsApp */}
          {activeSourceTab === "whatsapp" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" /> WhatsApp Intake (Meta API)
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Automated WhatsApp webhook listening for candidate CV attachments and recruiter forwarded messages.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-text-secondary">Ingestion Status</span>
                  <button
                    onClick={() => handleToggle("whatsappIngestion", !toggles.whatsappIngestion)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      toggles.whatsappIngestion
                        ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {toggles.whatsappIngestion ? "Active (Click to Pause)" : "Paused (Click to Resume)"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatBox label="Received Today" value={whatsappStats.todayCount} icon={MessageCircle} color="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" />
                <StatBox label="Last Received" value={whatsappStats.lastReceived ? 1 : 0} icon={Activity} color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          )}

          {/* TAB 5: Meta Campaigns */}
          {activeSourceTab === "meta" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-700 dark:text-blue-400" /> Meta Campaign Intake
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Direct lead ads webhook capturing candidate submissions from Facebook & Instagram ad campaigns.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary bg-surface-container-low px-3 py-1.5 rounded-lg border border-border">
                  <span>Today: {metaStats.todayCount} CVs</span>
                  <span>•</span>
                  <span>Last Received: {formatTime(metaStats.lastReceived)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatBox label="Captured Today" value={metaStats.todayCount} icon={Activity} color="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" />
                <StatBox label="Extraction Errors" value={getErrorCount("Meta")} icon={AlertCircle} color="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" />
              </div>
            </div>
          )}

          {/* TAB 6: Email (Office 365) */}
          {activeSourceTab === "email" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <Mail className="w-5 h-5 text-orange-500 dark:text-orange-400" /> Email Ingestion (Office 365)
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Microsoft Graph API inbox monitor parsing incoming CV attachments from job board forwarders and candidates.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-text-secondary">Ingestion Status</span>
                  <button
                    onClick={() => handleToggle("emailIngestion", !toggles.emailIngestion)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      toggles.emailIngestion
                        ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {toggles.emailIngestion ? "Active (Click to Pause)" : "Paused (Click to Resume)"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatBox label="Received Today" value={emailStats.todayCount} icon={Mail} color="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" />
                <StatBox label="Last Received" value={emailStats.lastReceived ? 1 : 0} icon={Activity} color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          )}

          {/* TAB 7: Career Portal / Web Form */}
          {activeSourceTab === "portal" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Career Portal / Web Form
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Direct public candidate application portal and embedded website application form submissions.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary bg-surface-container-low px-3 py-1.5 rounded-lg border border-border">
                  <span>Today: {linkStats.todayCount} CVs</span>
                  <span>•</span>
                  <span>Last Received: {formatTime(linkStats.lastReceived)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatBox label="Submissions Today" value={linkStats.todayCount} icon={Link2} color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" />
                <StatBox label="Extraction Errors" value={getErrorCount("Career Portal / Web Form")} icon={AlertCircle} color="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" />
              </div>
            </div>
          )}
        </div>

        {/* Section D: Bottom Errors & Activity Panel */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col min-h-[400px]">
          <div className="flex border-b border-border bg-surface-container-low px-2 pt-2 gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveBottomTab("errors")}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
                activeBottomTab === "errors"
                  ? "bg-surface text-red-600 dark:text-red-400 border-x border-t border-border border-b-transparent shadow-[0_2px_0_0_#fff]"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface/50 border border-transparent"
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              Failed Extractions
              {failedUploads.length > 0 && (
                <span className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full text-[10px] ml-1">
                  {failedUploads.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveBottomTab("permanent")}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
                activeBottomTab === "permanent"
                  ? "bg-surface text-amber-700 dark:text-amber-400 border-x border-t border-border border-b-transparent shadow-[0_2px_0_0_#fff]"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface/50 border border-transparent"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Permanent Failures
              {(failedRetryUploads?.length || 0) > 0 && (
                <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full text-[10px] ml-1">
                  {failedRetryUploads.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveBottomTab("activity")}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
                activeBottomTab === "activity"
                  ? "bg-surface text-primary border-x border-t border-border border-b-transparent shadow-[0_2px_0_0_#fff]"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface/50 border border-transparent"
              }`}
            >
              <Activity className="w-4 h-4" />
              Activity Log
              {importBatchId && <span className="w-2 h-2 rounded-full bg-primary animate-pulse ml-1" />}
            </button>
          </div>

          <div className="p-5 flex-1 bg-surface">
            {activeBottomTab === "errors" && (
              <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h2 className="text-[15px] font-bold text-text-primary">Failed CV Extractions</h2>
                    <p className="text-xs text-text-secondary mt-0.5">CVs that failed AI parsing or encountered a network error.</p>
                  </div>
                  <button
                    onClick={handleRetryFailed}
                    disabled={retrying || failedUploads.length === 0}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
                  >
                    {retrying && <Loader2 className="w-4 h-4 animate-spin" />}
                    {retrying ? "Queueing..." : "Retry All Failed"}
                  </button>
                </div>

                {Object.keys(failedBySource).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-text-secondary border-2 border-dashed border-border rounded-xl">
                    <CheckCircle2 className="w-8 h-8 text-green-500 mb-2 opacity-50" />
                    <p className="font-medium text-sm">No failed extractions!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Object.entries(failedBySource).map(([sourceName, uploads]: [string, any]) => (
                      <div key={sourceName} className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-4 rounded-xl">
                        <div className="flex justify-between items-center mb-3 border-b border-red-100 dark:border-red-900/30 pb-2">
                          <span className="font-bold text-red-900 dark:text-red-400 text-sm flex items-center gap-2">
                            {sourceName}
                            <span className="text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                              {uploads.length}
                            </span>
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                          {uploads.map((f: any) => (
                            <div key={f._id} className="bg-surface dark:bg-surface-container-high p-3 rounded-lg border border-red-100 dark:border-red-900/30 shadow-sm">
                              <p className="text-[13px] font-semibold text-text-primary truncate" title={f.fileName}>
                                {f.fileName}
                              </p>
                              <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 flex items-start gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span className="line-clamp-2">{f.errorMessage || "Unknown extraction error"}</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeBottomTab === "permanent" && (
              <div className="animate-in fade-in duration-300">
                <div className="mb-5">
                  <h2 className="text-[15px] font-bold text-text-primary">Permanent Failures</h2>
                  <p className="text-xs text-text-secondary mt-0.5">CVs that failed repeatedly even after manual retries. These require human review.</p>
                </div>

                {Object.keys(failedRetryBySource).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-text-secondary border-2 border-dashed border-border rounded-xl">
                    <CheckCircle2 className="w-8 h-8 text-green-500 mb-2 opacity-50" />
                    <p className="font-medium text-sm">No permanent failures!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Object.entries(failedRetryBySource).map(([sourceName, uploads]: [string, any]) => (
                      <div key={sourceName} className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-4 rounded-xl">
                        <div className="flex justify-between items-center mb-3 border-b border-amber-100 dark:border-amber-900/30 pb-2">
                          <span className="font-bold text-amber-900 dark:text-amber-400 text-sm flex items-center gap-2">
                            {sourceName}
                            <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                              {uploads.length}
                            </span>
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                          {uploads.map((f: any) => (
                            <div key={f._id} className="bg-surface dark:bg-surface-container-high p-3 rounded-lg border border-amber-100 dark:border-amber-900/30 shadow-sm">
                              <p className="text-[13px] font-semibold text-text-primary truncate" title={f.fileName}>
                                {f.fileName}
                              </p>
                              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 flex items-start gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span className="line-clamp-2">{f.errorMessage || "Failed repeatedly during retry"}</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeBottomTab === "activity" && (
              <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h2 className="text-[15px] font-bold text-text-primary">Activity Log</h2>
                    <p className="text-xs text-text-secondary mt-0.5">Real-time logs for ongoing or recent ingestion batches.</p>
                  </div>
                  {importBatchId && (
                    <button
                      onClick={() => setImportBatchId(null)}
                      className="text-xs font-semibold text-text-secondary hover:text-text-primary bg-surface-container-low border border-border px-3 py-1.5 rounded-lg shadow-sm transition-all hover:bg-surface-container-high"
                    >
                      Clear Log
                    </button>
                  )}
                </div>

                {importBatchId ? (
                  <div className="rounded-xl overflow-hidden border border-border shadow-sm">
                    <RealTimeBatchLog batchId={importBatchId} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-text-secondary border-2 border-dashed border-border rounded-xl">
                    <Activity className="w-8 h-8 mb-2 opacity-50" />
                    <p className="font-medium text-sm">No active batch logs.</p>
                    <p className="text-xs mt-1 opacity-70">Logs will appear here when an upload or sync starts.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
