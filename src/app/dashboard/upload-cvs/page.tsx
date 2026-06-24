"use client";

import { useState, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const SOURCE_OPTIONS = [
  "LinkedIn",
  "WhatsApp",
  "Meta",
  "Email",
  "Workable",
  "Manual",
  "Headhunting",
];

type FileEntry = {
  file: File;
  status: "pending" | "uploading" | "processing" | "done" | "failed";
  error?: string;
};

function normalizeFileType(file: File): string {
  if (file.type.includes("pdf")) return "pdf";
  if (file.type.includes("wordprocessingml") || file.name.endsWith(".docx")) return "docx";
  if (file.type.includes("msword") || file.name.endsWith(".doc")) return "doc";
  if (file.type.includes("text")) return "txt";
  if (file.type.includes("png")) return "png";
  if (file.type.includes("jpeg")) return "jpg";
  const ext = file.name.split(".").pop()?.toLowerCase() || "txt";
  return ext;
}

export default function UploadCVs() {
  const { user } = useUser();
  const generateUploadUrl = useMutation(api.cvs.cvUploads.generateUploadUrl);
  const saveUpload = useMutation(api.cvs.cvUploads.saveUpload);
  const processCvExtraction = useAction(api.cvs.cvExtraction.processCvExtraction);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [source, setSource] = useState("");
  const [campaignLabel, setCampaignLabel] = useState("");
  const [assignToJob, setAssignToJob] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateFileStatus = useCallback(
    (index: number, status: FileEntry["status"], error?: string) => {
      setFiles((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], status, error };
        return next;
      });
    },
    [],
  );

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const entries: FileEntry[] = selected.map((f) => ({ file: f, status: "pending" }));
    setFiles((prev) => [...prev, ...entries]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg"].includes(f.type) ||
      f.name.endsWith(".pdf") || f.name.endsWith(".doc") || f.name.endsWith(".docx") || f.name.endsWith(".png") || f.name.endsWith(".jpg") || f.name.endsWith(".jpeg")
    );
    const entries: FileEntry[] = dropped.map((f) => ({ file: f, status: "pending" }));
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(async () => {
    if (files.length === 0 || !user?.id) return;
    setUploading(true);
    let allSucceeded = true;
    try {
      for (let i = 0; i < files.length; i++) {
        const entry = files[i];
        if (entry.status === "done") continue;

        updateFileStatus(i, "uploading");
        try {
          const uploadUrl = await generateUploadUrl();
          const resp = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": entry.file.type },
            body: entry.file,
          });
          const { storageId } = await resp.json();

          const cvUploadId = await saveUpload({
            storageId,
            fileName: entry.file.name,
            fileSize: entry.file.size,
            fileType: entry.file.type,
            source: source || undefined,
            campaignLabel: campaignLabel || undefined,
            assignToJob: assignToJob || undefined,
            uploadedBy: user.id,
          });

          updateFileStatus(i, "processing");

          await processCvExtraction({
            storageId,
            fileType: normalizeFileType(entry.file),
            sourceChannel: source || undefined,
            uploadedBy: user.id,
            cvUploadId,
          });

          updateFileStatus(i, "done");
        } catch (err) {
          allSucceeded = false;
          updateFileStatus(i, "failed", err instanceof Error ? err.message : "Processing failed");
        }
      }

      if (allSucceeded) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        toast.success(`${files.length} CV${files.length > 1 ? "s" : ""} processed successfully`);
      } else {
        toast.error("Some files failed. Check the list for details.");
      }
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [files, source, campaignLabel, assignToJob, user, generateUploadUrl, saveUpload, processCvExtraction, updateFileStatus]);

  return (
    <div className="flex flex-col bg-surface w-full">
      <div className="self-stretch bg-surface px-8 md:px-[114px] pt-10">
        <div className="flex flex-col self-stretch bg-background max-w-[1052px] pb-[499px] gap-6 rounded-t-[10px]">
          <div className="flex justify-between items-center self-stretch bg-[#F8FAF2] py-[11px] px-[23px] ml-[13px] rounded-t-[10px]">
            <div className="flex shrink-0 items-center gap-4">
              <span className="text-on-primary-fixed text-2xl font-bold">Upload CV</span>
            </div>
          </div>
          <div className="flex flex-col self-stretch mx-8 md:mx-[71px] gap-8">
            <div className="flex flex-col items-start self-stretch">
              <span className="text-text-primary text-2xl font-bold">Upload CVs</span>
              <span className="text-text-secondary text-[13px]">Add CVs manually — batch or individual</span>
            </div>
            <div className="flex flex-col md:flex-row items-start self-stretch gap-6">
              <div className="flex-1 w-full bg-surface p-[21px] rounded-[10px] border border-solid border-border" style={{ boxShadow: "0px 2px 4px #0000000D" }}>
                <div
                  className="flex flex-col items-center self-stretch bg-background py-[41px] rounded-lg border-2 border-dashed border-[#C0C9BB] cursor-pointer hover:bg-[#f3f3ea] transition-colors"
                  onClick={() => !showSuccess && fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  {showSuccess ? (
                    <>
                      <svg className="w-16 h-16 mb-2" viewBox="0 0 64 64" fill="none">
                        <circle cx="32" cy="32" r="30" fill="#E8F5E9" stroke="#1B5E20" strokeWidth="2" />
                        <path d="M20 33 L28 41 L44 25" stroke="#1B5E20" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-primary-container text-base font-bold">Upload Complete!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-8 h-14 mb-2" viewBox="0 0 32 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="4" y="6" width="24" height="44" rx="3" stroke="#757575" strokeWidth="2" fill="none" />
                        <line x1="12" y1="18" x2="20" y2="18" stroke="#757575" strokeWidth="2" strokeLinecap="round" />
                        <line x1="12" y1="24" x2="18" y2="24" stroke="#757575" strokeWidth="2" strokeLinecap="round" />
                        <line x1="12" y1="30" x2="20" y2="30" stroke="#757575" strokeWidth="2" strokeLinecap="round" />
                        <path d="M16 36 L16 46 M11 41 L16 46 L21 41" stroke="#1B5E20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                      <div className="flex flex-col items-center pb-1">
                        <span className="text-[#191D18] text-base font-bold text-center">Drag & drop CV files here</span>
                      </div>
                      <div className="flex flex-col items-center pb-[15px]">
                        <span className="text-text-secondary text-[13px]">or click to select files</span>
                      </div>
                      <span className="text-text-disabled text-[11px] font-bold text-center px-4">PDF, DOC, DOCX, PNG, JPG — UP TO 600 FILES</span>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={handleFileSelect} />

                {files.length > 0 && (
                  <div className="mt-4 max-h-48 overflow-y-auto">
                    {files.map((entry, i) => (
                      <div key={`${entry.file.name}-${i}`} className="flex items-center justify-between py-2 px-3 bg-background rounded-md mb-1">
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 20" fill="none">
                            <rect x="2" y="1" width="12" height="17" rx="2" stroke="#757575" strokeWidth="1.5" fill="none" />
                            <line x1="5" y1="6" x2="11" y2="6" stroke="#757575" strokeWidth="1.5" />
                            <line x1="5" y1="9" x2="9" y2="9" stroke="#757575" strokeWidth="1.5" />
                          </svg>
                          <span className="text-text-primary text-[13px] truncate">{entry.file.name}</span>
                          <span className="text-text-disabled text-[11px] shrink-0">({(entry.file.size / 1024).toFixed(0)} KB)</span>
                          {entry.status === "uploading" && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Loader2 className="w-3 h-3 animate-spin text-[#F57C00]" />
                              <span className="text-[#F57C00] text-[10px] font-bold">Uploading...</span>
                            </div>
                          )}
                          {entry.status === "processing" && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Loader2 className="w-3 h-3 animate-spin text-[#1565C0]" />
                              <span className="text-[#1565C0] text-[10px] font-bold">Parsing...</span>
                            </div>
                          )}
                          {entry.status === "done" && (
                            <span className="text-primary-container text-[10px] font-bold shrink-0">Done</span>
                          )}
                          {entry.status === "failed" && (
                            <span className="text-[#BA1A1A] text-[10px] font-bold shrink-0" title={entry.error}>Failed</span>
                          )}
                        </div>
                        {entry.status === "pending" && (
                          <button onClick={() => removeFile(i)} className="text-[#BA1A1A] text-xs font-bold ml-2 shrink-0">Remove</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col w-full md:w-[320px] shrink-0 items-center bg-surface p-5 gap-6 rounded-[10px] border border-solid border-border" style={{ boxShadow: "0px 2px 4px #0000000D" }}>
                <div className="flex flex-col w-full items-start gap-3">
                  <div className="flex flex-col items-start w-full">
                    <span className="text-text-secondary text-[11px] font-bold">TAG THIS UPLOAD</span>
                  </div>
                  <div className="flex flex-col items-center gap-4 w-full">
                    <div className="flex flex-col items-start gap-1 w-full relative">
                      <span className="text-text-disabled text-[11px] font-bold">CV SOURCE</span>
                      <div className="w-full relative">
                        <div
                          className="flex items-center bg-surface rounded-md border border-solid border-border w-full cursor-pointer hover:bg-surface-container-high transition-colors py-[9px] px-[13px]"
                          onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                        >
                          <span className={`text-[13px] ${source ? "text-text-primary" : "text-text-disabled"}`}>
                            {source || "Select Source..."}
                          </span>
                        </div>
                        {showSourceDropdown && (
                          <div className="absolute top-full left-0 mt-1 w-full bg-surface rounded-md border border-solid border-border shadow-lg z-10">
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
                    <div className="flex flex-col items-start gap-1 w-full">
                      <span className="text-text-disabled text-[11px] font-bold">CAMPAIGN LABEL</span>
                      <input
                        type="text"
                        placeholder="e.g. Q4 Hiring Sprint"
                        value={campaignLabel}
                        onChange={(e) => setCampaignLabel(e.target.value)}
                        className="text-text-primary bg-surface text-[13px] py-[9px] px-3 rounded-md border border-solid border-border w-full focus:outline-none focus:border-primary-container"
                      />
                    </div>
                    <div className="flex flex-col items-start gap-1 w-full">
                      <span className="text-text-disabled text-[11px] font-bold">ASSIGN TO JOB</span>
                      <div className="flex items-center bg-surface p-2.5 gap-[9px] rounded-md border border-solid border-border w-full">
                        <input
                          type="text"
                          placeholder="Search open roles..."
                          value={assignToJob}
                          onChange={(e) => setAssignToJob(e.target.value)}
                          className="text-text-primary text-[13px] bg-transparent border-none outline-none w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  className="flex items-center bg-primary-container hover:bg-[#144718] transition-colors text-left py-3 px-[25px] gap-2 rounded-lg border-0 w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleUpload}
                  disabled={files.length === 0 || uploading || !user?.id}
                >
                  <span className="text-on-primary text-sm font-bold">
                    {uploading ? "Processing..." : "Upload and Process CVs"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
