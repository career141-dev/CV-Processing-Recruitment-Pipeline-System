"use client";

import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CandidateSidebarFilters } from '@/components/candidates/CandidateSidebarFilters';
import { CandidateCard } from '@/components/candidates/CandidateCard';
import { FloatingActionBar } from '@/components/candidates/FloatingActionBar';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { X, Loader2, ChevronDown, Search, Filter } from 'lucide-react';
import { MessageComposer } from '@/components/communications/MessageComposer';

export default function CandidatesSearch() {
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
    // Auto-search if a filter is toggled and we haven't searched yet? 
    // Let's just let the user explicitly search with the AI button.
  };

  const removeFilter = (filter: string) => {
    setActiveFilters(prev => prev.filter(f => f !== filter));
  };

  const candidatesData = [
    {
      id: '1',
      name: "Priya Nair",
      initials: "PN",
      avatarColorClass: "bg-[#ACF4A4] text-[#002C06]",
      sourceText: "WHATSAPP",
      sourceVariant: "warning" as const,
      role: "Senior Software Engineer at FinTech Global",
      location: "Mumbai, IN",
      skills: ["React", "Node.js", "+4"],
      score: 92,
      scoreIconUrl: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/vych6cj6_expires_30_days.png",
      scoreColorClass: "text-[#006E1C]"
    },
    {
      id: '2',
      name: "James Chen",
      initials: "JC",
      avatarColorClass: "bg-[#FFD9E2] text-[#6B1D3D]",
      sourceText: "LINKEDIN",
      sourceVariant: "success" as const,
      role: "Fullstack Dev at TechScale Solutions",
      location: "Singapore, SG",
      skills: ["Next.js", "Go"],
      score: 88,
      scoreIconUrl: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/3f7mjel6_expires_30_days.png",
      scoreColorClass: "text-[#006E1C]"
    },
    {
      id: '3',
      name: "Fatima Al Rashid",
      initials: "FA",
      avatarColorClass: "bg-[#00676333] text-[#006763]",
      sourceText: "EMAIL",
      sourceVariant: "success" as const,
      role: "Product Lead at Oasis Digital",
      location: "Dubai, UAE",
      skills: ["Scrum", "Jira"],
      score: 75,
      scoreIconUrl: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/tlgb2nzc_expires_30_days.png",
      scoreColorClass: "text-[#F97316]"
    }
  ];

  const filteredCandidates = candidatesData.filter(candidate => {
    if (activeFilters.length === 0) return true;

    const roleFilters = activeFilters.filter(f => ['Senior', 'Lead'].includes(f));
    const roleMatch = roleFilters.length === 0 || roleFilters.some(f => candidate.role.toLowerCase().includes(f.toLowerCase()));

    const sourceFilters = activeFilters.filter(f => ['LinkedIn', 'WhatsApp'].includes(f));
    const sourceMatch = sourceFilters.length === 0 || sourceFilters.some(f => candidate.sourceText.toLowerCase() === f.toLowerCase());

    const customFilters = activeFilters.filter(f => 
      !['Senior', 'Lead', 'LinkedIn', 'WhatsApp', 'Bachelor', 'Masters'].includes(f) && !f.includes('years')
    );
    const customMatch = customFilters.length === 0 || customFilters.some(f => 
      candidate.skills.some(s => s.toLowerCase() === f.toLowerCase()) || 
      candidate.role.toLowerCase().includes(f.toLowerCase())
    );

    return roleMatch && sourceMatch && customMatch;
  });

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
            
            {/* Sort & Legend Bar */}
            {hasSearched && (
              <div className="flex justify-between items-center self-stretch mb-4 mt-2">
                <div className="flex items-center gap-6">
                  <span className="text-[#616161] text-[13px] font-bold">
                    Showing {filteredCandidates.length} candidates
                  </span>
                  
                  {/* Match Score Legend */}
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                    <span className="font-semibold uppercase tracking-wider mr-1 text-gray-400">Match Score</span>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#006E1C]" /> &gt;80%</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#F97316]" /> 60-79%</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-gray-400" /> &lt;60%</div>
                  </div>
                </div>

                {/* Sort Dropdown */}
                <div className="relative">
                  <div 
                    className="flex shrink-0 items-center py-1.5 px-3 gap-2 rounded-md border border-gray-200 cursor-pointer hover:bg-gray-50 bg-white shadow-sm"
                    onClick={() => setIsSortOpen(!isSortOpen)}
                  >
                    <span className="text-[#616161] text-[13px]">Sort by:</span>
                    <span className="text-[#212121] text-[13px] font-bold min-w-[80px]">{sortOption}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
                  </div>
                  {isSortOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
                      {['Best Match', 'Experience', 'Recency', 'Name'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => { setSortOption(opt); setIsSortOpen(false); }}
                          className={`w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 ${sortOption === opt ? 'font-bold text-[#1B5E20]' : 'text-gray-700'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Candidate List */}
            <div className="flex flex-col gap-4 relative min-h-[400px]">
              {isAiSearching && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl">
                  <Loader2 className="w-8 h-8 text-[#1B5E20] animate-spin mb-4" />
                  <span className="text-sm font-bold text-[#1B5E20]">AI is analyzing 115,000+ candidates...</span>
                  <span className="text-xs text-gray-500 mt-1">This may take a few seconds</span>
                </div>
              )}
              
              {!hasSearched && !isAiSearching ? (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                     <Search className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-1">Start your candidate search</h3>
                  <p className="text-sm text-gray-500 mb-4">Type a prompt to describe the ideal candidate and let AI do the rest.</p>
                </div>
              ) : hasSearched && !isAiSearching && filteredCandidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                     <Search className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-1">No results match your search</h3>
                  <p className="text-sm text-gray-500 mb-4">Try removing some filters or adjusting your AI prompt.</p>
                  <Button variant="outline" onClick={() => setActiveFilters([])}>Clear All Filters</Button>
                </div>
              ) : hasSearched && !isAiSearching ? (
                filteredCandidates.map(candidate => (
                  <CandidateCard
                    key={candidate.id}
                    {...candidate}
                    isSelected={selectedCandidates.includes(candidate.id)}
                    onToggle={() => toggleCandidate(candidate.id)}
                    onMessage={() => setMessageCandidate({
                      id: candidate.id,
                      name: candidate.name,
                      initials: candidate.initials,
                      role: candidate.role
                    })}
                  />
                ))
              ) : null}
              
              {filteredCandidates.length > 0 && !isAiSearching && (
                <div className="flex justify-center mt-6">
                  <Button variant="outline" className="px-8 bg-white">
                    Load More Results
                  </Button>
                </div>
              )}
            </div>
            
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
