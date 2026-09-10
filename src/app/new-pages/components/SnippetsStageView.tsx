'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';

interface SnippetData {
  jobTitle: string;
  level: string;
  industry: string;
  location: string;
  packageVal: string;
  company: string;
  gender: string;
  requirements: string[];
  email: string;
  mobile: string;
}

const INITIAL_SNIPPET: SnippetData = {
  jobTitle: 'Executive / Senior Executive Quality Assurance',
  level: 'Nethma Tharindi',
  industry: 'Apparel',
  location: 'Nethma Tharindi',
  packageVal: '100K – 175K / = $800 – $1750',
  company: 'Apparel Manufacturing',
  gender: 'Open',
  requirements: [
    'Degree or Diploma in Textile Apparel, Quality Management, or Garment Technology.',
    'Experience in a similar capacity for 1–4 years',
    'Practical knowledge of pattern making and sewing processes.',
    'Strong understanding of production processes, machinery components, and needles.',
    'Familiarity with customer-specific QA standards and regulatory requirements.',
    'Proven ability to implement QA procedures and conduct regular quality audits.',
  ],
  email: 'Chirani@career141.com',
  mobile: '+94 76 4263120',
};

export const SnippetsStageView: React.FC = () => {
  const [snippet, setSnippet] = useState<SnippetData>(INITIAL_SNIPPET);
  const [requirementsText, setRequirementsText] = useState<string>(
    INITIAL_SNIPPET.requirements.map((r) => `•  ${r}`).join('\n')
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleRequirementsChange = (text: string) => {
    setRequirementsText(text);
    const lines = text
      .split('\n')
      .map((l) => l.trim().replace(/^[•\-\*]\s*/, ''))
      .filter((l) => l.length > 0);
    setSnippet((prev) => ({ ...prev, requirements: lines }));
  };

  const handleProcess = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      toast.success('Snippet processed and ready for distribution!');
    }, 600);
  };

  const handleReset = () => {
    setSnippet(INITIAL_SNIPPET);
    setRequirementsText(INITIAL_SNIPPET.requirements.map((r) => `•  ${r}`).join('\n'));
    toast.info('Snippet refreshed to default template');
  };

  return (
    <div className="w-full">
      {/* ── BIG OUTER WIDGET (BORDER: 1px solid #DDDFE2) ── */}
      <div
        className="bg-white rounded-[12px] p-5 sm:p-6 shadow-2xs space-y-6"
        style={{ border: '1px solid #DDDFE2' }}
      >
        {/* ── 2 BOXES ROW: DETAILS SECTION BOX & SNIPPET PREVIEW BOX ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* ── 1. DETAILS SECTION BOX (BORDER: 1px solid #DDDFE2) ── */}
          <div
            className="lg:col-span-8 xl:col-span-8 bg-white rounded-[10px] p-4 sm:p-5 shadow-2xs flex flex-col justify-between space-y-3.5"
            style={{ border: '1px solid #DDDFE2' }}
          >
            {/* Row 1: Job Title */}
            <div className="flex items-center gap-3 bg-[#F6F8FA] rounded-[6px] px-4 py-2.5 border border-slate-100/90">
              <span className="w-20 sm:w-24 text-[13px] font-semibold text-slate-900 shrink-0">
                Job Title
              </span>
              <span className="text-slate-400 font-semibold">:</span>
              <input
                type="text"
                value={snippet.jobTitle}
                onChange={(e) => setSnippet({ ...snippet, jobTitle: e.target.value })}
                className="chat-borderless-input flex-1 bg-transparent text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium"
                placeholder="Executive / Senior Executive Quality Assurance"
              />
            </div>

            {/* Row 2: Level & Industry */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex items-center gap-3 bg-[#F6F8FA] rounded-[6px] px-4 py-2.5 border border-slate-100/90">
                <span className="w-20 sm:w-24 text-[13px] font-semibold text-slate-900 shrink-0">
                  Level
                </span>
                <span className="text-slate-400 font-semibold">:</span>
                <input
                  type="text"
                  value={snippet.level}
                  onChange={(e) => setSnippet({ ...snippet, level: e.target.value })}
                  className="chat-borderless-input flex-1 bg-transparent text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium"
                  placeholder="Level"
                />
              </div>

              <div className="flex items-center gap-3 bg-[#F6F8FA] rounded-[6px] px-4 py-2.5 border border-slate-100/90">
                <span className="w-20 sm:w-24 text-[13px] font-semibold text-slate-900 shrink-0">
                  Industry
                </span>
                <span className="text-slate-400 font-semibold">:</span>
                <input
                  type="text"
                  value={snippet.industry}
                  onChange={(e) => setSnippet({ ...snippet, industry: e.target.value })}
                  className="chat-borderless-input flex-1 bg-transparent text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium"
                  placeholder="Industry"
                />
              </div>
            </div>

            {/* Row 3: Location & Package */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex items-center gap-3 bg-[#F6F8FA] rounded-[6px] px-4 py-2.5 border border-slate-100/90">
                <span className="w-20 sm:w-24 text-[13px] font-semibold text-slate-900 shrink-0">
                  Location
                </span>
                <span className="text-slate-400 font-semibold">:</span>
                <input
                  type="text"
                  value={snippet.location}
                  onChange={(e) => setSnippet({ ...snippet, location: e.target.value })}
                  className="chat-borderless-input flex-1 bg-transparent text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium"
                  placeholder="Location"
                />
              </div>

              <div className="flex items-center gap-3 bg-[#F6F8FA] rounded-[6px] px-4 py-2.5 border border-slate-100/90">
                <span className="w-20 sm:w-24 text-[13px] font-semibold text-slate-900 shrink-0">
                  Package
                </span>
                <span className="text-slate-400 font-semibold">:</span>
                <input
                  type="text"
                  value={snippet.packageVal}
                  onChange={(e) => setSnippet({ ...snippet, packageVal: e.target.value })}
                  className="chat-borderless-input flex-1 bg-transparent text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium"
                  placeholder="Package"
                />
              </div>
            </div>

            {/* Row 4: Company & Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex items-center gap-3 bg-[#F6F8FA] rounded-[6px] px-4 py-2.5 border border-slate-100/90">
                <span className="w-20 sm:w-24 text-[13px] font-semibold text-slate-900 shrink-0">
                  Company
                </span>
                <span className="text-slate-400 font-semibold">:</span>
                <input
                  type="text"
                  value={snippet.company}
                  onChange={(e) => setSnippet({ ...snippet, company: e.target.value })}
                  className="chat-borderless-input flex-1 bg-transparent text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium"
                  placeholder="Company"
                />
              </div>

              <div className="flex items-center gap-3 bg-[#F6F8FA] rounded-[6px] px-4 py-2.5 border border-slate-100/90">
                <span className="w-20 sm:w-24 text-[13px] font-semibold text-slate-900 shrink-0">
                  Gender
                </span>
                <span className="text-slate-400 font-semibold">:</span>
                <input
                  type="text"
                  value={snippet.gender}
                  onChange={(e) => setSnippet({ ...snippet, gender: e.target.value })}
                  className="chat-borderless-input flex-1 bg-transparent text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium"
                  placeholder="Gender"
                />
              </div>
            </div>

            {/* Row 5: Job Title (Requirements bullet textarea) */}
            <div className="bg-[#F6F8FA] rounded-[6px] px-4 py-3 border border-slate-100/90 space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-20 sm:w-24 text-[13px] font-semibold text-slate-900 shrink-0">
                  Job Title
                </span>
                <span className="text-slate-400 font-semibold">:</span>
              </div>
              <textarea
                rows={7}
                value={requirementsText}
                onChange={(e) => handleRequirementsChange(e.target.value)}
                className="chat-borderless-input w-full bg-transparent p-0 text-[13px] text-slate-800 focus:outline-none leading-relaxed resize-y font-sans"
                placeholder="• Degree or Diploma in Textile Apparel..."
              />
            </div>

            {/* Row 6: Email & Mobile Footer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex items-center gap-3 bg-[#F6F8FA] rounded-[6px] px-4 py-2.5 border border-slate-100/90">
                <span className="w-20 sm:w-24 text-[13px] font-semibold text-slate-900 shrink-0">
                  Email
                </span>
                <span className="text-slate-400 font-semibold">:</span>
                <input
                  type="text"
                  value={snippet.email}
                  onChange={(e) => setSnippet({ ...snippet, email: e.target.value })}
                  className="chat-borderless-input flex-1 bg-transparent text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium"
                  placeholder="Email"
                />
              </div>

              <div className="flex items-center gap-3 bg-[#F6F8FA] rounded-[6px] px-4 py-2.5 border border-slate-100/90">
                <span className="w-20 sm:w-24 text-[13px] font-semibold text-slate-900 shrink-0">
                  Mobile
                </span>
                <span className="text-slate-400 font-semibold">:</span>
                <input
                  type="text"
                  value={snippet.mobile}
                  onChange={(e) => setSnippet({ ...snippet, mobile: e.target.value })}
                  className="chat-borderless-input flex-1 bg-transparent text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium"
                  placeholder="Mobile"
                />
              </div>
            </div>
          </div>

          {/* ── 2. SNIPPET PREVIEW BOX (BORDER: 1px solid #DDDFE2) ── */}
          <div
            className="lg:col-span-4 xl:col-span-4 bg-white rounded-[10px] p-4 sm:p-5 shadow-2xs flex flex-col items-center justify-center"
            style={{ border: '1px solid #DDDFE2' }}
          >
            {/* ── LIVE FLYER GRAPHIC ── */}
            <div className="w-full max-w-[340px] sm:max-w-[360px] rounded-[16px] bg-[#00E575] text-slate-900 shadow-md overflow-hidden font-sans border border-emerald-400/40 flex flex-col">
              {/* 1. Top Brand Header */}
              <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-2.5">
                {/* Career141 Brand Logo */}
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-7 h-7 shrink-0 text-[#05563D]"
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M10 32C18 34 26 28 36 12C36 12 30 26 16 28Z"
                      fill="#04593E"
                    />
                    <path
                      d="M12 36C22 34 32 24 38 8C38 8 28 20 18 26Z"
                      fill="#0B6E4F"
                    />
                  </svg>
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1 leading-none">
                      <span className="font-extrabold text-[15px] text-slate-950 tracking-tight">
                        career141
                      </span>
                      <span className="text-slate-700 font-light mx-0.5">|</span>
                      <span className="text-[13px] font-black text-slate-950">20</span>
                      <span className="text-[7px] font-extrabold text-slate-800 uppercase tracking-tighter">
                        YEARS
                      </span>
                    </div>
                    <span className="text-[7.5px] italic text-slate-800 tracking-wider mt-0.5">
                      a positive impact
                    </span>
                  </div>
                </div>

                {/* Level Badge */}
                <div className="bg-[#0B6E4F] text-white text-[9.5px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs">
                  LEVEL - EXECUTIVE
                </div>
              </div>

              {/* 2. Full-width Dark Industry Banner */}
              <div className="bg-[#05563D] w-full px-4 sm:px-5 py-1.5">
                <p className="text-[14px] font-bold text-white tracking-wide">
                  {snippet.industry || 'Apparel'}
                </p>
              </div>

              {/* 3. Hero Job Title Section */}
              <div className="px-4 sm:px-5 py-3 text-left">
                <h3 className="text-[17px] sm:text-[19px] font-normal text-slate-900 leading-tight">
                  {snippet.jobTitle.toLowerCase().includes('quality assurance')
                    ? snippet.jobTitle.replace(/quality assurance/i, '').trim() || 'Executive / Senior Executive'
                    : snippet.jobTitle}
                </h3>
                <h2 className="text-[22px] sm:text-[25px] font-black text-slate-950 tracking-tight leading-none uppercase mt-0.5">
                  {snippet.jobTitle.toLowerCase().includes('quality assurance')
                    ? 'QUALITY ASSURANCE'
                    : snippet.jobTitle}
                </h2>
              </div>

              {/* 4. 2x2 Pill Badges */}
              <div className="px-4 sm:px-5 pb-3 grid grid-cols-2 gap-1.5">
                <div className="bg-white rounded-full px-2.5 py-1 shadow-2xs flex items-center justify-start text-[9.5px] font-medium text-slate-900 truncate">
                  <span className="text-slate-500 font-medium shrink-0">Location :&nbsp;</span>
                  <span className="font-bold truncate">{snippet.location || 'theldeniya/kandy | katunayake'}</span>
                </div>

                <div className="bg-white rounded-full px-2.5 py-1 shadow-2xs flex items-center justify-start text-[9.5px] font-medium text-slate-900 truncate">
                  <span className="text-slate-500 font-medium shrink-0">Company :&nbsp;</span>
                  <span className="font-bold truncate">{snippet.company || 'Apparel Manufacturing'}</span>
                </div>

                <div className="bg-white rounded-full px-2.5 py-1 shadow-2xs flex items-center justify-start text-[9.5px] font-medium text-slate-900 truncate">
                  <span className="text-slate-500 font-medium shrink-0">Package :&nbsp;</span>
                  <span className="font-bold truncate">{snippet.packageVal || '100K – 175K / = $800 – $1750'}</span>
                </div>

                <div className="bg-white rounded-full px-2.5 py-1 shadow-2xs flex items-center justify-start text-[9.5px] font-medium text-slate-900 truncate">
                  <span className="text-slate-500 font-medium shrink-0">Gender :&nbsp;</span>
                  <span className="font-bold truncate">{snippet.gender || 'Open'}</span>
                </div>
              </div>

              {/* 5. Full-width Dark Requirements Section */}
              <div className="bg-[#05563D] w-full px-4 sm:px-5 py-3 space-y-1">
                {snippet.requirements.slice(0, 7).map((req, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-1.5 text-[10px] leading-relaxed text-white"
                  >
                    <span className="text-white shrink-0 leading-none mt-0.5 font-bold">•</span>
                    <span className="break-words">{req}</span>
                  </div>
                ))}
              </div>

              {/* 6. Footer Contact Bar */}
              <div className="bg-[#00E575] w-full py-2.5 px-4 text-center font-bold text-[11px] text-slate-950 tracking-tight">
                TA : E : <span className="underline">{snippet.email}</span> | M : {snippet.mobile}
              </div>
            </div>
          </div>
        </div>

        {/* ── ACTION BUTTONS ROW (INSIDE THE BIG WIDGET, ALIGNED TO BOTTOM RIGHT) ── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleReset}
            className="px-6 py-2.5 rounded-full bg-white hover:bg-slate-50 text-slate-800 font-semibold text-[13px] transition-all cursor-pointer shadow-2xs active:scale-95"
            style={{ border: '1px solid #DDDFE2' }}
          >
            Snippets Edit
          </button>

          <button
            onClick={handleProcess}
            disabled={isProcessing}
            className="px-8 py-2.5 rounded-full bg-[#064E3B] hover:bg-[#043D2E] text-white font-semibold text-[13px] transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5 disabled:opacity-75"
          >
            {isProcessing ? <span>Processing...</span> : <span>Process</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
