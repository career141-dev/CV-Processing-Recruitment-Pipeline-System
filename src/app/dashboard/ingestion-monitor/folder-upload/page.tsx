"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import {
  FolderUp,
  ArrowLeft,
  Play,
  Pause,
  Square,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  Terminal,
  Layers,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

const BATCH_SIZE = 100;
const VALID_EXTENSIONS = [".pdf", ".docx", ".doc", ".rtf", ".txt"];

type CandidateFolderItem = {
  folderName: string;
  file: File;
  relativePath: string;
};

export default function FolderUploadPage() {
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [candidateItems, setCandidateItems] = useState<CandidateFolderItem[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [status, setStatus] = useState<"idle" | "running" | "paused" | "stopped" | "done">("idle");

  // Progress Counters
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [uploadedCount, setUploadedCount] = useState<number>(0);
  const [skippedCount, setSkippedCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(1);
  const [totalBatches, setTotalBatches] = useState<number>(1);

  const [copiedCliCommand, setCopiedCliCommand] = useState<boolean>(false);

  const uploadFolderCandidate = useAction(api.cvs.folderIngestion.uploadFolderCandidate);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsScanning(true);
    const discoveredCandidates: Map<string, File> = new Map();
    let rootFolderName = "";

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = file.webkitRelativePath || file.name;
      const parts = relPath.split("/");

      if (parts.length >= 2) {
        if (!rootFolderName) rootFolderName = parts[0];
        const candidateFolderName = parts[1];

        // Check if file is inside a "Downloads" or "download" folder
        const downloadsIndex = parts.findIndex(
          (p) => p.toLowerCase() === "downloads" || p.toLowerCase() === "download"
        );

        if (downloadsIndex !== -1 && downloadsIndex < parts.length - 1) {
          const fileName = parts[parts.length - 1];
          const ext = "." + fileName.split(".").pop()?.toLowerCase();

          if (VALID_EXTENSIONS.includes(ext) && file.size > 0) {
            // Keep the first valid resume file for each candidate folder
            if (!discoveredCandidates.has(candidateFolderName)) {
              discoveredCandidates.set(candidateFolderName, file);
            }
          }
        }
      }
    }

    const items: CandidateFolderItem[] = Array.from(discoveredCandidates.entries()).map(
      ([folderName, file]) => ({
        folderName,
        file,
        relativePath: file.webkitRelativePath,
      })
    );

    setCandidateItems(items);
    setSelectedPath(rootFolderName ? `Selected Folder: ${rootFolderName}` : "External Drive Folder");
    setTotalBatches(Math.ceil(items.length / BATCH_SIZE) || 1);
    setIsScanning(false);

    toast.success(`Discovered ${items.length.toLocaleString()} candidates with resumes in Downloads folders!`);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const [importMode, setImportMode] = useState<"test_100" | "full">("test_100");
  const [lastStoppedItem, setLastStoppedItem] = useState<{ index: number; folderName: string } | null>(null);

  const startBatchUpload = async () => {
    if (candidateItems.length === 0) {
      toast.error("Please select a valid root folder first.");
      return;
    }

    setStatus("running");
    let currentUploaded = uploadedCount;
    let currentSkipped = skippedCount;
    let currentFailed = failedCount;

    const maxLimit = importMode === "test_100" ? 100 : candidateItems.length;
    const totalToProcess = Math.min(candidateItems.length, maxLimit);

    for (let i = processedCount; i < totalToProcess; i++) {
      if (status === "stopped" || status === "paused") break;

      const item = candidateItems[i];
      const batchIdx = Math.floor(i / BATCH_SIZE) + 1;
      setCurrentBatchIndex(batchIdx);

      try {
        const base64Data = await fileToBase64(item.file);
        const ext = item.file.name.split(".").pop()?.toLowerCase() || "pdf";
        const uploadFileName = `${item.folderName}_${item.file.name}`;

        await uploadFolderCandidate({
          fileName: uploadFileName,
          fileType: ext,
          base64Data,
          uploadedBy: "Browser Folder Importer",
          sourceChannel: "Manual Directory Import",
          batchIndex: i % BATCH_SIZE,
        });

        currentUploaded++;
        setUploadedCount(currentUploaded);
        setLastStoppedItem({ index: i + 1, folderName: item.folderName });
      } catch (err) {
        console.error(`Failed to upload ${item.folderName}:`, err);
        currentFailed++;
        setFailedCount(currentFailed);
        setLastStoppedItem({ index: i + 1, folderName: item.folderName });
      }

      setProcessedCount(i + 1);

      // Pacing pause between batches of 100
      if ((i + 1) % BATCH_SIZE === 0 && i + 1 < totalToProcess) {
        await new Promise((res) => setTimeout(res, 1000));
      }
    }

    if (processedCount + 1 >= totalToProcess) {
      setStatus("done");
      if (importMode === "test_100" && totalToProcess < candidateItems.length) {
        toast.success(`Initial test batch of 100 candidates completed! Check candidate database and switch to 'Full Import' to continue.`);
      } else {
        toast.success("Folder candidate batch upload completed successfully!");
      }
    }
  };

  const handleCopyCliCommand = () => {
    navigator.clipboard.writeText('node scripts/folder-cv-importer.js "E:\\Path\\To\\18000_Candidates"');
    setCopiedCliCommand(true);
    toast.success("CLI Worker command copied to clipboard!");
    setTimeout(() => setCopiedCliCommand(false), 2500);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/ingestion-monitor"
          className="p-2 rounded-lg border border-border-color hover:bg-surface-hover transition text-text-secondary flex items-center gap-1.5 text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Ingestion Monitor
        </Link>
      </div>

      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-card p-6 rounded-xl border border-border-color shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">
              18,000 Candidate External Drive Directory Import
            </h1>
            <span className="bg-[#E8F5E9] text-[#1B5E20] text-xs px-2.5 py-0.5 rounded-full font-bold border border-[#C8E6C9]">
              100 Candidate Batches
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            Scans candidate subfolders on your local or external drive, picks the first resume in each{" "}
            <code className="bg-background-accent px-1.5 py-0.5 rounded font-mono text-text-primary">Downloads/</code>{" "}
            subfolder, and uploads in 100-candidate batches with AI DeepSeek extraction.
          </p>
        </div>
      </div>

      {/* Directory Import Selection Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Option A: Webkit Browser Folder Selection */}
        <div className="bg-surface-card p-6 rounded-xl border border-border-color space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#006E1C]/10 text-[#006E1C] rounded-lg">
                <FolderUp className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-bold text-text-primary">Option A: Web Browser Directory Picker</h2>
            </div>
            <p className="text-xs text-text-secondary">
              Select your candidate root folder directly in the browser. The platform will automatically parse subfolders and locate candidate resumes inside <code className="font-mono">Downloads/</code>.
            </p>

            <input
              type="file"
              // @ts-ignore
              webkitdirectory="true"
              // @ts-ignore
              directory="true"
              multiple
              ref={fileInputRef}
              onChange={handleFolderSelect}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning || status === "running"}
              className="w-full py-3 px-4 bg-[#006E1C] hover:bg-[#005415] text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning Candidate Subfolders...
                </>
              ) : (
                <>
                  <FolderUp className="w-4 h-4" />
                  Select Candidate Root Directory
                </>
              )}
            </button>

            {selectedPath && (
              <div className="p-3 bg-background-accent rounded-lg text-xs font-semibold text-text-primary border border-border-color flex justify-between items-center">
                <span>{selectedPath}</span>
                <span className="font-bold text-[#006E1C]">{candidateItems.length.toLocaleString()} Candidates Found</span>
              </div>
            )}
          </div>
        </div>

        {/* Option B: High-Speed Standalone CLI Importer Script */}
        <div className="bg-surface-card p-6 rounded-xl border border-border-color space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-text-primary/10 text-text-primary rounded-lg">
                <Terminal className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-bold text-text-primary">Option B: High-Speed CLI Worker (Recommended for 18k)</h2>
            </div>
            <p className="text-xs text-text-secondary">
              For ultra-fast import of large 18,000 candidate folders from an external drive, run our standalone Node CLI script directly in your terminal. It logs progress to <code className="font-mono">progress.json</code> and supports seamless resume.
            </p>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-text-secondary">Run Full 18,000 Candidates Import (100 per batch):</div>
              <div className="p-2.5 bg-[#1E1E1E] text-[#D4D4D4] rounded-lg font-mono text-xs flex items-center justify-between overflow-x-auto">
                <code>node scripts/folder-cv-importer.js "E:\Path\To\18000_Candidates"</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('node scripts/folder-cv-importer.js "E:\\Path\\To\\18000_Candidates"');
                    toast.success("Full CLI command copied!");
                  }}
                  className="ml-2 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded transition text-xs flex items-center gap-1 shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-[11px] font-bold text-text-secondary">Run First 100 Test Candidates Only:</div>
              <div className="p-2.5 bg-[#1E1E1E] text-[#D4D4D4] rounded-lg font-mono text-xs flex items-center justify-between overflow-x-auto">
                <code>node scripts/folder-cv-importer.js "E:\Path\To\18000_Candidates" --test</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('node scripts/folder-cv-importer.js "E:\\Path\\To\\18000_Candidates" --test');
                    toast.success("Test CLI command copied!");
                  }}
                  className="ml-2 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded transition text-xs flex items-center gap-1 shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Import Progress Dashboard */}
      {(candidateItems.length > 0 || status !== "idle") && (
        <div className="bg-surface-card p-6 rounded-xl border border-border-color space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-text-primary">Folder Candidate Import Progress</h3>
              <p className="text-xs text-text-secondary">
                Batch #{currentBatchIndex} of {totalBatches} ({BATCH_SIZE} candidates / batch)
              </p>
            </div>

            {/* Status Badge */}
            {status === "running" && (
              <div className="flex items-center gap-1.5 bg-[#E8F5E9] text-[#1B5E20] px-3 py-1 rounded-md border border-[#C8E6C9]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs font-bold uppercase tracking-wider">Uploading Batch...</span>
              </div>
            )}
            {status === "paused" && (
              <div className="flex items-center gap-1.5 bg-[#FFF3E0] text-[#E65100] px-3 py-1 rounded-md border border-[#FFE0B2]">
                <Pause className="w-3.5 h-3.5" />
                <span className="text-xs font-bold uppercase tracking-wider">Paused</span>
              </div>
            )}
            {status === "stopped" && (
              <div className="flex items-center gap-1.5 bg-[#FFF3E0] text-[#E65100] px-3 py-1 rounded-md border border-[#FFE0B2]">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="text-xs font-bold uppercase tracking-wider">Stopped</span>
              </div>
            )}
            {status === "done" && (
              <div className="flex items-center gap-1.5 bg-[#E8F5E9] text-[#1B5E20] px-3 py-1 rounded-md border border-[#C8E6C9]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-xs font-bold uppercase tracking-wider">Complete</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs font-bold text-text-secondary mb-1.5">
              <span>Candidates Processed</span>
              <span>
                {processedCount.toLocaleString()} / {candidateItems.length.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-background-accent h-3 rounded-full overflow-hidden border border-border-color">
              <div
                className="bg-[#006E1C] h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${candidateItems.length > 0 ? (processedCount / candidateItems.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Stats Boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-lg border border-border-color bg-surface-card space-y-1">
              <div className="text-xs text-text-secondary font-semibold">Uploaded & Queued</div>
              <div className="text-xl font-bold text-[#006E1C]">{uploadedCount.toLocaleString()}</div>
            </div>
            <div className="p-3.5 rounded-lg border border-border-color bg-surface-card space-y-1">
              <div className="text-xs text-text-secondary font-semibold">Skipped (No Resume)</div>
              <div className="text-xl font-bold text-[#E65100]">{skippedCount.toLocaleString()}</div>
            </div>
            <div className="p-3.5 rounded-lg border border-border-color bg-surface-card space-y-1">
              <div className="text-xs text-text-secondary font-semibold">Failed Uploads</div>
              <div className="text-xl font-bold text-red-600">{failedCount.toLocaleString()}</div>
            </div>
            <div className="p-3.5 rounded-lg border border-border-color bg-surface-card space-y-1">
              <div className="text-xs text-text-secondary font-semibold">Current Batch</div>
              <div className="text-xl font-bold text-text-primary">#{currentBatchIndex}</div>
            </div>
          </div>

          {/* Import Mode Selector Toggle */}
          <div className="flex items-center gap-3 p-3 bg-background-accent rounded-lg border border-border-color">
            <span className="text-xs font-bold text-text-primary">Import Scope:</span>
            <button
              onClick={() => setImportMode("test_100")}
              disabled={status === "running"}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                importMode === "test_100"
                  ? "bg-[#006E1C] text-white shadow-sm"
                  : "bg-surface-card text-text-secondary hover:text-text-primary"
              }`}
            >
              🎯 First 100 Candidates Only (Initial Test Batch)
            </button>
            <button
              onClick={() => setImportMode("full")}
              disabled={status === "running"}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                importMode === "full"
                  ? "bg-[#006E1C] text-white shadow-sm"
                  : "bg-surface-card text-text-secondary hover:text-text-primary"
              }`}
            >
              🚀 Full Directory Import (100 candidates / batch)
            </button>
          </div>

          {/* Recorded Stop Location Banner */}
          {lastStoppedItem && (status === "paused" || status === "stopped" || status === "done") && (
            <div className="p-3 bg-[#FFF3E0] text-[#E65100] rounded-lg text-xs font-semibold border border-[#FFE0B2] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Recorded Stop Point:</strong> Processed up to candidate #{lastStoppedItem.index}{" "}
                  (<code className="font-mono">{lastStoppedItem.folderName}</code>). Re-run or click <strong>Resume Upload</strong> to pick up at #{lastStoppedItem.index + 1}.
                </span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-3 pt-2">
            {status !== "running" && status !== "done" && (
              <button
                onClick={startBatchUpload}
                disabled={candidateItems.length === 0}
                className="py-2.5 px-5 bg-[#006E1C] hover:bg-[#005415] text-white text-xs font-bold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                {status === "paused" || status === "stopped"
                  ? `Resume Upload (from Candidate #${processedCount + 1})`
                  : importMode === "test_100"
                  ? "Start First 100 Test Batch"
                  : "Start 100-Batch Upload"}
              </button>
            )}

            {status === "running" && (
              <button
                onClick={() => setStatus("paused")}
                className="py-2.5 px-5 bg-[#FFF3E0] text-[#E65100] hover:bg-[#FFE0B2] text-xs font-bold rounded-lg border border-[#FFE0B2] transition flex items-center gap-2"
              >
                <Pause className="w-4 h-4" />
                Pause Upload
              </button>
            )}

            {(status === "running" || status === "paused") && (
              <button
                onClick={() => setStatus("stopped")}
                className="py-2.5 px-5 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold rounded-lg border border-red-200 transition flex items-center gap-2"
              >
                <Square className="w-4 h-4 fill-current" />
                Stop Upload
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
