import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge, AvatarBadge } from '@/components/ui/Badge';
import { MessageCircle } from 'lucide-react';

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
  profileHref?: string;
  matchReason?: string;
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
  profileHref = '/dashboard/candidates/kasun',
  matchReason
}: CandidateCardProps) {
  return (
    <Card 
      noPadding 
      className={`flex flex-row items-start self-stretch py-[17px] px-4 hover:border-primary-container transition-colors cursor-default !bg-surface-container-high ${isSelected ? 'border-primary-container !bg-[#E8EDE1]' : ''}`}
    >
      <input 
        type="checkbox" 
        className="w-4 h-4 mr-[15px] mt-[18px] cursor-pointer" 
        checked={isSelected}
        onChange={onToggle}
      />
      
      <div className="mr-[15px] mt-[10px]">
        <AvatarBadge initials={initials} colorClass={avatarColorClass} />
      </div>
      
      <div className="flex-1 px-[1px] mr-4 min-w-0 flex flex-col justify-start">
        <div className="flex items-center self-stretch mb-1 gap-2">
          <span className="text-text-primary text-sm font-bold truncate">
            {name}
          </span>
          <Badge variant={sourceVariant} size="sm">{sourceText}</Badge>
        </div>
        <div className="flex flex-col items-start self-stretch mb-1">
          <span className="text-text-secondary text-[13px] truncate">
            {role}
          </span>
        </div>
        <div className="flex items-center self-stretch py-1 gap-[17px]">
          <div className="flex shrink-0 items-center gap-1">
            <img
              src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/omthap57_expires_30_days.png" 
              className="w-[9px] h-[11px] object-fill"
              alt="loc"
            />
            <span className="text-text-disabled text-[11px]">{location}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {skills.map((skill, idx) => (
              <Badge key={idx} variant="default" size="sm">{skill}</Badge>
            ))}
          </div>
        </div>
        {matchReason && (
          <div className="mt-2 text-xs text-[#1B5E20] bg-white/70 border border-[#1B5E20]/15 rounded-md py-1.5 px-2.5 leading-relaxed">
            {matchReason}
          </div>
        )}
      </div>
      
      <div className="flex flex-col shrink-0 items-end gap-2 mt-[6px]">
        {score !== undefined && score !== null && (
          <div 
            className="flex items-center justify-center bg-[length:100%_100%] w-12 h-12 rounded-full"
            style={{ backgroundImage: `url('${scoreIconUrl}')` }}
          >
            <span className={`${scoreColorClass} text-sm font-bold`}>{score}</span>
          </div>
        )}
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
        </div>
      </div>
    </Card>
  );
}
