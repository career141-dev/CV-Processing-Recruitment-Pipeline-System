"use client";

import React, { useState } from 'react';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { PageHeader } from '@/components/ui/PageHeader';
import { CandidateSidebarFilters } from '@/components/candidates/CandidateSidebarFilters';
import { CandidateCard } from '@/components/candidates/CandidateCard';
import { FloatingActionBar } from '@/components/candidates/FloatingActionBar';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { X, Loader2, ChevronDown, Search, Filter } from 'lucide-react';
import { MessageComposer } from '@/components/communications/MessageComposer';

function getInitials(name?: string | null): string {
  if (!name) return "??";
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getSourceVariant(source?: string | null): "success" | "warning" | "error" | "info" | "default" {
  switch (source?.toLowerCase()) {
    case "linkedin": return "success";
    case "whatsapp": return "warning";
    case "email": return "info";
    case "headhunting": return "error";
    default: return "default";
  }
}

function formatRole(title?: string | null, employer?: string | null): string {
  if (title && employer) return `${title} at ${employer}`;
  return title || employer || "Unknown Role";
}

function formatSkills(skills?: string[] | null, max = 2): string[] {
  if (!skills || skills.length === 0) return [];
  const shown = skills.slice(0, max);
  const remainder = skills.length - max;
  if (remainder > 0) shown.push(`+${remainder}`);
  return shown;
}

export default function CandidatesSearch() {
  const candidates = useQuery(api.candidates.listCandidates);

  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState('Best Match');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Message Composer State
  const [messageCandidate, setMessageCandidate] = useState<{ id: string; name: string; initials: string; role: string } | null>(null);

  const toggleCandidate = (id: string) => {
    setSelectedCandidates(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleAiSearch = () => {
    setIsAiSearching(true);
    setTimeout(() => {
      setIsAiSearching(false);
      setHasSearched(true);
    }, 2500);
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  const removeFilter = (filter: string) => {
    setActiveFilters(prev => prev.filter(f => f !== filter));
  };
  return (
    <div className="flex-1 relative w-full bg-white">
      <PageHeader title="Search Candidates" />
      
      <div className="flex flex-col items-start self-stretch relative">
        <div className="flex items-start self-stretch relative">
          
          {/* Animated Sidebar Container */}
          <div className={`transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${isSidebarOpen ? 'w-[260px] opacity-100 mr-[21px]' : 'w-0 opacity-0 mr-0'}`}>
            <div className="w-[260px]">
              <CandidateSidebarFilters activeFilters={activeFilters} onToggleFilter={toggleFilter} />
            </div>
          </div>
          
          {/* Main Feed */}
          <div className="flex-1 flex flex-col gap-4 min-w-0 pr-6 pb-[100px]">
            {/* Heading and Subtopic */}
            <div className="flex flex-col items-start mb-2">
              <h2 className="text-[22px] font-bold text-[#212121]">Smart Candidate Sourcing</h2>
              <p className="text-sm text-[#616161] mt-1">
                Use the AI prompt to describe your ideal hire, and apply filters to narrow down the results perfectly.
              </p>
            </div>

            {/* Top row with Filter toggle button and applied filters */}
            <div className="flex items-start gap-3 mb-4">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="flex shrink-0 items-center justify-center p-2.5 rounded-lg transition-colors shadow-sm bg-[#1B5E20] text-white hover:bg-[#144718]"
                title="Toggle Filters"
              >
                <Filter className="w-5 h-5" />
              </button>
              
              {/* Applied Filters Summary */}
              {activeFilters.length > 0 && (
                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 w-full">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Applied Filters:</span>
                  <div className="flex flex-wrap gap-2 flex-1">
                    {activeFilters.map(filter => (
                      <div key={filter} className="flex items-center bg-white border border-gray-200 rounded-md py-1 px-2 gap-1 text-xs text-gray-700 shadow-sm">
                        {filter}
                        <button onClick={() => removeFilter(filter)} className="text-gray-400 hover:text-red-500 ml-1">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setActiveFilters([])} className="text-xs text-[#1B5E20] font-medium hover:underline shrink-0">
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* AI Search Banner */}
            <div className="flex flex-col self-stretch bg-white py-[17px] mb-2 gap-[21px] rounded-[10px] border border-solid border-[#E0E0E0]" style={{ boxShadow: '0px 2px 4px #0000000D' }}>
              <div className="flex flex-col items-start self-stretch bg-white pt-[13px] pb-[33px] px-[17px] mx-[21px] rounded-lg border border-solid border-[#E0E0E0]">
                <textarea 
                  className="text-[#212121] text-[13px] w-full border-none outline-none resize-none bg-transparent"
                  placeholder="Describe the ideal candidate (e.g. Senior Frontend Developer with experience in SaaS, React, and Fintech compliance)..."
                  rows={2}
                  disabled={isAiSearching}
                ></textarea>
              </div>
              <div className="flex items-center self-stretch ml-[21px] mr-9 gap-1.5">
                <img
                  src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/vj27hvjd_expires_30_days.png" 
                  className="w-[13px] h-[13px] object-fill"
                  alt="icon"
                />
                <span className="text-[#616161] text-xs">
                  AI will score all results against this description to find the most relevant matches.
                </span>
                <div className="flex-1"></div>
                <Button 
                  variant="primary" 
                  onClick={handleAiSearch}
                  disabled={isAiSearching}
                  icon={
                    isAiSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <img src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/ft3ifvri_expires_30_days.png" className="w-4 h-4 object-fill" alt="icon" />
                    )
                  }
                >
                  {isAiSearching ? 'Scoring Candidates...' : 'Search with AI'}
                </Button>
              </div>
            </div>
            
            {/* Sort Bar */}
            <div className="flex justify-between items-center self-stretch mb-2">
              <span className="text-[#616161] text-[13px] font-bold">
                {candidates === undefined
                  ? "Loading..."
                  : `Showing ${candidates.length} candidate${candidates.length !== 1 ? "s" : ""}`}
              </span>
              <div className="flex shrink-0 items-center py-1 px-[3px] gap-2 rounded cursor-pointer">
                <span className="text-[#616161] text-[13px]">
                  Sort by:
                </span>
                <span className="text-[#212121] text-[13px] font-bold">
                  Best Match
                </span>
              </div>
              </div>
            
            
            {/* Candidate List */}
            {candidates === undefined ? (
              <div className="flex justify-center py-10 text-[#9E9E9E] text-sm">Loading candidates...</div>
            ) : candidates.length === 0 ? (
              <div className="flex justify-center py-10 text-[#9E9E9E] text-sm">No candidates yet. Upload CVs to get started.</div>
            ) : (
              candidates.map((c) => (
                <CandidateCard
                  key={c._id}
                  id={c._id}
                  name={c.fullName || "Unknown"}
                  initials={getInitials(c.fullName)}
                  sourceText={(c.sourceChannel || "Manual").toUpperCase()}
                  sourceVariant={getSourceVariant(c.sourceChannel)}
                  role={formatRole(c.currentTitle, c.currentEmployer)}
                  location={c.location || "Unknown"}
                  skills={formatSkills(c.skills)}
                  score={75}
                  isSelected={selectedCandidates.includes(c._id)}
                  onToggle={() => toggleCandidate(c._id)}
                  profileHref={`/dashboard/candidates/${c._id}`}
                />
              ))
            )}
            
            <FloatingActionBar 
              selectedCount={selectedCandidates.length} 
              onClear={() => setSelectedCandidates([])} 
            />
          </div>
        </div>
      </div>

      {messageCandidate && (
        <MessageComposer
          isOpen={!!messageCandidate}
          onClose={() => setMessageCandidate(null)}
          candidateName={messageCandidate.name}
          candidateInitials={messageCandidate.initials}
          candidateTitle={messageCandidate.role}
        />
      )}
    </div>
  );
}
