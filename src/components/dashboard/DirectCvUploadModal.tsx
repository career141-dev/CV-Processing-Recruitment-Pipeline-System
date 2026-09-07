"use client";

import React, { useState, useRef } from "react";
import JSZip from "jszip";
import { useUser } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  X,
  Upload,
  FileText,
  Archive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  FolderPlus,
  Briefcase,
  Database,
  ArrowRight,
  Search,
} from "lucide-react";

interface DirectCvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultJobId?: string;
}

const VALID_EXTENSIONS = [".pdf", ".docx", ".doc", ".rtf", ".txt"];

export function DirectCvUploadModal({
  isOpen,
  onClose,
  defaultJobId,
}: DirectCvUploadModalProps) {
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [files, setFiles] = useState<File[]>([]);
  const [isExtractingZip, setIsExtractingZip] = useState(false);
  const [zipNotice, setZipNotice] = useState<string | null>(null);
  const [destinationType, setDestinationType] = useState<"common" | "job">(
    defaultJobId ? "job" : "common"
  );
  const [selectedJobId, setSelectedJobId] = useState<string>(defaultJobId || "");
  const [jobSearchQuery, setJobSearchQuery] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  // Convex actions and queries
  const generateUploadUrl = useAction(api.storage.r2.generateUploadUrl);
  const saveUpload = useMutation(api.cvs.cvUploads.saveUpload);
  const createBatch = useMutation(api.cvs.batches.createBatch);
  const startBatchExtraction = useAction(api.cvs.cvExtraction.startBatchExtraction);
  const jobs = useQuery(api.jobs.jobs.list);

  const activeJobs = jobs?.filter((j) => j.status === "active" || j.status === "draft") || [];

  const selectedJob = activeJobs.find((j) => j._id === selectedJobId);

  const filteredJobs = activeJobs.filter((job) => {
    if (!jobSearchQuery.trim()) return true;
    const q = jobSearchQuery.toLowerCase();
    const titleMatch = job.title?.toLowerCase().includes(q);
    const clientMatch = job.clientName?.toLowerCase().includes(q);
    return Boolean(titleMatch || clientMatch);
  });

  if (!isOpen) return null;

  // Process selected files (including unpacking ZIP files client-side)
  const handleFilesAdded = async (newFiles: FileList | File[]) => {
    const rawFiles = Array.from(newFiles);
    const regularFiles: File[] = [];
    const zipFiles: File[] = [];

    for (const f of rawFiles) {
      if (f.name.toLowerCase().endsWith(".zip")) {
        zipFiles.push(f);
      } else {
        const ext = "." + f.name.split(".").pop()?.toLowerCase();
        if (VALID_EXTENSIONS.includes(ext)) {
          regularFiles.push(f);
        }
      }
    }

    let extractedFromZips: File[] = [];
    if (zipFiles.length > 0) {
      setIsExtractingZip(true);
      try {
        for (const zipFile of zipFiles) {
          const zip = await JSZip.loadAsync(zipFile);
          const entries = Object.keys(zip.files);
          let countFromZip = 0;

          for (const path of entries) {
            const entry = zip.files[path];
            if (entry.dir) continue;
            if (
              path.includes("__MACOSX") ||
              path.startsWith(".") ||
              path.includes("/.")
            ) {
              continue;
            }

            const lower = entry.name.toLowerCase();
            const isValid = VALID_EXTENSIONS.some((ext) => lower.endsWith(ext));
            if (!isValid) continue;

            const blob = await entry.async("blob");
            const fileName = path.split("/").pop() || entry.name;

            let mimeType = "application/octet-stream";
            if (lower.endsWith(".pdf")) mimeType = "application/pdf";
            else if (lower.endsWith(".docx"))
              mimeType =
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            else if (lower.endsWith(".doc")) mimeType = "application/msword";
            else if (lower.endsWith(".txt")) mimeType = "text/plain";

            const extractedFile = new File([blob], fileName, {
              type: mimeType,
              lastModified: entry.date?.getTime() || Date.now(),
            });

            extractedFromZips.push(extractedFile);
            countFromZip++;
          }

          setZipNotice(
            `Extracted ${countFromZip} CVs from "${zipFile.name}"`
          );
        }
      } catch (err) {
        console.error("Failed to extract zip:", err);
        toast.error("Failed to unpack ZIP file. Please verify the archive format.");
      } finally {
        setIsExtractingZip(false);
      }
    }

    const allValid = [...regularFiles, ...extractedFromZips];
    if (allValid.length === 0 && rawFiles.length > 0 && zipFiles.length === 0) {
      toast.warning("No supported CV files found (.pdf, .docx, .doc, .txt, .zip).");
      return;
    }

    // Deduplicate by filename
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const filtered = allValid.filter((f) => !existingNames.has(f.name));
      return [...prev, ...filtered];
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
    setZipNotice(null);
  };

  // Perform Upload to Cloudflare R2 and trigger Convex batch extraction
  const handleUploadSubmit = async () => {
    if (files.length === 0 || !user?.id) return;

    if (destinationType === "job" && !selectedJobId) {
      toast.error("Please select a target job or choose Common Database.");
      return;
    }

    const filesToUpload = [...files];
    const targetJobId =
      destinationType === "job" && selectedJobId ? selectedJobId : undefined;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: filesToUpload.length });

    let successCount = 0;
    try {
      // 1. Create Ingestion Batch
      const batchId = await createBatch({
        sourceChannel: "Direct Dashboard Upload",
        totalCount: filesToUpload.length,
        jobId: targetJobId ? (targetJobId as Id<"jobs">) : undefined,
      });

      // 2. Upload each file to R2 and register cvUpload record
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        setUploadProgress({ current: i + 1, total: filesToUpload.length });

        try {
          const { url: uploadUrl, key: s3Key } = await generateUploadUrl({
            fileName: file.name,
            contentType: file.type || "application/pdf",
          });

          const resp = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type || "application/pdf" },
            body: file,
          });

          if (!resp.ok) throw new Error(`R2 upload failed: ${resp.statusText}`);

          await saveUpload({
            s3Key,
            storageProvider: "r2",
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || "application/pdf",
            source: "Direct Upload",
            assignToJob: targetJobId,
            uploadedBy: user.id,
            batchId,
          });

          successCount++;
        } catch (fileErr) {
          console.error("Error uploading file:", file.name, fileErr);
        }
      }

      // 3. Kick off AI Batch Extraction
      if (successCount > 0) {
        await startBatchExtraction({ batchId });
        toast.success(
          `${successCount} CVs uploaded successfully! AI extraction started.`
        );
        onClose();
      } else {
        toast.error("No files could be uploaded. Please check network connection.");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err?.message || "An error occurred during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Upload size={18} />
            </div>
            <div>
              <h2
                className="text-[15px] font-bold text-text-primary leading-snug"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Upload Candidate CVs
              </h2>
              <p className="text-[11px] text-text-secondary">
                Upload individual files or bulk ZIP archives (50+ CVs)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-container-high transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Target Destination Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-2">
              Destination Database
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: Common Database (Default) */}
              <button
                type="button"
                onClick={() => setDestinationType("common")}
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  destinationType === "common"
                    ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500"
                    : "border-border hover:bg-surface-container-high bg-surface"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    destinationType === "common"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  <Database size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-text-primary flex items-center gap-1.5">
                    Common Database
                    <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                      Default
                    </span>
                  </div>
                  <p className="text-[10px] text-text-secondary leading-tight mt-0.5">
                    General talent pool available for reverse matching and global search
                  </p>
                </div>
              </button>

              {/* Option 2: Assign to Job */}
              <button
                type="button"
                onClick={() => setDestinationType("job")}
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  destinationType === "job"
                    ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500"
                    : "border-border hover:bg-surface-container-high bg-surface"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    destinationType === "job"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  <Briefcase size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-text-primary">
                    Assign to Specific Job
                  </div>
                  <p className="text-[10px] text-text-secondary leading-tight mt-0.5">
                    Attach CVs directly to an active job opening pipeline
                  </p>
                </div>
              </button>
            </div>

            {/* Searchable Job Picker (Conditional) */}
            {destinationType === "job" && (
              <div className="mt-3 p-3 rounded-xl bg-surface-container-lowest border border-border animate-in fade-in slide-in-from-top-1 duration-150 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-text-primary">
                    Target Job <span className="text-red-500">*</span>
                  </label>
                  {selectedJob && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJobId("");
                        setJobSearchQuery("");
                      }}
                      className="text-[10px] font-semibold text-accent-teal hover:underline flex items-center gap-0.5"
                    >
                      Change Job
                    </button>
                  )}
                </div>

                {selectedJob ? (
                  // Selected Job Card Pill
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Briefcase size={13} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] font-bold text-text-primary truncate">
                          {selectedJob.title}
                        </div>
                        <div className="text-[10px] text-text-secondary truncate">
                          {selectedJob.clientName || "Confidential Client"}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJobId("");
                        setJobSearchQuery("");
                      }}
                      className="p-1 rounded-md text-text-secondary hover:text-red-500 hover:bg-surface transition-colors ml-2"
                      title="Clear Selection"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  // Search Input & Filtered Results List
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
                      />
                      <input
                        type="text"
                        value={jobSearchQuery}
                        onChange={(e) => setJobSearchQuery(e.target.value)}
                        placeholder="Search by job title or client name..."
                        className="w-full text-[12px] pl-8 pr-7 py-2 rounded-lg border border-border bg-surface text-text-primary focus:outline-hidden focus:ring-1 focus:ring-emerald-500 placeholder:text-text-disabled"
                        autoFocus
                      />
                      {jobSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setJobSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-primary p-0.5"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-surface divide-y divide-border/50">
                      {filteredJobs.length === 0 ? (
                        <div className="p-3 text-center text-text-secondary text-[11px]">
                          No active jobs match &ldquo;{jobSearchQuery}&rdquo;
                        </div>
                      ) : (
                        filteredJobs.map((job) => (
                          <button
                            key={job._id}
                            type="button"
                            onClick={() => {
                              setSelectedJobId(job._id);
                              setJobSearchQuery("");
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors group cursor-pointer"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-[12px] font-semibold text-text-primary group-hover:text-accent-teal transition-colors truncate">
                                {job.title}
                              </div>
                              <div className="text-[10px] text-text-secondary truncate">
                                {job.clientName || "Confidential Client"}
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-container-high group-hover:bg-accent-teal group-hover:text-white transition-colors shrink-0">
                              Select
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drag & Drop File Zone */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".pdf,.docx,.doc,.txt,.zip"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesAdded(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) handleFilesAdded(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-emerald-500 dark:hover:border-emerald-400 bg-surface-container-lowest/50 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10 rounded-2xl p-6 text-center cursor-pointer transition-all group"
            >
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-105 transition-transform">
                {isExtractingZip ? (
                  <Loader2 size={22} className="animate-spin" />
                ) : (
                  <Upload size={22} />
                )}
              </div>

              <div className="text-[13px] font-bold text-text-primary mb-1">
                {isExtractingZip
                  ? "Unpacking ZIP archive..."
                  : "Click or drag & drop files here"}
              </div>

              <p className="text-[11px] text-text-secondary max-w-sm mx-auto mb-2">
                PDF, Word (.docx, .doc), Text, or <span className="font-semibold text-emerald-700 dark:text-emerald-300">.ZIP archives</span> (extracts 50+ CVs directly in browser)
              </p>

              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-teal hover:underline">
                Browse Files
                <ArrowRight size={11} />
              </span>
            </div>
          </div>

          {/* Zip Extraction Notice */}
          {zipNotice && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
              <Archive size={14} className="shrink-0" />
              <span>{zipNotice}</span>
            </div>
          )}

          {/* Queued Files List */}
          {files.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                  Ready to upload ({files.length} {files.length === 1 ? "file" : "files"})
                </span>
                <button
                  type="button"
                  onClick={clearAllFiles}
                  className="text-[11px] text-red-500 hover:text-red-700 font-semibold"
                >
                  Clear all
                </button>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-surface-container-high/60 border border-border/50 text-[11px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={13} className="text-emerald-600 shrink-0" />
                      <span className="text-text-primary font-medium truncate max-w-[280px]">
                        {file.name}
                      </span>
                      <span className="text-text-disabled text-[10px] shrink-0">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => removeFile(idx)}
                      className="text-text-disabled hover:text-red-500 p-1 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-text-primary flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin text-emerald-600" />
                  Uploading CVs to storage...
                </span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  {uploadProgress.current} / {uploadProgress.total}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-accent-teal h-full transition-all duration-300"
                  style={{
                    width: `${
                      uploadProgress.total > 0
                        ? (uploadProgress.current / uploadProgress.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-border bg-surface-container-lowest/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-[12px] font-semibold text-text-secondary hover:text-text-primary rounded-lg transition-colors disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleUploadSubmit}
            disabled={isUploading || files.length === 0 || (destinationType === "job" && !selectedJobId)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-teal hover:bg-[#00504d] text-white text-[12px] font-bold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Uploading ({uploadProgress.current}/{uploadProgress.total})...</span>
              </>
            ) : (
              <>
                <Upload size={14} />
                <span>
                  Upload {files.length > 0 ? `${files.length} CV${files.length > 1 ? "s" : ""}` : "CVs"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
