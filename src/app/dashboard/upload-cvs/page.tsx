"use client";

import { useState, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

const SOURCE_OPTIONS = [
  "LinkedIn",
  "WhatsApp",
  "Meta",
  "Email",
  "Workable",
  "Manual",
  "Headhunting",
];

export default function UploadCVs() {
  const { user } = useUser();
  const generateUploadUrl = useMutation(api.cvUploads.generateUploadUrl);
  const saveUpload = useMutation(api.cvUploads.saveUpload);

  const [files, setFiles] = useState<File[]>([]);
  const [source, setSource] = useState("");
  const [campaignLabel, setCampaignLabel] = useState("");
  const [assignToJob, setAssignToJob] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg"].includes(f.type) ||
      f.name.endsWith(".pdf") || f.name.endsWith(".doc") || f.name.endsWith(".docx") || f.name.endsWith(".png") || f.name.endsWith(".jpg") || f.name.endsWith(".jpeg")
    );
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(async () => {
    if (files.length === 0 || !user?.id) return;
    setUploading(true);
    try {
      for (const file of files) {
        const uploadUrl = await generateUploadUrl();
        const resp = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await resp.json();
        await saveUpload({
          storageId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          source: source || undefined,
          campaignLabel: campaignLabel || undefined,
          assignToJob: assignToJob || undefined,
          uploadedBy: user.id,
        });
      }
      setFiles([]);
      setSource("");
      setCampaignLabel("");
      setAssignToJob("");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      toast.success(`${files.length} CV${files.length > 1 ? "s" : ""} uploaded successfully`);
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [files, source, campaignLabel, assignToJob, user, generateUploadUrl, saveUpload]);

  return (
    <div className="flex flex-col bg-white w-full">
      <div className="self-stretch bg-white px-8 md:px-[114px] pt-10">
        <div className="flex flex-col self-stretch bg-[#F5F5F0] max-w-[1052px] pb-[499px] gap-6 rounded-t-[10px]">
          <div className="flex justify-between items-center self-stretch bg-[#F8FAF2] py-[11px] px-[23px] ml-[13px] rounded-t-[10px]">
            <div className="flex shrink-0 items-center gap-4">
              <span className="text-[#002C06] text-2xl font-bold">Upload CV</span>
            </div>
          </div>
          <div className="flex flex-col self-stretch mx-8 md:mx-[71px] gap-8">
            <div className="flex flex-col items-start self-stretch">
              <span className="text-[#212121] text-2xl font-bold">Upload CVs</span>
              <span className="text-[#616161] text-[13px]">Add CVs manually — batch or individual</span>
            </div>
            <div className="flex flex-col md:flex-row items-start self-stretch gap-6">
              <div className="flex-1 w-full bg-white p-[21px] rounded-[10px] border border-solid border-[#E0E0E0]" style={{ boxShadow: "0px 2px 4px #0000000D" }}>
                <div
                  className="flex flex-col items-center self-stretch bg-[#FAFAF5] py-[41px] rounded-lg border-2 border-dashed border-[#C0C9BB] cursor-pointer hover:bg-[#f3f3ea] transition-colors"
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
                      <span className="text-[#1B5E20] text-base font-bold">Upload Complete!</span>
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
                        <span className="text-[#616161] text-[13px]">or click to select files</span>
                      </div>
                      <span className="text-[#9E9E9E] text-[11px] font-bold text-center px-4">PDF, DOC, DOCX, PNG, JPG — UP TO 600 FILES</span>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={handleFileSelect} />

                {files.length > 0 && (
                  <div className="mt-4 max-h-48 overflow-y-auto">
                    {files.map((file, i) => (
                      <div key={`${file.name}-${i}`} className="flex items-center justify-between py-2 px-3 bg-[#FAFAF5] rounded-md mb-1">
                        <div className="flex items-center gap-2 truncate">
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 20" fill="none">
                            <rect x="2" y="1" width="12" height="17" rx="2" stroke="#757575" strokeWidth="1.5" fill="none" />
                            <line x1="5" y1="6" x2="11" y2="6" stroke="#757575" strokeWidth="1.5" />
                            <line x1="5" y1="9" x2="9" y2="9" stroke="#757575" strokeWidth="1.5" />
                          </svg>
                          <span className="text-[#212121] text-[13px] truncate">{file.name}</span>
                          <span className="text-[#9E9E9E] text-[11px] shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                        </div>
                        <button onClick={() => removeFile(i)} className="text-[#BA1A1A] text-xs font-bold ml-2 shrink-0">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col w-full md:w-[320px] shrink-0 items-center bg-white p-5 gap-6 rounded-[10px] border border-solid border-[#E0E0E0]" style={{ boxShadow: "0px 2px 4px #0000000D" }}>
                <div className="flex flex-col w-full items-start gap-3">
                  <div className="flex flex-col items-start w-full">
                    <span className="text-[#616161] text-[11px] font-bold">TAG THIS UPLOAD</span>
                  </div>
                  <div className="flex flex-col items-center gap-4 w-full">
                    <div className="flex flex-col items-start gap-1 w-full relative">
                      <span className="text-[#9E9E9E] text-[11px] font-bold">CV SOURCE</span>
                      <div className="w-full relative">
                        <div
                          className="flex items-center bg-white rounded-md border border-solid border-[#E0E0E0] w-full cursor-pointer hover:bg-gray-50 py-[9px] px-[13px]"
                          onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                        >
                          <span className={`text-[13px] ${source ? "text-[#212121]" : "text-[#9E9E9E]"}`}>
                            {source || "Select Source..."}
                          </span>
                        </div>
                        {showSourceDropdown && (
                          <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-md border border-solid border-[#E0E0E0] shadow-lg z-10">
                            {SOURCE_OPTIONS.map((opt) => (
                              <div
                                key={opt}
                                className="py-2 px-[13px] text-[13px] text-[#212121] hover:bg-[#FAFAF5] cursor-pointer"
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
                      <span className="text-[#9E9E9E] text-[11px] font-bold">CAMPAIGN LABEL</span>
                      <input
                        type="text"
                        placeholder="e.g. Q4 Hiring Sprint"
                        value={campaignLabel}
                        onChange={(e) => setCampaignLabel(e.target.value)}
                        className="text-[#212121] bg-white text-[13px] py-[9px] px-3 rounded-md border border-solid border-[#E0E0E0] w-full focus:outline-none focus:border-[#1B5E20]"
                      />
                    </div>
                    <div className="flex flex-col items-start gap-1 w-full">
                      <span className="text-[#9E9E9E] text-[11px] font-bold">ASSIGN TO JOB</span>
                      <div className="flex items-center bg-white p-2.5 gap-[9px] rounded-md border border-solid border-[#E0E0E0] w-full">
                        <input
                          type="text"
                          placeholder="Search open roles..."
                          value={assignToJob}
                          onChange={(e) => setAssignToJob(e.target.value)}
                          className="text-[#212121] text-[13px] bg-transparent border-none outline-none w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  className="flex items-center bg-[#1B5E20] hover:bg-[#144718] transition-colors text-left py-3 px-[25px] gap-2 rounded-lg border-0 w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleUpload}
                  disabled={files.length === 0 || uploading || !user?.id}
                >
                  <span className="text-white text-sm font-bold">
                    {uploading ? "Uploading..." : "Upload and Process CVs"}
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
