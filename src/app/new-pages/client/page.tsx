'use client';

import React, { useState, useMemo } from 'react';
import { SlidersHorizontal, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '../components/Navbar';
import { CLIENT_DESIGNATIONS, INITIAL_CLIENT_CANDIDATES, ClientCandidate } from './mock-data';
import {
  DeskCard,
  DeskSearchInput,
  DeskButton,
  DeskBadge,
  CandidateNameLink,
} from '../components/common';

export default function ClientPage() {
  const [activeNavTab, setActiveNavTab] = useState<'projects' | 'jobs' | 'reports'>('projects');
  const [candidates, setCandidates] = useState<ClientCandidate[]>(INITIAL_CLIENT_CANDIDATES);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [selectedDesignation, setSelectedDesignation] = useState<string>(CLIENT_DESIGNATIONS[0]);
  const [openDropdownCandidateId, setOpenDropdownCandidateId] = useState<string | null>('client-cand-1');

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase();
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.overviewExperiences.some((exp) => exp.toLowerCase().includes(q)) ||
        c.educationOrLinkedIn.toLowerCase().includes(q)
    );
  }, [candidates, searchQuery]);

  // Bulk selection handlers
  const isAllSelected =
    filteredCandidates.length > 0 &&
    filteredCandidates.every((c) => selectedCandidateIds.includes(c.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCandidateIds(filteredCandidates.map((c) => c.id));
    } else {
      setSelectedCandidateIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedCandidateIds((prev) => [...prev, id]);
    } else {
      setSelectedCandidateIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleSetStep = (candidateId: string, step: number) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, currentStep: step } : c))
    );
  };

  const handleRejectCandidate = (candidateId: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
    setSelectedCandidateIds((prev) => prev.filter((id) => id !== candidateId));
  };

  const handleSelectDesignation = (desig: string) => {
    setSelectedDesignation(desig);
  };

  const handleToggleDropdown = (candidateId: string) => {
    setOpenDropdownCandidateId((prev) => (prev === candidateId ? null : candidateId));
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] text-slate-800 font-sans antialiased flex flex-col selection:bg-emerald-100 selection:text-emerald-900 relative">
      {/* ── TOP NAV BAR ── */}
      <Navbar
        activeNavTab={activeNavTab}
        setActiveNavTab={setActiveNavTab}
        onBrandClick={() => {}}
      />

      {/* ── MAIN WORKSPACE CONTAINER ── */}
      <main className="flex-1 p-3.5 sm:p-5 md:p-7 pb-60 sm:pb-80 overflow-visible">
        <div className="w-full overflow-visible">
          {/* ── CANDIDATES DESK CARD (FULL WIDTH & OVERFLOW VISIBLE) ── */}
          <div className="bg-white border border-[#DBDEE0] shadow-2xs rounded-[8px] w-full overflow-visible">
            {/* 1. Toolbar */}
            <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#DBDEE0]">
              <div className="flex items-center gap-3 flex-wrap">
                <DeskSearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search pipeline"
                />

                <DeskButton
                  variant="toolbar"
                  onClick={() => toast.info('All filters')}
                  icon={<SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />}
                >
                  <span>All filters</span>
                </DeskButton>
              </div>

              <button
                type="button"
                onClick={() => toast.info('Add a candidate')}
                className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" />
                <span>Add a candidate</span>
              </button>
            </div>

            {/* 2. Results Header */}
            <div className="px-5 py-3 flex items-center justify-between text-xs text-slate-600 border-b border-[#DBDEE0] bg-white">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#165B42] focus:ring-[#165B42] cursor-pointer"
                />
                <span className="font-bold text-[#165B42] tracking-wider uppercase">
                  {filteredCandidates.length} RESULTS
                </span>
              </div>

              <div className="flex items-center gap-5 text-slate-600 text-[13px]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-slate-900">
                  <span className="text-slate-600">Sort by:</span>
                  <span className="text-slate-600">Last modified</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
                </div>
                <span className="text-slate-400">|</span>
                <span className="text-slate-600">
                  {filteredCandidates.length > 0 ? `1 – ${filteredCandidates.length}` : '0'}
                </span>
              </div>
            </div>

            {/* 3. Candidate Rows */}
            <div className="divide-y divide-[#DBDEE0] overflow-visible">
              {filteredCandidates.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-3">
                  <p className="text-sm font-medium">
                    No candidates found matching your criteria.
                  </p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-[#165B42] hover:underline font-semibold cursor-pointer"
                    >
                      Clear search query
                    </button>
                  )}
                </div>
              ) : (
                filteredCandidates.map((candidate) => {
                  const isSelected = selectedCandidateIds.includes(candidate.id);
                  const isDropdownOpen = openDropdownCandidateId === candidate.id;

                  return (
                    <div
                      key={candidate.id}
                      className={`p-4 sm:p-6 transition-colors hover:bg-slate-50/40 relative overflow-visible ${
                        isDropdownOpen ? 'z-30' : 'z-10'
                      } ${isSelected ? 'bg-sky-50/30' : ''}`}
                    >
                      <div className="flex flex-col lg:flex-row items-start gap-4 overflow-visible">
                        {/* Checkbox + Details */}
                        <div className="flex items-start gap-2.5 sm:gap-4 flex-1 min-w-0 w-full">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectOne(candidate.id, e.target.checked)}
                            className="w-4 h-4 mt-1 rounded border-slate-300 text-[#165B42] focus:ring-[#165B42] cursor-pointer shrink-0"
                          />

                          <div className="flex-1 space-y-3 min-w-0">
                            {/* Header */}
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <CandidateNameLink
                                  name={candidate.name}
                                  onClick={() =>
                                    toast.info(`Viewing profile for ${candidate.name}`)
                                  }
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

                            {/* Structured Metadata */}
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
                                <div className="flex-1 min-w-0 text-slate-800 break-words">
                                  <p>{candidate.educationOrLinkedIn}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Action Column: Step 1, 2, 3 buttons, Reject, Chevron */}
                        <div className="w-full lg:w-auto shrink-0 flex items-center justify-between lg:justify-end gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 relative overflow-visible">
                          {/* Step Sequence Buttons 1, 2, 3 */}
                          <div className="flex items-center gap-1.5">
                            {[1, 2, 3].map((step) => {
                              const isActive = candidate.currentStep === step;
                              return (
                                <button
                                  key={step}
                                  type="button"
                                  onClick={() => handleSetStep(candidate.id, step)}
                                  className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                                    isActive
                                      ? 'bg-[#165B42] text-white shadow-xs'
                                      : 'bg-white border border-[#CBD5E1] text-slate-700 hover:border-[#165B42] hover:text-[#165B42]'
                                  }`}
                                  title={`Set Step ${step}`}
                                >
                                  {step}
                                </button>
                              );
                            })}
                          </div>

                          {/* Reject Button */}
                          <button
                            type="button"
                            onClick={() => handleRejectCandidate(candidate.id)}
                            className="px-4 py-1.5 rounded-full border border-[#CBD5E1] text-slate-700 text-xs font-semibold hover:border-red-400 hover:text-red-600 hover:bg-red-50/50 transition-colors cursor-pointer"
                          >
                            Reject
                          </button>

                          {/* Dropdown Chevron Trigger */}
                          <div className="relative overflow-visible">
                            <button
                              type="button"
                              onClick={() => handleToggleDropdown(candidate.id)}
                              className="p-1 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                              title={isDropdownOpen ? 'Hide Designations' : 'Show Designations'}
                            >
                              <ChevronDown
                                className={`w-[18px] h-[18px] transition-transform duration-200 ${
                                  isDropdownOpen ? 'rotate-180 text-slate-700' : ''
                                }`}
                              />
                            </button>

                            {/* ── DOWNWARD FLOATING CLIENT DESIGNATIONS DROPDOWN (FIGMA SPECS) ── */}
                            {isDropdownOpen && (
                              <div
                                className="absolute right-0 top-full mt-2 z-50 overflow-hidden shadow-2xl"
                                style={{
                                  width: '402px',
                                  maxWidth: 'calc(100vw - 32px)',
                                  maxHeight: '874px',
                                  background: '#FFFFFFEB',
                                  borderRadius: '30px',
                                  border: '1px solid #C2C2C2',
                                  boxShadow: '0px 4px 4px 0px #00000040',
                                  backdropFilter: 'blur(8px)',
                                }}
                              >
                                <div className="divide-y divide-[#E5E7EB] max-h-[874px] overflow-y-auto scrollbar-none py-1">
                                  {CLIENT_DESIGNATIONS.map((desig, idx) => (
                                    <div
                                      key={idx}
                                      onClick={() => handleSelectDesignation(desig)}
                                      className="px-6 py-4 text-[13px] font-bold text-[#165B42] text-left transition-colors cursor-pointer select-none hover:bg-slate-50/70"
                                    >
                                      {desig}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
