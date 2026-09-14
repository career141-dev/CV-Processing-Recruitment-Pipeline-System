'use client';

import React, { useState } from 'react';
import { ArrowUpDown, MoreHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { INITIAL_EXCEL_CANDIDATES } from '../mock-data';
import {
  DeskCard,
  DeskButton,
  DeskBadge,
  CandidateNameLink,
} from '../../components/common';

export const ExcelTablesView: React.FC = () => {
  const [candidates, setCandidates] = useState(INITIAL_EXCEL_CANDIDATES);
  const [linkedInInput, setLinkedInInput] = useState<string>('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [expandedEducations, setExpandedEducations] = useState<Record<string, boolean>>({});

  const handleToggleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedCandidateIds((prev) => [...prev, id]);
    } else {
      setSelectedCandidateIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleToggleEducation = (id: string) => {
    setExpandedEducations((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddLinkedInLink = () => {
    if (!linkedInInput.trim()) {
      toast.error('Please enter a link or competitor');
      return;
    }
    toast.success(`Added: ${linkedInInput.trim()}`);
    setLinkedInInput('');
  };

  const handleChangeStage = (candidateName: string) => {
    toast.info(`Change stage for ${candidateName}`);
  };

  const handleUploadCV = (candidateName: string) => {
    toast.info(`Upload CV for ${candidateName}`);
  };

  return (
    <DeskCard className="p-4 sm:p-6 md:p-8 space-y-7">
      {/* ── HEADER ── */}
      <div>
        <h1 className="text-[18px] sm:text-[20px] font-bold text-slate-800 tracking-tight">
          Excel Tables
        </h1>
      </div>

      {/* ── LINKEDIN LINK INPUT ROW ── */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
        {/* Outlined Input Box with Floating Label */}
        <div className="relative flex-1 min-w-[240px] rounded-[9px] border border-[#DBDEE0] bg-white pt-2.5 pb-2 px-3.5 sm:px-4 focus-within:border-[#165B42] focus-within:ring-1 focus-within:ring-[#165B42]/20 transition-all flex flex-col justify-center min-h-[48px]">
          <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-[11.5px] sm:text-[12px] font-semibold text-slate-800 pointer-events-none select-none">
            LinkedIn Link
          </label>
          <input
            type="text"
            value={linkedInInput}
            onChange={(e) => setLinkedInInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddLinkedInLink()}
            placeholder="Add Competitors"
            className="chat-borderless-input w-full bg-transparent text-[13px] sm:text-[13.5px] text-slate-800 placeholder:text-slate-400 border-none outline-none focus:outline-none focus:ring-0 shadow-none font-normal"
          />
        </div>

        {/* Add Button */}
        <button
          type="button"
          onClick={handleAddLinkedInLink}
          className="px-6 sm:px-8 py-2.5 bg-[#165B42] hover:bg-[#114934] active:scale-95 text-white font-semibold rounded-[8px] text-[13px] transition-all cursor-pointer shadow-xs shrink-0"
        >
          Add
        </button>
      </div>

      {/* ── CANDIDATE LIST ── */}
      <div className="pt-2 divide-y divide-[#DBDEE0]">
        {candidates.map((candidate) => {
          const isSelected = selectedCandidateIds.includes(candidate.id);
          const isExpanded = !!expandedEducations[candidate.id];

          return (
            <div
              key={candidate.id}
              className={`pt-5 pb-4 transition-colors hover:bg-slate-50/40 rounded-lg ${
                isSelected ? 'bg-sky-50/30' : ''
              }`}
            >
              <div className="flex flex-col lg:flex-row items-start gap-4">
                {/* Checkbox + Candidate Details */}
                <div className="flex items-start gap-2.5 sm:gap-4 flex-1 min-w-0 w-full">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleToggleSelect(candidate.id, e.target.checked)}
                    className="w-4 h-4 mt-1 rounded border-slate-300 text-[#165B42] focus:ring-[#165B42] cursor-pointer shrink-0"
                  />

                  {/* Main Candidate Details */}
                  <div className="flex-1 space-y-3 min-w-0">
                    {/* Header: Name, Rank, Badges */}
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <CandidateNameLink
                          name={candidate.name}
                          onClick={() => toast.info(`Viewing profile for ${candidate.name}`)}
                        />
                        <span className="text-[12px] text-slate-500 font-normal">
                          in · {candidate.rank}
                        </span>
                        {candidate.isApplicant && (
                          <DeskBadge variant="applicant">Applicant</DeskBadge>
                        )}
                      </div>

                      <p className="text-[13px] font-semibold text-slate-800 mt-1">
                        {candidate.role}
                      </p>
                      <p className="text-[13px] text-slate-500 mt-0.5 break-words">
                        {candidate.location} · {candidate.industry}
                      </p>
                    </div>

                    {/* Structured Metadata (Overview & LinkedIn URL) */}
                    <div className="space-y-2.5 text-[13px] pt-1">
                      {/* Overview */}
                      <div className="flex items-start gap-2.5 sm:gap-4">
                        <span className="w-[95px] sm:w-[105px] min-w-[95px] sm:min-w-[105px] font-bold text-slate-900 shrink-0">
                          Overview
                        </span>
                        <div className="flex-1 min-w-0 space-y-1 text-slate-800 break-words">
                          {candidate.overviewExperiences.map((exp, idx) => (
                            <p key={idx}>{exp}</p>
                          ))}
                        </div>
                      </div>

                      {/* LinkedIn URL */}
                      <div className="flex items-start gap-2.5 sm:gap-4">
                        <span className="w-[95px] sm:w-[105px] min-w-[95px] sm:min-w-[105px] font-bold text-slate-900 shrink-0">
                          LinkedIn URL
                        </span>
                        <div className="flex-1 min-w-0 space-y-1 text-slate-800 break-words">
                          {candidate.initialEducations.map((edu, idx) => (
                            <p key={idx}>{edu}</p>
                          ))}
                          {isExpanded &&
                            candidate.extraEducations.map((edu, idx) => (
                              <p key={`extra-${idx}`}>{edu}</p>
                            ))}
                          {candidate.totalEducationsCount > candidate.initialEducations.length && (
                            <button
                              type="button"
                              onClick={() => handleToggleEducation(candidate.id)}
                              className="text-slate-500 hover:text-slate-800 font-normal inline-flex items-center gap-1 cursor-pointer pt-0.5"
                            >
                              <span>
                                {isExpanded
                                  ? 'Show less'
                                  : `Show all (${candidate.totalEducationsCount})`}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Action Column */}
                <div className="w-full lg:w-auto shrink-0 flex flex-col items-start lg:items-end justify-between lg:justify-start gap-2.5 text-left lg:text-right pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <DeskButton
                      variant="primary"
                      onClick={() => handleChangeStage(candidate.name)}
                      icon={<ArrowUpDown className="w-3.5 h-3.5 text-white" />}
                    >
                      <span>Change stage</span>
                    </DeskButton>

                    <DeskButton
                      variant="outline"
                      onClick={() => handleUploadCV(candidate.name)}
                    >
                      Upload CV
                    </DeskButton>

                    <button
                      type="button"
                      onClick={() => toast.info(`Options for ${candidate.name}`)}
                      className="p-1 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                      title="More Options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Status & Stage Text */}
                  <div className="space-y-0.5 pt-0.5 text-left lg:text-right">
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
        })}
      </div>
    </DeskCard>
  );
};
