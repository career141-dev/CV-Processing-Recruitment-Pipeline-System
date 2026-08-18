"use client";

import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CandidateManagementTable } from '@/components/candidates/CandidateManagementTable';
import { FloatingActionBar } from '@/components/candidates/FloatingActionBar';
import { DeleteCandidateModal } from '@/components/candidates/modals/DeleteCandidateModal';
import { CvPreviewModal } from '@/components/candidates/modals/CvPreviewModal';
import { MessageComposer } from '@/components/communications/MessageComposer';

export default function CandidateManagementPage() {
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [cvPreviewCandidate, setCvPreviewCandidate] = useState<{ id: string; name: string } | null>(null);
  const [messageCandidate, setMessageCandidate] = useState<{ id: string; name: string; initials: string; role: string } | null>(null);

  const toggleCandidate = (id: string) => {
    setSelectedCandidates((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 md:p-8 transition-colors duration-300">
      <div className="w-full max-w-[98%] mx-auto space-y-6">
        <PageHeader title="Candidate Management" />

        {/* Dedicated Candidate Management Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <CandidateManagementTable
            onDeleteClick={(id: string) => setDeletingCandidateId(id)}
            selectedCandidates={selectedCandidates}
            onToggleCandidate={toggleCandidate}
            onSelectAll={(ids) => setSelectedCandidates(ids)}
          />
        </div>
      </div>

      {/* Action Modals */}
      {selectedCandidates.length > 0 && (
        <FloatingActionBar
          selectedCandidates={selectedCandidates}
          onClear={() => setSelectedCandidates([])}
        />
      )}

      {messageCandidate && (
        <MessageComposer
          isOpen={!!messageCandidate}
          onClose={() => setMessageCandidate(null)}
          candidateName={messageCandidate.name}
          candidateInitials={messageCandidate.initials}
          candidateTitle={messageCandidate.role}
        />
      )}

      {deletingCandidateId && (
        <DeleteCandidateModal
          isOpen={!!deletingCandidateId}
          onClose={() => setDeletingCandidateId(null)}
          candidateIds={[deletingCandidateId]}
        />
      )}

      {cvPreviewCandidate && (
        <CvPreviewModal
          isOpen={!!cvPreviewCandidate}
          onClose={() => setCvPreviewCandidate(null)}
          candidateId={cvPreviewCandidate.id}
          candidateName={cvPreviewCandidate.name}
        />
      )}
    </div>
  );
}
