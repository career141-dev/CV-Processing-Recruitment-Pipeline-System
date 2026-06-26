"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Upload, AlertCircle, Loader2, CheckCircle2, Info, Building2, Key, X, Play, RotateCcw, Copy, SkipForward, XCircle } from 'lucide-react';
import { ChannelStatusCard } from '@/components/ingestion-monitor/ChannelStatusCard';
import RealTimeBatchLog from "@/components/ingestion-monitor/RealTimeBatchLog";
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { toast } from 'sonner';

const SOURCE_OPTIONS = ["LinkedIn", "WhatsApp", "Meta", "Email", "Workable", "Manual", "Headhunting"];

const SOURCE_COLORS: Record<string, { bgColor: string; textColor: string }> = {
  'Workable': { bgColor: 'bg-[#E3F2FD]', textColor: 'text-[#1565C0]' },
  'Manual': { bgColor: 'bg-[#E1F5FE]', textColor: 'text-[#0277BD]' },
  'LinkedIn': { bgColor: 'bg-[#E8F5E9]', textColor: 'text-[#006E1C]' },
  'WhatsApp': { bgColor: 'bg-[#E8F5E9]', textColor: 'text-primary-container' },
  'Email': { bgColor: 'bg-[#FFF3E0]', textColor: 'text-[#E65100]' },
  'default': { bgColor: 'bg-[#F3F4F6]', textColor: 'text-[#374151]' }
};

type ImportStatus = {
  _id: string;
  status: "running" | "done" | "error" | "stopped";
  totalCandidates: number;
  imported: number;
  skipped: number;
  deduplicated: number;
  failed: number;
  startedAt: string;
  errorMessage?: string;
  lastCursor?: string;
  subdomain?: string;
};

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

