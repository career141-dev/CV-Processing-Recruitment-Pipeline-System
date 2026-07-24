import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { X, Search, Filter, MapPin, SlidersHorizontal, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ManageFiltersModal } from './modals/ManageFiltersModal';

interface CandidateSidebarFiltersProps {
  activeFilters?: string[];
  onToggleFilter?: (filter: string) => void;
  location?: string;
  onLocationChange?: (loc: string) => void;
  onClearAll?: () => void;
}

export function CandidateSidebarFilters({
  activeFilters = [],
  onToggleFilter,
  location = '',
  onLocationChange,
  onClearAll,
}: CandidateSidebarFiltersProps) {
  const [customFilterInput, setCustomFilterInput] = useState('');
  const [savedFilters, setSavedFilters] = useState<string[]>(['PCI-DSS', 'Big 4 experience']);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  // Experience Logic
  let currentMin = 0;
  let currentMax = 20;
  const expFilter = activeFilters.find(f => f.includes('years'));
  if (expFilter) {
    const match = expFilter.match(/(\d+)\s*(?:-|–)\s*(\d+)/);
    if (match) {
      currentMin = parseInt(match[1]);
      currentMax = parseInt(match[2]);
    }
  } else {
    currentMin = 0;
    currentMax = 20;
  }

  const [minExp, setMinExp] = useState(currentMin);
  const [maxExp, setMaxExp] = useState(currentMax);

  useEffect(() => {
    setMinExp(currentMin);
    setMaxExp(currentMax);
  }, [currentMin, currentMax]);

  const applyExperienceFilter = () => {
    if (!onToggleFilter) return;

    if (minExp === 0 && maxExp === 20) {
      if (expFilter) {
        onToggleFilter(expFilter);
      }
      return;
    }

    const newFilter = `${minExp}-${maxExp} years`;
    if (expFilter === newFilter) return;

    if (expFilter) {
      onToggleFilter(expFilter);
    }
    onToggleFilter(newFilter);
  };

  const handleAddCustomFilter = () => {
    if (!customFilterInput.trim()) return;
    if (savedFilters.includes(customFilterInput.trim())) {
      toast.error('Filter already exists');
      return;
    }
    setSavedFilters([...savedFilters, customFilterInput.trim()]);
    toast.success('Custom filter saved');
    setCustomFilterInput('');
  };

  const handleRemoveCustomFilter = (filter: string) => {
    setSavedFilters(savedFilters.filter(f => f !== filter));
    toast.success(`Removed filter: ${filter}`);
  };

  const totalActiveCount = activeFilters.length + (location.trim() ? 1 : 0);

  return (
    <>
      <div className="w-full bg-surface border border-border rounded-xl p-4 shadow-sm mb-4 transition-all">
        {/* Header Action Bar */}
        {totalActiveCount > 0 && onClearAll && (
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
            <span className="text-xs font-bold text-[#1B5E20]">
              {totalActiveCount} Filter{totalActiveCount > 1 ? 's' : ''} Active
            </span>
            <button
              onClick={onClearAll}
              className="text-xs text-red-600 hover:text-red-700 font-semibold hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Clear All Filters
            </button>
          </div>
        )}

        {/* Side-by-Side 3 Pillar Grid with Vertical Dividers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Pillar 1: Seniority & Experience */}
          <div className="flex flex-col gap-4 lg:pr-6 lg:border-r lg:border-border">
            {/* Seniority Role */}
            <div>
              <span className="text-[11px] font-bold text-text-secondary tracking-wider block mb-2">SENIORITY ROLE</span>
              <div className="flex items-center gap-4">
                {['Senior', 'Lead'].map((role) => {
                  const isChecked = activeFilters.includes(role);
                  return (
                    <label key={role} className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleFilter && onToggleFilter(role)}
                        className="w-4 h-4 rounded text-[#1B5E20] focus:ring-[#1B5E20]"
                      />
                      <span className="text-xs font-medium text-text-primary">{role}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Experience */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-text-secondary tracking-wider">EXPERIENCE</span>
                <span className="text-xs font-bold text-[#006E1C] bg-[#E8F5E9] px-2 py-0.5 rounded-full">
                  {!expFilter || (minExp === 0 && maxExp === 20)
                    ? 'Any'
                    : maxExp >= 20
                    ? `${minExp}+ yrs`
                    : `${minExp} – ${maxExp} yrs`}
                </span>
              </div>

              {/* Quick Pills */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[
                  { label: 'Any', min: 0, max: 20 },
                  { label: '1+ yrs', min: 1, max: 20 },
                  { label: '3+ yrs', min: 3, max: 20 },
                  { label: '5+ yrs', min: 5, max: 20 },
                  { label: '8+ yrs', min: 8, max: 20 },
                  { label: '10+ yrs', min: 10, max: 20 },
                ].map((preset) => {
                  const isActive =
                    (!expFilter && preset.min === 0 && preset.max === 20) ||
                    (expFilter && minExp === preset.min && maxExp === preset.max);
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setMinExp(preset.min);
                        setMaxExp(preset.max);
                        if (!onToggleFilter) return;
                        if (expFilter) onToggleFilter(expFilter);
                        if (preset.min !== 0 || preset.max !== 20) {
                          onToggleFilter(`${preset.min}-${preset.max} years`);
                        }
                      }}
                      className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#1B5E20] text-white border-[#1B5E20] shadow-sm font-semibold'
                          : 'bg-surface text-text-secondary border-border hover:border-primary-container hover:text-text-primary'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Number Inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-text-secondary font-semibold block mb-1">MIN YRS</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    placeholder="0"
                    value={minExp}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(20, Number(e.target.value) || 0));
                      setMinExp(val);
                      if (val > maxExp) setMaxExp(val);
                    }}
                    onBlur={applyExperienceFilter}
                    className="w-full bg-surface border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary font-medium outline-none focus:border-primary-container transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-secondary font-semibold block mb-1">MAX YRS</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    placeholder="20+"
                    value={maxExp >= 20 ? 20 : maxExp}
                    onChange={(e) => {
                      const val = Math.max(minExp, Math.min(20, Number(e.target.value) || 20));
                      setMaxExp(val);
                    }}
                    onBlur={applyExperienceFilter}
                    className="w-full bg-surface border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary font-medium outline-none focus:border-primary-container transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pillar 2: Location & Education */}
          <div className="flex flex-col gap-4 lg:px-6 lg:border-r lg:border-border">
            {/* Location Input */}
            <div>
              <span className="text-[11px] font-bold text-text-secondary tracking-wider block mb-2">PREFERRED LOCATION</span>
              <div className="flex items-center bg-surface py-2 px-3 gap-2 rounded-md border border-border focus-within:border-primary-container transition-colors">
                <MapPin className="w-4 h-4 text-text-secondary shrink-0" />
                <input
                  type="text"
                  placeholder="Remote, New York, London..."
                  value={location}
                  onChange={(e) => onLocationChange && onLocationChange(e.target.value)}
                  className="border-none outline-none text-xs text-text-primary w-full bg-transparent"
                />
                {location.trim() !== '' && (
                  <button onClick={() => onLocationChange && onLocationChange('')} className="text-text-secondary hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Education Degree */}
            <div>
              <span className="text-[11px] font-bold text-text-secondary tracking-wider block mb-2">EDUCATION DEGREE</span>
              <div className="flex items-center gap-4">
                {['Bachelor', 'Masters'].map((edu) => {
                  const isChecked = activeFilters.includes(edu);
                  return (
                    <label key={edu} className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleFilter && onToggleFilter(edu)}
                        className="w-4 h-4 rounded text-[#1B5E20] focus:ring-[#1B5E20]"
                      />
                      <span className="text-xs font-medium text-text-primary">{edu}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Pillar 3: Source & Custom Filters */}
          <div className="flex flex-col gap-4 lg:pl-6">
            {/* Ingestion Source */}
            <div>
              <span className="text-[11px] font-bold text-text-secondary tracking-wider block mb-2">INGESTION SOURCE</span>
              <div className="flex items-center gap-4">
                {['LinkedIn', 'WhatsApp'].map((src) => {
                  const isChecked = activeFilters.includes(src);
                  return (
                    <label key={src} className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleFilter && onToggleFilter(src)}
                        className="w-4 h-4 rounded text-[#1B5E20] focus:ring-[#1B5E20]"
                      />
                      <span className="text-xs font-medium text-text-primary">{src}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Custom Filter Tags */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-text-secondary tracking-wider">CUSTOM SKILL TAGS</span>
                <button
                  onClick={() => setIsManageModalOpen(true)}
                  className="text-[11px] text-[#1B5E20] font-semibold hover:underline"
                >
                  Manage
                </button>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={customFilterInput}
                  onChange={(e) => setCustomFilterInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomFilter()}
                  placeholder="Add custom filter tag..."
                  className="flex-1 bg-surface text-xs py-1.5 px-3 rounded-md border border-border outline-none focus:border-primary-container"
                />
                <Button variant="primary" size="sm" onClick={handleAddCustomFilter} className="px-3 py-1.5 text-xs">
                  Add
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {savedFilters.map((filter) => {
                  const isActive = activeFilters.includes(filter);
                  return (
                    <div key={filter} className="group relative inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => onToggleFilter && onToggleFilter(filter)}
                        className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-all ${
                          isActive
                            ? 'bg-[#1B5E20] text-white border-[#1B5E20] shadow-sm font-semibold'
                            : 'bg-surface text-text-secondary border-border hover:border-primary-container'
                        }`}
                      >
                        {filter}
                      </button>
                      <button
                        onClick={() => handleRemoveCustomFilter(filter)}
                        className="ml-1 w-3.5 h-3.5 rounded-full text-text-secondary opacity-60 group-hover:opacity-100 hover:text-red-600"
                        title="Remove tag"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>

      <ManageFiltersModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        savedFilters={savedFilters}
        onDeleteFilter={handleRemoveCustomFilter}
      />
    </>
  );
}
