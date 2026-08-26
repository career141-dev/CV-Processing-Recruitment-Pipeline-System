"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/ui/PageHeader";
import { CandidateSidebarFilters } from "@/components/candidates/CandidateSidebarFilters";
import { CandidateCard } from "@/components/candidates/CandidateCard";
import { FloatingActionBar } from "@/components/candidates/FloatingActionBar";
import { Button } from "@/components/ui/Button";
import {
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  SlidersHorizontal,
  History,
} from "lucide-react";
import { MessageComposer } from "@/components/communications/MessageComposer";
import { DeleteCandidateModal } from "@/components/candidates/modals/DeleteCandidateModal";
import { CvPreviewModal } from "@/components/candidates/modals/CvPreviewModal";
import { toast } from "sonner";

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

const SESSION_STORAGE_KEY = "career141_ai_search_session";

export default function CandidatesSearchPage() {
  const aiSearchAction = useAction(api.matching.search.aiSearch);

  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [locationQuery, setLocationQuery] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);

  // Search Pagination
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

  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
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

  const [messageCandidate, setMessageCandidate] = useState<{ id: string; name: string; initials: string; role: string } | null>(null);
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [cvPreviewCandidate, setCvPreviewCandidate] = useState<{ id: string; name: string } | null>(null);
  const [isRestored, setIsRestored] = useState(false);

  // Restore Session
  useEffect(() => {
    const savedHistory = localStorage.getItem("career141_search_history");
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (e) {}
    }

    const sessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        if (parsed.searchQuery !== undefined) setSearchQuery(parsed.searchQuery);
        if (parsed.activeFilters) setActiveFilters(parsed.activeFilters);
        if (parsed.locationQuery !== undefined) setLocationQuery(parsed.locationQuery);
        if (parsed.searchResults) setSearchResults(parsed.searchResults);
        if (parsed.hasSearched !== undefined) setHasSearched(parsed.hasSearched);
        if (parsed.searchPage) setSearchPage(parsed.searchPage);
      } catch (e) {}
    }
    setIsRestored(true);
  }, []);

  // Save Session
  useEffect(() => {
    if (!isRestored) return;
    const saveState = {
      searchQuery,
      activeFilters,
      locationQuery,
      searchResults,
      hasSearched,
      searchPage,
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(saveState));
  }, [isRestored, searchQuery, activeFilters, locationQuery, searchResults, hasSearched, searchPage]);

  const searchIds = useMemo(() => {
    return (searchResults?.results || []).map((r) => r.candidateId as Id<"candidates">);
  }, [searchResults]);

  const searchedCandidatesList = useQuery(api.candidates.candidates.listCandidatesByIds, { ids: searchIds });

  const searchCandidateMap = useMemo(() => {
    return new Map((searchedCandidatesList || []).map((c) => [c._id, c]));
  }, [searchedCandidatesList]);

  const runSearch = async (q: string, flts: string[], loc: string) => {
    let seniorityFilter: string | undefined = undefined;
    if (flts.includes("Senior")) seniorityFilter = "senior";
    else if (flts.includes("Lead")) seniorityFilter = "lead";

    let minExperience: number | undefined = undefined;
    let maxExperience: number | undefined = undefined;
    const expFilter = flts.find((f) => f.includes("years"));
    if (expFilter) {
      const match = expFilter.match(/(\d+)\s*(?:-|–)\s*(\d+)/);
      if (match) {
        const min = parseInt(match[1], 10);
        const max = parseInt(match[2], 10);
        if (min > 0) minExperience = min;
        if (max < 20) maxExperience = max;
      }
    }

    const educationFilter = flts.filter((f) => f === "Bachelor" || f === "Masters");
    const education = educationFilter.length > 0 ? educationFilter : undefined;

    const sourceFilter = flts.filter((f) => f === "LinkedIn" || f === "WhatsApp");
    const sources = sourceFilter.length > 0 ? sourceFilter : undefined;

    const customFilters = flts.filter((f) => {
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
      education,
      sources,
      customFilters: customFiltersParam,
      location: loc || undefined,
      limit: 40,
    });
  };

  const handleAiSearchSubmit = async () => {
    if (!searchQuery.trim() && activeFilters.length === 0 && !locationQuery.trim()) {
      toast.error("Please enter a search query or select at least one filter.");
      return;
    }
    setIsAiSearching(true);
    setSearchPage(1);
    try {
      const effectiveQuery = searchQuery.trim() || activeFilters.join(" ");
      const data = await runSearch(effectiveQuery, activeFilters, locationQuery);
      setSearchResults(data as any);
      setHasSearched(true);

      const historyItem = {
        id: Date.now().toString(),
        query: searchQuery.trim() || "Filter Search",
        timestamp: new Date().toISOString(),
        matchCount: data?.results?.length || 0,
        filters: activeFilters,
        location: locationQuery,
      };

      const updatedHistory = [historyItem, ...searchHistory.filter((h) => h.query !== historyItem.query)].slice(0, 10);
      setSearchHistory(updatedHistory);
      localStorage.setItem("career141_search_history", JSON.stringify(updatedHistory));
      toast.success(`Found ${data?.results?.length || 0} candidate matches!`);
    } catch (err: any) {
      console.error("AI Search Error:", err);
      toast.error(`Search failed: ${err.message || String(err)}`);
    } finally {
      setIsAiSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
    setHasSearched(false);
    setActiveFilters([]);
    setLocationQuery("");
    setSearchPage(1);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const sortedResults = useMemo(() => {
    if (!searchResults?.results) return [];
    return [...searchResults.results];
  }, [searchResults]);

  const totalSearchPages = Math.ceil(sortedResults.length / searchItemsPerPage) || 1;
  const paginatedSearchResults = useMemo(() => {
    const start = (searchPage - 1) * searchItemsPerPage;
    return sortedResults.slice(start, start + searchItemsPerPage);
  }, [sortedResults, searchPage, searchItemsPerPage]);

  const handleToggleCandidate = (id: string) => {
    setSelectedCandidates((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
    );
  };

  const activeFilterCount = activeFilters.length + (locationQuery.trim() ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 md:p-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader title="AI Candidate Search" />

        <div className="flex flex-col items-start self-stretch w-full">
          {/* Header Bar with Filter Options Toggle */}
          <div className="flex flex-col md:flex-row md:items-center justify-between w-full mb-4 gap-4">
            <div>
              <h2 className="text-[22px] font-bold text-slate-900 dark:text-white">Smart Candidate Sourcing</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Use the AI prompt to describe your ideal hire, and toggle filter options to refine results.
              </p>
            </div>

            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                showFilterPanel || activeFilterCount > 0
                  ? "bg-emerald-700 dark:bg-emerald-600 text-white border-emerald-700 dark:border-emerald-600 shadow-sm"
                  : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>{showFilterPanel ? "Hide Filters" : "Filter Options"}</span>
              {activeFilterCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-white text-emerald-800 text-[10px] font-extrabold rounded-full">
                  {activeFilterCount}
                </span>
              )}
              {showFilterPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Collapsible 3-Pillar Top Filter Panel */}
          {showFilterPanel && (
            <div className="w-full mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
              <CandidateSidebarFilters
                activeFilters={activeFilters}
                onToggleFilter={toggleFilter}
                location={locationQuery}
                onLocationChange={setLocationQuery}
                onClearAll={() => {
                  setActiveFilters([]);
                  setLocationQuery("");
                }}
              />
            </div>
          )}

          {/* Full-Width Search Input Banner */}
          <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6">
            {/* Active Filters Chips Bar */}
            {(hasSearched || activeFilterCount > 0) && (
              <div className="flex flex-wrap items-center gap-2 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
                  Active Criteria:
                </span>

                {hasSearched && searchQuery.trim() !== "" && (
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs px-3 py-1 rounded-lg font-medium">
                    <Sparkles className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate max-w-[280px]">"{searchQuery}"</span>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setHasSearched(false);
                        setSearchResults(null);
                      }}
                      className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 ml-1 font-bold text-sm"
                    >
                      ×
                    </button>
                  </div>
                )}

                {locationQuery.trim() !== "" && (
                  <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span>Location: {locationQuery}</span>
                    <button onClick={() => setLocationQuery("")} className="hover:text-red-500 font-bold ml-1">
                      ×
                    </button>
                  </div>
                )}

                {activeFilters.map((f) => (
                  <div
                    key={f}
                    className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <span>{f}</span>
                    <button onClick={() => toggleFilter(f)} className="hover:text-red-500 font-bold ml-1">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Prompt Textarea */}
            <div className="relative flex flex-col mb-4">
              <textarea
                ref={textareaRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAiSearchSubmit();
                  }
                }}
                placeholder="Describe your target candidate requirements (e.g. 'Senior Sales Manager with 5+ years experience in FMCG or BD in Colombo')..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-xl p-4 focus:outline-none focus:border-emerald-500 transition-all resize-none min-h-[90px]"
              />
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="relative">
                {searchHistory.length > 0 && (
                  <button
                    onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Search History ({searchHistory.length})</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}

                {showHistoryDropdown && searchHistory.length > 0 && (
                  <div className="absolute left-0 top-11 z-30 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 animate-in fade-in zoom-in-95 duration-150">
                    <div className="text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 px-2 py-1 border-b border-slate-100 dark:border-slate-800 mb-1">
                      Recent Searches
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {searchHistory.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSearchQuery(item.query || "");
                            if (item.filters) setActiveFilters(item.filters);
                            if (item.location) setLocationQuery(item.location);
                            setShowHistoryDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors block"
                        >
                          <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {item.query || "Filter Search"}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex justify-between mt-0.5">
                            <span>{item.matchCount} matches</span>
                            <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 ml-auto">
                {hasSearched && (
                  <Button variant="ghost" className="text-xs h-10 px-4" onClick={clearSearch}>
                    Reset Search
                  </Button>
                )}
                <Button
                  variant="primary"
                  className="text-xs h-10 px-6 font-bold shadow-md"
                  onClick={handleAiSearchSubmit}
                  disabled={isAiSearching}
                  icon={isAiSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                >
                  {isAiSearching ? "Finding Candidates with AI..." : "Run AI Candidate Search"}
                </Button>
              </div>
            </div>
          </div>

          {/* AI Search Results Section */}
          {isAiSearching ? (
            <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-600 dark:text-emerald-400 mx-auto mb-3" />
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base mb-1">
                Searching Candidate Vector Database...
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Voyage AI embedding match $\rightarrow$ DeepSeek match score calculation.
              </p>
            </div>
          ) : hasSearched && searchResults ? (
            <div className="w-full space-y-6">
              {/* AI Interpretation Card */}
              {searchResults.interpretation && (
                <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 p-5 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                    <Sparkles className="w-4 h-4" />
                    AI Search Query Interpretation
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                    {searchResults.interpretation.interpretation}
                  </p>
                  {searchResults.interpretation.keywords && searchResults.interpretation.keywords.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Extracted Keywords:</span>
                      {searchResults.interpretation.keywords.map((kw, idx) => (
                        <span
                          key={idx}
                          className="bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-[11px] font-medium px-2 py-0.5 rounded-lg"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Scored Candidate Cards Stream */}
              <div className="w-full space-y-4">
                {paginatedSearchResults.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs italic">
                    No candidate matches found for this query. Try adjusting your search description or clearing filters.
                  </div>
                ) : (
                  paginatedSearchResults.map((res) => {
                    const cand = searchCandidateMap.get(res.candidateId as Id<"candidates">);
                    if (!cand) return null;

                    const initials = getInitials(cand.fullName);
                    const role = formatRole(cand.currentJobTitle, cand.currentCompany);
                    const sourceVar = getSourceVariant(cand.sourceChannel);

                    return (
                      <CandidateCard
                        key={cand._id}
                        id={cand._id}
                        name={cand.fullName || "Candidate"}
                        initials={initials}
                        sourceText={cand.sourceChannel || "direct"}
                        sourceVariant={sourceVar}
                        role={role}
                        location={cand.location || "Not Specified"}
                        skills={formatSkills(cand.skills, 3)}
                        score={res.score}
                        isSelected={selectedCandidates.includes(cand._id)}
                        onToggle={() => handleToggleCandidate(cand._id)}
                        onMessage={() => setMessageCandidate({ id: cand._id, name: cand.fullName || "Candidate", initials, role })}
                        onDelete={() => setDeletingCandidateId(cand._id)}
                        onShowCv={() => setCvPreviewCandidate({ id: cand.cvUploadId || cand._id, name: cand.fullName || "Candidate" })}
                        matchReason={res.reason}
                        breakdown={res.breakdown}
                      />
                    );
                  })
                )}
              </div>

              {/* Pagination Controls */}
              {totalSearchPages > 1 && (
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Page {searchPage} of {totalSearchPages} ({sortedResults.length} total candidate matches)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="text-xs h-8 px-3"
                      disabled={searchPage === 1}
                      onClick={() => setSearchPage((p) => Math.max(1, p - 1))}
                      icon={<ChevronLeft className="w-3.5 h-3.5" />}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      className="text-xs h-8 px-3"
                      disabled={searchPage === totalSearchPages}
                      onClick={() => setSearchPage((p) => Math.min(totalSearchPages, p + 1))}
                      icon={<ChevronRight className="w-3.5 h-3.5" />}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs italic">
              Enter a candidate description or job requirement above to search across the candidate database.
            </div>
          )}
        </div>
      </div>

      {/* Action Popups */}
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
