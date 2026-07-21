"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { 
  RefreshCw, Upload, AlertCircle, Loader2, CheckCircle2, Info, Building2, Key, 
  X, Play, RotateCcw, Copy, SkipForward, XCircle, Link2, Mail, MessageCircle, Share2, Activity,
  AlertTriangle
} from 'lucide-react';
import { ChannelStatusCard } from '@/components/ingestion-monitor/ChannelStatusCard';
import RealTimeBatchLog from "@/components/ingestion-monitor/RealTimeBatchLog";
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { toast } from 'sonner';

const SOURCE_OPTIONS = ["LinkedIn", "WhatsApp", "Meta", "Email", "Workable", "Manual", "Headhunting"];

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
  const stats = useQuery(api.stats.stats.getIngestionStats);
  const toggles = useQuery(api.admin.settings.getSystemSettings);
  const updateToggles = useMutation(api.admin.settings.updateChannelToggles);
  
  const resumeFailedUploads = useAction(api.cvs.cvExtraction.resumeFailedUploads);
  const startBatchExtraction = useAction(api.cvs.cvExtraction.startBatchExtraction);
  const activeBatchId = useQuery(api.cvs.batches.getLatestActiveBatch);
  
  const { user } = useUser();
  const startBulkImport = useAction(api.integrations.workableActions.startBulkImport);
  const retryImport = useAction(api.integrations.workableActions.retryImport);
  const retrySkippedAction = useAction(api.integrations.workableActions.retrySkipped);
  const stopImport = useAction(api.integrations.workableActions.stopImport);
  const clearImportHistory = useMutation(api.integrations.workable.clearImportHistory);

  // Reactive query for Workable import status
  const importStatus = useQuery(
    api.integrations.workable.getLatestImportStatus,
    user?.id ? { userId: user.id } : "skip"
  );

  const generateUploadUrl = useAction(api.storage.r2.generateUploadUrl);
  const saveUpload = useMutation(api.cvs.cvUploads.saveUpload);
  const createBatch = useMutation(api.cvs.batches.createBatch);
  const updateBatchProgress = useMutation(api.cvs.batches.updateBatchProgress);

  const [retrying, setRetrying] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'errors' | 'permanent' | 'activity'>('errors');
  
  // Workable State
  const [isWorkableModalOpen, setIsWorkableModalOpen] = useState(false);
  const [subdomain, setSubdomain] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isWorkableImporting, setIsWorkableImporting] = useState(false);

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

  // --- Workable Effects ---
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
      await startBulkImport({ subdomain, apiKey, userId: user.id });
      toast.success("Workable import started!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start import");
    } finally {
      setIsWorkableImporting(false);
    }
  };

  const handleRetryWorkable = async () => {
    if (!importStatus) return;
    setIsWorkableImporting(true);
    try {
      await retryImport({ importId: importStatus._id as any, subdomain: subdomain || undefined, apiKey: apiKey || undefined });
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
      await retrySkippedAction({ importId: importStatus._id as any, subdomain: subdomain || undefined, apiKey: apiKey || undefined });
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

  const handleManualUpload = async () => {
    if (files.length === 0 || !user?.id) return;
    
    const filesToUpload = [...files];
    const uploadSource = source || "Manual";
    const uploadCampaignLabel = campaignLabel;
    const uploadAssignToJob = assignToJob;

    setIsUploading(true);
    setIsManualModalOpen(false);
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
      setActiveTab('activity');

      for (const file of filesToUpload) {
        try {
          let { url: uploadUrl, key: s3Key } = await generateUploadUrl({ fileName: file.name, contentType: file.type });
          const resp = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
          
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
            status: "failed"
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
      setActiveTab('activity');
      await resumeFailedUploads({ batchId });
      toast.success("Retry queued! Background process started.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to queue retries.");
    } finally {
      setRetrying(false);
    }
  };

  const handleToggle = async (channel: 'whatsappIngestion' | 'emailIngestion', newValue: boolean) => {
    try {
      await updateToggles({ toggles: { ...toggles, [channel]: newValue } });
      toast.success(`${channel === 'whatsappIngestion' ? 'WhatsApp' : 'Email'} ingestion ${newValue ? 'resumed' : 'paused'}.`);
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
      const s = curr.source || 'Manual';
      if (!acc[s]) acc[s] = [];
      acc[s].push(curr);
      return acc;
    }, {});
  };

  const failedBySource = groupFailures(failedUploads);
  const failedRetryBySource = groupFailures(failedRetryUploads || []);

  const getStats = (channel: string) => statsBySource[channel] || { todayCount: 0, lastReceived: null };
  const getErrorCount = (channel: string) => {
    // Map standard channel names to the generic ones tracked in 'failedBySource'
    let searchKey = channel;
    if (channel === 'Career Portal / Web Form') searchKey = 'Link';
    if (channel === 'LinkedIn Inbox') searchKey = 'linkedin';
    
    const count1 = (failedBySource[searchKey] || []).length;
    const count2 = (failedRetryBySource[searchKey] || []).length;
    return count1 + count2;
  };

  const workableStats = getStats('Workable');
  const manualStats = getStats('Manual');
  const linkStats = getStats('Link');
  const emailStats = getStats('Email');
  const whatsappStats = getStats('WhatsApp');
  const metaStats = getStats('Meta');
  const linkedinStats = getStats('linkedin');

  const totalToday = 
    workableStats.todayCount + manualStats.todayCount + linkStats.todayCount + 
    emailStats.todayCount + whatsappStats.todayCount + metaStats.todayCount + linkedinStats.todayCount;
    
  const totalFailed = failedUploads.length + (failedRetryUploads?.length || 0);

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
            <div className="flex items-center gap-3 bg-surface px-4 py-2.5 rounded-lg border border-border shadow-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[11px] font-bold tracking-widest text-green-600 dark:text-green-400">LIVE SYNC</span>
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
                <Loader2 className={`w-5 h-5 ${activeBatchId ? 'animate-spin' : ''}`} />
              </div>
            </div>
          </div>
        </header>

        {/* Section B: Channel Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          <ChannelStatusCard
            title="Workable Sync"
            isSelected={selectedChannel === 'Workable'}
            onClick={() => setSelectedChannel(selectedChannel === 'Workable' ? null : 'Workable')}
            status={workableStats.lastReceived ? "Active" : "Awaiting Data"}
            statusColor={workableStats.lastReceived ? "text-blue-600 dark:text-blue-400" : "text-text-secondary"}
            icon={<RefreshCw size={18} />}
            pulse={!!activeUploads.find((u: any) => u.source === 'Workable')}
            errorCount={getErrorCount('Workable')}
            toggle={{ enabled: true, onChange: () => {}, disabled: true }}
            stats={[
              { label: 'CVs Uploaded Today', value: workableStats.todayCount.toString() },
              { label: 'Last received', value: formatTime(workableStats.lastReceived) }
            ]}
            actionButton={
              <button 
                onClick={(e) => { e.stopPropagation(); setIsWorkableModalOpen(true); }}
                className="w-full mt-1 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors"
              >
                Import Data
              </button>
            }
          />
          
          <ChannelStatusCard
            title="Direct-to (Manual)"
            isSelected={selectedChannel === 'Manual'}
            onClick={() => setSelectedChannel(selectedChannel === 'Manual' ? null : 'Manual')}
            status={manualStats.lastReceived ? "Active" : "Ready"}
            statusColor={manualStats.lastReceived ? "text-blue-500 dark:text-blue-400" : "text-text-secondary"}
            icon={<Upload size={18} />}
            pulse={!!activeUploads.find((u: any) => u.source === 'Manual' || !u.source)}
            errorCount={getErrorCount('Manual')}
            toggle={{ enabled: true, onChange: () => {}, disabled: true }}
            stats={[
              { label: 'CVs Uploaded Today', value: manualStats.todayCount.toString() },
              { label: 'Last Batch', value: formatTime(manualStats.lastReceived) }
            ]}
            actionButton={
              <button 
                onClick={(e) => { e.stopPropagation(); setIsManualModalOpen(true); }}
                className="w-full mt-1 py-1.5 text-xs font-semibold text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors"
              >
                Upload CVs
              </button>
            }
          />

          <ChannelStatusCard
            title="Email (Office 365)"
            isSelected={selectedChannel === 'Email'}
            onClick={() => setSelectedChannel(selectedChannel === 'Email' ? null : 'Email')}
            status={!toggles.emailIngestion ? "Paused" : emailStats.lastReceived ? "Active" : "Monitoring"}
            statusColor={!toggles.emailIngestion ? "text-amber-500 dark:text-amber-400" : emailStats.lastReceived ? "text-orange-500 dark:text-orange-400" : "text-text-secondary"}
            icon={<Mail size={18} />}
            pulse={!!activeUploads.find((u: any) => u.source === 'Email' || u.source === 'email_campaign')}
            errorCount={getErrorCount('Email')}
            toggle={{ 
              enabled: toggles.emailIngestion, 
              onChange: (v) => handleToggle('emailIngestion', v) 
            }}
            stats={[
              { label: 'CVs Received Today', value: emailStats.todayCount.toString() },
              { label: 'Last received', value: formatTime(emailStats.lastReceived) }
            ]}
          />

          <ChannelStatusCard
            title="WhatsApp (Meta API)"
            isSelected={selectedChannel === 'WhatsApp'}
            onClick={() => setSelectedChannel(selectedChannel === 'WhatsApp' ? null : 'WhatsApp')}
            status={!toggles.whatsappIngestion ? "Paused" : whatsappStats.lastReceived ? "Active" : "Monitoring"}
            statusColor={!toggles.whatsappIngestion ? "text-amber-500 dark:text-amber-400" : whatsappStats.lastReceived ? "text-green-600 dark:text-green-400" : "text-text-secondary"}
            icon={<MessageCircle size={18} />}
            pulse={!!activeUploads.find((u: any) => u.source === 'WhatsApp')}
            errorCount={getErrorCount('WhatsApp')}
            toggle={{ 
              enabled: toggles.whatsappIngestion, 
              onChange: (v) => handleToggle('whatsappIngestion', v) 
            }}
            stats={[
              { label: 'CVs Received Today', value: whatsappStats.todayCount.toString() },
              { label: 'Last received', value: formatTime(whatsappStats.lastReceived) }
            ]}
          />

          <ChannelStatusCard
            title="Career Portal / Web Form"
            isSelected={selectedChannel === 'Link'}
            onClick={() => setSelectedChannel(selectedChannel === 'Link' ? null : 'Link')}
            status={linkStats.lastReceived ? "Active" : "Monitoring"}
            statusColor={linkStats.lastReceived ? "text-emerald-600 dark:text-emerald-400" : "text-text-secondary"}
            icon={<Link2 size={18} />}
            pulse={!!activeUploads.find((u: any) => u.source === 'Link')}
            errorCount={getErrorCount('Career Portal / Web Form')}
            toggle={{ enabled: true, onChange: () => {}, disabled: true }}
            stats={[
              { label: 'CVs Uploaded Today', value: linkStats.todayCount.toString() },
              { label: 'Last received', value: formatTime(linkStats.lastReceived) }
            ]}
          />

          <ChannelStatusCard
            title="Meta Campaign"
            isSelected={selectedChannel === 'Meta'}
            onClick={() => setSelectedChannel(selectedChannel === 'Meta' ? null : 'Meta')}
            status={metaStats.lastReceived ? "Active" : "Monitoring"}
            statusColor={metaStats.lastReceived ? "text-blue-700 dark:text-blue-400" : "text-text-secondary"}
            icon={<Share2 size={18} />}
            pulse={!!activeUploads.find((u: any) => u.source === 'Meta')}
            errorCount={getErrorCount('Meta')}
            toggle={{ enabled: true, onChange: () => {}, disabled: true }}
            stats={[
              { label: 'CVs Captured Today', value: metaStats.todayCount.toString() },
              { label: 'Last received', value: formatTime(metaStats.lastReceived) }
            ]}
          />

          <ChannelStatusCard
            title="LinkedIn Inbox"
            isSelected={selectedChannel === 'linkedin'}
            onClick={() => setSelectedChannel(selectedChannel === 'linkedin' ? null : 'linkedin')}
            status={!toggles.emailIngestion ? "Paused" : linkedinStats.lastReceived ? "Active" : "Monitoring"}
            statusColor={!toggles.emailIngestion ? "text-amber-500 dark:text-amber-400" : linkedinStats.lastReceived ? "text-green-700 dark:text-green-400" : "text-text-secondary"}
            icon={
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                <rect x="2" y="9" width="4" height="12"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
            }
            pulse={!!activeUploads.find((u: any) => u.source === 'linkedin')}
            errorCount={getErrorCount('LinkedIn Inbox')}
            toggle={{ 
              enabled: toggles.emailIngestion, 
              onChange: (v) => handleToggle('emailIngestion', v),
            }}
            stats={[
              { label: 'CVs Received Today', value: linkedinStats.todayCount.toString() },
              { label: 'Last received', value: formatTime(linkedinStats.lastReceived) }
            ]}
          >
            <div className="mt-1 bg-green-50/50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-md px-2 py-1.5 text-[10px] text-green-700 dark:text-green-400 font-medium flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
              Polling <span className="font-bold truncate">linkedin@career141.com</span>
            </div>
          </ChannelStatusCard>
        </div>
        
        {/* Section C: Errors & Activity Panel */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col min-h-[400px]">
          {/* Tabs */}
          <div className="flex border-b border-border bg-surface-container-low px-2 pt-2 gap-1 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('errors')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === 'errors' 
                  ? 'bg-surface text-red-600 dark:text-red-400 border-x border-t border-border border-b-transparent shadow-[0_2px_0_0_#fff]' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface/50 border border-transparent'
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
              onClick={() => setActiveTab('permanent')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === 'permanent' 
                  ? 'bg-surface text-amber-700 dark:text-amber-400 border-x border-t border-border border-b-transparent shadow-[0_2px_0_0_#fff]' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface/50 border border-transparent'
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
              onClick={() => setActiveTab('activity')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === 'activity' 
                  ? 'bg-surface text-primary border-x border-t border-border border-b-transparent shadow-[0_2px_0_0_#fff]' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface/50 border border-transparent'
              }`}
            >
              <Activity className="w-4 h-4" />
              Activity Log
              {importBatchId && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse ml-1" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-5 flex-1 bg-surface">
            {activeTab === 'errors' && (
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
                              <p className="text-[13px] font-semibold text-text-primary truncate" title={f.fileName}>{f.fileName}</p>
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

            {activeTab === 'permanent' && (
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
                              <p className="text-[13px] font-semibold text-text-primary truncate" title={f.fileName}>{f.fileName}</p>
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

            {activeTab === 'activity' && (
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
                    <button onClick={handleClearHistory} className="bg-surface-container-high py-1.5 px-3 rounded-lg text-[12px] font-bold">
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
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-2 bg-surface border border-border p-3 rounded-lg shadow-sm custom-scrollbar">
                <span className="text-xs font-bold text-text-secondary mb-1">Selected Files ({files.length})</span>
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-surface-container-low p-2 rounded-md border border-border">
                    <span className="text-[13px] text-text-primary truncate" title={f.name}>{f.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter((_, idx) => idx !== i)); }} className="text-[#BA1A1A] hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded">
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
                  <div className="absolute top-full left-0 mt-1 w-full bg-surface rounded-md border border-border shadow-lg z-10 max-h-40 overflow-y-auto custom-scrollbar">
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
