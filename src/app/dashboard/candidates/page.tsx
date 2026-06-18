"use client";

import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CandidateSidebarFilters } from '@/components/candidates/CandidateSidebarFilters';
import { CandidateCard } from '@/components/candidates/CandidateCard';
import { FloatingActionBar } from '@/components/candidates/FloatingActionBar';
import { Button } from '@/components/ui/Button';

export default function CandidatesSearch() {
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const toggleCandidate = (id: string) => {
    setSelectedCandidates(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
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

  return (
    <div className="flex-1 relative w-full bg-white">
      <PageHeader title="Search Candidates" />
      
      <div className="flex flex-col items-start self-stretch relative">
        <div className="flex items-start self-stretch relative">
          <CandidateSidebarFilters />
          
          {/* Main Feed */}
          <div className="flex-1 flex flex-col gap-4 min-w-0 pr-6 pb-[100px]">
            {/* AI Search Banner */}
            <div className="flex flex-col self-stretch bg-white py-[17px] mb-2 gap-[21px] rounded-[10px] border border-solid border-[#E0E0E0]" style={{ boxShadow: '0px 2px 4px #0000000D' }}>
              <div className="flex flex-col items-start self-stretch bg-white pt-[13px] pb-[33px] px-[17px] mx-[21px] rounded-lg border border-solid border-[#E0E0E0]">
                <textarea 
                  className="text-[#212121] text-[13px] w-full border-none outline-none resize-none bg-transparent"
                  placeholder="Describe the ideal candidate (e.g. Senior Frontend Developer with experience in SaaS, React, and Fintech compliance)..."
                  rows={2}
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
                <Button variant="primary" icon={<img src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/ft3ifvri_expires_30_days.png" className="w-4 h-4 object-fill" alt="icon" />}>
                  Search with AI
                </Button>
              </div>
            </div>
            
            {/* Sort Bar */}
            <div className="flex justify-between items-center self-stretch mb-2">
              <span className="text-[#616161] text-[13px] font-bold">
                Showing 247 candidates
              </span>
              <div className="flex shrink-0 items-center py-1 px-[3px] gap-2 rounded cursor-pointer">
                <span className="text-[#616161] text-[13px]">
                  Sort by:
                </span>
                <span className="text-[#212121] text-[13px] font-bold">
                  Best Match
                </span>
                <img
                  src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/1ba16p4c_expires_30_days.png" 
                  className="w-[9px] h-[5px] object-fill"
                  alt="sort"
                />
              </div>
            </div>
            
            {/* Candidate List */}
            {candidatesData.map(candidate => (
              <CandidateCard
                key={candidate.id}
                {...candidate}
                isSelected={selectedCandidates.includes(candidate.id)}
                onToggle={() => toggleCandidate(candidate.id)}
              />
            ))}
            
            <FloatingActionBar 
              selectedCount={selectedCandidates.length} 
              onClear={() => setSelectedCandidates([])} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
