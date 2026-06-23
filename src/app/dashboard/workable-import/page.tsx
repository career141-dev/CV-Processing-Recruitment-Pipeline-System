"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { 
  Building2, Key, CheckCircle2, AlertCircle, Loader2,
  SkipForward, XCircle, ExternalLink, Info, RotateCcw, Play, Copy 
} from "lucide-react";

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

export default function WorkableImportPage() {
  const { user } = useUser();
  const [subdomain, setSubdomain] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const testConnection = useAction(api.integrations.workableActions.testConnection);
  const startBulkImport = useAction(api.integrations.workableActions.startBulkImport);
  const getLatestImportStatus = useAction(api.integrations.workableActions.getLatestImportStatus);
  const getImportStatus = useAction(api.integrations.workableActions.getImportStatus);
  const retryImport = useAction(api.integrations.workableActions.retryImport);
  const retrySkippedAction = useAction(api.integrations.workableActions.retrySkipped);
  const stopImport = useAction(api.integrations.workableActions.stopImport);
  const clearImportHistory = useMutation(api.integrations.workable.clearImportHistory);

  useEffect(() => {
    if (!user?.id) return;
    getLatestImportStatus({ userId: user.id })
      .then((status) => {
        if (status) {
          setImportStatus(status as ImportStatus);
          if (status.subdomain) setSubdomain(status.subdomain);
          if (status.status === "running") startPolling(status._id);
        }
      })
      .finally(() => setIsRestoring(false));
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
          setIsImporting(false);
        }
      }
    }, 3000);
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleTestConnection = async () => {
    if (!subdomain || !apiKey) return toast.error("Please enter both subdomain and API key");
    setIsTesting(true);
    try {
      const result = await testConnection({ subdomain, apiKey });
      if (result.ok) {
        setIsConnected(true);
        toast.success("Connected to Workable successfully!");
      } else {
        toast.error(result.error ?? "Connection failed");
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleStartImport = async () => {
    if (!subdomain || !apiKey || !user?.id) return toast.error("Please enter both subdomain and API key");
    setIsImporting(true);
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
      toast.success("Import started! Processing candidates in the background.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start import");
      setIsImporting(false);
    }
  };

  const handleRetry = async () => {
    if (!importStatus) return;
    setIsImporting(true);
    try {
      await retryImport({ importId: importStatus._id as any, subdomain: subdomain || undefined, apiKey: apiKey || undefined });
      setImportStatus((prev) => prev ? { ...prev, status: "running", errorMessage: "" } : prev);
      startPolling(importStatus._id);
      toast.info("Import retrying from where it left off.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry");
      setIsImporting(false);
    }
  };

  const handleRetrySkipped = async () => {
    if (!importStatus) return;
    setIsImporting(true);
    try {
      await retrySkippedAction({ importId: importStatus._id as any, subdomain: subdomain || undefined, apiKey: apiKey || undefined });
      setImportStatus((prev) => prev ? { ...prev, status: "running", errorMessage: "", skipped: 0, failed: 0 } : prev);
      startPolling(importStatus._id);
      toast.info("Retrying skipped candidates from the beginning. Already-imported CVs will be skipped automatically.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry skipped");
      setIsImporting(false);
    }
  };

  const handleStop = async () => {
    if (!importStatus) return;
    try {
      await stopImport({ importId: importStatus._id as any });
      setImportStatus((prev) => prev ? { ...prev, status: "stopped" } : prev);
      setIsImporting(false);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      toast.info("Import stopped. You can resume it later.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to stop import");
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("⚠️ This will permanently delete your import job history. Are you sure?")) return;
    try {
      await clearImportHistory();
      toast.success("Import history cleared");
      setImportStatus(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cleanup failed");
    }
  };

  const totalProcessed = importStatus
    ? importStatus.imported + importStatus.skipped + importStatus.deduplicated + importStatus.failed
    : 0;

  return (
    <div className="flex flex-col bg-surface w-full">
      <div className="self-stretch bg-surface px-8 md:px-[114px] pt-10">
        <div className="flex flex-col self-stretch bg-background max-w-[1052px] pb-[499px] gap-6 rounded-t-[10px]">
          <div className="flex justify-between items-center self-stretch bg-[#F8FAF2] py-[11px] px-[23px] ml-[13px] rounded-t-[10px]">
            <div className="flex shrink-0 items-center gap-4">
              <span className="text-on-primary-fixed text-2xl font-bold">Workable Import</span>
            </div>
          </div>
          <div className="flex flex-col self-stretch mx-8 md:mx-[71px] gap-8">
            <div className="flex flex-col items-start self-stretch">
              <span className="text-text-primary text-2xl font-bold">Import from Workable</span>
              <span className="text-text-secondary text-[13px] mt-1">Bulk import candidates and their CVs from Workable into this system. Limited to 100 CVs per run for testing.</span>
            </div>

            {isRestoring ? (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking import status...
              </div>
            ) : (
              <div className="flex flex-col gap-6 w-full max-w-3xl">
                {/* How it works */}
                <div className="bg-[#E1F5FE] border border-[#B3E5FC] rounded-xl p-5 text-[#0277BD]">
                  <p className="text-sm font-bold flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 shrink-0" /> How this works
                  </p>
                  <ol className="text-xs space-y-1 list-decimal list-inside font-medium ml-1">
                    <li>We connect to your Workable account using your API key.</li>
                    <li>Candidates with a CV/resume attached are downloaded.</li>
                    <li>CVs are extracted and processed with AI (name, skills, experience).</li>
                    <li>Up to 100 new candidates will be imported in a single run.</li>
                  </ol>
                </div>

                {/* Credentials */}
                <div className="bg-surface border border-border rounded-xl p-5 space-y-5 shadow-sm">
                  <div>
                    <label className="text-sm font-bold text-text-primary flex items-center gap-2 mb-1.5">
                      <Building2 className="w-4 h-4 text-text-secondary" /> Workable subdomain
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={subdomain}
                        onChange={(e) => { setSubdomain(e.target.value); setIsConnected(false); }}
                        placeholder="mycompany"
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
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); setIsConnected(false); }}
                      placeholder="your-workable-api-key"
                      className="text-text-primary bg-background text-[13px] py-2 px-3 rounded-md border border-border w-full focus:outline-none focus:border-primary-container"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-border mt-4">
                    <button
                      onClick={handleTestConnection}
                      disabled={isTesting || !subdomain || !apiKey}
                      className="flex items-center bg-surface-container-high hover:bg-surface-container-highest transition-colors text-text-primary py-2 px-4 gap-2 rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isTesting ? <Loader2 className="w-4 h-4 animate-spin text-text-secondary" /> : null}
                      <span className="text-[13px] font-bold">Test connection</span>
                    </button>
                    {isConnected && (
                      <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#006E1C]">
                        <CheckCircle2 className="w-4 h-4" /> Connected
                      </span>
                    )}
                  </div>
                </div>

                {/* Start import button */}
                {isConnected && !importStatus && (
                  <button
                    onClick={handleStartImport}
                    disabled={isImporting}
                    className="flex items-center bg-primary-container hover:bg-[#144718] transition-colors text-left py-3 px-6 gap-2 rounded-lg w-full justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImporting ? (
                      <><Loader2 className="w-4 h-4 animate-spin text-on-primary" /><span className="text-on-primary text-sm font-bold">Starting...</span></>
                    ) : (
                      <><Play className="w-4 h-4 text-on-primary" fill="currentColor" /><span className="text-on-primary text-sm font-bold">Start Import (100 CVs max)</span></>
                    )}
                  </button>
                )}

                {/* Import progress */}
                {importStatus && (
                  <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
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
                      <div className="mb-6">
                        <div className="flex justify-between text-xs font-bold text-text-secondary">
                          <span>Overall progress</span>
                          <span>{totalProcessed.toLocaleString()} / {importStatus.totalCandidates.toLocaleString()}</span>
                        </div>
                        <ProgressBar value={totalProcessed} max={importStatus.totalCandidates} color="bg-[#006E1C]" />
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                      <StatBox
                        label="Imported"
                        value={importStatus.imported}
                        icon={CheckCircle2}
                        color="bg-[#E8F5E9] text-[#1B5E20]"
                      />
                      <StatBox
                        label="Duplicates"
                        value={importStatus.deduplicated}
                        icon={Copy}
                        color="bg-[#E1F5FE] text-[#0277BD]"
                      />
                      <StatBox
                        label="Skipped"
                        value={importStatus.skipped}
                        icon={SkipForward}
                        color="bg-[#FFF3E0] text-[#E65100]"
                      />
                      <StatBox
                        label="Failed"
                        value={importStatus.failed}
                        icon={XCircle}
                        color="bg-[#FFEBEE] text-[#D32F2F]"
                      />
                    </div>

                    {importStatus.errorMessage && importStatus.status === "error" && (
                      <div className="flex items-start gap-2 bg-[#FFEBEE] border border-[#FFCDD2] rounded-lg p-3 text-xs font-medium text-[#D32F2F] mb-5">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        {importStatus.errorMessage}
                      </div>
                    )}

                    {importStatus.status === "running" && (
                      <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                        <p className="text-[13px] font-medium text-text-secondary">Import is running in the background.</p>
                        <button
                          onClick={handleStop}
                          className="flex items-center gap-1.5 bg-[#FFEBEE] hover:bg-[#FFCDD2] transition-colors text-[#D32F2F] py-1.5 px-3 rounded-lg border border-[#FFCDD2]"
                        >
                          <XCircle className="w-3.5 h-3.5" /> <span className="text-xs font-bold">Stop Import</span>
                        </button>
                      </div>
                    )}

                    {importStatus.status === "stopped" && (
                      <div className="pt-4 border-t border-border space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[14px] font-bold text-text-primary">Import stopped</p>
                            <p className="text-[12px] font-medium text-text-secondary mt-0.5">Will continue from where it stopped.</p>
                          </div>
                          <button onClick={handleRetry} disabled={isImporting} className="flex items-center bg-primary-container hover:bg-[#144718] transition-colors text-on-primary py-2 px-4 gap-2 rounded-lg disabled:opacity-50">
                            {isImporting ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="text-[13px] font-bold">Resuming...</span></>
                            ) : (
                              <><Play className="w-3.5 h-3.5" fill="currentColor" /><span className="text-[13px] font-bold">Resume Import</span></>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {importStatus.status === "error" && (
                      <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-bold text-text-primary">Import failed</p>
                          <p className="text-[12px] font-medium text-text-secondary mt-0.5">
                            {importStatus.lastCursor ? "Will continue from where it stopped." : "Will restart from the beginning."}
                          </p>
                        </div>
                        <button onClick={handleRetry} disabled={isImporting} className="flex items-center bg-primary-container hover:bg-[#144718] transition-colors text-on-primary py-2 px-4 gap-2 rounded-lg disabled:opacity-50">
                          {isImporting ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="text-[13px] font-bold">Retrying...</span></>
                          ) : (
                            <><RotateCcw className="w-3.5 h-3.5" /><span className="text-[13px] font-bold">Retry Import</span></>
                          )}
                        </button>
                      </div>
                    )}

                    {importStatus.status === "done" && (
                      <div className="pt-4 border-t border-border space-y-4">
                        <div className="text-center">
                          <p className="text-[14px] font-bold text-text-primary">
                            Import complete! {importStatus.imported.toLocaleString()} CVs processed.
                          </p>
                          <button
                            className="mt-3 bg-surface-container-high hover:bg-surface-container-highest transition-colors text-text-primary py-2 px-4 rounded-lg border border-border text-[13px] font-bold"
                            onClick={() => { setImportStatus(null); }}
                          >
                            Start New Import
                          </button>
                        </div>
                        {importStatus.skipped > 0 && (
                          <div className="flex items-center justify-between gap-3 bg-[#FFF3E0] border border-[#FFE0B2] rounded-lg p-3">
                            <p className="text-xs font-bold text-[#E65100]">
                              {importStatus.skipped} candidates were skipped (no CV found).
                            </p>
                            <button onClick={handleRetrySkipped} disabled={isImporting} className="flex items-center gap-1.5 text-[#E65100] hover:text-[#BF360C] transition-colors">
                              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                              <span className="text-[11px] font-bold uppercase tracking-wide">Retry Skipped</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Danger zone */}
                <div className="border border-[#FFCDD2] bg-[#FFEBEE]/30 rounded-xl p-5 mt-4">
                  <p className="text-sm font-bold text-[#D32F2F] mb-3">Settings & Cleanup</p>
                  <p className="text-[13px] text-text-secondary font-medium mb-3">
                    Delete the import history. This will not delete the candidates or CVs, it only resets this screen.
                  </p>
                  <button onClick={handleClearHistory} className="flex items-center bg-[#FFEBEE] hover:bg-[#FFCDD2] transition-colors text-[#D32F2F] py-2 px-4 gap-2 rounded-lg border border-[#FFCDD2]">
                    <XCircle className="w-4 h-4" /> <span className="text-[13px] font-bold">Clear Import History</span>
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
