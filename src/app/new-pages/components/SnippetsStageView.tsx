'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Download,
  Upload,
  Trash2,
  Eraser,
} from 'lucide-react';

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

const BLANK_SNIPPET: SnippetData = {
  jobTitle: '',
  level: '',
  industry: '',
  location: '',
  packageVal: '',
  company: '',
  gender: '',
  requirements: [],
  email: '',
  mobile: '',
};

// Helper to parse Job Title into two-tier Canva layout (Line 1: Designation, Line 2: Role)
const splitJobTitle = (title: string): { line1: string; line2: string } => {
  if (!title) return { line1: '', line2: '' };

  if (title.includes('\n')) {
    const lines = title.split('\n').map((l) => l.trim()).filter(Boolean);
    return {
      line1: lines[0] || '',
      line2: lines.slice(1).join(' ') || '',
    };
  }

  if (title.includes('/')) {
    const lastSlashIdx = title.lastIndexOf('/');
    const prefixWithSlash = title.substring(0, lastSlashIdx + 1);
    const remainder = title.substring(lastSlashIdx + 1).trim();
    const words = remainder.split(/\s+/);
    if (words.length >= 2) {
      const roleWord = words[words.length - 1];
      const prefixWords = words.slice(0, -1).join(' ');
      return {
        line1: `${prefixWithSlash} ${prefixWords}`.trim(),
        line2: roleWord.trim(),
      };
    }
  }

  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    return {
      line1: parts[0].trim(),
      line2: parts.slice(1).join(' - ').trim(),
    };
  }

  const words = title.split(/\s+/);
  if (words.length >= 3) {
    const line2Words = words.slice(-1).join(' ');
    const line1Words = words.slice(0, -1).join(' ');
    return {
      line1: line1Words,
      line2: line2Words,
    };
  }

  return {
    line1: '',
    line2: title,
  };
};