function StatBox({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string;
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
  const stats = useQuery(api.stats.getIngestionStats);
  const resumeFailedUploads = useAction(api.cvs.cvExtraction.resumeFailedUploads);
  
  const { user } = useUser();
  const startBulkImport = useAction(api.integrations.workableActions.startBulkImport);
  const getLatestImportStatus = useAction(api.integrations.workableActions.getLatestImportStatus);
  const getImportStatus = useAction(api.integrations.workableActions.getImportStatus);
  const retryImport = useAction(api.integrations.workableActions.retryImport);
  const retrySkippedAction = useAction(api.integrations.workableActions.retrySkipped);
  const stopImport = useAction(api.integrations.workableActions.stopImport);
  const clearImportHistory = useMutation(api.integrations.workable.clearImportHistory);

  const generateUploadUrl = useMutation(api.cvs.cvUploads.generateUploadUrl);
  const saveUpload = useMutation(api.cvs.cvUploads.saveUpload);
  const processCvExtraction = useAction(api.cvs.cvExtraction.processCvExtraction);
  const createBatch = useMutation(api.ingestionBatches.createBatch);
  const queueManualExtraction = useMutation(api.cvs.cvUploads.queueManualExtraction);

  const [retrying, setRetrying] = useState(false);
  const [activeTab, setActiveTab] = useState<'ongoing' | 'history'>('ongoing');
  
  // Workable State
  const [isWorkableModalOpen, setIsWorkableModalOpen] = useState(false);
  const [subdomain, setSubdomain] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isWorkableImporting, setIsWorkableImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual Upload State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [importBatchId, setImportBatchId] = useState<Id<"ingestionBatches"> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Manual Upload Tags
  const [source, setSource] = useState("Manual");
  const [campaignLabel, setCampaignLabel] = useState("");
  const [assignToJob, setAssignToJob] = useState("");
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);

  // --- Workable Polling & Effects ---
  useEffect(() => {
    if (!user?.id) return;
    getLatestImportStatus({ userId: user.id }).then((status) => {
      if (status) {
        setImportStatus(status as ImportStatus);
        if (status.subdomain) setSubdomain(status.subdomain);
        if (status.status === "running") startPolling(status._id);
      }
    });
  }, [user?.id]);

  const startPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const status = await getImportStatus({ importId: id as any });
      if (status) {
        setImportStatus(status as ImportStatus);
        if (status.status !== "running") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setIsWorkableImporting(false);
        }
      }
    }, 3000);
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleWorkableImport = async () => {
    if (!subdomain || !apiKey || !user?.id) {
      toast.error("Please enter both subdomain and API key");
      return;
    }
    setIsWorkableImporting(true);
    try {
      const { importId: newId } = await startBulkImport({ subdomain, apiKey, userId: user.id });
      setImportStatus({
        _id: newId,
        status: "running",
        totalCandidates: 0,
        imported: 0,
        skipped: 0,
        deduplicated: 0,
        failed: 0,
        startedAt: new Date().toISOString(),
        subdomain,
      });
      startPolling(newId);
      toast.success("Workable import started!");
      // Removed setIsWorkableModalOpen(false) to keep the modal open and show progress
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start import");
      setIsWorkableImporting(false);
    }
  };

  const handleRetryWorkable = async () => {
    if (!importStatus) return;
    setIsWorkableImporting(true);
    try {
      await retryImport({ importId: importStatus._id as any, subdomain: subdomain || undefined, apiKey: apiKey || undefined });
      setImportStatus((prev) => prev ? { ...prev, status: "running", errorMessage: "" } : prev);
      startPolling(importStatus._id);
      toast.info("Import retrying from where it left off.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry");
      setIsWorkableImporting(false);
    }
  };

  const handleRetrySkipped = async () => {
    if (!importStatus) return;
    setIsWorkableImporting(true);
    try {
      await retrySkippedAction({ importId: importStatus._id as any, subdomain: subdomain || undefined, apiKey: apiKey || undefined });
      setImportStatus((prev) => prev ? { ...prev, status: "running", errorMessage: "", skipped: 0, failed: 0 } : prev);
      startPolling(importStatus._id);
      toast.info("Retrying skipped candidates from the beginning.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry skipped");
      setIsWorkableImporting(false);
    }
  };

  const handleStopWorkable = async () => {
    if (!importStatus) return;
    try {
      await stopImport({ importId: importStatus._id as any });
      setImportStatus((prev) => prev ? { ...prev, status: "stopped" } : prev);
      setIsWorkableImporting(false);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      toast.info("Import stopped.");
    } catch (err) {
      toast.error("Failed to stop import");
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("⚠️ This will delete your import job history (not candidates). Sure?")) return;
    try {
      await clearImportHistory();
      toast.success("Import history cleared");
      setImportStatus(null);
    } catch (err) {
      toast.error("Cleanup failed");
    }
  };

  const totalProcessed = importStatus
    ? importStatus.imported + importStatus.skipped + importStatus.deduplicated + importStatus.failed
    : 0;

  // --- Manual Upload Handlers ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
  };

  const normalizeFileType = (file: File): string => {
    if (file.type.includes("pdf")) return "pdf";
    if (file.type.includes("wordprocessingml") || file.name.endsWith(".docx")) return "docx";
    if (file.type.includes("msword") || file.name.endsWith(".doc")) return "doc";
    if (file.type.includes("text")) return "txt";
    if (file.type.includes("png")) return "png";
    if (file.type.includes("jpeg")) return "jpg";
    return file.name.split(".").pop()?.toLowerCase() || "txt";
  };

  const handleManualUpload = async () => {
    if (files.length === 0 || !user?.id) return;
    setIsUploading(true);
    let successCount = 0;
    try {
      const batchId = await createBatch({
        sourceChannel: source || "Manual",
        totalCount: files.length,
        jobId: (assignToJob as Id<"jobs">) || undefined,
      });
      setImportBatchId(batchId);

      for (const file of files) {
        const uploadUrl = await generateUploadUrl();
        const resp = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        const { storageId } = await resp.json();

        const cvUploadId = await saveUpload({
          storageId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          source: source || "Manual",
          campaignLabel: campaignLabel || undefined,
          assignToJob: assignToJob || undefined,
          uploadedBy: user.id,
        });

        await queueManualExtraction({
          storageId,
          fileType: normalizeFileType(file),
          sourceChannel: source || "Manual",
          uploadedBy: user.id,
          cvUploadId,
          fileName: file.name,
          batchId,
        });
        successCount++;
      }
      toast.success(`${successCount} CVs uploaded and processing started.`);
      setFiles([]);
      setIsManualModalOpen(false);
    } catch (err) {
      toast.error("Upload failed for some files.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { statsBySource, activeUploads, failedUploads, recentDone } = stats;

  const handleRetryFailed = async () => {
    setRetrying(true);
    try {
      await resumeFailedUploads();
      toast.success("Retry queued! Background process started.");
    } catch (err) {
      toast.error("Failed to queue retries.");
    } finally {
      setRetrying(false);
    }
  };

  const getSourceConfig = (sourceName: string) => SOURCE_COLORS[sourceName] || SOURCE_COLORS.default;

  const workableStats = statsBySource['Workable'] || { todayCount: 0, lastReceived: null };
  const manualStats = statsBySource['Manual'] || { todayCount: 0, lastReceived: null };

  const formatTime = (ts: number | null) => {
    if (!ts) return "N/A";
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs} hr ago`;
  };

  const failedBySource = failedUploads.reduce((acc: any, curr: any) => {
    const s = curr.source || 'Manual';
    if (!acc[s]) acc[s] = [];
    acc[s].push(curr);
    return acc;
  }, {});

  const logsToShow = activeTab === 'ongoing' 
    ? [...activeUploads].sort((a: any, b: any) => b._creationTime - a._creationTime)
    : [...recentDone].sort((a: any, b: any) => b._creationTime - a._creationTime).slice(0, 50);

  return (
    <div className="self-stretch bg-background min-h-screen w-full flex flex-col">
      <PageHeader title="" />
      
      <div className="px-6 pb-24 md:pb-6 mx-auto w-full max-w-7xl">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-[24px] leading-8 font-semibold text-text-primary">Ingestion Monitor</h1>
            <p className="text-[13px] text-text-secondary mt-1">Real-time status of all CV intake channels and the parsing queue.</p>
          </div>
          <div className="flex items-center gap-3 bg-surface px-4 py-2.5 rounded-md border border-border shadow-sm">
            <div className="w-2 h-2 rounded-full bg-[#006E1C] animate-pulse"></div>
            <span className="text-[11px] font-semibold tracking-widest text-[#006E1C]">LIVE SYNC</span>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <ChannelStatusCard
            title="Workable Sync"
            status={workableStats.lastReceived ? "Active" : "Awaiting Data"}
            statusColor={workableStats.lastReceived ? "text-[#1565C0]" : "text-text-secondary"}
            icon={<RefreshCw size={20} />}
            pulse={!!activeUploads.find((u: any) => u.source === 'Workable')}
            stats={[
              { label: 'CVs Uploaded Today', value: workableStats.todayCount.toString() },
              { label: 'Last received', value: formatTime(workableStats.lastReceived) }
            ]}
            actionButton={
              <button 
                onClick={() => setIsWorkableModalOpen(true)}
                className="w-full mt-2 py-2 text-sm font-semibold text-[#1565C0] bg-[#E3F2FD] hover:bg-[#BBDEFB] rounded-md transition-colors"
              >
                Import Data
              </button>
            }
          >
            {importStatus && (
              <div className="mt-2 bg-surface-container-low p-3 rounded-md border border-border">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-text-primary">
                    Import Progress
                  </span>
                  <span className="text-xs font-bold text-text-secondary">
                    {totalProcessed} / {importStatus.totalCandidates}
                  </span>
                </div>
                <ProgressBar value={totalProcessed} max={importStatus.totalCandidates} color="bg-[#006E1C]" />
                
                <div className="mt-3 flex justify-between items-center">
                  {importStatus.status === "running" && (
                    <button 
                      onClick={handleStopWorkable} 
                      className="text-[11px] font-bold text-[#D32F2F] flex items-center gap-1 hover:underline"
                    >
                      <XCircle className="w-3 h-3" /> Pause
                    </button>
                  )}
                  {importStatus.status === "stopped" && (
                    <button 
                      onClick={handleRetryWorkable} 
                      disabled={isWorkableImporting}
                      className="text-[11px] font-bold text-[#1565C0] flex items-center gap-1 hover:underline disabled:opacity-50"
                    >
                      {isWorkableImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" fill="currentColor" />}
                      Resume
                    </button>
                  )}
                  {importStatus.status === "error" && (
                    <button 
                      onClick={handleRetryWorkable} 
                      disabled={isWorkableImporting}
                      className="text-[11px] font-bold text-[#D32F2F] flex items-center gap-1 hover:underline disabled:opacity-50"
                    >
                      {isWorkableImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      Retry
                    </button>
                  )}
                  {importStatus.status === "done" && (
                    <button 
                      onClick={() => setImportStatus(null)} 
                      className="text-[11px] font-bold text-[#1B5E20] flex items-center gap-1 hover:underline"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Clear
                    </button>
                  )}
                  
                  <button 
                    onClick={() => setIsWorkableModalOpen(true)}
                    className="text-[11px] font-bold text-text-secondary hover:text-text-primary underline"
                  >
                    View Details
                  </button>
                </div>
              </div>
            )}
          </ChannelStatusCard>
          <ChannelStatusCard
            title="Manual Bulk Upload"
            status={manualStats.lastReceived ? "Active" : "Ready"}
            statusColor={manualStats.lastReceived ? "text-[#0277BD]" : "text-text-secondary"}
            icon={<Upload size={20} />}
            pulse={!!activeUploads.find((u: any) => u.source === 'Manual' || !u.source)}
            stats={[
              { label: 'CVs Uploaded Today', value: manualStats.todayCount.toString() },
              { label: 'Last Batch', value: formatTime(manualStats.lastReceived) }
            ]}
            actionButton={
              <button 
                onClick={() => setIsManualModalOpen(true)}
                className="w-full mt-2 py-2 text-sm font-semibold text-[#0277BD] bg-[#E1F5FE] hover:bg-[#B3E5FC] rounded-md transition-colors"
              >
                Import Data
              </button>
            }
          />
        </div>
        
        {importBatchId && (
          <div className="mb-8">
            <RealTimeBatchLog batchId={importBatchId} />
          </div>
        )}

        {Object.keys(failedBySource).length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-[#B3261E] flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Failed CV Extractions
              </h2>
              <button
                onClick={handleRetryFailed}
                disabled={retrying}
                className="flex items-center gap-2 bg-[#B3261E] hover:bg-[#8C1D18] text-white py-2 px-4 rounded-md font-bold text-sm transition-colors disabled:opacity-50"
              >
                {retrying && <Loader2 className="w-4 h-4 animate-spin" />}
                {retrying ? "Queueing..." : "Retry All Failed CVs"}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(failedBySource).map(([sourceName, uploads]: [string, any]) => (
                <div key={sourceName} className="bg-[#FEF7F6] border border-[#F9DEDC] p-5 rounded-xl">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-[#1D1B20] text-[15px]">{sourceName} Failures</span>
                    <span className="text-[12px] font-bold text-[#B3261E] bg-[#FCEEEE] px-2 py-1 rounded-sm">
                      {uploads.length} files
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
                    {uploads.map((f: any) => (
                      <div key={f._id} className="bg-white p-3 rounded-md border border-[#F9DEDC] shadow-sm flex flex-col">
                        <span className="text-[13px] font-semibold text-[#1D1B20] truncate">{f.fileName}</span>
                        <span className="text-[11px] text-[#49454F] mt-1 truncate">{f.errorMessage || "Unknown extraction error"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm mb-8">
          <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center bg-surface gap-4">
            <h2 className="text-[15px] font-semibold text-text-primary">Real-time Parsing Log</h2>
            <div className="flex gap-2 bg-surface-container-low p-1 rounded-lg border border-border">
              <button 
                onClick={() => setActiveTab('ongoing')} 
                className={`px-4 py-1.5 rounded-md text-[13px] font-semibold transition-all ${activeTab === 'ongoing' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface-container'}`}
              >
                Ongoing Parsings ({activeUploads.length})
              </button>
              <button 
                onClick={() => setActiveTab('history')} 
                className={`px-4 py-1.5 rounded-md text-[13px] font-semibold transition-all ${activeTab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface-container'}`}
              >
                Parsing History
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {logsToShow.length === 0 ? (
              <div className="p-8 text-center text-text-secondary text-[13px]">
                {activeTab === 'ongoing' ? "No CVs currently processing." : "No recent activity. Upload a CV or sync Workable to see logs."}
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-surface-container-high border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Time</th>
                    <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Source</th>
                    <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase">File Name</th>
                    <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E0E0]">
                  {logsToShow.map((log: any) => {
                    const sourceConfig = getSourceConfig(log.source || 'Manual');
                    const isProcessing = log.status === 'processing' || log.status === 'uploaded';
                    
                    return (
                      <tr key={log._id} className="hover:bg-surface-container-low transition-colors" style={{ backgroundColor: isProcessing ? '#F0FFF0' : 'transparent' }}>
                        <td className="px-6 py-4 text-[13px] text-text-secondary whitespace-nowrap">
                          {new Date(log._creationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 ${sourceConfig.bgColor} ${sourceConfig.textColor} rounded-md text-[11px] font-bold`}>
                            {log.source || 'Manual'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[13px] font-semibold truncate max-w-[300px]">
                          {log.fileName}
                        </td>
                        <td className="px-6 py-4 flex items-center gap-2">
                          {isProcessing ? (
                            <div className="flex items-center gap-2 text-[#006E1C] font-bold text-[12px]">
                              <Loader2 className="w-4 h-4 animate-spin" /> {log.status === 'uploaded' ? 'Queued...' : 'Extracting Text...'}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-text-secondary font-bold text-[12px]">
                              <CheckCircle2 className="w-4 h-4 text-[#006E1C]" /> Parsed Successfully
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Workable Modal */}
      <Modal
        isOpen={isWorkableModalOpen}
        onClose={() => setIsWorkableModalOpen(false)}
        title="Import from Workable"
        maxWidth="max-w-2xl"
      >
        <div className="flex flex-col gap-5 py-2 w-[550px] max-w-full">
          {!importStatus ? (
            <>
              <div className="bg-[#E1F5FE] border border-[#B3E5FC] rounded-xl p-4 text-[#0277BD]">
                <p className="text-sm font-bold flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 shrink-0" /> How this works
                </p>
                <ol className="text-xs space-y-1 list-decimal list-inside font-medium ml-1">
                  <li>We connect to your Workable account using your API key.</li>
                  <li>Candidates with a CV/resume attached are downloaded.</li>
                  <li>CVs are extracted and processed with AI (name, skills, experience).</li>
                  <li>Up to 10 new candidates will be imported in a single run.</li>
                </ol>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-text-primary flex items-center gap-2 mb-1.5">
                    <Building2 className="w-4 h-4 text-text-secondary" /> Workable subdomain
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
                    <Key className="w-4 h-4 text-text-secondary" /> API key
                  </label>
                  <input
                    type="password"
                    placeholder="your-workable-api-key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="text-text-primary bg-background text-[13px] py-2 px-3 rounded-md border border-border w-full focus:outline-none focus:border-primary-container"
                  />
                </div>
                
                <div className="pt-2 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsWorkableModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleWorkableImport} disabled={isWorkableImporting}>
                    {isWorkableImporting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Starting...</> : "Start Import"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-surface rounded-xl p-2 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[15px] font-bold text-text-primary">Import Progress</h2>
                {importStatus.status === "running" && (
                  <div className="flex items-center gap-1.5 bg-[#E8F5E9] text-[#1B5E20] px-2.5 py-1 rounded-md border border-[#C8E6C9]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-wider">Running</span>
                  </div>
                )}
                {importStatus.status === "stopped" && (
                  <div className="flex items-center gap-1.5 bg-[#FFF3E0] text-[#E65100] px-2.5 py-1 rounded-md border border-[#FFE0B2]">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Stopped</span>
                  </div>
                )}
                {importStatus.status === "done" && (
                  <div className="flex items-center gap-1.5 bg-[#E8F5E9] text-[#1B5E20] px-2.5 py-1 rounded-md border border-[#C8E6C9]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Complete</span>
                  </div>
                )}
                {importStatus.status === "error" && (
                  <div className="flex items-center gap-1.5 bg-[#FFEBEE] text-[#D32F2F] px-2.5 py-1 rounded-md border border-[#FFCDD2]">
                    <XCircle className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Error</span>
                  </div>
                )}
              </div>

              {importStatus.totalCandidates > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs font-bold text-text-secondary">
                    <span>Overall progress</span>
                    <span>{totalProcessed.toLocaleString()} / {importStatus.totalCandidates.toLocaleString()}</span>
                  </div>
                  <ProgressBar value={totalProcessed} max={importStatus.totalCandidates} color="bg-[#006E1C]" />
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <StatBox label="Imported" value={importStatus.imported} icon={CheckCircle2} color="bg-[#E8F5E9] text-[#1B5E20]" />
                <StatBox label="Duplicates" value={importStatus.deduplicated} icon={Copy} color="bg-[#E1F5FE] text-[#0277BD]" />
                <StatBox label="Skipped" value={importStatus.skipped} icon={SkipForward} color="bg-[#FFF3E0] text-[#E65100]" />
                <StatBox label="Failed" value={importStatus.failed} icon={XCircle} color="bg-[#FFEBEE] text-[#D32F2F]" />
              </div>

              {importStatus.errorMessage && importStatus.status === "error" && (
                <div className="flex items-start gap-2 bg-[#FFEBEE] border border-[#FFCDD2] rounded-lg p-3 text-xs font-medium text-[#D32F2F] mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {importStatus.errorMessage}
                </div>
              )}

              {importStatus.status === "running" && (
                <div className="pt-2 flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-text-secondary">Import is running in the background.</p>
                  <button onClick={handleStopWorkable} className="flex items-center gap-1.5 bg-[#FFEBEE] hover:bg-[#FFCDD2] text-[#D32F2F] py-1.5 px-3 rounded-lg border border-[#FFCDD2]">
                    <XCircle className="w-3.5 h-3.5" /> <span className="text-xs font-bold">Stop</span>
                  </button>
                </div>
              )}

              {importStatus.status === "stopped" && (
                <div className="pt-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-bold text-text-primary">Import stopped</p>
                  </div>
                  <button onClick={handleRetryWorkable} disabled={isWorkableImporting} className="flex items-center bg-primary-container text-on-primary py-1.5 px-3 rounded-lg">
                    {isWorkableImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" fill="currentColor" />}
                    <span className="text-[13px] font-bold ml-1">Resume</span>
                  </button>
                </div>
              )}

              {importStatus.status === "error" && (
                <div className="pt-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-bold text-text-primary">Import failed</p>
                  </div>
                  <button onClick={handleRetryWorkable} disabled={isWorkableImporting} className="flex items-center bg-primary-container text-on-primary py-1.5 px-3 rounded-lg">
                    {isWorkableImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span className="text-[13px] font-bold ml-1">Retry</span>
                  </button>
                </div>
              )}

              {importStatus.status === "done" && (
                <div className="pt-2 space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-[14px] font-bold text-text-primary">Import complete!</p>
                    <button onClick={() => setImportStatus(null)} className="bg-surface-container-high py-1.5 px-3 rounded-lg text-[12px] font-bold">
                      Start New Import
                    </button>
                  </div>
                  {importStatus.skipped > 0 && (
                    <div className="flex items-center justify-between gap-3 bg-[#FFF3E0] border border-[#FFE0B2] rounded-lg p-2.5">
                      <p className="text-xs font-bold text-[#E65100]">Skipped candidates (no CV).</p>
                      <button onClick={handleRetrySkipped} disabled={isWorkableImporting} className="flex items-center gap-1.5 text-[#E65100]">
                        {isWorkableImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        <span className="text-[11px] font-bold">Retry Skipped</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-border pt-4 mt-2">
                <button onClick={handleClearHistory} className="text-[#D32F2F] text-xs font-bold flex items-center gap-1 hover:underline">
                  <XCircle className="w-3.5 h-3.5" /> Clear History
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Manual Upload Modal */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => { setIsManualModalOpen(false); setFiles([]); setSource("Manual"); setCampaignLabel(""); setAssignToJob(""); }}
        title="Manual Bulk Upload"
        maxWidth="max-w-4xl"
        footer={
          <>
            <Button variant="outline" onClick={() => { setIsManualModalOpen(false); setFiles([]); setSource("Manual"); setCampaignLabel(""); setAssignToJob(""); }}>Cancel</Button>
            <Button onClick={handleManualUpload} disabled={files.length === 0 || isUploading}>
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isUploading ? "Uploading..." : "Upload Files"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col md:flex-row gap-6 py-2 min-w-[300px] md:min-w-[700px]">
          {/* Left Side - File Uploader */}
          <div className="flex-1 flex flex-col gap-4">
            <div 
              className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg bg-surface-container-low cursor-pointer hover:bg-surface-container-high transition-colors h-40"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload className="w-8 h-8 text-text-secondary mb-2" />
              <p className="text-sm font-medium text-text-primary">Drag & drop CV files here</p>
              <p className="text-xs text-text-secondary mt-1 mb-4">Support PDF, DOCX, PNG</p>
              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>Select Files</Button>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={handleFileSelect} />
            </div>
            
            {files.length > 0 && (
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-2 bg-surface border border-border p-3 rounded-lg shadow-sm">
                <span className="text-xs font-bold text-text-secondary mb-1">Selected Files ({files.length})</span>
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-surface-container-low p-2 rounded-md border border-border">
                    <span className="text-[13px] text-text-primary truncate" title={f.name}>{f.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter((_, idx) => idx !== i)); }} className="text-[#BA1A1A] hover:bg-red-50 p-1 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Side - Tagging */}
          <div className="w-full md:w-[280px] shrink-0 bg-surface border border-border rounded-lg p-5 shadow-sm flex flex-col gap-4 h-fit">
            <span className="text-xs font-bold text-text-secondary border-b border-border pb-2">TAG THIS UPLOAD</span>
            
            <div className="flex flex-col gap-1 w-full relative">
              <span className="text-text-disabled text-[11px] font-bold">CV SOURCE</span>
              <div className="w-full relative">
                <div
                  className="flex items-center bg-surface rounded-md border border-border w-full cursor-pointer hover:bg-surface-container-high py-[9px] px-3"
                  onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                >
                  <span className={`text-[13px] ${source ? "text-text-primary" : "text-text-disabled"}`}>
                    {source || "Select Source..."}
                  </span>
                </div>
                {showSourceDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-surface rounded-md border border-border shadow-lg z-10 max-h-40 overflow-y-auto">
                    {SOURCE_OPTIONS.map((opt) => (
                      <div
                        key={opt}
                        className="py-2 px-[13px] text-[13px] text-text-primary hover:bg-background cursor-pointer"
                        onClick={() => { setSource(opt); setShowSourceDropdown(false); }}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1 w-full">
              <span className="text-text-disabled text-[11px] font-bold">CAMPAIGN LABEL</span>
              <input
                type="text"
                placeholder="e.g. Q4 Hiring Sprint"
                value={campaignLabel}
                onChange={(e) => setCampaignLabel(e.target.value)}
                className="text-text-primary bg-surface text-[13px] py-[9px] px-3 rounded-md border border-border w-full focus:outline-none focus:border-primary-container"
              />
            </div>

            <div className="flex flex-col gap-1 w-full">
              <span className="text-text-disabled text-[11px] font-bold">ASSIGN TO JOB</span>
              <input
                type="text"
                placeholder="Search open roles..."
                value={assignToJob}
                onChange={(e) => setAssignToJob(e.target.value)}
                className="text-text-primary bg-surface text-[13px] py-[9px] px-3 rounded-md border border-border w-full focus:outline-none focus:border-primary-container"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
