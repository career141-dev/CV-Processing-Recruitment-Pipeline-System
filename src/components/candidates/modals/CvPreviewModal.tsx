"use client";

import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FileText, ExternalLink, Loader2, AlertCircle } from 'lucide-react';

interface CvPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: string | null;
  candidateName?: string;
}

export function CvPreviewModal({
  isOpen,
  onClose,
  candidateId,
  candidateName,
}: CvPreviewModalProps) {
  const cvUpload = useQuery(
    api.candidates.candidates.getCvUploadUrl,
    candidateId ? { cvUploadId: candidateId } : 'skip'
  );

  const rawUrl = cvUpload?.url;
  const iframeUrl = rawUrl
    ? rawUrl.replace(
        /^http:\/\/(127\.0\.0\.1|localhost|convex)(:\d+)?/,
        process.env.NEXT_PUBLIC_CONVEX_URL || 'https://api.career141.com'
      )
    : null;

  const modalTitle = candidateName ? `${candidateName}'s CV Document` : 'Candidate CV Preview';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      maxWidth="max-w-5xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-text-secondary truncate">
            {cvUpload?.fileName && (
              <>
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-text-primary truncate max-w-[280px]">
                  {cvUpload.fileName}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {iframeUrl && (
              <Button
                variant="outline"
                className="text-xs h-9 py-1 px-3 border border-border"
                onClick={() => window.open(iframeUrl, '_blank')}
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
        {!candidateId ? (
          <div className="flex flex-col items-center justify-center text-text-disabled gap-2 p-6">
            <AlertCircle className="w-8 h-8 text-gray-400" />
            <span className="text-sm font-medium">No candidate selected.</span>
          </div>
        ) : cvUpload === undefined ? (
          <div className="flex flex-col items-center justify-center text-text-secondary gap-3 p-6">
            <Loader2 className="w-8 h-8 animate-spin text-[#1B5E20]" />
            <span className="text-xs font-semibold text-text-primary">Loading CV document...</span>
          </div>
        ) : iframeUrl ? (
          <iframe
            src={`${iframeUrl}#target=_blank`}
            className="w-full h-full border-0 bg-white"
            title={modalTitle}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-md gap-3">
            <div className="p-3 bg-amber-50 rounded-full text-amber-600 mb-1">
              <FileText className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-bold text-text-primary">
              CV Document Unavailable
            </h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              {cvUpload?.message || 'No original CV file attachment was found for this candidate profile.'}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
