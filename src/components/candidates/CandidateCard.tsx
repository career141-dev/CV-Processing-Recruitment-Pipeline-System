import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge, AvatarBadge } from '@/components/ui/Badge';

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
  score: number;
  scoreIconUrl?: string;
  scoreColorClass?: string;
  isSelected: boolean;
  onToggle: () => void;
  profileHref?: string;
}

export function CandidateCard({
  id,
  name,
  initials,
  avatarColorClass = 'bg-[#ACF4A4] text-[#002C06]',
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
  profileHref = '/dashboard/candidates/kasun'
}: CandidateCardProps) {
  return (
    <Card 
      noPadding 
      className={`flex flex-row items-center self-stretch py-[17px] px-4 hover:border-[#1B5E20] transition-colors cursor-default ${isSelected ? 'border-[#1B5E20] bg-green-50/10' : ''}`}
    >
      <input 
        type="checkbox" 
        className="w-4 h-4 mr-[15px] cursor-pointer" 
        checked={isSelected}
        onChange={onToggle}
      />
      
      <div className="mr-[15px]">
        <AvatarBadge initials={initials} colorClass={avatarColorClass} />
      </div>
      
      <div className="flex-1 px-[1px] mr-4 min-w-0">
        <div className="flex items-center self-stretch mb-1 gap-2">
          <span className="text-[#212121] text-sm font-bold truncate">
            {name}
          </span>
          <Badge variant={sourceVariant} size="sm">{sourceText}</Badge>
        </div>
        <div className="flex flex-col items-start self-stretch mb-1">
          <span className="text-[#616161] text-[13px] truncate">
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
            <span className="text-[#9E9E9E] text-[11px]">{location}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {skills.map((skill, idx) => (
              <Badge key={idx} variant="default" size="sm">{skill}</Badge>
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex flex-col shrink-0 items-end gap-2">
        <div 
          className="flex items-center justify-center bg-[length:100%_100%] w-12 h-12 rounded-full"
          style={{ backgroundImage: `url('${scoreIconUrl}')` }}
        >
          <span className={`${scoreColorClass} text-sm font-bold`}>{score}</span>
        </div>
        <Link href={profileHref} className="flex items-center justify-center bg-transparent py-1 px-3 rounded-md border border-solid border-[#E0E0E0] hover:bg-gray-50 no-underline">
          <span className="text-[#616161] text-xs font-bold">View Profile</span>
        </Link>
      </div>
    </Card>
  );
}
