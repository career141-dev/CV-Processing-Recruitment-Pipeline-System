"use client";

import React, { useState } from 'react';
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { PageHeader } from '@/components/ui/PageHeader';
import { CandidateSidebarFilters } from '@/components/candidates/CandidateSidebarFilters';
import { CandidateCard } from '@/components/candidates/CandidateCard';
import { FloatingActionBar } from '@/components/candidates/FloatingActionBar';
import { CandidateManagementTable } from '@/components/candidates/CandidateManagementTable';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { X, Loader2, ChevronDown, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { MessageComposer } from '@/components/communications/MessageComposer';
import { toast } from 'sonner';

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
  const candidates = useQuery(api.candidates.candidates.listCandidates);
  const aiSearchAction = useAction(api.matching.search.aiSearch);

  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState('Best Match');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'management' | 'search'>('management');
  
  // Search Tab Pagination
  const [searchPage, setSearchPage] = useState(1);
  const searchItemsPerPage = 10;
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    interpretation: {
      searchText: string;
      industry?: string;
      seniority?: string;
      minYears?: number;
      interpretation: string;
      keywords: string[];
    };
    results: { candidateId: string; score: number; reason: string }[];
  } | null>(null);

  // Message Composer State
  const [messageCandidate, setMessageCandidate] = useState<{ id: string; name: string; initials: string; role: string } | null>(null);

  const toggleCandidate = (id: string) => {
    setSelectedCandidates(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleAiSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search description");
      return;
    }
    setIsAiSearching(true);
    try {
      // Extract optional filters if they are applied in UI
      let seniorityFilter: string | undefined = undefined;
      if (activeFilters.includes("Senior")) seniorityFilter = "senior";
      else if (activeFilters.includes("Lead")) seniorityFilter = "lead";

      const res = await aiSearchAction({
        query: searchQuery,
        seniority: seniorityFilter,
      });
      setSearchResults(res);
      setHasSearched(true);
      setSearchPage(1);
      toast.success(`Found ${res.results.length} candidate matches`);
    } catch (error) {
      console.error(error);
      toast.error("Search failed. Please try again.");
    } finally {
      setIsAiSearching(false);
    }
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  const removeFilter = (filter: string) => {
    setActiveFilters(prev => prev.filter(f => f !== filter));
  };

  const candidateMap = new Map((candidates ?? []).map((c: Doc<"candidates">) => [c._id, c]));

  const candidatesToRender = (hasSearched && searchResults
    ? searchResults.results
        .map(res => {
          const cand = candidateMap.get(res.candidateId as any);
          if (!cand) return null;
          return { ...cand, score: res.score, matchReason: res.reason };
        })
        .filter(Boolean)
    : (candidates ?? []).map((c: Doc<"candidates">) => ({ ...c, score: undefined as number | undefined, matchReason: undefined as string | undefined }))) ?? [];

  const searchStartIndex = (searchPage - 1) * searchItemsPerPage;
  const currentSearchItems = candidatesToRender.slice(searchStartIndex, searchStartIndex + searchItemsPerPage);
  const totalSearchPages = Math.ceil(candidatesToRender.length / searchItemsPerPage);

  return (
    <div className="flex-1 relative w-full bg-surface">
      <PageHeader title="Candidates" />
      
      {/* Tabs Navigation */}
      <div className="px-6 border-b border-gray-200 mt-2 mb-6">
        <div className="flex space-x-8">
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'management'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('management')}
          >
            Candidate Management
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'search'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('search')}
          >
            Candidate Search
          </button>
        </div>
      </div>

      {activeTab === 'management' && (
        <CandidateManagementTable />
      )}

      {activeTab === 'search' && (
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
              <h2 className="text-[22px] font-bold text-text-primary">Smart Candidate Sourcing</h2>
              <p className="text-sm text-text-secondary mt-1">
                Use the AI prompt to describe your ideal hire, and apply filters to narrow down the results perfectly.
              </p>
            </div>

            {/* Top row with Filter toggle button and applied filters */}
            <div className="flex items-start gap-3 mb-4">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="flex shrink-0 items-center justify-center p-2.5 rounded-lg transition-colors shadow-sm bg-primary-container text-on-primary hover:bg-[#144718]"
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
                      <div key={filter} className="flex items-center bg-surface border border-gray-200 rounded-md py-1 px-2 gap-1 text-xs text-gray-700 shadow-sm">
                        {filter}
                        <button onClick={() => removeFilter(filter)} className="text-gray-400 hover:text-red-500 ml-1">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setActiveFilters([])} className="text-xs text-primary-container font-medium hover:underline shrink-0">
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* AI Search Banner */}
            <div className="flex flex-col self-stretch bg-surface py-[17px] mb-2 gap-[21px] rounded-[10px] border border-solid border-border" style={{ boxShadow: '0px 2px 4px #0000000D' }}>
              <div className="flex flex-col items-start self-stretch bg-surface pt-[13px] pb-[33px] px-[17px] mx-[21px] rounded-lg border border-solid border-border">
                <textarea 
                  className="text-text-primary text-[13px] w-full border-none outline-none resize-none bg-transparent"
                  placeholder="Describe the ideal candidate (e.g. Senior Frontend Developer with experience in SaaS, React, and Fintech compliance)..."
                  rows={2}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAiSearch();
                    }
                  }}
                  disabled={isAiSearching}
                ></textarea>
              </div>
              <div className="flex items-center self-stretch ml-[21px] mr-9 gap-1.5">
                <img
                  src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/vj27hvjd_expires_30_days.png" 
                  className="w-[13px] h-[13px] object-fill"
                  alt="icon"
                />
                <span className="text-text-secondary text-xs">
                  AI will score all results against this description to find the most relevant matches.
                </span>
                <div className="flex-1"></div>
                {hasSearched && (
                  <Button
                    variant="outline"
                    className="mr-2 h-9 text-xs py-1 px-3 border border-solid border-[#E0E0E0] hover:bg-gray-50 rounded-md"
                    onClick={() => {
                      setHasSearched(false);
                      setSearchResults(null);
                      setSearchQuery("");
                    }}
                  >
                    Clear Search
                  </Button>
                )}
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
              <span className="text-text-secondary text-[13px] font-bold">
                {candidates === undefined
                  ? "Loading..."
                  : `Showing ${candidatesToRender.length === 0 ? 0 : Math.min((searchPage - 1) * searchItemsPerPage + 1, candidatesToRender.length)} to ${Math.min(searchPage * searchItemsPerPage, candidatesToRender.length)} of ${candidatesToRender.length} candidate${candidatesToRender.length !== 1 ? "s" : ""}`}
              </span>
              <div className="flex shrink-0 items-center py-1 px-[3px] gap-2 rounded cursor-pointer">
                <span className="text-text-secondary text-[13px]">
                  Sort by:
                </span>
                <span className="text-text-primary text-[13px] font-bold">
                  {hasSearched ? 'AI Relevancy' : 'Best Match'}
                </span>
              </div>
            </div>
            
            {/* Candidate List */}
            {candidates === undefined ? (
              <div className="flex justify-center py-10 text-text-disabled text-sm">Loading candidates...</div>
            ) : candidatesToRender.length === 0 ? (
              <div className="flex justify-center py-10 text-text-disabled text-sm">
                {hasSearched ? 'No matching candidates found. Try a different query.' : 'No candidates yet. Upload CVs to get started.'}
              </div>
            ) : (
              (currentSearchItems as any[]).map((c) => c && (
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
                  score={c.score}
                  matchReason={c.matchReason}
                  isSelected={selectedCandidates.includes(c._id)}
                  onToggle={() => toggleCandidate(c._id)}
                  profileHref={`/dashboard/candidates/${c._id}`}
                  onMessage={() => setMessageCandidate({
                    id: c._id,
                    name: c.fullName || "Unknown",
                    initials: getInitials(c.fullName),
                    role: formatRole(c.currentTitle, c.currentEmployer)
                  })}
                />
              ))
            )}
            
            <FloatingActionBar 
              selectedCount={selectedCandidates.length} 
              onClear={() => setSelectedCandidates([])} 
            />

            {/* Search Pagination Controls */}
            {candidatesToRender.length > 0 && (
              <div className="flex items-center justify-between mt-4 bg-surface p-3 rounded-lg border border-gray-200">
                <span className="text-sm text-gray-500">
                  Page <span className="font-medium text-gray-900">{searchPage}</span> of <span className="font-medium text-gray-900">{totalSearchPages}</span>
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-8 text-xs py-1 px-3 border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => setSearchPage(p => Math.max(1, p - 1))}
                    disabled={searchPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 text-xs py-1 px-3 border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => setSearchPage(p => Math.min(totalSearchPages, p + 1))}
                    disabled={searchPage === totalSearchPages || totalSearchPages === 0}
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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
    </div>
  );
}
