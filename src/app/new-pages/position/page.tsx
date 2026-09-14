'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '../components/Navbar';
import { INITIAL_POSITIONS } from './mock-data';
import { PositionItem, WorkplaceType, PositionStatus } from './types';
import { PositionSidebar } from './components/PositionSidebar';
import { PositionRow } from './components/PositionRow';

export default function PositionPage() {
  const [activeNavTab, setActiveNavTab] = useState<'projects' | 'jobs' | 'reports'>('jobs');
  const [positions, setPositions] = useState<PositionItem[]>(INITIAL_POSITIONS);

  // Sidebar Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locationSearch, setLocationSearch] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([
    'sri_lanka',
    'western_province',
    'colombo_district',
    'colombo',
  ]);
  const [selectedWorkplaces, setSelectedWorkplaces] = useState<WorkplaceType[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<PositionStatus[]>(['Open']);
  const [selectedPositionIds, setSelectedPositionIds] = useState<string[]>([]);

  // Filter Logic
  const filteredPositions = useMemo(() => {
    return positions.filter((pos) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          pos.title.toLowerCase().includes(q) ||
          pos.company.toLowerCase().includes(q) ||
          pos.location.toLowerCase().includes(q) ||
          pos.projectTitle.toLowerCase().includes(q) ||
          pos.recruiterName.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      // 2. Workplace Type
      if (selectedWorkplaces.length > 0 && !selectedWorkplaces.includes(pos.workplaceType)) {
        return false;
      }

      // 3. Status
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(pos.status)) {
        return false;
      }

      return true;
    });
  }, [positions, searchQuery, selectedWorkplaces, selectedStatuses]);

  // Bulk Selection Handlers
  const isAllSelected =
    filteredPositions.length > 0 &&
    filteredPositions.every((p) => selectedPositionIds.includes(p.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPositionIds(filteredPositions.map((p) => p.id));
    } else {
      setSelectedPositionIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedPositionIds((prev) => [...prev, id]);
    } else {
      setSelectedPositionIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setLocationSearch('');
    setSelectedLocations([]);
    setSelectedWorkplaces([]);
    setSelectedStatuses([]);
    toast.info('Filters reset');
  };

  const handleClearAllFilterChips = () => {
    setSelectedStatuses([]);
    toast.info('Cleared status filter');
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans antialiased flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* ── TOP NAV BAR ── */}
      <Navbar
        activeNavTab={activeNavTab}
        setActiveNavTab={setActiveNavTab}
        onBrandClick={() => {}}
      />

      {/* ── PAGE TITLE ROW (ALIGNED WITH NAVBAR LOGO & ACTIONS) ── */}
      <div className="w-full px-4 sm:px-6 pt-4 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-b border-[#E2E8F0] bg-white">
        <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight">
          Position
        </h1>

        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          {/* Job Slots Progress */}
          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <span className="text-xs text-slate-600 font-medium">21 of 42 job slots in use</span>
            <div className="w-36 sm:w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="bg-[#165B42] h-full w-[50%] rounded-full transition-all" />
            </div>
          </div>

          {/* Post a Job Button */}
          <button
            type="button"
            onClick={() => toast.info('Post a job clicked')}
            className="px-5 py-2.5 rounded-[6px] bg-[#165B42] hover:bg-[#114934] text-white text-xs sm:text-[13px] font-semibold transition-colors cursor-pointer shadow-xs"
          >
            Post a job
          </button>
        </div>
      </div>

      {/* ── UNIFIED FULL-WIDTH WORKSPACE: SIDEBAR + POSITION TABLE (NO OUTER CARD BOXES) ── */}
      <div className="flex-1 flex flex-col lg:flex-row w-full items-stretch bg-white">
        {/* 1. Left Sidebar Filter Panel */}
        <div className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-[#E2E8F0] px-4 sm:px-6 py-5 bg-white">
          <PositionSidebar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            locationSearch={locationSearch}
            setLocationSearch={setLocationSearch}
            selectedLocations={selectedLocations}
            setSelectedLocations={setSelectedLocations}
            selectedWorkplaces={selectedWorkplaces}
            setSelectedWorkplaces={setSelectedWorkplaces}
            selectedStatuses={selectedStatuses}
            setSelectedStatuses={setSelectedStatuses}
            onResetFilters={handleResetFilters}
          />
        </div>

        {/* 2. Right Positions Table */}
        <div className="flex-1 min-w-0 bg-white flex flex-col">
          {/* Table Toolbar / Active Filters */}
          <div className="px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-white text-xs">
            {/* Left: Checkbox + Active Filter Chips + Clear All */}
            <div className="flex items-center gap-3.5 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#165B42] focus:ring-[#165B42] cursor-pointer"
                />
                <span>Position</span>
              </label>

              {/* Active Filter Badges */}
              {selectedStatuses.includes('Open') && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                  <span>Job status: Open</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedStatuses((prev) => prev.filter((s) => s !== 'Open'))
                    }
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Remove filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}

              {selectedStatuses.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllFilterChips}
                  className="text-xs font-semibold text-[#165B42] hover:underline cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Right: Sort By + Pagination */}
            <div className="flex items-center gap-4 text-slate-600 text-xs sm:text-[13px]">
              <div className="flex items-center gap-1 cursor-pointer hover:text-slate-900 select-none">
                <span className="text-slate-500">Sort by:</span>
                <span className="font-semibold text-slate-800">Last viewed by me</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1 text-slate-700 select-none">
                <span>1 – {filteredPositions.length}</span>
                <span className="text-slate-400 ml-1 cursor-pointer hover:text-slate-800">&gt;</span>
              </div>
            </div>
          </div>

          {/* Position Rows */}
          <div className="divide-y divide-[#E2E8F0]">
            {filteredPositions.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-3">
                <p className="text-sm font-medium">No positions match your filter criteria.</p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs text-[#165B42] hover:underline font-semibold cursor-pointer"
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              filteredPositions.map((pos) => (
                <PositionRow
                  key={pos.id}
                  position={pos}
                  isSelected={selectedPositionIds.includes(pos.id)}
                  onToggleSelect={handleSelectOne}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
