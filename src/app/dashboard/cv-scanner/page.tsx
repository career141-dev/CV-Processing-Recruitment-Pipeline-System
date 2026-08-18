"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ScanCvPreviewModal } from "@/components/cvScanner/ScanCvPreviewModal";
import {
  UploadCloud,
  FileText,
  Search,
  Sparkles,
  UserPlus,
  RefreshCw,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  Eye,
  FileCheck,
} from "lucide-react";

export default function CvScannerPage() {
  const [scanTitle, setScanTitle] = useState("");
  const [criteriaInput, setCriteriaInput] = useState("");
  const [criteriaList, setCriteriaList] = useState<string[]>([
    "Worked in Business Development (BD) previously",
  ]);

  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeScanId, setActiveScanId] = useState<Id<"cvScans"> | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "matches" | "non_matches">("all");
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [promotedIds, setPromotedIds] = useState<Record<string, boolean>>({});

  // CV Preview Modal State
  const [previewResultId, setPreviewResultId] = useState<Id<"cvScanResults"> | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>("");
  const [previewCandidateName, setPreviewCandidateName] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  const generateConvexUploadUrl = useMutation(api.cvs.cvUploads.generateUploadUrl);
  const generateR2UploadUrl = useAction(api.storage.r2.generateUploadUrl);
  const createScan = useMutation(api.cvScanner.scanMutations.createScan);
  const triggerScanBatch = useAction(api.cvScanner.scanActions.triggerScanBatch);
  const promoteCandidateToDb = useMutation(api.cvScanner.scanMutations.promoteCandidateToDb);

  const scanSession = useQuery(
    api.cvScanner.scanMutations.getScanSession,
    activeScanId ? { scanId: activeScanId } : "skip"
  );

  const scanResults = useQuery(
    api.cvScanner.scanMutations.getScanResults,
    activeScanId ? { scanId: activeScanId } : "skip"
  );

  const userScans = useQuery(api.cvScanner.scanMutations.getUserScans, { limit: 10 });

  const openPreview = (result: any) => {
    setPreviewResultId(result._id);
    setPreviewFileName(result.fileName);
    setPreviewCandidateName(result.candidateName || result.fileName);
    setIsPreviewOpen(true);
  };

  const addCriterion = () => {
    const trimmed = criteriaInput.trim();
    if (!trimmed) return;
    if (criteriaList.includes(trimmed)) {
      toast.error("Criterion already added");
      return;
    }
    setCriteriaList([...criteriaList, trimmed]);
    setCriteriaInput("");
  };

  const removeCriterion = (index: number) => {
    setCriteriaList(criteriaList.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      if (selected.length > 50) {
        toast.error("Maximum 50 files allowed per scan session.");
        setFiles(selected.slice(0, 50));
      } else {
        setFiles(selected);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const selected = Array.from(e.dataTransfer.files);
      if (selected.length > 50) {
        toast.error("Maximum 50 files allowed per scan session.");
        setFiles(selected.slice(0, 50));
      } else {
        setFiles(selected);
      }
    }
  };

  const handleStartScan = async () => {
    if (files.length === 0) {
      toast.error("Please upload at least one CV file.");
      return;
    }
    if (criteriaList.length === 0) {
      toast.error("Please specify at least one search criterion or keyword.");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${files.length} CVs to scanner...`);

    try {
      const uploadedFilesInfo: Array<{
        fileStorageId?: Id<"_storage">;
        s3Key?: string;
        fileName: string;
        fileSize: number;
        fileType: string;
      }> = [];

      const uploadSingleFileWithRetry = async (file: File, maxRetries = 3) => {
        let lastErr: any;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          if (attempt <= 2) {
            try {
              const r2Result = await generateR2UploadUrl({
                fileName: file.name,
                contentType: file.type || "application/pdf",
              });
              const res = await fetch(r2Result.url, {
                method: "PUT",
                headers: { "Content-Type": file.type || "application/pdf" },
                body: file,
              });

              if (!res.ok) {
                throw new Error(`R2 upload HTTP ${res.status} ${res.statusText}`);
              }

              return {
                s3Key: r2Result.key,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.name.split(".").pop() || "pdf",
              };
            } catch (r2Err: any) {
              lastErr = r2Err;
              console.warn(`[R2 Upload Attempt ${attempt}/${maxRetries}] Failed for file "${file.name}":`, r2Err?.message || r2Err);
            }
          }

          try {
            const uploadUrl = await generateConvexUploadUrl();
            const res = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": file.type || "application/pdf" },
              body: file,
            });

            if (!res.ok) {
              throw new Error(`Convex storage HTTP ${res.status} ${res.statusText}`);
            }

            const { storageId } = await res.json();
            return {
              fileStorageId: storageId as Id<"_storage">,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.name.split(".").pop() || "pdf",
            };
          } catch (convexErr: any) {
            lastErr = convexErr;
            console.warn(`[Convex Storage Attempt ${attempt}/${maxRetries}] Failed for file "${file.name}":`, convexErr?.message || convexErr);
            if (attempt < maxRetries) {
              await new Promise((r) => setTimeout(r, attempt * 500));
            }
          }
        }
        throw new Error(`Failed to upload ${file.name} after ${maxRetries} attempts: ${lastErr?.message || String(lastErr)}`);
      };

      const chunkSize = 3;
      for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize);
        toast.loading(`Uploading CVs (${Math.min(i + chunkSize, files.length)}/${files.length})...`, { id: toastId });

        const chunkResults = await Promise.all(
          chunk.map((file) => uploadSingleFileWithRetry(file))
        );
        uploadedFilesInfo.push(...chunkResults);
      }

      toast.loading("Initializing DeepSeek scanning job...", { id: toastId });

      const { scanId } = await createScan({
        title: scanTitle.trim() || `Scan: ${criteriaList[0]} (${files.length} CVs)`,
        criteria: criteriaList,
        files: uploadedFilesInfo,
      });

      setActiveScanId(scanId);
      await triggerScanBatch({ scanId });

      toast.success("Scan started! Results will populate in real time.", { id: toastId });
      setFiles([]);
    } catch (err: any) {
      console.error("Scan initialization error:", err);
      toast.error(`Scan failed to start: ${err.message || String(err)}`, { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handlePromoteCandidate = async (resultId: Id<"cvScanResults">) => {
    try {
      setPromotedIds((prev) => ({ ...prev, [resultId]: true }));
      await promoteCandidateToDb({ resultId });
      toast.success("Candidate saved to Candidate Database!");
    } catch (err: any) {
      toast.error(`Failed to save candidate: ${err.message || String(err)}`);
      setPromotedIds((prev) => ({ ...prev, [resultId]: false }));
    }
  };

  const filteredResults = (scanResults || []).filter((res: any) => {
    if (activeFilter === "matches") return res.isMatch;
    if (activeFilter === "non_matches") return !res.isMatch && res.status === "completed";
    return true;
  });

  const processedCount = scanSession?.processedFiles || 0;
  const totalCount = scanSession?.totalFiles || 0;
  const progressPercent = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 md:p-8 transition-colors duration-300">
      {/* Header Banner */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm dark:shadow-xl backdrop-blur-md">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-600 dark:from-white dark:via-slate-200 dark:to-emerald-400 bg-clip-text text-transparent">
                Quick CV Scanner
              </h1>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base max-w-2xl">
              Upload up to 50 CVs and queue custom criteria (e.g. <span className="text-emerald-600 dark:text-emerald-300 italic font-medium">&quot;Worked in BD previously&quot;</span>). DeepSeek evaluates each CV and presents ranked match results with verifiable evidence quotes.
            </p>
          </div>

          {userScans && userScans.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Recent Scans:</span>
              <select
                onChange={(e) => setActiveScanId(e.target.value ? (e.target.value as Id<"cvScans">) : null)}
                value={activeScanId || ""}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-colors"
              >
                <option value="">-- Select Past Scan --</option>
                {userScans.map((s: any) => (
                  <option key={s._id} value={s._id}>
                    {s.title} ({s.matchedFiles}/{s.totalFiles} matched)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload & Criteria Panel */}
        <div className="lg:col-span-5 space-y-6">
          {/* Section 1: Target Criteria Queue */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-lg backdrop-blur-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              1. Target Keywords & Criteria
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Add specific experience requirements, skills, or prior roles to check across the uploaded batch.
            </p>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={criteriaInput}
                onChange={(e) => setCriteriaInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCriterion()}
                placeholder="e.g. Worked in BD previously"
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <button
                onClick={addCriterion}
                type="button"
                className="bg-emerald-600 hover:bg-emerald-500 text-white p-2.5 rounded-xl font-medium text-sm flex items-center gap-1 transition-all shadow-md shadow-emerald-950/20 dark:shadow-emerald-950/50"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Criteria Queue Tags */}
            <div className="flex flex-wrap gap-2 min-h-[48px] p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
              {criteriaList.length === 0 ? (
                <span className="text-xs text-slate-400 dark:text-slate-500 italic">No criteria added yet.</span>
              ) : (
                criteriaList.map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  >
                    {c}
                    <button
                      onClick={() => removeCriterion(i)}
                      className="hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Section 2: Batch Upload Box */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-lg backdrop-blur-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              2. Upload CV Batch (Max 50)
            </h2>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 transition-all rounded-2xl p-6 text-center bg-slate-50/50 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-950/70 group cursor-pointer"
            >
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
                id="cv-scanner-upload-input"
              />
              <label htmlFor="cv-scanner-upload-input" className="cursor-pointer block">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Click or drag CV files here to upload
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Supports PDF, DOCX, PNG, JPG (up to 50 files)
                </p>
              </label>
            </div>

            {/* Selected File List */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span>Selected Files ({files.length})</span>
                  <button
                    onClick={() => setFiles([])}
                    className="text-red-500 hover:text-red-600 dark:text-red-400 text-xs"
                  >
                    Clear All
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs bg-slate-100 dark:bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300"
                    >
                      <span className="truncate max-w-[240px] font-medium">{f.name}</span>
                      <span className="text-slate-500 dark:text-slate-500">{(f.size / 1024).toFixed(0)} KB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Scan Title */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Scan Session Name (Optional)
              </label>
              <input
                type="text"
                value={scanTitle}
                onChange={(e) => setScanTitle(e.target.value)}
                placeholder="e.g. Senior BD Candidate Scan - Batch 1"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Submit Action Button */}
            <button
              onClick={handleStartScan}
              disabled={isUploading || files.length === 0 || criteriaList.length === 0}
              className="mt-5 w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-300 disabled:to-slate-400 dark:disabled:from-slate-800 dark:disabled:to-slate-900 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md shadow-emerald-950/20 dark:shadow-emerald-950/60 flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Uploading & Scanning...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Run DeepSeek Scan ({files.length} CVs)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Scan Results */}
        <div className="lg:col-span-7 space-y-6">
          {!scanSession ? (
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 dark:text-slate-500 shadow-sm">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-300 mb-1">No Active Scan Session Selected</h3>
              <p className="text-sm max-w-md mx-auto text-slate-500 dark:text-slate-400">
                Upload a batch of CVs on the left and click <span className="text-emerald-600 dark:text-emerald-400 font-semibold">&quot;Run DeepSeek Scan&quot;</span> to view ranked results here.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl backdrop-blur-md">
              {/* Scan Status Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{scanSession.title}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Target Criteria: {scanSession.criteria.join(" • ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Status</span>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider inline-block mt-0.5 ${
                        scanSession.status === "completed"
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40"
                          : scanSession.status === "processing"
                          ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 animate-pulse"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {scanSession.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center text-xs font-semibold mb-2">
                  <span className="text-slate-700 dark:text-slate-300">
                    Scanning Progress: {processedCount} / {totalCount} CVs Processed
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  <span>Matched CVs: <strong className="text-emerald-600 dark:text-emerald-400">{scanSession.matchedFiles}</strong></span>
                  <span>Non-Matches: <strong>{processedCount - scanSession.matchedFiles}</strong></span>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 gap-1 text-xs">
                  <button
                    onClick={() => setActiveFilter("all")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      activeFilter === "all"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    All ({scanResults?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveFilter("matches")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      activeFilter === "matches"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    Matched Only ({scanResults?.filter((r: any) => r.isMatch).length || 0})
                  </button>
                  <button
                    onClick={() => setActiveFilter("non_matches")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      activeFilter === "non_matches"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    Non-Matches ({scanResults?.filter((r: any) => !r.isMatch && r.status === "completed").length || 0})
                  </button>
                </div>
              </div>

              {/* Results List */}
              <div className="space-y-4">
                {filteredResults.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs italic">
                    No scan results matching the selected filter yet.
                  </div>
                ) : (
                  filteredResults.map((result: any) => {
                    const isExpanded = expandedResultId === result._id;
                    const isPromoted = promotedIds[result._id] || !!result.promotedCandidateId;

                    return (
                      <div
                        key={result._id}
                        className={`border rounded-xl transition-all overflow-hidden ${
                          result.isMatch
                            ? "bg-slate-50/80 dark:bg-slate-900/90 border-emerald-400/50 dark:border-emerald-500/30 hover:border-emerald-500 shadow-sm"
                            : "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        {/* Summary Bar */}
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                                result.matchScore >= 60
                                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40"
                                  : result.matchScore >= 40
                                  ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/40"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700"
                              }`}
                            >
                              {result.status === "processing" ? (
                                <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                              ) : (
                                `${result.matchScore}%`
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                  {result.candidateName || result.fileName}
                                </h4>
                                {result.isMatch && (
                                  <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Match
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {result.currentTitle || result.fileName} {result.email ? `• ${result.email}` : ""}
                              </p>

                              {/* Matched Criteria Badges */}
                              {result.matchedCriteria && result.matchedCriteria.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {result.matchedCriteria.map((mc: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="text-[10px] bg-emerald-50 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 px-2 py-0.5 rounded font-medium"
                                    >
                                      ✓ {mc}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {/* View Original CV Popup Button */}
                            <button
                              onClick={() => openPreview(result)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 shadow-sm"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              View CV
                            </button>

                            {/* Save to DB Promotion Button */}
                            <button
                              onClick={() => handlePromoteCandidate(result._id)}
                              disabled={isPromoted || result.status !== "completed"}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                                isPromoted
                                  ? "bg-slate-200 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border-slate-300 dark:border-slate-700 opacity-80"
                                  : "bg-emerald-700 dark:bg-emerald-950 hover:bg-emerald-600 dark:hover:bg-emerald-900 text-white dark:text-emerald-300 border-emerald-600 dark:border-emerald-500/40"
                              }`}
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              {isPromoted ? "Saved to DB" : "Save Candidate"}
                            </button>

                            {/* Expand Drawer Toggle */}
                            <button
                              onClick={() => setExpandedResultId(isExpanded ? null : result._id)}
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-300 dark:border-slate-700 transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Details Drawer */}
                        {isExpanded && (
                          <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 p-4 space-y-4 text-xs">
                            {/* DeepSeek Reasoning */}
                            <div>
                              <h5 className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                                DeepSeek Evaluation Summary
                              </h5>
                              <p className="text-slate-800 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                                {result.reasoning || "No detailed summary available."}
                              </p>
                            </div>

                            {/* Verifiable Evidence Quotes */}
                            <div>
                              <h5 className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-2 flex items-center gap-1.5">
                                Verifiable Evidence Quotes from CV Text
                              </h5>
                              {!result.evidenceQuotes || result.evidenceQuotes.length === 0 ? (
                                <p className="text-slate-400 dark:text-slate-500 italic">No evidence quotes extracted.</p>
                              ) : (
                                <div className="space-y-2">
                                  {result.evidenceQuotes.map((eq: any, qIdx: number) => (
                                    <div
                                      key={qIdx}
                                      className="p-2.5 rounded-xl border bg-white dark:bg-slate-900/90 flex items-start gap-2 border-slate-200 dark:border-slate-800"
                                    >
                                      {eq.isVerifiedQuote ? (
                                        <span className="p-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-lg shrink-0 border border-emerald-300 dark:border-emerald-500/30" title="Verbatim CV Substring Verified">
                                          <ShieldCheck className="w-3.5 h-3.5" />
                                        </span>
                                      ) : (
                                        <span className="p-1 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 rounded-lg shrink-0 border border-amber-300 dark:border-amber-500/30" title="Unverified Quote / Paraphrased">
                                          <ShieldAlert className="w-3.5 h-3.5" />
                                        </span>
                                      )}
                                      <p className="text-slate-800 dark:text-slate-200 font-mono text-[11px] leading-relaxed">
                                        &quot;{eq.quote}&quot;
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Criterion Confidence Scores Table */}
                            {result.criterionScores && result.criterionScores.length > 0 && (
                              <div>
                                <h5 className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-2">
                                  Per-Criterion Match Confidence
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {result.criterionScores.map((cs: any, cIdx: number) => (
                                    <div
                                      key={cIdx}
                                      className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                                    >
                                      <span className="text-slate-800 dark:text-slate-300 truncate font-medium max-w-[200px]">
                                        {cs.criterion}
                                      </span>
                                      <span
                                        className={`font-mono font-bold text-xs ${
                                          cs.score >= 60 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
                                        }`}
                                      >
                                        {cs.score}%
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CV Document Preview Modal */}
      <ScanCvPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        resultId={previewResultId}
        fileName={previewFileName}
        candidateName={previewCandidateName}
      />
    </div>
  );
}
