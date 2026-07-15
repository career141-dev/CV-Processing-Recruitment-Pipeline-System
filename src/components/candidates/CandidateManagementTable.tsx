import React from 'react';
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Trash2, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

const SOURCE_COLORS: Record<string, string> = {
  linkedin: "bg-[#0A66C2] text-white",
  whatsapp: "bg-[#25D366] text-white",
  email_campaign: "bg-orange-400 text-white",
  email: "bg-orange-400 text-white",
  headhunting: "bg-purple-500 text-white",
  manual_upload: "bg-surface-container text-text-secondary",
  workable: "bg-sky-500 text-white",
};

const STAGE_LABELS: Record<string, string> = {
  new_cvs: "New CVs",
  matched_candidates: "TA Shortlisted",
  ta_shortlist: "TA Shortlisted",
  shortlisted: "TA Shortlisted",
  follow_up: "Follow-up",
  second_shortlist: "Second Shortlist",
  director_shortlist: "Director Shortlist",
  client_review: "Client Review",
  interview: "Interview",
  offer: "Offer",
  placed: "Placed",
  rejected: "Rejected",
  active: "Active",
  not_available: "Not Available",
  merged: "Merged"
};

const STATUS_COLORS: Record<string, string> = {
  new_cvs: "bg-blue-50 text-blue-700 border-blue-200",
  shortlisted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ta_shortlist: "bg-emerald-50 text-emerald-700 border-emerald-200",
  matched_candidates: "bg-emerald-50 text-emerald-700 border-emerald-200",
  follow_up: "bg-amber-50 text-amber-700 border-amber-200",
  second_shortlist: "bg-teal-50 text-teal-700 border-teal-200",
  director_shortlist: "bg-purple-50 text-purple-700 border-purple-200",
  client_review: "bg-pink-50 text-pink-700 border-pink-200",
  interview: "bg-cyan-50 text-cyan-700 border-cyan-200",
  offer: "bg-violet-50 text-violet-700 border-violet-200",
  placed: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  active: "bg-green-50 text-green-700 border-green-200",
  not_available: "bg-gray-50 text-gray-700 border-gray-200",
  merged: "bg-slate-50 text-slate-700 border-slate-200",
};

interface CandidateManagementTableProps {
  onDeleteClick?: (id: string) => void;
  selectedCandidates: string[];
  onToggleCandidate: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
}