export const SnippetsStageView: React.FC = () => {
  const [snippet, setSnippet] = useState<SnippetData>(BLANK_SNIPPET);
  const [requirementsText, setRequirementsText] = useState<string>('');
  const [templateImageUrl, setTemplateImageUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load custom template from localStorage if saved
  useEffect(() => {
    try {
      const saved = localStorage.getItem('career141_canva_custom_template');
      if (saved) {
        setTemplateImageUrl(saved);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Handle Requirements Editing
  const handleRequirementsChange = (text: string) => {
    setRequirementsText(text);
    const lines = text
      .split('\n')
      .map((l) => l.trim().replace(/^[•\-\*]\s*/, ''))
      .filter((l) => l.length > 0);
    setSnippet((prev) => ({ ...prev, requirements: lines }));
  };

  // Clear All Form Fields
  const handleClearForm = () => {
    setSnippet(BLANK_SNIPPET);
    setRequirementsText('');
    toast.info('Cleared all form text fields');
  };

  // Process Uploaded Template Image
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (.png, .jpg, .webp)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setTemplateImageUrl(result);
      try {
        localStorage.setItem('career141_canva_custom_template', result);
      } catch {
        // Ignore quota
      }
      toast.success('Canva template image uploaded successfully!');
    };
    reader.readAsDataURL(file);
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Remove Template Image
  const handleRemoveTemplate = () => {
    setTemplateImageUrl(null);
    try {
      localStorage.removeItem('career141_canva_custom_template');
    } catch {
      // Ignore
    }
    toast.info('Template image removed. You can now upload a new template.');
  };

  // 1-Click High-Res PNG Download using Canvas API
  const handleDownloadFlyer = () => {
    if (!templateImageUrl) {
      toast.error('Please upload your Canva template image from your desktop first.');
      fileInputRef.current?.click();
      return;
    }

    setIsExporting(true);
    toast.info('Generating high-resolution flyer image from your template...');

    const canvas = document.createElement('canvas');
    const size = 1080;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setIsExporting(false);
      toast.error('Canvas 2D context not available');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 1. Draw the uploaded template background
      ctx.drawImage(img, 0, 0, size, size);

      // 2. Top-Right Level Text (Centered in top-right gradient badge with overflow containment)
      if (snippet.level) {
        let levelFontSize = 25.4;
        ctx.font = `bold ${levelFontSize}px "Inter", sans-serif`;
        const levelText = `LEVEL - ${snippet.level.toUpperCase()}`;
        const maxLevelBadgeWidth = 280;
        let measuredWidth = ctx.measureText(levelText).width;

        // Auto-scale if text is too wide for badge
        while (measuredWidth > maxLevelBadgeWidth && levelFontSize > 16) {
          levelFontSize -= 1;
          ctx.font = `bold ${levelFontSize}px "Inter", sans-serif`;
          measuredWidth = ctx.measureText(levelText).width;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(levelText, 865, 52);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }

      const leftAlignX = 95; // Exact left coordinate where the 1st white pill widget starts

      // 3. Dark Olive Industry Banner Text (32px bold)
      if (snippet.industry) {
        ctx.font = 'bold 32px "Inter", sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'middle';
        ctx.fillText(snippet.industry, leftAlignX, 260);
        ctx.textBaseline = 'alphabetic';
      }

      // 4. Job Title (1st line: 56px, 2nd line: 70px 900-weight)
      if (snippet.jobTitle) {
        const { line1, line2 } = splitJobTitle(snippet.jobTitle);
        ctx.fillStyle = '#000000';

        if (line1 && line2) {
          // Line 1: 56px Regular weight Title Case designation
          ctx.font = '400 56px "Inter", sans-serif';
          ctx.fillText(line1, leftAlignX, 365);

          // Line 2: 70px Extra bold black uppercase core role
          ctx.font = '900 70px "Inter", sans-serif';
          ctx.fillText(line2.toUpperCase(), leftAlignX, 442);
        } else {
          // Single line: 70px
          ctx.font = '900 70px "Inter", sans-serif';
          ctx.fillText((line2 || line1).toUpperCase(), leftAlignX, 420);
        }
      }

      // 5. 4 Pill Badges Text (19.5px Canva-calibrated scale, aligned inside the 4 white pills)
      ctx.textBaseline = 'middle';
      const row1Y = 582;
      const row2Y = 656;
      const col1X = 125;
      const col2X = 550;

      // Location (Top-Left Pill: 19.5px)
      if (snippet.location) {
        ctx.font = '600 19.5px "Inter", sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText('Location :', col1X, row1Y);
        const locLabelWidth = ctx.measureText('Location : ').width;
        ctx.font = 'bold 19.5px "Inter", sans-serif';
        ctx.fillText(snippet.location, col1X + locLabelWidth, row1Y);
      }

      // Company (Top-Right Pill: 19.5px)
      if (snippet.company) {
        ctx.font = '600 19.5px "Inter", sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText('Company :', col2X, row1Y);
        const compLabelWidth = ctx.measureText('Company : ').width;
        ctx.font = 'bold 19.5px "Inter", sans-serif';
        ctx.fillText(snippet.company, col2X + compLabelWidth, row1Y);
      }

      // Package (Bottom-Left Pill: 19.5px)
      if (snippet.packageVal) {
        ctx.font = '600 19.5px "Inter", sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText('Package :', col1X, row2Y);
        const pkgLabelWidth = ctx.measureText('Package : ').width;
        ctx.font = 'bold 19.5px "Inter", sans-serif';
        ctx.fillText(snippet.packageVal, col1X + pkgLabelWidth, row2Y);
      }

      // Gender (Bottom-Right Pill: 19.5px)
      if (snippet.gender) {
        ctx.font = '600 19.5px "Inter", sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText('Gender :', col2X, row2Y);
        const genLabelWidth = ctx.measureText('Gender : ').width;
        ctx.font = 'bold 19.5px "Inter", sans-serif';
        ctx.fillText(snippet.gender, col2X + genLabelWidth, row2Y);
      }

      // Reset baseline for rest of canvas
      ctx.textBaseline = 'alphabetic';

      // 6. Requirements Bullets Text (20px, positioned down inside dark container with multi-line wrapping)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '400 20px "Inter", sans-serif';
      let currentY = 765;
      const maxLineWidth = 820;
      const lineHeight = 28;

      snippet.requirements.slice(0, 3).forEach((req) => {
        const bulletPrefix = '•  ';
        const words = req.split(' ');
        let currentLine = bulletPrefix;

        for (let n = 0; n < words.length; n++) {
          const testLine = currentLine + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxLineWidth && n > 0) {
            ctx.fillText(currentLine, leftAlignX, currentY);
            currentLine = '   ' + words[n] + ' ';
            currentY += lineHeight;
          } else {
            currentLine = testLine;
          }
        }
        ctx.fillText(currentLine, leftAlignX, currentY);
        currentY += lineHeight + 8;
      });

      // 7. Bottom TA Contact Footer Text (21px bold)
      if (snippet.email || snippet.mobile) {
        ctx.font = 'bold 21px "Inter", sans-serif';
        ctx.fillStyle = '#050804';
        ctx.fillText(
          `TA:  E : ${snippet.email}   |   M : ${snippet.mobile}`,
          leftAlignX,
          1040
        );
      }

      // Trigger high-res download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Career141_Flyer_${(snippet.jobTitle || 'Job').replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();

      setIsExporting(false);
      toast.success('High-resolution Canva flyer downloaded successfully!');
    };

    img.onerror = () => {
      setIsExporting(false);
      toast.error('Failed to load template image.');
    };

    img.src = templateImageUrl;
  };

  return (
    <div className="w-full space-y-4">
      {/* Hidden File Input for Template Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleTemplateUpload}
        accept="image/*"
        className="hidden"
      />

      {/* ── 1 BIG OUTER WIDGET (BORDER: 1px solid #DDDFE2) ── */}
      <div
        className="bg-white rounded-[12px] p-3.5 sm:p-5 md:p-6 shadow-2xs space-y-6"
        style={{ border: '1px solid #DDDFE2' }}
      >
        {/* ── 2 BOXES ROW: DETAILS SECTION BOX & SNIPPET PREVIEW BOX ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

          {/* ── INNER BOX 1: DETAILS SECTION (INPUTS) ── */}
          <div
            className="lg:col-span-7 xl:col-span-7 bg-white rounded-[10px] p-2.5 sm:p-4 md:p-5 shadow-2xs flex flex-col justify-between space-y-3.5 min-w-0 overflow-hidden"
            style={{ border: '1px solid #DDDFE2' }}
          >
            {/* Row 1: Job Title */}
            <div className="flex items-center gap-1.5 sm:gap-3 bg-[#F6F8FA] rounded-[6px] px-2.5 sm:px-4 py-2 sm:py-2.5 border border-slate-100/90 w-full min-w-0 overflow-hidden">
              <span className="w-14 sm:w-20 md:w-24 text-[12px] sm:text-[13px] font-semibold text-slate-900 shrink-0">
                Job Title
              </span>
              <span className="text-slate-400 font-semibold shrink-0">:</span>
              <input
                type="text"
                value={snippet.jobTitle}
                onChange={(e) => setSnippet({ ...snippet, jobTitle: e.target.value })}
                className="chat-borderless-input flex-1 min-w-0 w-full bg-transparent text-[12px] sm:text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium truncate placeholder:truncate"
                placeholder="e.g. Executive / Senior Executive Quality Assurance"
              />
            </div>

            {/* Row 2: Level & Industry */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-3 bg-[#F6F8FA] rounded-[6px] px-2.5 sm:px-4 py-2 sm:py-2.5 border border-slate-100/90 w-full min-w-0 overflow-hidden">
                <span className="w-14 sm:w-20 md:w-24 text-[12px] sm:text-[13px] font-semibold text-slate-900 shrink-0">
                  Level
                </span>
                <span className="text-slate-400 font-semibold shrink-0">:</span>
                <input
                  type="text"
                  value={snippet.level}
                  onChange={(e) => setSnippet({ ...snippet, level: e.target.value })}
                  className="chat-borderless-input flex-1 min-w-0 w-full bg-transparent text-[12px] sm:text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium truncate placeholder:truncate"
                  placeholder="e.g. Executive / Senior"
                />
              </div>

              <div className="flex items-center gap-1.5 sm:gap-3 bg-[#F6F8FA] rounded-[6px] px-2.5 sm:px-4 py-2 sm:py-2.5 border border-slate-100/90 w-full min-w-0 overflow-hidden">
                <span className="w-14 sm:w-20 md:w-24 text-[12px] sm:text-[13px] font-semibold text-slate-900 shrink-0">
                  Industry
                </span>
                <span className="text-slate-400 font-semibold shrink-0">:</span>
                <input
                  type="text"
                  value={snippet.industry}
                  onChange={(e) => setSnippet({ ...snippet, industry: e.target.value })}
                  className="chat-borderless-input flex-1 min-w-0 w-full bg-transparent text-[12px] sm:text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium truncate placeholder:truncate"
                  placeholder="e.g. Apparel Manufacturing"
                />
              </div>
            </div>

            {/* Row 3: Location & Company (Aligned to Flyer Pill Row 1) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-3 bg-[#F6F8FA] rounded-[6px] px-2.5 sm:px-4 py-2 sm:py-2.5 border border-slate-100/90 w-full min-w-0 overflow-hidden">
                <span className="w-14 sm:w-20 md:w-24 text-[12px] sm:text-[13px] font-semibold text-slate-900 shrink-0">
                  Location
                </span>
                <span className="text-slate-400 font-semibold shrink-0">:</span>
                <input
                  type="text"
                  value={snippet.location}
                  onChange={(e) => setSnippet({ ...snippet, location: e.target.value })}
                  className="chat-borderless-input flex-1 min-w-0 w-full bg-transparent text-[12px] sm:text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium truncate placeholder:truncate"
                  placeholder="e.g. Katunayake | Kandy"
                />
              </div>

              <div className="flex items-center gap-1.5 sm:gap-3 bg-[#F6F8FA] rounded-[6px] px-2.5 sm:px-4 py-2 sm:py-2.5 border border-slate-100/90 w-full min-w-0 overflow-hidden">
                <span className="w-14 sm:w-20 md:w-24 text-[12px] sm:text-[13px] font-semibold text-slate-900 shrink-0">
                  Company
                </span>
                <span className="text-slate-400 font-semibold shrink-0">:</span>
                <input
                  type="text"
                  value={snippet.company}
                  onChange={(e) => setSnippet({ ...snippet, company: e.target.value })}
                  className="chat-borderless-input flex-1 min-w-0 w-full bg-transparent text-[12px] sm:text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium truncate placeholder:truncate"
                  placeholder="e.g. Apparel Manufacturing"
                />
              </div>
            </div>

            {/* Row 4: Package & Gender (Aligned to Flyer Pill Row 2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-3 bg-[#F6F8FA] rounded-[6px] px-2.5 sm:px-4 py-2 sm:py-2.5 border border-slate-100/90 w-full min-w-0 overflow-hidden">
                <span className="w-14 sm:w-20 md:w-24 text-[12px] sm:text-[13px] font-semibold text-slate-900 shrink-0">
                  Package
                </span>
                <span className="text-slate-400 font-semibold shrink-0">:</span>
                <input
                  type="text"
                  value={snippet.packageVal}
                  onChange={(e) => setSnippet({ ...snippet, packageVal: e.target.value })}
                  className="chat-borderless-input flex-1 min-w-0 w-full bg-transparent text-[12px] sm:text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium truncate placeholder:truncate"
                  placeholder="e.g. 100K – 175K"
                />
              </div>

              <div className="flex items-center gap-1.5 sm:gap-3 bg-[#F6F8FA] rounded-[6px] px-2.5 sm:px-4 py-2 sm:py-2.5 border border-slate-100/90 w-full min-w-0 overflow-hidden">
                <span className="w-14 sm:w-20 md:w-24 text-[12px] sm:text-[13px] font-semibold text-slate-900 shrink-0">
                  Gender
                </span>
                <span className="text-slate-400 font-semibold shrink-0">:</span>
                <input
                  type="text"
                  value={snippet.gender}
                  onChange={(e) => setSnippet({ ...snippet, gender: e.target.value })}
                  className="chat-borderless-input flex-1 min-w-0 w-full bg-transparent text-[12px] sm:text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium truncate placeholder:truncate"
                  placeholder="e.g. Open / Female"
                />
              </div>
            </div>

            {/* Row 5: Job Title (Requirements bullet textarea) */}
            <div className="bg-[#F6F8FA] rounded-[6px] px-2.5 sm:px-4 py-2.5 sm:py-3 border border-slate-100/90 space-y-2 w-full min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 sm:gap-3">
                <span className="w-20 sm:w-24 text-[12px] sm:text-[13px] font-semibold text-slate-900 shrink-0">
                  Requirements
                </span>
                <span className="text-slate-400 font-semibold shrink-0">:</span>
              </div>
              <textarea
                rows={6}
                value={requirementsText}
                onChange={(e) => handleRequirementsChange(e.target.value)}
                className="chat-borderless-input w-full min-w-0 bg-transparent p-0 text-[12px] sm:text-[13px] text-slate-800 focus:outline-none leading-relaxed resize-y font-sans"
                placeholder="• Enter requirement bullet points..."
              />
            </div>

            {/* Row 6: Email & Mobile Footer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-3 bg-[#F6F8FA] rounded-[6px] px-2.5 sm:px-4 py-2 sm:py-2.5 border border-slate-100/90 w-full min-w-0 overflow-hidden">
                <span className="w-14 sm:w-20 md:w-24 text-[12px] sm:text-[13px] font-semibold text-slate-900 shrink-0">
                  Email
                </span>
                <span className="text-slate-400 font-semibold shrink-0">:</span>
                <input
                  type="text"
                  value={snippet.email}
                  onChange={(e) => setSnippet({ ...snippet, email: e.target.value })}
                  className="chat-borderless-input flex-1 min-w-0 w-full bg-transparent text-[12px] sm:text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium truncate placeholder:truncate"
                  placeholder="e.g. Chirani@career141.com"
                />
              </div>

              <div className="flex items-center gap-1.5 sm:gap-3 bg-[#F6F8FA] rounded-[6px] px-2.5 sm:px-4 py-2 sm:py-2.5 border border-slate-100/90 w-full min-w-0 overflow-hidden">
                <span className="w-14 sm:w-20 md:w-24 text-[12px] sm:text-[13px] font-semibold text-slate-900 shrink-0">
                  Mobile
                </span>
                <span className="text-slate-400 font-semibold shrink-0">:</span>
                <input
                  type="text"
                  value={snippet.mobile}
                  onChange={(e) => setSnippet({ ...snippet, mobile: e.target.value })}
                  className="chat-borderless-input flex-1 min-w-0 w-full bg-transparent text-[12px] sm:text-[13px] text-slate-900 focus:outline-none border-none p-0 ml-1 font-medium truncate placeholder:truncate"
                  placeholder="e.g. +94 76 426 3120"
                />
              </div>
            </div>
          </div>

          {/* ── INNER BOX 2: SNIPPET PREVIEW (BORDER: 1px solid #DDDFE2) ── */}
          <div
            className="lg:col-span-5 xl:col-span-5 bg-white rounded-[10px] p-2.5 sm:p-4 md:p-5 shadow-2xs flex flex-col items-center justify-center relative min-h-[340px] sm:min-h-[440px]"
            style={{ border: '1px solid #DDDFE2' }}
          >
            {templateImageUrl ? (
              /* ── UPLOADED CANVA TEMPLATE WITH ACCURATE TEXT SLOTS ── */
              <div className="w-full flex flex-col items-center justify-center">
                <div
                  className="w-full max-w-[440px] sm:max-w-[480px] aspect-square rounded-[16px] shadow-md overflow-hidden relative font-sans border border-slate-200 select-none"
                  style={{
                    backgroundImage: `url(${templateImageUrl})`,
                    backgroundSize: '100% 100%',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }}
                >
                  {/* 1. Top-Right Level Text (Centered in top-right badge, strictly contained) */}
                  {snippet.level && (
                    <div className="absolute top-[0%] right-[0%] w-[38%] h-[10.5%] flex items-center justify-center px-3 text-center select-none overflow-hidden">
                      <span className="text-white text-[10px] sm:text-[11.5px] font-bold uppercase tracking-wider truncate max-w-full">
                        LEVEL - {snippet.level}
                      </span>
                    </div>
                  )}

                  {/* 2. Industry Banner Text (Centered vertically in olive banner: 32px scale) */}
                  {snippet.industry && (
                    <div className="absolute top-[19.2%] left-[8.8%] h-[9.2%] flex items-center text-[13px] sm:text-[15px] font-bold text-white tracking-wide select-none">
                      {snippet.industry}
                    </div>
                  )}

                  {/* 3. Hero Job Title (Line 1: 56px scale, Line 2: 70px scale) */}
                  <div className="absolute top-[28.5%] left-[8.8%] right-[6%] max-h-[22%] flex flex-col justify-center select-none overflow-hidden">
                    {(() => {
                      const { line1, line2 } = splitJobTitle(snippet.jobTitle);
                      if (line1 && line2) {
                        return (
                          <>
                            <div className="font-normal text-black text-[18px] sm:text-[25px] tracking-tight leading-tight truncate">
                              {line1}
                            </div>
                            <div className="font-black text-black text-[23px] sm:text-[31px] uppercase tracking-tight leading-none truncate mt-0.5">
                              {line2}
                            </div>
                          </>
                        );
                      }
                      return (
                        <div className="font-black text-black text-[23px] sm:text-[31px] uppercase tracking-tight leading-tight break-words line-clamp-2">
                          {snippet.jobTitle}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 4. 4 Pill Badges (Positioned cleanly inside the 4 white pills: 19.5px scale) */}
                  {/* Location (Top-Left Pill) */}
                  <div className="absolute top-[51.0%] left-[8.8%] w-[37.8%] h-[5.8%] flex items-center px-2.5 sm:px-3.5 overflow-hidden select-none">
                    <span className="text-[8.5px] sm:text-[9.5px] text-black font-semibold shrink-0">
                      Location :
                    </span>
                    <span className="text-[8.5px] sm:text-[9.5px] text-black font-bold truncate ml-1">
                      {snippet.location}
                    </span>
                  </div>

                  {/* Company (Top-Right Pill) */}
                  <div className="absolute top-[51.0%] left-[47.8%] w-[37.8%] h-[5.8%] flex items-center px-2.5 sm:px-3.5 overflow-hidden select-none">
                    <span className="text-[8.5px] sm:text-[9.5px] text-black font-semibold shrink-0">
                      Company :
                    </span>
                    <span className="text-[8.5px] sm:text-[9.5px] text-black font-bold truncate ml-1">
                      {snippet.company}
                    </span>
                  </div>

                  {/* Package (Bottom-Left Pill) */}
                  <div className="absolute top-[57.8%] left-[8.8%] w-[37.8%] h-[5.8%] flex items-center px-2.5 sm:px-3.5 overflow-hidden select-none">
                    <span className="text-[8.5px] sm:text-[9.5px] text-black font-semibold shrink-0">
                      Package :
                    </span>
                    <span className="text-[8.5px] sm:text-[9.5px] text-black font-bold truncate ml-1">
                      {snippet.packageVal}
                    </span>
                  </div>

                  {/* Gender (Bottom-Right Pill) */}
                  <div className="absolute top-[57.8%] left-[47.8%] w-[37.8%] h-[5.8%] flex items-center px-2.5 sm:px-3.5 overflow-hidden select-none">
                    <span className="text-[8.5px] sm:text-[9.5px] text-black font-semibold shrink-0">
                      Gender :
                    </span>
                    <span className="text-[8.5px] sm:text-[9.5px] text-black font-bold truncate ml-1">
                      {snippet.gender}
                    </span>
                  </div>

                  {/* 5. Requirements List (Inside the Dark Olive Container: 20px scale, positioned down with multi-line wrapping) */}
                  <div className="absolute top-[69.5%] left-[8.8%] right-[8%] bottom-[7.5%] overflow-hidden space-y-1.5 p-0.5">
                    {snippet.requirements.slice(0, 3).map((req, idx) => (
                      <div key={idx} className="flex items-start gap-1 text-[8.5px] sm:text-[9.5px] leading-snug text-white font-normal">
                        <span className="text-white shrink-0 font-bold leading-none mt-0.5">•</span>
                        <span className="break-words leading-tight">{req}</span>
                      </div>
                    ))}
                  </div>

                  {/* 6. Bottom TA Contact Footer (21px scale) */}
                  {(snippet.email || snippet.mobile) && (
                    <div className="absolute bottom-[2.5%] left-[8.8%] right-[6%] text-left font-bold text-[9px] sm:text-[10px] text-[#050804] tracking-tight">
                      TA: E : <span className="underline">{snippet.email}</span> | M : {snippet.mobile}
                    </div>
                  )}
                </div>

                {/* Remove Template Button Below Card */}
                <div className="flex items-center justify-end w-full max-w-[440px] sm:max-w-[480px] mt-2.5">
                  <button
                    onClick={handleRemoveTemplate}
                    className="text-[12px] font-semibold text-red-600 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Template</span>
                  </button>
                </div>
              </div>
            ) : (
              /* ── UPLOAD DROPZONE WHEN NO TEMPLATE IS LOADED ── */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full max-w-[440px] sm:max-w-[480px] aspect-square rounded-[16px] border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all ${isDragging
                  ? 'border-[#165B42] bg-emerald-50/50 scale-[1.01]'
                  : 'border-slate-300 hover:border-[#165B42] bg-slate-50/60 hover:bg-slate-50'
                  }`}
              >
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-[#165B42] flex items-center justify-center mb-3 shadow-2xs">
                  <Upload className="w-7 h-7" />
                </div>
                <h4 className="text-[15px] font-bold text-slate-800">
                  Upload Canva Flyer Template
                </h4>
                <p className="text-[12px] text-slate-500 mt-1.5 max-w-[280px] leading-relaxed">
                  Drag and drop your Canva template image (.png, .jpg) directly from your desktop or click to browse.
                </p>
                <div className="mt-4 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-[12px] font-semibold shadow-2xs hover:bg-slate-50">
                  Browse Image
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── ACTION BUTTONS ROW (INSIDE THE BIG WIDGET, ALIGNED TO BOTTOM RIGHT) ── */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-2 w-full">
          {/* Clear Form Button */}
          <button
            onClick={handleClearForm}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[13px] transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center justify-center gap-1.5"
            style={{ border: '1px solid #DDDFE2' }}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Clear Fields</span>
          </button>

          {/* Process & Export Snippet Button */}
          <button
            onClick={handleDownloadFlyer}
            disabled={isExporting}
            className="w-full sm:w-auto px-8 py-2.5 rounded-full bg-[#064E3B] hover:bg-[#043D2E] text-white font-semibold text-[13px] transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-75"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Processing...' : 'Export Snippet (PNG)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
