"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { PageHeader } from '@/components/ui/PageHeader';
import { CandidateSidebarFilters } from '@/components/candidates/CandidateSidebarFilters';
import { CandidateCard } from '@/components/candidates/CandidateCard';
import { FloatingActionBar } from '@/components/candidates/FloatingActionBar';
import { CandidateManagementTable } from '@/components/candidates/CandidateManagementTable';
import { Button } from '@/components/ui/Button';
import { X, Loader2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Sparkles, Pin, SlidersHorizontal, Filter } from 'lucide-react';
import { MessageComposer } from '@/components/communications/MessageComposer';
import { DeleteCandidateModal } from '@/components/candidates/modals/DeleteCandidateModal';
import { CvPreviewModal } from '@/components/candidates/modals/CvPreviewModal';
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

const SESSION_STORAGE_KEY = "career141_search_session";

export default function CandidatesSearch() {
  const aiSearchAction = useAction(api.matching.search.aiSearch);

  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [locationQuery, setLocationQuery] = useState("");
  const [sortOption, setSortOption] = useState('Best Match');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'management' | 'search'>('management');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  
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
    results: {
      candidateId: string;
      score: number;
      reason: string;
      breakdown?: {
        title: string;
        skills: string;
        experience: string;
        location: string;
        industry: string;
      };
    }[];
  } | null>(null);

  // Search History State
  const [searchHistory, setSearchHistory] = useState<any[]>([]);

  // Textarea Expansion Ref
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to get correct scrollHeight
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;

    // Bound between 80px and 300px
    if (scrollHeight <= 80) {
      textarea.style.height = "80px";
      textarea.style.overflowY = "hidden";
    } else if (scrollHeight >= 300) {
      textarea.style.height = "300px";
      textarea.style.overflowY = "auto";
    } else {
      textarea.style.height = `${scrollHeight}px`;
      textarea.style.overflowY = "hidden";
    }
  }, [searchQuery]);

  // Message Composer State
  const [messageCandidate, setMessageCandidate] = useState<{ id: string; name: string; initials: string; role: string } | null>(null);
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [cvPreviewCandidate, setCvPreviewCandidate] = useState<{ id: string; name: string } | null>(null);

  const [isRestored, setIsRestored] = useState(false);

  // 1. Mount effect: Load Search History from localStorage and Search Session from sessionStorage
  useEffect(() => {
    // Load History
    const savedHistory = localStorage.getItem("career141_search_history");
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (e) {}
    }

    // Load Session
    const sessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        if (parsed.activeTab) setActiveTab(parsed.activeTab);
        if (parsed.searchQuery !== undefined) setSearchQuery(parsed.searchQuery);
        if (parsed.activeFilters) setActiveFilters(parsed.activeFilters);
        if (parsed.locationQuery !== undefined) setLocationQuery(parsed.locationQuery);
        if (parsed.sortOption) setSortOption(parsed.sortOption);
        if (parsed.searchResults) setSearchResults(parsed.searchResults);
        if (parsed.hasSearched !== undefined) setHasSearched(parsed.hasSearched);
        if (parsed.searchPage) setSearchPage(parsed.searchPage);
        
        if (parsed.scrollPosition) {
          setTimeout(() => {
            window.scrollTo({
              top: parsed.scrollPosition,
              behavior: 'instant'
            });
          }, 250); // Delay to allow paginated query cache restoration
        }
      } catch (e) {
        console.error("Error restoring search session", e);
      }
    }
    setIsRestored(true);
  }, []);

  // 2. State-saving effect: Sync active tab, queries, filters, pagination, and results to sessionStorage
  useEffect(() => {
    if (!isRestored) return;
    const saveState = {
      activeTab,
      searchQuery,
      activeFilters,
      locationQuery,
      sortOption,
      searchResults,
      hasSearched,
      searchPage,
      scrollPosition: window.scrollY
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(saveState));
  }, [isRestored, activeTab, searchQuery, activeFilters, locationQuery, sortOption, searchResults, hasSearched, searchPage]);

  // 3. Scroll listener effect: Update scroll position in sessionStorage
  useEffect(() => {
    const handleScroll = () => {
      const sessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData);
          parsed.scrollPosition = window.scrollY;
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
        } catch (e) {}
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 5. Public batch resolver query for displaying candidate cards
  const searchIds = useMemo(() => {
    return (searchResults?.results || []).map(r => r.candidateId as Id<"candidates">);
  }, [searchResults]);
  
  const searchedCandidatesList = useQuery(api.candidates.candidates.listCandidatesByIds, { ids: searchIds });
  
  const searchCandidateMap = useMemo(() => {
    return new Map((searchedCandidatesList || []).map(c => [c._id, c]));
  }, [searchedCandidatesList]);

  // 6. Abstract Search runner function
  const runSearch = async (q: string, flts: string[], loc: string) => {
    let seniorityFilter: string | undefined = undefined;
    if (flts.includes("Senior")) seniorityFilter = "senior";
    else if (flts.includes("Lead")) seniorityFilter = "lead";

    let minExperience: number | undefined = undefined;
    let maxExperience: number | undefined = undefined;
    const expFilter = flts.find(f => f.includes("years"));
    if (expFilter) {
      const match = expFilter.match(/(\d+)\s*(?:-|–)\s*(\d+)/);
      if (match) {
        const min = parseInt(match[1], 10);
        const max = parseInt(match[2], 10);
        if (min > 0) minExperience = min;
        if (max < 20) maxExperience = max;
      }
    }

    const educationFilter = flts.filter(f => f === "Bachelor" || f === "Masters");
    const education = educationFilter.length > 0 ? educationFilter : undefined;

    const sourceFilter = flts.filter(f => f === "LinkedIn" || f === "WhatsApp");
    const sources = sourceFilter.length > 0 ? sourceFilter : undefined;

    const customFilters = flts.filter(f => {
      if (f === "Senior" || f === "Lead") return false;
      if (f.includes("years")) return false;
      if (f === "Bachelor" || f === "Masters") return false;
      if (f === "LinkedIn" || f === "WhatsApp") return false;
      return true;
    });
    const customFiltersParam = customFilters.length > 0 ? customFilters : undefined;

    return await aiSearchAction({
      query: q,
      seniority: seniorityFilter,
      minExperience,
      maxExperience,
      location: loc.trim() || undefined,
      education,
      sources,
      customFilters: customFiltersParam,
    });
  };

  const handleAiSearch = async () => {
    const hasQuery = searchQuery.trim() !== "";
    const hasFilters = activeFilters.length > 0 || locationQuery.trim() !== "";

    if (!hasQuery && !hasFilters) {
      toast.error("Please enter a description or select filters to browse");
      return;
    }

    setIsAiSearching(true);
    try {
      const res = await runSearch(searchQuery, activeFilters, locationQuery);
      setSearchResults(res);
      setHasSearched(true);
      setSortOption(searchQuery.trim() ? 'AI Relevancy' : 'Experience');
      setSearchPage(1);

      // Add to search history
      addToHistory(searchQuery, activeFilters, locationQuery, res.results.length);
      toast.success(`Found ${res.results.length} candidate matches`);
    } catch (error) {
      console.error(error);
      toast.error("Search failed. Please try again.");
    } finally {
      setIsAiSearching(false);
    }
  };

  // Note: Search is triggered explicitly by clicking 'Search Candidates' or pressing Enter
  // Filters update state locally without making intermediate network calls while editing.

  // 8. Search History management logic
  const saveSearchHistoryToStorage = (newHistory: any[]) => {
    setSearchHistory(newHistory);
    localStorage.setItem("career141_search_history", JSON.stringify(newHistory));
  };

function formatShortHistoryText(entry: any): string {
  const q = (entry.query || "").trim();
  const loc = (entry.location || "").trim();
  const flts = entry.filters || [];
  const count = entry.resultCount;

  const parts = [];
  if (q) parts.push(q.length > 40 ? `${q.slice(0, 40)}...` : q);
  if (loc) parts.push(loc);
  if (flts.length > 0) parts.push(flts.join(", "));

  const countSuffix = count !== undefined ? ` — ${count} result${count !== 1 ? 's' : ''}` : '';
  if (parts.length > 0) {
    return `${parts.join(" · ")}${countSuffix}`;
  }

  if (entry.summary) {
    return entry.summary.length > 60 ? `${entry.summary.slice(0, 60)}...` : entry.summary;
  }
  return "Search";
}

  const addToHistory = (q: string, flts: string[], loc: string, count: number) => {
    const parts = [];
    const cleanQ = q.trim();
    if (cleanQ) parts.push(cleanQ.length > 40 ? `${cleanQ.slice(0, 40)}...` : cleanQ);
    if (loc.trim()) parts.push(loc.trim());
    if (flts.length > 0) parts.push(...flts);

    const summaryText = `${parts.join(" · ") || "Filter-Only Search"} — ${count} result${count !== 1 ? 's' : ''}`;

    const newEntry = {
      id: Math.random().toString(36).substring(7),
      query: q,
      filters: flts,
      location: loc,
      resultCount: count,
      summary: summaryText,
      isPinned: false,
      timestamp: Date.now()
    };

    const isSame = (item: any) =>
      item.query.trim().toLowerCase() === newEntry.query.trim().toLowerCase() &&
      item.location.trim().toLowerCase() === newEntry.location.trim().toLowerCase() &&
      item.filters.length === newEntry.filters.length &&
      item.filters.every((f: string) => newEntry.filters.includes(f));

    const filtered = searchHistory.filter(item => !isSame(item));
    const merged = [newEntry, ...filtered];

    let finalHistory = merged;
    if (merged.length > 10) {
      let toEvict = merged.length - 10;
      const result = [];
      for (let i = merged.length - 1; i >= 0; i--) {
        const item = merged[i];
        if (toEvict > 0 && !item.isPinned) {
          toEvict--;
        } else {
          result.unshift(item);
        }
      }
      finalHistory = result.slice(0, 10);
    }

    saveSearchHistoryToStorage(finalHistory);
  };

  const togglePinHistory = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = searchHistory.map(item => {
      if (item.id === id) return { ...item, isPinned: !item.isPinned };
      return item;
    });
    saveSearchHistoryToStorage(updated);
  };

  const deleteHistoryEntry = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = searchHistory.filter(item => item.id !== id);
    saveSearchHistoryToStorage(updated);
  };

  const triggerHistorySearch = async (entry: any) => {
    setSearchQuery(entry.query);
    setActiveFilters(entry.filters);
    setLocationQuery(entry.location);
    setSearchPage(1);

    setIsAiSearching(true);
    try {
      const res = await runSearch(entry.query, entry.filters, entry.location);
      setSearchResults(res);
      setHasSearched(true);
      setSortOption(entry.query.trim() ? 'AI Relevancy' : 'Experience');
      toast.success(`Restored Search: Found ${res.results.length} candidate matches`);
    } catch (e) {
      toast.error("Failed to run search");
    } finally {
      setIsAiSearching(false);
    }
  };

  const toggleCandidate = (id: string) => {
    setSelectedCandidates(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  const removeFilter = (filter: string) => {
    setActiveFilters(prev => prev.filter(f => f !== filter));
  };

  const candidatesToRender = useMemo(() => {
    if (!hasSearched || !searchResults) return [];
    return searchResults.results
      .map(res => {
        const cand = searchCandidateMap.get(res.candidateId as any);
        if (!cand) return null;
        return { 
          ...cand, 
          score: res.score, 
          matchReason: res.reason,
          breakdown: res.breakdown 
        };
      })
      .filter(Boolean);
  }, [hasSearched, searchResults, searchCandidateMap]);

  const sortedCandidates = useMemo(() => {
    const list = [...candidatesToRender];
    if (sortOption === 'AI Score') {
      list.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));
    } else if (sortOption === 'Experience') {
      list.sort((a: any, b: any) => (b.yearsOfExperience ?? 0) - (a.yearsOfExperience ?? 0));
    } else if (sortOption === 'Name') {
      list.sort((a: any, b: any) => (a.fullName || '').localeCompare(b.fullName || ''));
    }
    return list;
  }, [candidatesToRender, sortOption]);

  const searchStartIndex = (searchPage - 1) * searchItemsPerPage;
  const currentSearchItems = sortedCandidates.slice(searchStartIndex, searchStartIndex + searchItemsPerPage);
  const totalSearchPages = Math.ceil(sortedCandidates.length / searchItemsPerPage);

  const isPromptState = !hasSearched && activeFilters.length === 0 && locationQuery.trim() === "";

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
            onClick={() => { 
              setActiveTab('management'); 
              setSelectedCandidates([]); 
              setSearchQuery("");
              setLocationQuery("");
              setActiveFilters([]);
              setHasSearched(false);
              setSearchResults(null);
              setSearchPage(1);
            }}
          >
            Candidate Management
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'search'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => { 
              setActiveTab('search'); 
              setSelectedCandidates([]); 
              setSearchQuery("");
              setLocationQuery("");
              setActiveFilters([]);
              setHasSearched(false);
              setSearchResults(null);
              setSearchPage(1);
            }}
          >
            Candidate Search
          </button>
        </div>
      </div>

      {activeTab === 'management' && (
        <CandidateManagementTable 
          onDeleteClick={(id: string) => setDeletingCandidateId(id)}
          selectedCandidates={selectedCandidates}
          onToggleCandidate={toggleCandidate}
          onSelectAll={(ids) => setSelectedCandidates(ids)}
        />
      )}

      {activeTab === 'search' && (
        <div className="flex flex-col items-start self-stretch relative w-full px-6 pb-[100px]">
          {/* Heading and Filter Toggle Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between w-full mb-4 gap-4">
            <div>
              <h2 className="text-[22px] font-bold text-text-primary">Smart Candidate Sourcing</h2>
              <p className="text-sm text-text-secondary mt-1">
                Use the AI prompt to describe your ideal hire, and toggle filter options to refine results.
              </p>
            </div>

            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                showFilterPanel || activeFilters.length > 0 || locationQuery.trim() !== ''
                  ? 'bg-[#1B5E20] text-white border-[#1B5E20] shadow-sm'
                  : 'bg-surface text-text-primary border-border hover:bg-gray-50 dark:hover:bg-white/5'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>{showFilterPanel ? 'Hide Filters' : 'Filter Options'}</span>
              {(activeFilters.length > 0 || locationQuery.trim() !== '') && (
                <span className="ml-1 px-2 py-0.5 bg-white text-[#1B5E20] text-[10px] font-bold rounded-full">
                  {activeFilters.length + (locationQuery.trim() ? 1 : 0)}
                </span>
              )}
              {showFilterPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Collapsible 3-Pillar Filter Panel */}
          {showFilterPanel && (
            <div className="w-full mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <CandidateSidebarFilters
                activeFilters={activeFilters}
                onToggleFilter={toggleFilter}
                location={locationQuery}
                onLocationChange={setLocationQuery}
                onClearAll={() => {
                  setActiveFilters([]);
                  setLocationQuery('');
                }}
              />
            </div>
          )}

            {/* AI Search Banner Area */}
            <div className="flex flex-col self-stretch bg-surface py-[17px] mb-2 gap-[17px] rounded-[10px] border border-solid border-border" style={{ boxShadow: '0px 2px 4px #0000000D' }}>
              
              {/* 4.2 Applied Filters Shown as Chips in the Search Bar Area */}
              {((hasSearched && searchQuery.trim() !== "") || activeFilters.length > 0 || locationQuery.trim() !== "") && (
                <div className="flex flex-wrap items-center gap-2 px-[21px] pb-3 border-b border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Active Criteria:</span>
                  
                  {/* AI Query Chip */}
                  {hasSearched && searchQuery.trim() !== "" && (
                    <div className="inline-flex items-center gap-1.5 bg-[#EAF5EC] border border-[#CDE5D2] text-[#1B5E20] text-xs px-2.5 py-1 rounded-md font-medium max-w-full">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#1B5E20]" />
                      <span className="truncate max-w-[240px] text-[11px]">Query: "{searchQuery}"</span>
                      <button 
                        onClick={() => {
                          setSearchQuery("");
                          setHasSearched(false);
                          setSearchResults(null);
                        }} 
                        className="text-[#1B5E20] hover:text-[#0C3C11] ml-1 font-bold text-sm leading-none"
                        title="Clear query"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {/* Location Chip */}
                  {locationQuery.trim() !== "" && (
                    <div className="inline-flex items-center gap-1 bg-surface-container-high border border-border text-text-primary text-[11px] px-2.5 py-1 rounded-md">
                      <span className="text-text-secondary">Location:</span>
                      <span className="font-semibold">{locationQuery}</span>
                      <button 
                        onClick={() => setLocationQuery("")} 
                        className="text-text-disabled hover:text-red-500 ml-1 font-bold text-sm leading-none"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {/* Structured Filter Chips */}
                  {activeFilters.map(filter => (
                    <div key={filter} className="inline-flex items-center gap-1 bg-surface-container-high border border-border text-text-primary text-[11px] px-2.5 py-1 rounded-md">
                      <span className="font-semibold">{filter}</span>
                      <button 
                        onClick={() => removeFilter(filter)} 
                        className="text-text-disabled hover:text-red-500 ml-1 font-bold text-sm leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => {
                      setSearchQuery("");
                      setLocationQuery("");
                      setActiveFilters([]);
                      setHasSearched(false);
                      setSearchResults(null);
                    }} 
                    className="text-xs text-[#006E1C] font-semibold hover:underline shrink-0 ml-auto"
                  >
                    Clear All
                  </button>
                </div>
              )}

              {/* 4.3 Auto-expanding search textarea container */}
              <div className="flex flex-col items-start self-stretch bg-surface pt-[13px] pb-[33px] px-[17px] mx-[21px] rounded-lg border border-solid border-border">
                <textarea 
                  ref={textareaRef}
                  style={{ height: "80px" }}
                  className="text-text-primary text-[13px] w-full border-none outline-none resize-none bg-transparent overflow-y-auto"
                  placeholder="Describe the ideal candidate (e.g. Senior Frontend Developer with experience in SaaS, React, and Fintech compliance)..."
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

              {/* Bottom bar of input area */}
              <div className="flex items-center self-stretch ml-[21px] mr-9 gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#1B5E20] shrink-0" />
                <span className="text-text-secondary text-xs">
                  AI will score all results against this description to find the most relevant matches.
                </span>
                <div className="flex-1"></div>
                {hasSearched && (
                  <Button
                    variant="outline"
                    className="mr-2 h-9 text-xs py-1 px-3 border border-solid border-[#E0E0E0] hover:bg-gray-50 dark:hover:bg-white/5 rounded-md"
                    onClick={() => {
                      setHasSearched(false);
                      setSearchResults(null);
                      setSearchQuery("");
                      setLocationQuery("");
                      setActiveFilters([]);
                      setSortOption('Best Match');
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
                      <Sparkles className="w-4 h-4 text-white" />
                    )
                  }
                >
                  {isAiSearching ? 'Scoring Candidates...' : 'Search with AI'}
                </Button>
              </div>
            </div>

            {/* 4.6 Search History Section */}
            {searchHistory.length > 0 && (
              <div className="flex flex-col gap-2 bg-surface p-4 rounded-[10px] border border-solid border-border mb-2 shadow-sm w-full self-stretch">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Searches</span>
                  <button 
                    onClick={() => saveSearchHistoryToStorage([])} 
                    className="text-[11px] text-red-500 hover:underline font-semibold"
                  >
                    Clear History
                  </button>
                </div>
                <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto">
                  {searchHistory.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-md transition-colors group">
                      <button 
                        onClick={() => triggerHistorySearch(entry)}
                        className="flex-1 text-left text-xs text-text-primary hover:text-[#006E1C] font-semibold truncate"
                        title={entry.query ? `Query: ${entry.query}` : entry.summary}
                      >
                        {formatShortHistoryText(entry)}
                      </button>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => togglePinHistory(entry.id, e)}
                          className={`p-1 rounded hover:bg-gray-200 transition-colors ${entry.isPinned ? 'text-primary' : 'text-gray-400'}`}
                          title={entry.isPinned ? "Unpin Search" : "Pin Search"}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => deleteHistoryEntry(entry.id, e)}
                          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete from history"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 4.4 No candidates shown before search is triggered / Clean Prompt State */}
            {isPromptState ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-surface border border-dashed border-border rounded-xl w-full self-stretch">
                <div className="flex items-center justify-center bg-[#EAF5EC] p-4 rounded-full text-[#1B5E20] mb-4">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-text-primary mb-1">
                  Smart Talent Sourcing
                </h3>
                <p className="text-xs text-text-secondary max-w-md leading-relaxed mb-6 mx-auto">
                  Describe your ideal candidate in the prompt above, or click Filter Options to refine matching profiles.
                </p>
                
                {/* Example Search Prompts Centered Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl w-full mx-auto justify-center">
                  <button
                    onClick={() => {
                      setSearchQuery("Senior React Developer with 5+ years of experience in SaaS and Fintech compliance");
                    }}
                    className="bg-surface hover:bg-gray-50 dark:hover:bg-white/5 border border-border p-3.5 rounded-xl text-left text-xs transition-all shadow-sm hover:border-[#1B5E20] cursor-pointer group flex flex-col justify-between"
                  >
                    <span className="font-bold text-text-primary group-hover:text-[#1B5E20] transition-colors block mb-1">Fintech Frontend Dev</span>
                    <span className="text-text-secondary text-[11px] line-clamp-2 leading-snug">"Senior React Developer with 5+ years of experience in SaaS and Fintech compliance"</span>
                  </button>
                  <button
                    onClick={() => {
                      setSearchQuery("Data Engineer who knows Python, Spark, AWS Redshift, and data pipeline orchestration");
                    }}
                    className="bg-surface hover:bg-gray-50 dark:hover:bg-white/5 border border-border p-3.5 rounded-xl text-left text-xs transition-all shadow-sm hover:border-[#1B5E20] cursor-pointer group flex flex-col justify-between"
                  >
                    <span className="font-bold text-text-primary group-hover:text-[#1B5E20] transition-colors block mb-1">Data Pipeline Builder</span>
                    <span className="text-text-secondary text-[11px] line-clamp-2 leading-snug">"Data Engineer who knows Python, Spark, AWS Redshift, and data pipeline orchestration"</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Sort Bar */}
                <div className="flex justify-between items-center self-stretch mb-2">
                  <span className="text-text-secondary text-[13px] font-bold">
                    {searchedCandidatesList === undefined
                      ? "Loading..."
                      : `Showing ${sortedCandidates.length === 0 ? 0 : Math.min((searchPage - 1) * searchItemsPerPage + 1, sortedCandidates.length)} to ${Math.min(searchPage * searchItemsPerPage, sortedCandidates.length)} of ${sortedCandidates.length} candidate${sortedCandidates.length !== 1 ? "s" : ""}`}
                  </span>
                  <div className="relative">
                    <div 
                      onClick={() => setIsSortOpen(!isSortOpen)}
                      className="flex shrink-0 items-center py-1 px-[3px] gap-2 rounded cursor-pointer select-none"
                    >
                      <span className="text-text-secondary text-[13px]">
                        Sort by:
                      </span>
                      <span className="text-text-primary text-[13px] font-bold flex items-center gap-1">
                        {sortOption} <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                      </span>
                    </div>
                    
                    {isSortOpen && (
                      <div className="absolute right-0 mt-1 w-40 bg-surface rounded-md border border-border shadow-lg py-1 z-50">
                        {hasSearched ? (
                          <>
                            <button
                              onClick={() => { setSortOption('AI Relevancy'); setIsSortOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors ${sortOption === 'AI Relevancy' ? 'font-bold text-primary bg-primary-container' : 'text-text-primary'}`}
                            >
                              AI Relevancy
                            </button>
                            <button
                              onClick={() => { setSortOption('AI Score'); setIsSortOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors ${sortOption === 'AI Score' ? 'font-bold text-primary bg-primary-container' : 'text-text-primary'}`}
                            >
                              AI Score
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => { setSortOption('Best Match'); setIsSortOpen(false); }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors ${sortOption === 'Best Match' ? 'font-bold text-primary bg-primary-container' : 'text-text-primary'}`}
                          >
                            Best Match
                          </button>
                        )}
                        <button
                          onClick={() => { setSortOption('Experience'); setIsSortOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors ${sortOption === 'Experience' ? 'font-bold text-primary bg-primary-container' : 'text-text-primary'}`}
                        >
                          Experience
                        </button>
                        <button
                          onClick={() => { setSortOption('Name'); setIsSortOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors ${sortOption === 'Name' ? 'font-bold text-primary bg-primary-container' : 'text-text-primary'}`}
                        >
                          Name
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Candidate List */}
                {searchedCandidatesList === undefined ? (
                  <div className="flex justify-center py-10 text-text-disabled text-sm">Loading candidates...</div>
                ) : candidatesToRender.length === 0 ? (
                  <div className="flex justify-center py-10 text-text-disabled text-sm">
                    {hasSearched ? 'No matching candidates found. Try a different query.' : 'No candidates matching filters found.'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 w-full self-stretch">
                    {(currentSearchItems as any[]).map((c) => c && (
                      <CandidateCard
                        key={c._id}
                        id={c._id}
                        name={c.fullName || (c.email ? c.email.split("@")[0] : "Candidate Profile")}
                        initials={getInitials(c.fullName || c.email || "Candidate")}
                        sourceText={(c.sourceChannel || "Manual").toUpperCase()}
                        sourceVariant={getSourceVariant(c.sourceChannel)}
                        role={formatRole(c.currentTitle || c.currentJobTitle, c.currentEmployer)}
                        location={c.location || "Unknown"}
                        skills={formatSkills(c.skills)}
                        score={c.score}
                        matchReason={c.matchReason}
                        breakdown={c.breakdown}
                        isSelected={selectedCandidates.includes(c._id)}
                        onToggle={() => toggleCandidate(c._id)}
                        profileHref={`/dashboard/candidates/${c._id}`}
                        imageUrl={(c as any).profileImageUrl}
                        onDelete={() => setDeletingCandidateId(c._id)}
                        onShowCv={() => setCvPreviewCandidate({
                          id: c._id,
                          name: c.fullName || (c.email ? c.email.split("@")[0] : "Candidate")
                        })}
                        onMessage={() => setMessageCandidate({
                          id: c._id,
                          name: c.fullName || "Unknown",
                          initials: getInitials(c.fullName),
                          role: formatRole(c.currentTitle, c.currentEmployer)
                        })}
                      />
                    ))}
                  </div>
                )}
                
                {/* Search Pagination Controls */}
                {candidatesToRender.length > 0 && (
                  <div className="flex items-center justify-between mt-4 bg-surface p-3 rounded-lg border border-gray-200 w-full self-stretch">
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
              </>
            )}
        </div>
      )}

      <FloatingActionBar 
        selectedCandidates={selectedCandidates} 
        onClear={() => setSelectedCandidates([])} 
      />

      {messageCandidate && (
        <MessageComposer
          isOpen={!!messageCandidate}
          onClose={() => setMessageCandidate(null)}
          candidateName={messageCandidate.name}
          candidateInitials={messageCandidate.initials}
          candidateTitle={messageCandidate.role}
        />
      )}

      <DeleteCandidateModal 
        isOpen={!!deletingCandidateId}
        onClose={() => setDeletingCandidateId(null)}
        candidateId={deletingCandidateId}
      />

      <CvPreviewModal
        isOpen={!!cvPreviewCandidate}
        onClose={() => setCvPreviewCandidate(null)}
        candidateId={cvPreviewCandidate?.id || null}
        candidateName={cvPreviewCandidate?.name}
      />

    </div>
  );
}
