'use client';

import React, { useState, useMemo } from 'react';
import { SlidersHorizontal, Plus, ChevronDown, MoreHorizontal, X, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { BooleanCandidate } from '../types';
import { INITIAL_BOOLEAN_CANDIDATES } from '../mock-data';
import {
  DeskCard,
  DeskSearchInput,
  DeskButton,
  DeskBadge,
  CandidateNameLink,
} from '../../components/common';

export const BooleanSearchView: React.FC = () => {
  const [candidates, setCandidates] = useState<BooleanCandidate[]>(INITIAL_BOOLEAN_CANDIDATES);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);

  // Add candidate form state
  const [newCandidate, setNewCandidate] = useState<{
    name: string;
    role: string;
    location: string;
    industry: string;
    experience: string;
    education: string;
  }>({
    name: '',
    role: '',
    location: 'Colombo, Western Province, Sri Lanka',
    industry: 'Food and Beverage Manufacturing',
    experience: '',
    education: '',
  });

  // Filter candidates by search query
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

  const handleAddToList = (candidateName: string) => {
    toast.success(`Added ${candidateName} to shortlist`);
  };

  const handleRejectCandidate = (candidateId: string, candidateName: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
    setSelectedCandidateIds((prev) => prev.filter((id) => id !== candidateId));
    toast.info(`Rejected candidate ${candidateName}`);
  };

  const handleCreateCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCandidate.name.trim() || !newCandidate.role.trim()) {
      toast.error('Please enter candidate name and role');
      return;
    }

    const created: BooleanCandidate = {
      id: `bool-${Date.now()}`,
      name: newCandidate.name.trim(),
      rank: '1st',
      isApplicant: true,
      role: newCandidate.role.trim(),
      location: newCandidate.location.trim() || 'Colombo, Sri Lanka',
      industry: newCandidate.industry.trim() || 'Information Technology',
      overviewExperiences: newCandidate.experience.trim()
        ? [newCandidate.experience.trim()]
        : ['Experience details pending'],
      educationOrLinkedIn:
        newCandidate.education.trim() || 'University of Colombo · Bachelor of Science',
      stageStatus: 'In contacted',
      stageChangedDate: new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      stageChangedBy: 'Nipuni Senanayake',
    };

    setCandidates((prev) => [created, ...prev]);
    setIsAddModalOpen(false);
    setNewCandidate({
      name: '',
      role: '',
      location: 'Colombo, Western Province, Sri Lanka',
      industry: 'Food and Beverage Manufacturing',
      experience: '',
      education: '',
    });
    toast.success(`Candidate ${created.name} added successfully`);
  };

  return (
    <div className="space-y-6">
      <DeskCard noPadding className="w-full">
        {/* ── 1. TOOLBAR: SEARCH PIPELINE, ALL FILTERS, ADD CANDIDATE ── */}
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#DBDEE0]">
          <div className="flex items-center gap-3 flex-wrap">
            <DeskSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search pipeline"
            />

            <DeskButton
              variant="toolbar"
              onClick={() => setIsFilterModalOpen(true)}
              icon={<SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />}
            >
              <span>All filters</span>
            </DeskButton>
          </div>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Add a candidate</span>
          </button>
        </div>

        {/* ── 2. SUBHEADER: RESULTS COUNT & SORTING ── */}
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

        {/* ── 3. CANDIDATE ROWS LIST ── */}
        <div className="divide-y divide-[#DBDEE0]">
          {filteredCandidates.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <p className="text-sm font-medium">No candidates found matching your criteria.</p>
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
              return (
                <div
                  key={candidate.id}
                  className={`p-4 sm:p-6 transition-colors hover:bg-slate-50/40 ${isSelected ? 'bg-sky-50/30' : ''
                    }`}
                >
                  <div className="flex flex-col lg:flex-row items-start gap-4">
                    {/* Checkbox + Candidate Details */}
                    <div className="flex items-start gap-2.5 sm:gap-4 flex-1 min-w-0 w-full">
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
                            <div className="flex-1 min-w-0 text-slate-800 break-words">
                              <p>{candidate.educationOrLinkedIn}</p>
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
                          onClick={() => handleAddToList(candidate.name)}
                        >
                          <span>Add to L</span>
                        </DeskButton>

                        <DeskButton
                          variant="outline"
                          onClick={() => handleRejectCandidate(candidate.id, candidate.name)}
                        >
                          Reject
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
            })
          )}
        </div>
      </DeskCard>

      {/* ── ADD CANDIDATE MODAL ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-[12px] border border-[#DBDEE0] shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#DBDEE0] flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#165B42] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Add New Candidate</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCandidate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCandidate.name}
                  onChange={(e) => setNewCandidate((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Nipuni Senanayake"
                  className="w-full px-3 py-2 bg-white border border-[#8B9399] rounded-[6px] text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#165B42] focus:border-[#165B42]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Job Designation / Role *
                </label>
                <input
                  type="text"
                  required
                  value={newCandidate.role}
                  onChange={(e) => setNewCandidate((p) => ({ ...p, role: e.target.value }))}
                  placeholder="e.g. HR Associate"
                  className="w-full px-3 py-2 bg-white border border-[#8B9399] rounded-[6px] text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#165B42] focus:border-[#165B42]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={newCandidate.location}
                    onChange={(e) => setNewCandidate((p) => ({ ...p, location: e.target.value }))}
                    placeholder="e.g. Colombo, Sri Lanka"
                    className="w-full px-3 py-2 bg-white border border-[#8B9399] rounded-[6px] text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#165B42] focus:border-[#165B42]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={newCandidate.industry}
                    onChange={(e) => setNewCandidate((p) => ({ ...p, industry: e.target.value }))}
                    placeholder="e.g. Food and Beverage"
                    className="w-full px-3 py-2 bg-white border border-[#8B9399] rounded-[6px] text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#165B42] focus:border-[#165B42]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Experience / Overview
                </label>
                <input
                  type="text"
                  value={newCandidate.experience}
                  onChange={(e) => setNewCandidate((p) => ({ ...p, experience: e.target.value }))}
                  placeholder="e.g. Human Resources Associate at Outdesk. · 2025 – Present"
                  className="w-full px-3 py-2 bg-white border border-[#8B9399] rounded-[6px] text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#165B42] focus:border-[#165B42]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  LinkedIn URL / Education
                </label>
                <input
                  type="text"
                  value={newCandidate.education}
                  onChange={(e) => setNewCandidate((p) => ({ ...p, education: e.target.value }))}
                  placeholder="e.g. University of Colombo, Bachelor of Business Administration - BBA"
                  className="w-full px-3 py-2 bg-white border border-[#8B9399] rounded-[6px] text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#165B42] focus:border-[#165B42]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#DBDEE0]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#165B42] hover:bg-[#114934] rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  Add Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ALL FILTERS MODAL ── */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-[12px] border border-[#DBDEE0] shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#DBDEE0] flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#165B42]" />
                <h3 className="text-base font-semibold text-slate-900">Filter Pipeline</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm text-slate-700">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Candidate Rank
                </label>
                <select className="w-full px-3 py-2 bg-white border border-[#8B9399] rounded-[6px] text-sm text-slate-800">
                  <option>All Ranks</option>
                  <option>1st</option>
                  <option>2nd</option>
                  <option>3rd+</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Applicant Status
                </label>
                <select className="w-full px-3 py-2 bg-white border border-[#8B9399] rounded-[6px] text-sm text-slate-800">
                  <option>All Candidates</option>
                  <option>Applicants Only</option>
                  <option>Sourced Only</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#DBDEE0]">
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFilterModalOpen(false);
                    toast.success('Filters applied');
                  }}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#165B42] hover:bg-[#114934] rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
