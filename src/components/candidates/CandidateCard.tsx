import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge, AvatarBadge } from '@/components/ui/Badge';
import { MessageCircle, Trash2, Sparkles } from 'lucide-react';

interface CandidateCardProps {
  id: string;
  name: string;
  initials: string;
  avatarColorClass?: string;
  sourceText: string;
  sourceVariant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  role: string;
  location: string;
  skills: string[];
  score?: number;
  scoreIconUrl?: string;
  scoreColorClass?: string;
  isSelected: boolean;
  onToggle: () => void;
  onMessage?: () => void;
  onDelete?: () => void;
  profileHref?: string;
  matchReason?: string;
  imageUrl?: string | null;
  breakdown?: {
    title: string;
    skills: string;
    experience: string;
    location: string;
    industry: string;
  };
}

export function CandidateCard({
  id,
  name,
  initials,
  avatarColorClass = 'bg-primary-fixed text-on-primary-fixed',
  sourceText,
  sourceVariant = 'success',
  role,
  location,
  skills,
  score,
  scoreIconUrl = 'https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/vych6cj6_expires_30_days.png',
  scoreColorClass = 'text-[#006E1C]',
  isSelected,
  onToggle,
  onMessage,
  onDelete,
  profileHref = '/dashboard/candidates/kasun',
  matchReason,
  imageUrl,
  breakdown
}: CandidateCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card 
      noPadding 
      className={`flex flex-col items-start self-stretch py-[17px] px-4 hover:border-primary-container transition-colors cursor-default !bg-surface-container-high ${isSelected ? 'border-primary-container !bg-[#E8EDE1]' : ''}`}
    >
      <div className="flex flex-row items-start w-full">
        <input 
          type="checkbox" 
          className="w-4 h-4 mr-[15px] mt-[18px] cursor-pointer shrink-0" 
          checked={isSelected}
          onChange={onToggle}
        />
        
        <div className="mr-[15px] mt-[10px] shrink-0">
          <AvatarBadge initials={initials} colorClass={avatarColorClass} imageUrl={imageUrl} />
        </div>
        
        <div className="flex-1 px-[1px] mr-4 min-w-0 flex flex-col justify-start">
          <div className="flex items-center self-stretch mb-1 gap-2 flex-wrap">
            <span className="text-text-primary text-sm font-bold truncate">
              {name}
            </span>
            {score !== undefined && score !== null && (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-primary-container bg-surface text-primary-container text-xs font-bold hover:scale-105 hover:bg-primary-container hover:text-white transition-all cursor-pointer shadow-sm shrink-0 ${isExpanded ? 'bg-primary-container text-white' : ''}`}
                title="Click to view match details"
              >
                {score}
              </button>
            )}
            <Badge variant={sourceVariant} size="sm">{sourceText}</Badge>
          </div>
          
          <div className="flex flex-col items-start self-stretch mb-1">
            <span className="text-text-secondary text-[13px] truncate">
              {role}
            </span>
          </div>
          
          <div className="flex items-center self-stretch py-1 gap-[17px] flex-wrap">
            <div className="flex shrink-0 items-center gap-1">
              <img
                src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/omthap57_expires_30_days.png" 
                className="w-[9px] h-[11px] object-fill"
                alt="loc"
              />
              <span className="text-text-disabled text-[11px]">{location}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1 flex-wrap">
              {skills.map((skill, idx) => (
                <Badge key={idx} variant="default" size="sm">{skill}</Badge>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col shrink-0 items-end gap-2 mt-[6px]">
          <div className="flex items-center gap-2">
            {onMessage && (
              <button 
                onClick={onMessage}
                className="flex items-center justify-center bg-transparent py-1 px-3 rounded-md border border-solid border-border hover:bg-surface-container-low text-text-secondary text-xs font-bold transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 mr-1" />
                Message
              </button>
            )}
            <Link href={profileHref} className="flex items-center justify-center bg-transparent py-1 px-3 rounded-md border border-solid border-border hover:bg-surface-container-high transition-colors no-underline">
              <span className="text-text-secondary text-xs font-bold">View Profile</span>
            </Link>
            {onDelete && (
              <button 
                onClick={onDelete}
                className="flex items-center justify-center bg-transparent py-1 px-2 rounded-md border border-solid border-transparent hover:border-red-200 hover:bg-red-50 text-red-500 transition-colors"
                title="Delete Candidate"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 w-full border-t border-gray-200/50 pt-3 flex flex-col gap-2.5 pl-[55px]">
          {matchReason && (
            <div className="text-xs text-text-primary leading-relaxed bg-[#F4F7F2] border border-[#E1EAD8] rounded-lg p-3">
              <div className="font-bold text-[#1B5E20] mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#1B5E20]" /> AI Match Reasoning
              </div>
              {matchReason}
            </div>
          )}
          
          {breakdown && (
            <div className="text-[11px] text-text-secondary bg-white border border-border rounded-lg p-3">
              <div className="font-bold text-text-primary mb-2 text-xs">Match Breakdown</div>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-1 rounded">
                  <span className="text-gray-400">Role Fit:</span>
                  <span className={`font-semibold capitalize ${
                    breakdown.title.includes('strong') ? 'text-green-600' :
                    breakdown.title.includes('partial') ? 'text-yellow-600' : 'text-gray-500'
                  }`}>{breakdown.title}</span>
                </div>
                <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-1 rounded">
                  <span className="text-gray-400">Skills:</span>
                  <span className={`font-semibold capitalize ${
                    breakdown.skills.includes('strong') ? 'text-green-600' :
                    breakdown.skills.includes('partial') ? 'text-yellow-600' : 'text-gray-500'
                  }`}>{breakdown.skills}</span>
                </div>
                <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-1 rounded">
                  <span className="text-gray-400">Experience:</span>
                  <span className={`font-semibold capitalize ${
                    breakdown.experience.includes('meets') ? 'text-green-600' :
                    breakdown.experience.includes('below') ? 'text-red-500' : 'text-gray-500'
                  }`}>{breakdown.experience}</span>
                </div>
                <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-1 rounded">
                  <span className="text-gray-400">Location:</span>
                  <span className={`font-semibold capitalize ${
                    breakdown.location.includes('match') && !breakdown.location.includes('diff') ? 'text-green-600' :
                    breakdown.location.includes('diff') ? 'text-red-500' : 'text-gray-500'
                  }`}>{breakdown.location}</span>
                </div>
                <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-1 rounded">
                  <span className="text-gray-400">Industry:</span>
                  <span className={`font-semibold capitalize ${
                    breakdown.industry.includes('match') ? 'text-green-600' : 'text-gray-500'
                  }`}>{breakdown.industry}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
