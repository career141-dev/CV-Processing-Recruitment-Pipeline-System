'use client';

import React, { useState } from 'react';
import { Plus, ChevronDown, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { ResearchFormData } from '../types';
import { INITIAL_RESEARCH_DATA, COUNTRIES, LOCATIONS } from '../mock-data';

export const ResearchView: React.FC = () => {
  const [formData, setFormData] = useState<ResearchFormData>(INITIAL_RESEARCH_DATA);

  // Add Item Helpers
  const handleAddServiceProvider = () => {
    if (!formData.serviceProviderInput.trim()) return;
    setFormData((prev) => ({
      ...prev,
      servicesProviders: [...prev.servicesProviders, prev.serviceProviderInput.trim()],
      serviceProviderInput: '',
    }));
    toast.success('Service provider added');
  };

  const handleRemoveServiceProvider = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      servicesProviders: prev.servicesProviders.filter((_, i) => i !== index),
    }));
  };

  const handleAddSimilarDesignation = () => {
    if (!formData.similarDesignation.trim()) return;
    setFormData((prev) => ({
      ...prev,
      similarDesignations: [...prev.similarDesignations, prev.similarDesignation.trim()],
      similarDesignation: '',
    }));
    toast.success('Designation added');
  };

  const handleRemoveSimilarDesignation = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      similarDesignations: prev.similarDesignations.filter((_, i) => i !== index),
    }));
  };

  const handleAddCompetitor = () => {
    if (!formData.competitorInput.trim()) return;
    setFormData((prev) => ({
      ...prev,
      competitors: [...prev.competitors, prev.competitorInput.trim()],
      competitorInput: '',
    }));
    toast.success('Competitor added');
  };

  const handleRemoveCompetitor = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      competitors: prev.competitors.filter((_, i) => i !== index),
    }));
  };

  const handleAddSocialMedia = () => {
    if (!formData.socialMediaInput.trim()) return;
    setFormData((prev) => ({
      ...prev,
      socialMediaPlatforms: [...prev.socialMediaPlatforms, prev.socialMediaInput.trim()],
      socialMediaInput: '',
    }));
    toast.success('Platform added');
  };

  const handleRemoveSocialMedia = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      socialMediaPlatforms: prev.socialMediaPlatforms.filter((_, i) => i !== index),
    }));
  };

  const handleAddBenchmarkPosition = () => {
    if (!formData.benchmarkPositionInput.trim()) return;
    setFormData((prev) => ({
      ...prev,
      benchmarkPositions: [...prev.benchmarkPositions, prev.benchmarkPositionInput.trim()],
      benchmarkPositionInput: '',
    }));
    toast.success('Benchmark position added');
  };

  const handleRemoveBenchmarkPosition = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      benchmarkPositions: prev.benchmarkPositions.filter((_, i) => i !== index),
    }));
  };

  const handleSaveResearch = () => {
    toast.success('Research data saved successfully!');
  };

  const handleCancelResearch = () => {
    setFormData(INITIAL_RESEARCH_DATA);
    toast.info('Research form reset');
  };

  const handleSaveBenchmark = () => {
    toast.success('Benchmark data saved successfully!');
  };

  const handleCancelBenchmark = () => {
    setFormData((prev) => ({
      ...prev,
      benchmarkLink: '',
      benchmarkPositionInput: '',
      benchmarkPositions: [],
    }));
    toast.info('Benchmark form reset');
  };

  return (
    <div className="w-full bg-white rounded-[8px] border border-[#DBDEE0] p-4 sm:p-6 md:p-8 shadow-2xs space-y-7 font-sans">
      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: RESEARCH
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <h1 className="text-[18px] sm:text-[20px] font-bold text-slate-800 tracking-tight">
          Research
        </h1>

        {/* ── ROW 1: SIMILAR DESIGNATION & WEBSITE LINK ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Similar Designation Outlined Box */}
          <div className="relative rounded-[9px] border border-[#DBDEE0] bg-white pt-2.5 pb-2 px-3.5 sm:px-4 focus-within:border-[#165B42] focus-within:ring-1 focus-within:ring-[#165B42]/20 transition-all flex flex-col justify-center min-h-[48px]">
            <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-[11.5px] sm:text-[12px] font-semibold text-slate-800 pointer-events-none select-none">
              Similar Designation
            </label>
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                value={formData.similarDesignation}
                onChange={(e) =>
                  setFormData({ ...formData, similarDesignation: e.target.value })
                }
                onKeyDown={(e) => e.key === 'Enter' && handleAddSimilarDesignation()}
                placeholder="Add Similar Designation"
                className="chat-borderless-input w-full bg-transparent text-[13px] sm:text-[13.5px] text-slate-800 placeholder:text-slate-400 border-none outline-none focus:outline-none focus:ring-0 shadow-none font-normal"
              />
              <button
                type="button"
                onClick={handleAddSimilarDesignation}
                className="p-1 text-slate-400 hover:text-[#165B42] hover:bg-emerald-50 active:scale-95 rounded-md transition-colors cursor-pointer shrink-0"
                title="Add Designation"
              >
                <Plus className="w-4 h-4 stroke-[2]" />
              </button>
            </div>
            {/* Tag Badges */}
            {formData.similarDesignations.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {formData.similarDesignations.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-[11px] font-semibold bg-[#EBEBEB] text-slate-700"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => handleRemoveSimilarDesignation(idx)}
                      className="hover:text-slate-900 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Website Link Outlined Box */}
          <div className="relative rounded-[9px] border border-[#DBDEE0] bg-white pt-2.5 pb-2 px-3.5 sm:px-4 focus-within:border-[#165B42] focus-within:ring-1 focus-within:ring-[#165B42]/20 transition-all flex flex-col justify-center min-h-[48px]">
            <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-[11.5px] sm:text-[12px] font-semibold text-slate-800 pointer-events-none select-none">
              Website Link
            </label>
            <input
              type="text"
              value={formData.websiteLink}
              onChange={(e) =>
                setFormData({ ...formData, websiteLink: e.target.value })
              }
              placeholder="Enter Website Link"
              className="chat-borderless-input w-full bg-transparent text-[13px] sm:text-[13.5px] text-slate-800 placeholder:text-slate-400 border-none outline-none focus:outline-none focus:ring-0 shadow-none font-normal"
            />
          </div>
        </div>

        {/* ── ROW 2: SERVICES PROVIDER BULLET LIST ── */}
        <div className="relative rounded-[9px] border border-[#DBDEE0] bg-white p-3.5 sm:p-4 transition-all space-y-3">
          <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-[11.5px] sm:text-[12px] font-semibold text-slate-800 pointer-events-none select-none">
            Services Provider
          </label>
          <ul className="space-y-2 pt-1 pb-0.5">
            {formData.servicesProviders.map((item, index) => (
              <li
                key={index}
                className="group flex items-start justify-between gap-2.5 text-[12.5px] sm:text-[13px] text-slate-700 leading-relaxed hover:text-slate-900 transition-colors"
              >
                <div className="flex items-start gap-2.5 flex-1">
                  <span className="text-slate-400 select-none text-[15px] leading-none mt-1">
                    •
                  </span>
                  <span>{item}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveServiceProvider(index)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded transition-all cursor-pointer shrink-0"
                  title="Remove service"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>

          {/* Add New Service Provider Input */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <input
              type="text"
              value={formData.serviceProviderInput}
              onChange={(e) =>
                setFormData({ ...formData, serviceProviderInput: e.target.value })
              }
              onKeyDown={(e) => e.key === 'Enter' && handleAddServiceProvider()}
              placeholder="Add another service provider..."
              className="chat-borderless-input w-full bg-transparent text-[12.5px] sm:text-[13px] text-slate-800 placeholder:text-slate-400 border-none outline-none focus:outline-none focus:ring-0 shadow-none font-normal"
            />
            <button
              type="button"
              onClick={handleAddServiceProvider}
              className="p-1 text-slate-400 hover:text-[#165B42] hover:bg-emerald-50 active:scale-95 rounded-md transition-colors cursor-pointer shrink-0"
              title="Add Service Provider"
            >
              <Plus className="w-4 h-4 stroke-[2]" />
            </button>
          </div>
        </div>

        {/* ── ROW 3: COUNTRY & LOCATION DROPDOWNS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Country Selector */}
          <div className="relative rounded-[9px] border border-[#DBDEE0] bg-white pt-2.5 pb-2 px-3.5 sm:px-4 focus-within:border-[#165B42] focus-within:ring-1 focus-within:ring-[#165B42]/20 transition-all flex flex-col justify-center min-h-[48px]">
            <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-[11.5px] sm:text-[12px] font-semibold text-slate-800 pointer-events-none select-none">
              Country
            </label>
            <div className="relative flex items-center justify-between">
              <select
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="chat-borderless-input w-full bg-transparent text-[13px] sm:text-[13.5px] text-slate-800 border-none outline-none focus:outline-none focus:ring-0 shadow-none font-normal appearance-none cursor-pointer pr-6"
              >
                {COUNTRIES.map((c, i) => (
                  <option key={i} value={i === 0 ? '' : c} className="text-slate-800">
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-0 pointer-events-none stroke-[2]" />
            </div>
          </div>

          {/* Location Selector */}
          <div className="relative rounded-[9px] border border-[#DBDEE0] bg-white pt-2.5 pb-2 px-3.5 sm:px-4 focus-within:border-[#165B42] focus-within:ring-1 focus-within:ring-[#165B42]/20 transition-all flex flex-col justify-center min-h-[48px]">
            <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-[11.5px] sm:text-[12px] font-semibold text-slate-800 pointer-events-none select-none">
              Location
            </label>
            <div className="relative flex items-center justify-between">
              <select
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="chat-borderless-input w-full bg-transparent text-[13px] sm:text-[13.5px] text-slate-800 border-none outline-none focus:outline-none focus:ring-0 shadow-none font-normal appearance-none cursor-pointer pr-6"
              >
                {LOCATIONS.map((l, i) => (
                  <option key={i} value={i === 0 ? '' : l} className="text-slate-800">
                    {l}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-0 pointer-events-none stroke-[2]" />
            </div>
          </div>
        </div>

        {/* ── ROW 4: COMPETITORS ── */}
        <div className="relative rounded-[9px] border border-[#DBDEE0] bg-white pt-2.5 pb-2 px-3.5 sm:px-4 focus-within:border-[#165B42] focus-within:ring-1 focus-within:ring-[#165B42]/20 transition-all flex flex-col justify-center min-h-[48px]">
          <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-[11.5px] sm:text-[12px] font-semibold text-slate-800 pointer-events-none select-none">
            Competitors
          </label>
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              value={formData.competitorInput}
              onChange={(e) =>
                setFormData({ ...formData, competitorInput: e.target.value })
              }
              onKeyDown={(e) => e.key === 'Enter' && handleAddCompetitor()}
              placeholder="Add Competitors"
              className="chat-borderless-input w-full bg-transparent text-[13px] sm:text-[13.5px] text-slate-800 placeholder:text-slate-400 border-none outline-none focus:outline-none focus:ring-0 shadow-none font-normal"
            />
            <button
              type="button"
              onClick={handleAddCompetitor}
              className="p-1 text-slate-400 hover:text-[#165B42] hover:bg-emerald-50 active:scale-95 rounded-md transition-colors cursor-pointer shrink-0"
              title="Add Competitor"
            >
              <Plus className="w-4 h-4 stroke-[2]" />
            </button>
          </div>
          {formData.competitors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {formData.competitors.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-[11px] font-semibold bg-[#EBEBEB] text-slate-700"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => handleRemoveCompetitor(idx)}
                    className="hover:text-slate-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── ROW 5: SOCIAL MEDIA PLATFORMER ── */}
        <div className="relative rounded-[9px] border border-[#DBDEE0] bg-white pt-2.5 pb-2 px-3.5 sm:px-4 focus-within:border-[#165B42] focus-within:ring-1 focus-within:ring-[#165B42]/20 transition-all flex flex-col justify-center min-h-[48px]">
          <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-[11.5px] sm:text-[12px] font-semibold text-slate-800 pointer-events-none select-none">
            Social Media Platformer
          </label>
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              value={formData.socialMediaInput}
              onChange={(e) =>
                setFormData({ ...formData, socialMediaInput: e.target.value })
              }
              onKeyDown={(e) => e.key === 'Enter' && handleAddSocialMedia()}
              placeholder="Add Social Media Platformer"
              className="chat-borderless-input w-full bg-transparent text-[13px] sm:text-[13.5px] text-slate-800 placeholder:text-slate-400 border-none outline-none focus:outline-none focus:ring-0 shadow-none font-normal"
            />
            <button
              type="button"
              onClick={handleAddSocialMedia}
              className="p-1 text-slate-400 hover:text-[#165B42] hover:bg-emerald-50 active:scale-95 rounded-md transition-colors cursor-pointer shrink-0"
              title="Add Platform"
            >
              <Plus className="w-4 h-4 stroke-[2]" />
            </button>
          </div>
          {formData.socialMediaPlatforms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {formData.socialMediaPlatforms.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-[11px] font-semibold bg-[#EBEBEB] text-slate-700"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => handleRemoveSocialMedia(idx)}
                    className="hover:text-slate-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── ROW 6: COMPANY OVERVIEW ── */}
        <div className="relative rounded-[9px] border border-[#DBDEE0] bg-white p-3.5 sm:p-4 focus-within:border-[#165B42] focus-within:ring-1 focus-within:ring-[#165B42]/20 transition-all">
          <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-[11.5px] sm:text-[12px] font-semibold text-slate-800 pointer-events-none select-none">
            Company Overview
          </label>
          <textarea
            rows={7}
            value={formData.companyOverview}
            onChange={(e) =>
              setFormData({ ...formData, companyOverview: e.target.value })
            }
            placeholder="Enter Company Overview..."
            className="chat-borderless-input w-full bg-transparent text-[12.5px] sm:text-[13px] text-slate-700 leading-relaxed placeholder:text-slate-400 border-none outline-none focus:outline-none focus:ring-0 shadow-none resize-y font-normal"
          />
        </div>

        {/* ── ACTIONS ROW: CANCELED & SAVE (ORIGINAL RECTANGULAR BUTTON STYLE) ── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleCancelResearch}
            className="px-6 py-2 bg-[#F0F2F5] hover:bg-[#E4E7EB] active:scale-95 text-slate-800 font-semibold rounded-[8px] text-[13px] transition-colors cursor-pointer"
          >
            Canceled
          </button>
          <button
            type="button"
            onClick={handleSaveResearch}
            className="px-7 py-2 bg-[#165B42] hover:bg-[#114934] active:scale-95 text-white font-semibold rounded-[8px] text-[13px] transition-colors cursor-pointer shadow-xs"
          >
            Save
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: BENCHMARK
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6 pt-2">
        <h2 className="text-[17px] sm:text-[18px] font-bold text-slate-800 tracking-tight">
          Benchmark
        </h2>

        {/* ── ROW 1: LINK & POSITION ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Link Outlined Box */}
          <div className="relative rounded-[9px] border border-[#DBDEE0] bg-white pt-2.5 pb-2 px-3.5 sm:px-4 focus-within:border-[#165B42] focus-within:ring-1 focus-within:ring-[#165B42]/20 transition-all flex flex-col justify-center min-h-[48px]">
            <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-[11.5px] sm:text-[12px] font-semibold text-slate-800 pointer-events-none select-none">
              Link
            </label>
            <input
              type="text"
              value={formData.benchmarkLink}
              onChange={(e) =>
                setFormData({ ...formData, benchmarkLink: e.target.value })
              }
              placeholder="Enter Link"
              className="chat-borderless-input w-full bg-transparent text-[13px] sm:text-[13.5px] text-slate-800 placeholder:text-slate-400 border-none outline-none focus:outline-none focus:ring-0 shadow-none font-normal"
            />
          </div>

          {/* Position Outlined Box */}
          <div className="relative rounded-[9px] border border-[#DBDEE0] bg-white pt-2.5 pb-2 px-3.5 sm:px-4 focus-within:border-[#165B42] focus-within:ring-1 focus-within:ring-[#165B42]/20 transition-all flex flex-col justify-center min-h-[48px]">
            <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-[11.5px] sm:text-[12px] font-semibold text-slate-800 pointer-events-none select-none">
              Position
            </label>
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                value={formData.benchmarkPositionInput}
                onChange={(e) =>
                  setFormData({ ...formData, benchmarkPositionInput: e.target.value })
                }
                onKeyDown={(e) => e.key === 'Enter' && handleAddBenchmarkPosition()}
                placeholder="Add Position"
                className="chat-borderless-input w-full bg-transparent text-[13px] sm:text-[13.5px] text-slate-800 placeholder:text-slate-400 border-none outline-none focus:outline-none focus:ring-0 shadow-none font-normal"
              />
              <button
                type="button"
                onClick={handleAddBenchmarkPosition}
                className="p-1 text-slate-400 hover:text-[#165B42] hover:bg-emerald-50 active:scale-95 rounded-md transition-colors cursor-pointer shrink-0"
                title="Add Position"
              >
                <Plus className="w-4 h-4 stroke-[2]" />
              </button>
            </div>
            {formData.benchmarkPositions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {formData.benchmarkPositions.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-[11px] font-semibold bg-[#EBEBEB] text-slate-700"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => handleRemoveBenchmarkPosition(idx)}
                      className="hover:text-slate-900 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── BENCHMARK ACTIONS ROW (ORIGINAL RECTANGULAR BUTTON STYLE) ── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleCancelBenchmark}
            className="px-6 py-2 bg-[#F0F2F5] hover:bg-[#E4E7EB] active:scale-95 text-slate-800 font-semibold rounded-[8px] text-[13px] transition-colors cursor-pointer"
          >
            Canceled
          </button>
          <button
            type="button"
            onClick={handleSaveBenchmark}
            className="px-7 py-2 bg-[#165B42] hover:bg-[#114934] active:scale-95 text-white font-semibold rounded-[8px] text-[13px] transition-colors cursor-pointer shadow-xs"
          >
            Save
          </button>
        </div>
      </section>
    </div>
  );
};
