'use client';

import React, { useState } from 'react';
import { User } from 'lucide-react';
import { MockCandidate } from '../../types';

interface ChatLogTabProps {
  candidate: MockCandidate;
}

export const ChatLogTab: React.FC<ChatLogTabProps> = ({ candidate }) => {
  const [chatChannel, setChatChannel] = useState<'Whatsapp' | 'Email'>('Whatsapp');

  return (
    <div className="bg-white rounded-[8px] border border-[#DBDEE0] p-4 sm:p-6 space-y-4 sm:space-y-5 w-full">
      {/* Channel Pill Toggle: Whatsapp / Email */}
      <div className="inline-flex items-center p-1 bg-[#F5F7FA] border border-[#DBDEE0] rounded-[6px]">
        <button
          onClick={() => setChatChannel('Whatsapp')}
          className={`px-3.5 sm:px-4 py-1.5 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
            chatChannel === 'Whatsapp'
              ? 'bg-[#057642] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Whatsapp
        </button>
        <button
          onClick={() => setChatChannel('Email')}
          className={`px-3.5 sm:px-4 py-1.5 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
            chatChannel === 'Email'
              ? 'bg-[#057642] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Email
        </button>
      </div>

      {/* Message Card Container */}
      <div className="border border-[#DBDEE0] rounded-[8px] p-3.5 sm:p-5 space-y-3 sm:space-y-3.5 bg-white">
        {/* Header: User Icon, Name, Divider, Subtitle/Role, Date & Time */}
        <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <User className="w-4 h-4 text-slate-800 shrink-0" />
            <span className="font-bold text-[14.5px] text-slate-900 truncate">
              Azlan Raban
            </span>
            <span className="text-slate-300 font-light mx-1">|</span>
            <span className="text-[13px] text-slate-700 font-medium truncate">
              {candidate.role || 'AI-Powered Full Stack Application Developer (Intern)'}
            </span>
          </div>
          <span className="text-[12.5px] text-slate-500 font-normal shrink-0">
            9/9/2026 &nbsp;&nbsp; 5.24 AM
          </span>
        </div>

        {/* Message 1 (Gray background box) */}
        <div className="bg-[#F5F7FA] rounded-[6px] p-3 text-[12.5px] text-slate-700 leading-relaxed">
          &quot;New application for Data Entry Specialist - Documentation, no specific question text but implied query about next steps.&quot;
        </div>

        {/* Message 2 (Light mint green background box #E0F0EA) */}
        <div className="bg-[#E0F0EA] text-[#165B42] rounded-[6px] p-3 text-[12.5px] leading-relaxed font-medium">
          &quot;New application for Data Entry Specialist - Documentation, no specific question text but implied query about next steps.&quot;
        </div>
      </div>
    </div>
  );
};
