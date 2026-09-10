'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, Mail, MoreHorizontal, ArrowUpDown } from 'lucide-react';
import { MockCandidate } from '../types';
import { INITIAL_CANDIDATES } from '../mock-data';
import { ChangeStageModal } from './Modals';

interface ReferenceStageViewProps {
  candidates?: MockCandidate[];
  setCandidates?: React.Dispatch<React.SetStateAction<MockCandidate[]>>;
  onProfileClick?: (candidate: MockCandidate) => void;
}

export const ReferenceStageView: React.FC<ReferenceStageViewProps> = ({
  candidates: externalCandidates,
  setCandidates: externalSetCandidates,
  onProfileClick,
}) => {
  // ── INTERNAL OR SHARED CANDIDATE STATE ──
  const [internalCandidates, setInternalCandidates] = useState<MockCandidate[]>(() =>
    INITIAL_CANDIDATES.filter((c) => c.stage === 'reference')
  );

  const allCandidates = externalCandidates || internalCandidates;
  const updateCandidates = externalSetCandidates || setInternalCandidates;

  const stageCandidates = useMemo(() => {
    return allCandidates.filter((c) => c.stage === 'reference');
  }, [allCandidates]);

  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [expandedEducations, setExpandedEducations] = useState<Record<string, boolean>>({});
  const [stageModalCandidate, setStageModalCandidate] = useState<MockCandidate | null>(null);

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedCandidateIds((prev) => [...prev, id]);
    } else {
      setSelectedCandidateIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleToggleEducation = (id: string) => {
    setExpandedEducations((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleChangeStage = (
    candidateId: string,
    newStageKey: MockCandidate['stage'],
    newStatusLabel: string
  ) => {
    updateCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? {
              ...c,
              stage: newStageKey,
              stageStatus: newStatusLabel,
              stageChangedDate: new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }),
            }
          : c
      )
    );
    setStageModalCandidate(null);
  };

  const handleRejectCandidate = (candidateId: string) => {
    updateCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? {
              ...c,
              stageStatus: 'Rejected',
              stageChangedDate: new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }),
            }
          : c
      )
    );
  };

  return (
    <div className="bg-white rounded-[10px] border border-[#DBDEE0] p-6 sm:p-8 shadow-2xs w-full">
      {/* ── TITLE ── */}
      <h2 className="text-[20px] font-semibold text-slate-800 tracking-tight mb-6">
        Reference
      </h2>

      {/* ── CANDIDATE LIST ── */}
      <div className="divide-y divide-[#DBDEE0]">
        {stageCandidates.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <p className="text-sm font-medium">No candidates in Reference stage.</p>
          </div>
        ) : (
          stageCandidates.map((candidate) => {
            const isSelected = selectedCandidateIds.includes(candidate.id);
            const isExpandedEducation = !!expandedEducations[candidate.id];

            return (
              <div key={candidate.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col lg:flex-row items-start gap-4">
                  {/* Left Checkbox + Candidate Info */}
                  <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleSelectOne(candidate.id, e.target.checked)}
                      className="w-4 h-4 mt-1 rounded border-slate-300 text-[#165B42] focus:ring-[#165B42] cursor-pointer shrink-0"
                    />

                    {/* Main Candidate Details */}
                    <div className="flex-1 space-y-3 min-w-0">
                      {/* Header: Name, Rank, Badges */}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3
                            onClick={() => onProfileClick?.(candidate)}
                            className="font-bold text-[16px] text-[#165B42] hover:underline cursor-pointer tracking-normal leading-[100%]"
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontWeight: 700,
                              fontSize: '16px',
                              lineHeight: '100%',
                              letterSpacing: '0%',
                            }}
                          >
                            {candidate.name}
                          </h3>
                          <span className="text-[12px] text-slate-500 font-normal">
                            in · {candidate.degreeRank}
                          </span>
                          {candidate.isApplicant && (
                            <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-semibold bg-[#EBEBEB] text-slate-700">
                              Applicant
                            </span>
                          )}
                        </div>

                        <p className="text-[13px] font-semibold text-slate-800 mt-1">
                          {candidate.role}
                        </p>
                        <p className="text-[13px] text-slate-500 mt-0.5 break-words">
                          {candidate.location} · {candidate.industry}
                        </p>
                      </div>

                      {/* Structured Metadata: 1st Designation, 2nd Location, 3rd Mail, 4th Phone No */}
                      <div className="space-y-3 text-[13px] pt-1">
                        {/* 1. Designation Section */}
                        <div className="flex items-start gap-2.5 sm:gap-4">
                          <span className="w-[95px] sm:w-[105px] min-w-[95px] sm:min-w-[105px] font-bold text-slate-900 shrink-0">
                            Designation
                          </span>
                          <div className="flex-1 min-w-0 space-y-1 text-slate-800 break-words">
                            {(candidate.designations && candidate.designations.length > 0
                              ? candidate.designations
                              : [candidate.role || 'Human Resources Associate at Outdesk.']
                            ).map((desig, idx) => (
                              <p key={idx} className="text-slate-800">
                                {desig}
                              </p>
                            ))}
                          </div>
                        </div>

                        {/* 2. Location Section */}
                        <div className="flex items-start gap-2.5 sm:gap-4">
                          <span className="w-[95px] sm:w-[105px] min-w-[95px] sm:min-w-[105px] font-bold text-slate-900 shrink-0">
                            Location
                          </span>
                          <div className="flex-1 min-w-0 space-y-1 text-slate-800 break-words">
                            {(candidate.locations && candidate.locations.length > 0
                              ? candidate.locations
                              : [candidate.location || 'Colombo, Western Province, Sri Lanka']
                            ).map((loc, idx) => (
                              <p key={idx} className="text-slate-800">
                                {loc}
                              </p>
                            ))}
                          </div>
                        </div>

                        {/* 3. Mail Section */}
                        <div className="flex items-start gap-2.5 sm:gap-4">
                          <span className="w-[95px] sm:w-[105px] min-w-[95px] sm:min-w-[105px] font-bold text-slate-900 shrink-0">
                            Mail
                          </span>
                          <div className="flex-1 min-w-0 space-y-1 text-slate-800 break-words">
                            {(candidate.emails && candidate.emails.length > 0
                              ? candidate.emails
                              : [candidate.email || 'nethma.tharindi@outdesk.com', 'nethma.tharindi.personal@gmail.com']
                            ).map((mail, idx) => (
                              <p key={idx} className="text-[#165B42] hover:underline cursor-pointer">
                                {mail}
                              </p>
                            ))}
                          </div>
                        </div>

                        {/* 4. Phone No Section */}
                        <div className="flex items-start gap-2.5 sm:gap-4">
                          <span className="w-[95px] sm:w-[105px] min-w-[95px] sm:min-w-[105px] font-bold text-slate-900 shrink-0">
                            Phone No
                          </span>
                          <div className="flex-1 min-w-0 space-y-1 text-slate-800 break-words">
                            {(candidate.phoneNumbers && candidate.phoneNumbers.length > 0
                              ? candidate.phoneNumbers
                              : [candidate.phone || '+94 71 279 8490', '+94 11 289 4521']
                            ).map((ph, idx) => (
                              <p key={idx} className="text-slate-800">
                                {ph}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Action Column */}
                  <div className="w-full lg:w-auto shrink-0 flex flex-col items-start lg:items-end justify-between lg:justify-start gap-2.5 text-left lg:text-right pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* Top Action Buttons */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        onClick={() => setStageModalCandidate(candidate)}
                        className="px-4 py-1.5 bg-[#165B42] hover:bg-[#114934] text-white font-semibold rounded-full text-[13px] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <span>Change stage</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-white" />
                      </button>

                      <button
                        onClick={() => handleRejectCandidate(candidate.id)}
                        className="px-4 py-1.5 bg-white border border-[#165B42] hover:bg-emerald-50 text-[#165B42] font-semibold rounded-full text-[13px] transition-colors cursor-pointer"
                      >
                        Reject
                      </button>

                      <button
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title="Message Candidate"
                      >
                        <Mail className="w-4 h-4" />
                      </button>

                      <button
                        className="p-1 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                        title="More Options"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Status Text */}
                    <div className="space-y-0.5 pt-0.5 text-left lg:text-right">
                      <div className="text-[14px] font-medium text-slate-800">
                        {candidate.stageStatus}
                      </div>
                      <p className="text-[12px] text-slate-500 leading-tight">
                        Stage changed on {candidate.stageChangedDate}
                      </p>
                      <p className="text-[12px] text-slate-500 leading-tight">
                        by {candidate.stageChangedBy}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── CHANGE STAGE MODAL ── */}
      <ChangeStageModal
        candidate={stageModalCandidate}
        onClose={() => setStageModalCandidate(null)}
        onChangeStage={handleChangeStage}
      />
    </div>
  );
};
