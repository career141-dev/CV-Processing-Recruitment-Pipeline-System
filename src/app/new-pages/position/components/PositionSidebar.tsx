'use client';

import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { LOCATION_OPTIONS, WORKPLACE_OPTIONS, STATUS_OPTIONS } from '../mock-data';
import { WorkplaceType, PositionStatus } from '../types';

interface PositionSidebarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  locationSearch: string;
  setLocationSearch: (val: string) => void;
  selectedLocations: string[];
  setSelectedLocations: React.Dispatch<React.SetStateAction<string[]>>;
  selectedWorkplaces: WorkplaceType[];
  setSelectedWorkplaces: React.Dispatch<React.SetStateAction<WorkplaceType[]>>;
  selectedStatuses: PositionStatus[];
  setSelectedStatuses: React.Dispatch<React.SetStateAction<PositionStatus[]>>;
  onResetFilters: () => void;
}

export const PositionSidebar: React.FC<PositionSidebarProps> = ({
  searchQuery,
  setSearchQuery,
  locationSearch,
  setLocationSearch,
  selectedLocations,
  setSelectedLocations,
  selectedWorkplaces,
  setSelectedWorkplaces,
  selectedStatuses,
  setSelectedStatuses,
  onResetFilters,
}) => {
  const [locationOpen, setLocationOpen] = useState(true);
  const [workplaceOpen, setWorkplaceOpen] = useState(true);
  const [statusOpen, setStatusOpen] = useState(true);

  const toggleLocation = (id: string) => {
    setSelectedLocations((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleWorkplace = (type: WorkplaceType) => {
    setSelectedWorkplaces((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  };

  const toggleStatus = (status: PositionStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status]
    );
  };

  const filteredLocationOptions = LOCATION_OPTIONS.filter((loc) =>
    loc.label.toLowerCase().includes(locationSearch.toLowerCase())
  );

  return (
    <aside className="w-full space-y-5">
      {/* ── TOP RESET FILTERS & SEARCH INPUT ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onResetFilters}
            className="text-xs font-semibold text-[#165B42] hover:underline cursor-pointer transition-colors"
          >
            Reset filters
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a Position"
            className="w-full pl-9 pr-3 py-2 bg-white border border-[#CBD5E1] rounded-[6px] text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#165B42] focus:border-[#165B42] transition-colors"
          />
        </div>
      </div>

      {/* ── 1. LOCATION FILTER ── */}
      <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
        <button
          type="button"
          onClick={() => setLocationOpen(!locationOpen)}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-800 uppercase tracking-wider hover:text-slate-900 cursor-pointer"
        >
          <span>Location</span>
          {locationOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {locationOpen && (
          <div className="space-y-2.5 pt-1">
            {/* Add Location Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Add location"
                className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-[#CBD5E1] rounded-[6px] text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#165B42] focus:border-[#165B42]"
              />
            </div>

            {/* Location Checkboxes */}
            <div className="space-y-2 pt-1">
              {filteredLocationOptions.map((loc) => {
                const isChecked = selectedLocations.includes(loc.id);
                return (
                  <label
                    key={loc.id}
                    className="flex items-start justify-between text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none gap-2"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleLocation(loc.id)}
                        className="w-3.5 h-3.5 mt-0.5 rounded border-slate-300 text-[#165B42] focus:ring-[#165B42] cursor-pointer shrink-0"
                      />
                      <span className="truncate leading-tight font-medium">{loc.label}</span>
                    </div>
                    <span className="text-slate-400 text-[11px] shrink-0">({loc.count})</span>
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              className="text-xs font-semibold text-[#165B42] hover:underline cursor-pointer block pt-1"
            >
              Show more
            </button>
          </div>
        )}
      </div>

      {/* ── 2. WORKPLACE TYPE FILTER ── */}
      <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
        <button
          type="button"
          onClick={() => setWorkplaceOpen(!workplaceOpen)}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-800 uppercase tracking-wider hover:text-slate-900 cursor-pointer"
        >
          <span>Workplace type</span>
          {workplaceOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {workplaceOpen && (
          <div className="space-y-2 pt-1">
            {WORKPLACE_OPTIONS.map((item) => {
              const isChecked = selectedWorkplaces.includes(item.id as WorkplaceType);
              return (
                <label
                  key={item.id}
                  className="flex items-center justify-between text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleWorkplace(item.id as WorkplaceType)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-[#165B42] focus:ring-[#165B42] cursor-pointer shrink-0"
                    />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <span className="text-slate-400 text-[11px]">({item.count})</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3. JOB STATUS FILTER ── */}
      <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
        <button
          type="button"
          onClick={() => setStatusOpen(!statusOpen)}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-800 uppercase tracking-wider hover:text-slate-900 cursor-pointer"
        >
          <span>Job status</span>
          {statusOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {statusOpen && (
          <div className="space-y-2 pt-1">
            {STATUS_OPTIONS.map((item) => {
              const isChecked = selectedStatuses.includes(item.id as PositionStatus);
              return (
                <label
                  key={item.id}
                  className="flex items-center justify-between text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleStatus(item.id as PositionStatus)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-[#165B42] focus:ring-[#165B42] cursor-pointer shrink-0"
                    />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <span className="text-slate-400 text-[11px]">({item.count})</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
