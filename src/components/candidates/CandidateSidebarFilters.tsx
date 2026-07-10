import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { ManageFiltersModal } from './modals/ManageFiltersModal';

interface CandidateSidebarFiltersProps {
  activeFilters?: string[];
  onToggleFilter?: (filter: string) => void;
  location?: string;
  onLocationChange?: (loc: string) => void;
}

export function CandidateSidebarFilters({
  activeFilters = [],
  onToggleFilter,
  location = '',
  onLocationChange,
}: CandidateSidebarFiltersProps) {
  const [customFilterInput, setCustomFilterInput] = useState('');
  const [savedFilters, setSavedFilters] = useState<string[]>(['PCI-DSS', 'Big 4 experience']);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  // Experience Slider Logic
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

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Number(e.target.value), maxExp - 1);
    setMinExp(value);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(Number(e.target.value), minExp + 1);
    setMaxExp(value);
  };

  const applyExperienceFilter = () => {
    if (!onToggleFilter) return;
    
    const newFilter = `${minExp}-${maxExp} years`;
    
    // If the filter didn't change, do nothing
    if (expFilter === newFilter) return;
    
    // Remove old experience filter
    if (expFilter) {
      onToggleFilter(expFilter);
    }
    
    // Add new one
    onToggleFilter(newFilter);
  };

  const handleAddCustomFilter = () => {
    if (!customFilterInput.trim()) return;
    if (savedFilters.includes(customFilterInput.trim())) {
      toast.error('Filter already exists');
      return;
    }
    setSavedFilters([...savedFilters, customFilterInput.trim()]);
    toast.success('Custom filter saved to your library');
    setCustomFilterInput('');
  };

  const handleRemoveCustomFilter = (filter: string) => {
    setSavedFilters(savedFilters.filter(f => f !== filter));
    toast.success(`Removed filter: ${filter}`);
  };

  return (
    <>
      <div className="flex flex-col shrink-0 items-start bg-surface pt-2 w-[260px] pb-4">
        <div className="flex items-center mb-3 ml-5 gap-2">
          <button className="flex flex-col shrink-0 items-center bg-primary-container text-left py-1 px-2 rounded-md border-0">
            <span className="text-on-primary text-sm font-bold">C</span>
          </button>
          <span className="text-primary-container text-base font-bold">Career141</span>
        </div>
        <div className="flex items-center bg-surface-container-low py-2 pl-[19px] pr-[110px] w-full mb-4 gap-2 border-r-2 border-solid border-r-[#1B5E20]">
        <img
          src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/t5q3a73c_expires_30_days.png" 
          className="w-[15px] h-3.5 object-fill"
          alt="search"
        />
        <span className="text-primary-container text-[13px] font-bold">Search</span>
      </div>
      
      <div className="flex flex-col items-start ml-5 w-full">
        {/* Role */}
        <div className="flex flex-col items-start mb-4 gap-2 w-full pr-4">
          <span className="text-text-secondary text-[11px] font-bold">ROLE</span>
          <div className="flex flex-col items-start gap-2 w-full">
            <label className="flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={activeFilters.includes('Senior')}
                onChange={() => onToggleFilter && onToggleFilter('Senior')}
                className="mr-2" 
              />
              <span className="text-text-primary text-[13px]">Senior</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={activeFilters.includes('Lead')}
                onChange={() => onToggleFilter && onToggleFilter('Lead')}
                className="mr-2" 
              />
              <span className="text-text-primary text-[13px]">Lead</span>
            </label>
          </div>
          <div className="w-full h-[1px] bg-gray-200 mt-3"></div>
        </div>
        
        {/* Experience */}
        <div className="flex flex-col items-start mb-4 gap-2 w-full pr-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-text-secondary text-[11px] font-bold">EXPERIENCE</span>
            <span className="text-[#006E1C] text-xs font-bold">{minExp} – {maxExp} years</span>
          </div>
          <div className="w-full relative mt-2 h-6 flex items-center">
            {/* Background Track */}
            <div className="bg-border w-full h-1 rounded-sm absolute top-1/2 -translate-y-1/2"></div>
            {/* Active Track */}
            <div 
              className="bg-primary-container h-1 rounded-sm absolute top-1/2 -translate-y-1/2 pointer-events-none" 
              style={{ left: `${(minExp / 20) * 100}%`, right: `${100 - (maxExp / 20) * 100}%` }}
            ></div>
            
            {/* Min Slider */}
            <input 
              type="range" 
              min={0} 
              max={20} 
              value={minExp} 
              onChange={handleMinChange}
              onMouseUp={applyExperienceFilter}
              onTouchEnd={applyExperienceFilter}
              className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-container [&::-webkit-slider-thumb]:appearance-none cursor-pointer z-10"
            />
            {/* Max Slider */}
            <input 
              type="range" 
              min={0} 
              max={20} 
              value={maxExp} 
              onChange={handleMaxChange}
              onMouseUp={applyExperienceFilter}
              onTouchEnd={applyExperienceFilter}
              className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-container [&::-webkit-slider-thumb]:appearance-none cursor-pointer z-20"
            />
          </div>
          <div className="w-full h-[1px] bg-gray-200 mt-3"></div>
        </div>
        
        {/* Location */}
        <div className="flex flex-col items-start mb-4 gap-2 w-full pr-4">
          <span className="text-text-secondary text-[11px] font-bold">LOCATION</span>
          <div className="flex items-center bg-surface py-[11px] px-[15px] gap-2.5 rounded-md border border-solid border-border w-full">
            <img
              src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/7porn968_expires_30_days.png" 
              className="w-3 h-[15px] object-fill"
              alt="location"
            />
            <input 
              type="text" 
              placeholder="Remote, New York..." 
              value={location}
              onChange={(e) => onLocationChange && onLocationChange(e.target.value)}
              className="border-none outline-none text-[13px] w-full" 
            />
          </div>
          <div className="w-full h-[1px] bg-gray-200 mt-3"></div>
        </div>
        
        {/* Education */}
        <div className="flex flex-col items-start mb-4 gap-2 w-full pr-4">
          <span className="text-text-secondary text-[11px] font-bold">EDUCATION</span>
          <div className="flex flex-col items-start gap-2 w-full">
            <label className="flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={activeFilters.includes('Bachelor')}
                onChange={() => onToggleFilter && onToggleFilter('Bachelor')}
                className="mr-2" 
              />
              <span className="text-text-primary text-[13px]">Bachelor</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={activeFilters.includes('Masters')}
                onChange={() => onToggleFilter && onToggleFilter('Masters')}
                className="mr-2" 
              />
              <span className="text-text-primary text-[13px]">Masters</span>
            </label>
          </div>
          <div className="w-full h-[1px] bg-gray-200 mt-3"></div>
        </div>
        
        {/* Source */}
        <div className="flex flex-col items-start mb-4 gap-2 w-full pr-4">
          <span className="text-text-secondary text-[11px] font-bold">SOURCE</span>
          <div className="flex flex-col items-start gap-2 w-full">
            <label className="flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={activeFilters.includes('LinkedIn')}
                onChange={() => onToggleFilter && onToggleFilter('LinkedIn')}
                className="mr-2" 
              />
              <span className="text-text-primary text-[13px]">LinkedIn</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={activeFilters.includes('WhatsApp')}
                onChange={() => onToggleFilter && onToggleFilter('WhatsApp')}
                className="mr-2" 
              />
              <span className="text-text-primary text-[13px]">WhatsApp</span>
            </label>
          </div>
        </div>
        
        {/* Custom Filters */}
        <div className="flex flex-col items-start mb-2 w-full pr-4">
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-text-secondary text-[11px] font-bold">CUSTOM FILTERS</span>
            <button 
              onClick={() => setIsManageModalOpen(true)}
              className="text-[10px] text-primary-container hover:underline"
            >
              Manage
            </button>
          </div>
          <div className="flex items-center mb-3 gap-2 w-full">
            <input
              type="text"
              value={customFilterInput}
              onChange={e => setCustomFilterInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCustomFilter()}
              placeholder="Add custom..."
              className="flex-1 text-gray-700 bg-surface text-xs py-[7px] px-[13px] rounded-md border border-solid border-border focus:outline-none focus:border-primary-container"
            />
            <Button variant="primary" size="sm" onClick={handleAddCustomFilter}>Add</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {savedFilters.map(filter => {
              const isActive = activeFilters.includes(filter);
              return (
                <div key={filter} className="group relative inline-flex items-center">
                  <Button 
                    variant={isActive ? "primary" : "outline"} 
                    size="sm" 
                    className="pr-6"
                    onClick={() => onToggleFilter && onToggleFilter(filter)}
                  >
                    {filter}
                  </Button>
                  <button 
                    onClick={() => handleRemoveCustomFilter(filter)}
                    className="absolute right-1 w-4 h-4 rounded-full bg-gray-100 text-gray-500 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-all z-10"
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
      
      <ManageFiltersModal 
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        savedFilters={savedFilters}
        onDeleteFilter={handleRemoveCustomFilter}
      />
    </>
  );
}
