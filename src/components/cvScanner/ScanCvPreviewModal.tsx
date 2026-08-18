"use client";

import React, { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FileText, ExternalLink, Loader2, AlertCircle, Download } from "lucide-react";

interface ScanCvPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  resultId: Id<"cvScanResults"> | null;
  fileName?: string;
  candidateName?: string;
}

export function ScanCvPreviewModal({
  isOpen,
  onClose,
  resultId,
  fileName,
  candidateName,
}: ScanCvPreviewModalProps) {
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docFileName, setDocFileName] = useState<string>(fileName || "Candidate_CV.pdf");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const getScanResultDownloadUrl = useAction(api.cvScanner.scanActions.getScanResultDownloadUrl);

  useEffect(() => {
    if (!isOpen || !resultId) {
      setDocUrl(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getScanResultDownloadUrl({ resultId })
      .then((res) => {
        if (!isMounted) return;
        if (res && res.url) {
          setDocUrl(res.url);
          if (res.fileName) setDocFileName(res.fileName);
        } else {
          setError("Unable to generate document viewing URL.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Error fetching CV preview URL:", err);
        setError("Failed to load document preview.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, resultId, getScanResultDownloadUrl]);

  if (!isOpen) return null;

  const rawUrl = docUrl;
  const iframeUrl = rawUrl
    ? rawUrl.replace(
        /^http:\/\/(127\.0\.0\.1|localhost|convex)(:\d+)?/,
        process.env.NEXT_PUBLIC_CONVEX_URL || "https://api.career141.com"
      )
    : null;

  const modalTitle = candidateName
    ? `${candidateName}'s CV Document`
    : fileName
    ? `${fileName} - CV Preview`
    : "Candidate CV Preview";

  const isWordDoc =
    docFileName.toLowerCase().endsWith(".docx") || docFileName.toLowerCase().endsWith(".doc");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      maxWidth="max-w-5xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-text-secondary truncate">
            {docFileName && (
              <>
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-text-primary truncate max-w-[280px]">
                  {docFileName}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {iframeUrl && (
              <Button
                variant="outline"
                className="text-xs h-9 py-1 px-3 border border-border"
                onClick={() => window.open(iframeUrl, "_blank")}
                icon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                Open in New Tab
              </Button>
            )}
            <Button
              variant="primary"
              className="text-xs h-9 py-1 px-4"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col items-center justify-center min-h-[500px] h-[72vh] w-full bg-gray-50 dark:bg-zinc-900 rounded-lg overflow-hidden border border-border">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center text-text-secondary gap-3 p-6">
            <Loader2 className="w-8 h-8 animate-spin text-[#1B5E20]" />
            <span className="text-xs font-semibold text-text-primary">Loading CV document...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-md gap-3">
            <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-full text-red-600 dark:text-red-400 mb-1">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-bold text-text-primary">
              CV Preview Unavailable
            </h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              {error}
            </p>
          </div>
        ) : iframeUrl ? (
          isWordDoc ? (
            <div className="flex flex-col items-center justify-center text-center p-8 max-w-md gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-full text-blue-600 dark:text-blue-400">
                <FileText className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-text-primary mb-1">
                  Word Document ({docFileName.split(".").pop()?.toUpperCase()})
                </h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Microsoft Word files cannot be displayed directly in browser PDF viewers. Click below to download and view in Word.
                </p>
              </div>
              <Button
                variant="primary"
                className="text-xs h-10 px-5"
                onClick={() => window.open(iframeUrl, "_blank")}
                icon={<Download className="w-4 h-4" />}
              >
                Download Word File
              </Button>
            </div>
          ) : (
            <iframe
              src={`${iframeUrl}#target=_blank`}
              className="w-full h-full border-0 bg-white"
              title={modalTitle}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-md gap-3">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-full text-amber-600 mb-1">
              <FileText className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-bold text-text-primary">
              CV Document Unavailable
            </h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              No original CV file attachment was found for this candidate profile.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