export function CandidateManagementTable({ 
  onDeleteClick, 
  selectedCandidates, 
  onToggleCandidate, 
  onSelectAll 
}: CandidateManagementTableProps) {
  const router = useRouter();

  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = React.useState(1);
  
  // Filter States
  const [nameSearch, setNameSearch] = React.useState('');
  const [sourceFilter, setSourceFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [dateFilter, setDateFilter] = React.useState('all');
  const [locationFilter, setLocationFilter] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('');

  const {
    results: rawResults,
    status,
    loadMore,
  } = usePaginatedQuery(api.candidates.candidates.listCandidatesPaginated, {
    searchQuery: nameSearch || undefined
  }, { initialNumItems: 10 });

  // Filter candidates locally in memory
  const filteredResults = React.useMemo(() => {
    let list = rawResults;

    if (nameSearch.trim()) {
      const q = nameSearch.toLowerCase();
      list = list.filter(c =>
        c.fullName?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        (c as any).phone?.toLowerCase().includes(q)
      );
    }

    if (sourceFilter !== 'all') {
      list = list.filter(c => {
        const src = ((c as any).firstSourceChannel || (c as any).sourceChannel || "manual_upload").toLowerCase();
        return src === sourceFilter;
      });
    }

    if (statusFilter !== 'all') {
      list = list.filter(c => {
        const statusKey = c.overallStatus || c.status || "new_cvs";
        return statusKey === statusFilter;
      });
    }

    if (locationFilter.trim()) {
      const loc = locationFilter.toLowerCase();
      list = list.filter(c => c.location?.toLowerCase().includes(loc));
    }

    if (roleFilter.trim()) {
      const role = roleFilter.toLowerCase();
      list = list.filter(c => 
        (c.currentTitle || c.currentJobTitle || "").toLowerCase().includes(role)
      );
    }

    if (dateFilter !== 'all') {
      const now = Date.now();
      list = list.filter(c => {
        const date = c.firstSeenAt || c._creationTime;
        const diff = now - date;
        if (dateFilter === 'today') return diff <= 24 * 60 * 60 * 1000;
        if (dateFilter === 'week') return diff <= 7 * 24 * 60 * 60 * 1000;
        if (dateFilter === 'month') return diff <= 30 * 24 * 60 * 60 * 1000;
        return true;
      });
    }

    return list;
  }, [rawResults, nameSearch, sourceFilter, statusFilter, locationFilter, roleFilter, dateFilter]);

  // Reset to page 1 when search/filters change
  React.useEffect(() => { 
    setCurrentPage(1); 
  }, [nameSearch, sourceFilter, statusFilter, locationFilter, roleFilter, dateFilter]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredResults.slice(startIndex, endIndex);
  
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const canGoNext = currentPage < totalPages;
  const canGoPrev = currentPage > 1;

  const handleNext = () => {
    if (canGoNext) {
      setCurrentPage((p) => p + 1);
    } else if (status === "CanLoadMore") {
      loadMore(10);
      setCurrentPage((p) => p + 1);
    }
  };

  const handlePrev = () => {
    if (canGoPrev) setCurrentPage((p) => p - 1);
  };

  const hasActiveFilters = nameSearch || sourceFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all' || locationFilter || roleFilter;

  return (
    <div className="flex flex-col flex-1 w-full px-6 pb-6">
      
      {/* Search and Filters Layout */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-surface p-4 rounded-xl border border-border shadow-sm">
        {/* Name/Contact Search */}
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, email or phone..."
            value={nameSearch}
            onChange={e => setNameSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-[13px] border border-border rounded-[8px] bg-surface focus:outline-none focus:border-primary-container transition-colors"
          />
          {nameSearch && (
            <button
              onClick={() => setNameSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Source Filter */}
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="px-3 py-2 text-[13px] border border-border rounded-[8px] bg-surface focus:outline-none focus:border-primary-container transition-colors text-text-primary font-medium"
        >
          <option value="all">All Sources</option>
          <option value="linkedin">LinkedIn</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email_campaign">Email Campaign</option>
          <option value="headhunting">Headhunting</option>
          <option value="workable">Workable</option>
          <option value="manual_upload">Manual Upload</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-[13px] border border-border rounded-[8px] bg-surface focus:outline-none focus:border-primary-container transition-colors text-text-primary font-medium"
        >
          <option value="all">All Statuses</option>
          {Object.entries(STAGE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        {/* Date Filter */}
        <select
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="px-3 py-2 text-[13px] border border-border rounded-[8px] bg-surface focus:outline-none focus:border-primary-container transition-colors text-text-primary font-medium"
        >
          <option value="all">All Time</option>
          <option value="today">Added Today</option>
          <option value="week">Added This Week</option>
          <option value="month">Added This Month</option>
        </select>

        {/* Location Text Search */}
        <div className="w-40">
          <input
            type="text"
            placeholder="Filter location..."
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            className="w-full px-3 py-2 text-[13px] border border-border rounded-[8px] bg-surface focus:outline-none focus:border-primary-container transition-colors text-text-primary"
          />
        </div>

        {/* Role/Title Text Search */}
        <div className="w-44">
          <input
            type="text"
            placeholder="Filter role/title..."
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 text-[13px] border border-border rounded-[8px] bg-surface focus:outline-none focus:border-primary-container transition-colors text-text-primary"
          />
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setNameSearch('');
              setSourceFilter('all');
              setStatusFilter('all');
              setDateFilter('all');
              setLocationFilter('');
              setRoleFilter('');
            }}
            className="text-[12px] text-primary hover:underline font-semibold px-2 py-1 shrink-0"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                {/* Checkbox Header */}
                <th className="px-6 py-4 w-12">
                  <input 
                    type="checkbox"
                    checked={currentItems.length > 0 && currentItems.every(c => selectedCandidates.includes(c._id as string))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const newSelected = [...selectedCandidates];
                        currentItems.forEach(c => {
                          if (!newSelected.includes(c._id as string)) newSelected.push(c._id as string);
                        });
                        onSelectAll(newSelected);
                      } else {
                        const pageIds: string[] = currentItems.map(c => c._id as string);
                        onSelectAll(selectedCandidates.filter(id => !pageIds.includes(id)));
                      }
                    }}
                    className="rounded border-gray-300 text-primary focus:ring-[#1B5E20] cursor-pointer w-4 h-4"
                  />
                </th>
                <th className="px-6 py-4">Candidate</th>
                <th className="px-6 py-4">Current Role</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Experience</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Added On</th>
                <th className="px-6 py-4">Last Activity</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-[13px] text-text-primary">
              {currentItems.map((candidate) => (
                  <tr key={candidate._id} className="hover:bg-surface-bright transition-colors group">
                    {/* Checkbox Row */}
                    <td className="px-6 py-4 w-12">
                      <input 
                        type="checkbox"
                        checked={selectedCandidates.includes(candidate._id as string)}
                        onChange={() => onToggleCandidate(candidate._id as string)}
                        className="rounded border-gray-300 text-primary focus:ring-[#1B5E20] cursor-pointer w-4 h-4"
                      />
                    </td>
                    
                    <td className="px-6 py-4 font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-bold text-xs shrink-0 overflow-hidden">
                          {(candidate as any).profileImageUrl ? (
                            <img src={(candidate as any).profileImageUrl} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            candidate.fullName?.charAt(0) || "?"
                          )}
                        </div>
                        <div>
                          <button
                            onClick={() => router.push(`/dashboard/candidates/${candidate._id}`)}
                            className="text-text-primary font-semibold hover:text-primary hover:underline text-left transition-colors"
                          >
                            {candidate.fullName || "Unknown"}
                          </button>
                          <div className="text-text-secondary text-xs truncate max-w-[150px]">{candidate.email || candidate.phone || "No contact"}</div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="text-text-primary">{(candidate as any).currentTitle || (candidate as any).currentJobTitle || "—"}</div>
                      <div className="text-text-secondary text-xs">{(candidate as any).currentEmployer || ""}</div>
                    </td>

                    {/* Actionable Missing Location */}
                    <td className="px-6 py-4">
                      {candidate.location ? (
                        <span className="text-text-secondary">{candidate.location}</span>
                      ) : (
                        <button
                          onClick={() => router.push(`/dashboard/candidates/${candidate._id}`)}
                          className="text-xs text-primary hover:underline font-medium text-left"
                        >
                          Not extracted — click to add
                        </button>
                      )}
                    </td>

                    <td className="px-6 py-4 text-text-secondary">
                      {(candidate as any).totalExperienceYears != null
                        ? `${(candidate as any).totalExperienceYears} yrs`
                        : (candidate as any).yearsOfExperience
                        ? `${(candidate as any).yearsOfExperience} yrs`
                        : "—"}
                    </td>

                    <td className="px-6 py-4">
                      {(() => {
                        const src = ((candidate as any).firstSourceChannel || (candidate as any).sourceChannel || "manual_upload").toLowerCase();
                        const color = SOURCE_COLORS[src] ?? "bg-surface-container text-text-secondary";
                        return (
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${color}`}>
                            {src.replace(/_/g, " ")}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Explicit Job Context Status Badges */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2.5 max-w-[200px]">
                        {(candidate as any).activeApplications && (candidate as any).activeApplications.length > 0 ? (
                          (candidate as any).activeApplications.map((app: any, idx: number) => {
                            const statusKey = app.stage || "new_cvs";
                            const label = STAGE_LABELS[statusKey] || statusKey;
                            const color = STATUS_COLORS[statusKey] ?? "bg-surface-container text-text-secondary border-border";
                            return (
                              <div key={idx} className="flex flex-col items-start gap-0.5">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${color}`}>
                                  {label}
                                </span>
                                <span className="text-[10px] text-text-secondary pl-1 font-semibold truncate max-w-[180px]" title={app.jobTitle}>
                                  ({app.jobTitle})
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border bg-gray-50 text-gray-500 border-gray-200 text-center">
                            In Database
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Separated Dates */}
                    <td className="px-6 py-4 text-text-secondary whitespace-nowrap">
                      {format(new Date(candidate.firstSeenAt || candidate._creationTime), 'MMM d, yyyy, h:mm a')}
                    </td>
                    <td className="px-6 py-4 text-text-secondary whitespace-nowrap">
                      {candidate.lastUpdatedAt ? format(new Date(candidate.lastUpdatedAt), 'MMM d, yyyy, h:mm a') : '—'}
                    </td>

                    {/* Icon-Only Row Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-[8px] transition-colors border border-transparent hover:border-red-100"
                          onClick={() => onDeleteClick?.(candidate._id as string)}
                          title="Delete Candidate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {currentItems.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="w-10 h-10 text-gray-300 mb-3" />
                      <p className="text-gray-500 font-medium">No candidates found.</p>
                      {hasActiveFilters && (
                        <p className="text-sm text-gray-400 mt-1">Try clearing or adjusting your filters.</p>
                      )}
                    </div>
                  </td>
                </tr>
              )}</tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface-bright">
          <span className="text-[13px] text-text-secondary">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredResults.length)} of {filteredResults.length} {status === "CanLoadMore" ? "(More available)" : ""}
          </span>
          <div className="flex gap-2 items-center">
            <button
              onClick={handlePrev}
              disabled={!canGoPrev}
              className="p-1.5 border border-border rounded-md text-text-secondary hover:bg-surface hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {/* Numeric Page Indicators */}
            <div className="flex items-center gap-1 mx-2">
              {(() => {
                const pages = [];
                const maxVisiblePages = 5;
                
                let startPage = Math.max(1, currentPage - 2);
                let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                
                if (endPage - startPage + 1 < maxVisiblePages) {
                  startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }

                if (startPage > 1) {
                  pages.push(
                    <button key={1} onClick={() => setCurrentPage(1)} className="px-2.5 py-1 text-[13px] rounded-md transition-colors text-text-secondary hover:bg-surface hover:text-text-primary font-medium">
                      1
                    </button>
                  );
                  if (startPage > 2) {
                    pages.push(<span key="start-ellipsis" className="px-1 text-text-secondary">...</span>);
                  }
                }

                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`px-2.5 py-1 text-[13px] rounded-md transition-colors font-medium ${
                        currentPage === i
                          ? "bg-[#0A66C2] text-white shadow-sm"
                          : "text-text-secondary hover:bg-surface hover:text-text-primary"
                      }`}
                    >
                      {i}
                    </button>
                  );
                }

                if (endPage < totalPages) {
                  if (endPage < totalPages - 1) {
                    pages.push(<span key="end-ellipsis" className="px-1 text-text-secondary">...</span>);
                  }
                  pages.push(
                    <button key={totalPages} onClick={() => setCurrentPage(totalPages)} className="px-2.5 py-1 text-[13px] rounded-md transition-colors text-text-secondary hover:bg-surface hover:text-text-primary font-medium">
                      {totalPages}
                    </button>
                  );
                }

                if (status === "CanLoadMore" && endPage >= totalPages && totalPages > 0) {
                    pages.push(<span key="load-more-ellipsis" className="px-1 text-text-secondary" title="More pages available to load">...</span>);
                }

                return pages;
              })()}
            </div>

            <button
              onClick={handleNext}
              disabled={!canGoNext && status !== "CanLoadMore"}
              className="p-1.5 border border-border rounded-md text-text-secondary hover:bg-surface hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
