"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { EditJobModal } from '@/components/jobs/EditJobModal';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import {
  Search,
  RotateCcw,
  Pencil,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  HelpCircle,
  PauseCircle,
  PlayCircle,
  Trash2,
  Share2,
  Building,
  MapPin,
  User,
  Briefcase
} from 'lucide-react';

type Source = { id: string; label: string; bgClass: string; textClass: string };

type Job = {
  id: string;
  rawJob: any;
  title: string;
  client: string;
  keyword: string;
  location: string;
  workplaceType: 'On-site' | 'Hybrid' | 'Remote';
  seniority: string;
  type: string;
  salary: string;
  sources: Source[];
  newCvs: number;
  newCvsBadge?: { text: string; bgClass: string; textClass: string };
  totalApplications: number;
  stage: { label: string; bgClass: string; textClass: string; borderClass: string };
  taAssigned: string | null;
  status: 'Open' | 'On Hold' | 'Fins' | 'Lost' | 'Draft';
  statusBadge: { label: string; bgClass: string; textClass: string; borderClass: string };
  created: string;
  createdTime: number;
};

export default function JobsPage() {
  const router = useRouter();

  // Data fetching
  const dbJobs = useQuery(api.jobs.jobs.list);
  const jobCounts = useQuery(api.jobs.jobs.getJobCounts);
  const users = useQuery(api.users.users.getAllUsers);
  const isLoading = dbJobs === undefined || users === undefined;

  // Mutations
  const deleteJob = useMutation(api.jobs.jobs.deleteJob);
  const updateJobStatus = useMutation(api.jobs.jobs.updateJobStatus);

  // Selection & UI state
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [activeDropdownJobId, setActiveDropdownJobId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [expandedJobIds, setExpandedJobIds] = useState<string[]>([]);

  // Filter states (LinkedIn Recruiter Facets)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locationSearch, setLocationSearch] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [showAllLocations, setShowAllLocations] = useState<boolean>(false);
  const [selectedWorkplaceTypes, setSelectedWorkplaceTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [posterSearch, setPosterSearch] = useState<string>('');
  const [selectedPosters, setSelectedPosters] = useState<string[]>([]);
  const [showAllPosters, setShowAllPosters] = useState<boolean>(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<'last_viewed' | 'newest' | 'title' | 'applicants'>('last_viewed');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 10;

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleWindowClick = () => {
      setActiveDropdownJobId(null);
    };
    window.addEventListener('click', handleWindowClick);
    return () => {
      window.removeEventListener('click', handleWindowClick);
    };
  }, []);

  // Format jobs from live Convex database
  const formattedJobs: Job[] = useMemo(() => {
    if (!dbJobs || !users) return [];

    return dbJobs.map((j: any) => {
      const recruiter = users.find((u: any) => u._id === j.primaryRecruiterId);

      // Map status
      let statusFormatted: 'Open' | 'On Hold' | 'Fins' | 'Lost' | 'Draft' = 'Open';
      let statusBadge = { label: "Open", bgClass: "bg-emerald-50", textClass: "text-emerald-700", borderClass: "border-emerald-200" };

      if (j.status === 'on_hold') {
        statusFormatted = 'On Hold';
        statusBadge = { label: "On Hold", bgClass: "bg-amber-50", textClass: "text-amber-700", borderClass: "border-amber-200" };
      } else if (j.status === 'closed') {
        statusFormatted = 'Fins';
        statusBadge = { label: "Fins", bgClass: "bg-slate-100", textClass: "text-slate-700", borderClass: "border-slate-200" };
      } else if (j.status === 'lost') {
        statusFormatted = 'Lost';
        statusBadge = { label: "Lost", bgClass: "bg-red-50", textClass: "text-red-700", borderClass: "border-red-200" };
      } else if (j.status === 'draft') {
        statusFormatted = 'Draft';
        statusBadge = { label: "Draft", bgClass: "bg-gray-100", textClass: "text-gray-700", borderClass: "border-gray-200" };
      }

      // Workplace type
      let workplace: 'On-site' | 'Hybrid' | 'Remote' = 'On-site';
      const locLower = (j.location || '').toLowerCase();
      if (locLower.includes('remote')) workplace = 'Remote';
      else if (locLower.includes('hybrid')) workplace = 'Hybrid';

      // Stage labels
      const STAGE_LABELS: Record<string, { label: string; bgClass: string; textClass: string; borderClass: string }> = {
        new_cvs:            { label: "New CVs",          bgClass: "bg-blue-50",    textClass: "text-blue-700",    borderClass: "border-blue-200" },
        ta_shortlist:       { label: "TA Shortlist",     bgClass: "bg-violet-50",  textClass: "text-violet-700",  borderClass: "border-violet-200" },
        ai_call:            { label: "AI Call",           bgClass: "bg-cyan-50",    textClass: "text-cyan-700",    borderClass: "border-cyan-200" },
        interview:          { label: "Interview",         bgClass: "bg-yellow-50",  textClass: "text-yellow-700",  borderClass: "border-yellow-200" },
        second_shortlist:   { label: "2nd Shortlist",    bgClass: "bg-orange-50",  textClass: "text-orange-700",  borderClass: "border-orange-200" },
        director_shortlist: { label: "Director Review",  bgClass: "bg-indigo-50",  textClass: "text-indigo-700",  borderClass: "border-indigo-200" },
        client_review:      { label: "Client Review",    bgClass: "bg-pink-50",    textClass: "text-pink-700",    borderClass: "border-pink-200" },
        offer:              { label: "Offer",             bgClass: "bg-emerald-50", textClass: "text-emerald-700", borderClass: "border-emerald-200" },
        placed:             { label: "Placed",            bgClass: "bg-green-50",   textClass: "text-green-700",   borderClass: "border-green-200" },
      };

      const stageInfo = j.totalApplications > 0
        ? (STAGE_LABELS[j.dominantStage] || STAGE_LABELS.new_cvs)
        : { label: "No Applicants", bgClass: "bg-gray-50", textClass: "text-gray-500", borderClass: "border-gray-200" };

      const ALL_SOURCES = [
        { id: 'whatsapp', label: 'WA', bgClass: 'bg-green-100', textClass: 'text-green-700' },
        { id: 'email', label: 'EM', bgClass: 'bg-orange-100', textClass: 'text-orange-700' },
        { id: 'linkedin', label: 'LI', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
        { id: 'portal', label: 'CP', bgClass: 'bg-purple-100', textClass: 'text-purple-700' }
      ];
      const paused = j.pausedChannels || [];
      const activeSources = ALL_SOURCES.filter(src => !paused.includes(src.id));

      // Clean location to remove duplicate (On-site)/(Hybrid)/(Remote) if already present in database location string
      const cleanLocation = (j.location || 'Sri Lanka')
        .replace(/\s*\((on-site|hybrid|remote)\)/gi, '')
        .trim();

      return {
        id: j._id,
        rawJob: j,
        title: j.title,
        client: j.clientName || 'Career141',
        keyword: j.keyword || '',
        location: cleanLocation || 'Sri Lanka',
        workplaceType: workplace,
        seniority: j.seniorityLevel || 'N/A',
        type: j.recruitmentType || 'Manual',
        salary: j.salaryMin ? `${j.salaryMin}${j.salaryMax ? `-${j.salaryMax}` : ''} ${j.salaryCurrency || 'LKR'}` : '-',
        sources: activeSources,
        newCvs: j.newCvsCount ?? 0,
        newCvsBadge: (j.newCvsCount ?? 0) > 0 ? { text: "new", bgClass: "bg-blue-100", textClass: "text-blue-700" } : undefined,
        totalApplications: j.totalApplications ?? 0,
        stage: stageInfo,
        taAssigned: (j.isAssignedTAExplicit !== false && recruiter) ? recruiter.fullName : null,
        status: statusFormatted,
        statusBadge,
        created: new Date(j._creationTime).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }),
        createdTime: j._creationTime,
      };
    });
  }, [dbJobs, users]);

  // Real Dynamic Facets from Live Database
  // 1. Locations (extracting hierarchical segments and counting matches)
  const locationFacets = useMemo(() => {
    const rawLocations = formattedJobs.map(j => j.location.trim()).filter(Boolean);
    const candidateSegments = new Set<string>();

    rawLocations.forEach(loc => {
      candidateSegments.add(loc);
      const parts = loc.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        // e.g., "Western Province, Sri Lanka"
        candidateSegments.add(parts.slice(-2).join(', '));
      }
      if (parts.length >= 1) {
        // e.g., "Sri Lanka"
        candidateSegments.add(parts[parts.length - 1]);
      }
    });

    const facets: { name: string; count: number }[] = [];
    candidateSegments.forEach(segment => {
      if (!segment) return;
      const count = formattedJobs.filter(j =>
        j.location.toLowerCase().includes(segment.toLowerCase())
      ).length;
      if (count > 0) {
        facets.push({ name: segment, count });
      }
    });

    // Sort by count descending, then alphabetical
    return facets.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [formattedJobs]);

  // 2. Workplace Types (real counts)
  const workplaceFacets = useMemo(() => {
    const counts = { 'On-site': 0, 'Hybrid': 0, 'Remote': 0 };
    formattedJobs.forEach(j => {
      if (counts[j.workplaceType] !== undefined) {
        counts[j.workplaceType]++;
      }
    });
    return counts;
  }, [formattedJobs]);

  // 3. Job Status (real counts)
  const statusFacets = useMemo(() => {
    const counts: Record<string, number> = { 'Open': 0, 'On Hold': 0, 'Fins': 0, 'Lost': 0, 'Draft': 0 };
    formattedJobs.forEach(j => {
      if (counts[j.status] !== undefined) {
        counts[j.status]++;
      }
    });
    return counts;
  }, [formattedJobs]);

  // 4. Job Posters / Assigned Recruiters (real team members from users)
  const posterFacets = useMemo(() => {
    const map = new Map<string, number>();
    formattedJobs.forEach(j => {
      const poster = j.taAssigned || 'Unassigned';
      map.set(poster, (map.get(poster) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [formattedJobs]);

  // 5. Companies / Clients
  const clientFacets = useMemo(() => {
    const map = new Map<string, number>();
    formattedJobs.forEach(j => {
      if (j.client) {
        map.set(j.client, (map.get(j.client) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [formattedJobs]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setLocationSearch('');
    setSelectedLocations([]);
    setSelectedWorkplaceTypes([]);
    setSelectedStatuses([]);
    setPosterSearch('');
    setSelectedPosters([]);
    setSelectedClients([]);
    setCurrentPage(1);
  };

  // Filter evaluation
  const filteredJobs = useMemo(() => {
    return formattedJobs.filter(job => {
      // 1. Text Search (title, client, keyword, location)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = job.title.toLowerCase().includes(q);
        const matchClient = job.client.toLowerCase().includes(q);
        const matchKeyword = job.keyword.toLowerCase().includes(q);
        const matchLocation = job.location.toLowerCase().includes(q);
        if (!matchTitle && !matchClient && !matchKeyword && !matchLocation) return false;
      }

      // 2. Location filter (OR match among selected locations)
      if (selectedLocations.length > 0) {
        const matchesLocation = selectedLocations.some(sel =>
          job.location.toLowerCase().includes(sel.toLowerCase())
        );
        if (!matchesLocation) return false;
      }

      // 3. Workplace filter (OR match among selected workplace types)
      if (selectedWorkplaceTypes.length > 0 && !selectedWorkplaceTypes.includes(job.workplaceType)) {
        return false;
      }

      // 4. Status filter (OR match among selected statuses)
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(job.status)) {
        return false;
      }

      // 5. Job Poster / TA filter (OR match among selected posters)
      if (selectedPosters.length > 0) {
        const poster = job.taAssigned || 'Unassigned';
        if (!selectedPosters.includes(poster)) return false;
      }

      // 6. Client filter
      if (selectedClients.length > 0 && !selectedClients.includes(job.client)) {
        return false;
      }

      return true;
    });
  }, [formattedJobs, searchQuery, selectedLocations, selectedWorkplaceTypes, selectedStatuses, selectedPosters, selectedClients]);

  // Sort evaluation
  const sortedJobs = useMemo(() => {
    const copy = [...filteredJobs];
    if (sortBy === 'newest') {
      return copy.sort((a, b) => b.createdTime - a.createdTime);
    }
    if (sortBy === 'title') {
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortBy === 'applicants') {
      return copy.sort((a, b) => b.totalApplications - a.totalApplications);
    }
    // Default: last_viewed (or creation order)
    return copy;
  }, [filteredJobs, sortBy]);

  // Pagination calculations
  const totalItems = sortedJobs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const paginatedJobs = sortedJobs.slice(startIndex, endIndex);

  // Multi-select handlers
  const handleSelectJob = (id: string) => {
    setSelectedJobs(prev => prev.includes(id) ? prev.filter(jId => jId !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedJobs.length === filteredJobs.length && filteredJobs.length > 0) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(filteredJobs.map(j => j.id));
    }
  };

  // Toggle see more
  const toggleSeeMore = (id: string) => {
    setExpandedJobIds(prev =>
      prev.includes(id) ? prev.filter(jId => jId !== id) : [...prev, id]
    );
  };


  // Check if any filter is active
  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedLocations.length > 0 ||
    selectedWorkplaceTypes.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedPosters.length > 0 ||
    selectedClients.length > 0;

  return (
    <div className="w-full max-w-[1440px] mx-auto pb-20 pt-1">
      {/* Top Header Section (Matching LinkedIn Recruiter) */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 mb-6 border-b border-border/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Jobs</h1>
        </div>

        <div className="flex items-center gap-5 self-end sm:self-auto">
          {/* Post a job primary button */}
          <button
            onClick={() => router.push('/dashboard/jobs/new')}
            className="px-4 py-1.5 rounded-full bg-[#0a66c2] hover:bg-[#004182] text-white text-xs sm:text-[13px] font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-1"
          >
            Post a job
          </button>
        </div>
      </div>

      {/* Two-Column Layout: Left Filter Sidebar + Main Jobs Feed */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* ── Left Sidebar Filters ────────────────────────── */}
        <aside className="w-full lg:w-64 shrink-0 space-y-5 lg:pr-2">
          {/* Reset filters header */}
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#0a66c2] hover:underline cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Reset filters</span>
            </button>
          </div>

          {/* Search for a job input */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search for a job"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-surface text-text-primary placeholder:text-text-secondary focus:outline-hidden focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition-colors"
            />
          </div>

          {/* Location Facet */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-text-primary">Location</h3>
            <div className="relative">
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Search location"
                disabled={isLoading}
                className="w-full px-3 py-1.5 text-xs rounded-md border border-border bg-surface text-text-primary placeholder:text-text-secondary focus:outline-hidden focus:border-[#0a66c2]"
              />
            </div>
            <div className="space-y-2 pt-1">
              {isLoading ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="w-4 h-4 rounded shrink-0" />
                    <Skeleton className="h-3.5 w-32" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="w-4 h-4 rounded shrink-0" />
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="w-4 h-4 rounded shrink-0" />
                    <Skeleton className="h-3.5 w-28" />
                  </div>
                </div>
              ) : (
                <>
                  {locationFacets
                    .filter(l => !locationSearch || l.name.toLowerCase().includes(locationSearch.toLowerCase()))
                    .slice(0, showAllLocations ? undefined : 4)
                    .map((loc) => {
                      const isChecked = selectedLocations.includes(loc.name);
                      return (
                        <label key={loc.name} className="flex items-center gap-2.5 text-[13px] text-text-secondary hover:text-text-primary cursor-pointer select-none leading-normal">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedLocations(prev =>
                                prev.includes(loc.name) ? prev.filter(x => x !== loc.name) : [...prev, loc.name]
                              );
                              setCurrentPage(1);
                            }}
                            className="rounded border-border text-[#0a66c2] focus:ring-[#0a66c2] w-4 h-4 cursor-pointer"
                          />
                          <span className="truncate flex-1">{loc.name}</span>
                          <span className="text-text-disabled text-xs">({loc.count})</span>
                        </label>
                      );
                    })}
                  {locationFacets.length > 4 && (
                    <button
                      type="button"
                      onClick={() => setShowAllLocations(!showAllLocations)}
                      className="text-xs font-semibold text-[#0a66c2] hover:underline pt-0.5 cursor-pointer"
                    >
                      {showAllLocations ? "Show less" : "Show more"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Workplace type Facet */}
          <div className="space-y-2 pt-2.5 border-t border-border/60">
            <h3 className="text-[13px] font-bold text-text-primary">Workplace type</h3>
            <div className="space-y-2">
              {(['On-site', 'Hybrid', 'Remote'] as const).map((type) => {
                const isChecked = selectedWorkplaceTypes.includes(type);
                const count = workplaceFacets[type];
                return (
                  <label key={type} className="flex items-center gap-2.5 text-[13px] text-text-secondary hover:text-text-primary cursor-pointer select-none leading-normal">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isLoading}
                      onChange={() => {
                        setSelectedWorkplaceTypes(prev =>
                          prev.includes(type) ? prev.filter(x => x !== type) : [...prev, type]
                        );
                        setCurrentPage(1);
                      }}
                      className="rounded border-border text-[#0a66c2] focus:ring-[#0a66c2] w-4 h-4 cursor-pointer"
                    />
                    <span className="flex-1">{type}</span>
                    {isLoading ? (
                      <Skeleton className="w-5 h-3.5 rounded" />
                    ) : (
                      <span className="text-text-disabled text-xs">({count})</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Job status Facet */}
          <div className="space-y-2 pt-2.5 border-t border-border/60">
            <h3 className="text-[13px] font-bold text-text-primary">Job status</h3>
            <div className="space-y-2">
              {(['Open', 'On Hold', 'Fins', 'Lost', 'Draft'] as const).map((status) => {
                const isChecked = selectedStatuses.includes(status);
                const count = statusFacets[status] || 0;
                return (
                  <label key={status} className="flex items-center gap-2.5 text-[13px] text-text-secondary hover:text-text-primary cursor-pointer select-none leading-normal">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isLoading}
                      onChange={() => {
                        setSelectedStatuses(prev =>
                          prev.includes(status) ? prev.filter(x => x !== status) : [...prev, status]
                        );
                        setCurrentPage(1);
                      }}
                      className="rounded border-border text-[#0a66c2] focus:ring-[#0a66c2] w-4 h-4 cursor-pointer"
                    />
                    <span className="flex-1">{status === 'Fins' ? 'Closed' : status}</span>
                    {isLoading ? (
                      <Skeleton className="w-5 h-3.5 rounded" />
                    ) : (
                      <span className="text-text-disabled text-xs">({count})</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Job poster Facet */}
          {(isLoading || posterFacets.length > 0) && (
            <div className="space-y-2 pt-2.5 border-t border-border/60">
              <h3 className="text-[13px] font-bold text-text-primary">Job poster</h3>
              <div className="relative">
                <input
                  type="text"
                  value={posterSearch}
                  onChange={(e) => setPosterSearch(e.target.value)}
                  placeholder="Search job poster"
                  disabled={isLoading}
                  className="w-full px-3 py-1.5 text-xs rounded-md border border-border bg-surface text-text-primary placeholder:text-text-secondary focus:outline-hidden focus:border-[#0a66c2]"
                />
              </div>
              <div className="space-y-2 pt-1">
                {isLoading ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="w-4 h-4 rounded shrink-0" />
                      <Skeleton className="h-3.5 w-28" />
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="w-4 h-4 rounded shrink-0" />
                      <Skeleton className="h-3.5 w-36" />
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="w-4 h-4 rounded shrink-0" />
                      <Skeleton className="h-3.5 w-20" />
                    </div>
                  </div>
                ) : (
                  <>
                    {posterFacets
                      .filter(p => !posterSearch || p.name.toLowerCase().includes(posterSearch.toLowerCase()))
                      .slice(0, showAllPosters ? undefined : 4)
                      .map((poster) => {
                        const isChecked = selectedPosters.includes(poster.name);
                        return (
                          <label key={poster.name} className="flex items-center gap-2.5 text-[13px] text-text-secondary hover:text-text-primary cursor-pointer select-none leading-normal">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedPosters(prev =>
                                  prev.includes(poster.name) ? prev.filter(x => x !== poster.name) : [...prev, poster.name]
                                );
                                setCurrentPage(1);
                              }}
                              className="rounded border-border text-[#0a66c2] focus:ring-[#0a66c2] w-4 h-4 cursor-pointer"
                            />
                            <span className="truncate flex-1">{poster.name}</span>
                            <span className="text-text-disabled text-xs">({poster.count})</span>
                          </label>
                        );
                      })}
                    {posterFacets.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setShowAllPosters(!showAllPosters)}
                        className="text-xs font-semibold text-[#0a66c2] hover:underline pt-0.5 cursor-pointer"
                      >
                        {showAllPosters ? "Show less" : "Show more"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Company / Client Facet */}
          {(isLoading || clientFacets.length > 0) && (
            <div className="space-y-2 pt-2.5 border-t border-border/60">
              <h3 className="text-[13px] font-bold text-text-primary">Company / Client</h3>
              <div className="space-y-2 pt-1">
                {isLoading ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="w-4 h-4 rounded shrink-0" />
                      <Skeleton className="h-3.5 w-32" />
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="w-4 h-4 rounded shrink-0" />
                      <Skeleton className="h-3.5 w-24" />
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="w-4 h-4 rounded shrink-0" />
                      <Skeleton className="h-3.5 w-28" />
                    </div>
                  </div>
                ) : (
                  clientFacets.slice(0, 4).map((c) => {
                    const isChecked = selectedClients.includes(c.name);
                    return (
                      <label key={c.name} className="flex items-center gap-2.5 text-[13px] text-text-secondary hover:text-text-primary cursor-pointer select-none leading-normal">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedClients(prev =>
                              prev.includes(c.name) ? prev.filter(x => x !== c.name) : [...prev, c.name]
                            );
                            setCurrentPage(1);
                          }}
                          className="rounded border-border text-[#0a66c2] focus:ring-[#0a66c2] w-4 h-4 cursor-pointer"
                        />
                        <span className="truncate flex-1">{c.name}</span>
                        <span className="text-text-disabled text-xs">({c.count})</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </aside>

        {/* ── Main Content Area: Job List Feed ────────────────────────── */}
        <main className="flex-1 w-full min-w-0">
          {/* Top Toolbar: Selection, Active Filter Chips, Sort & Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border mb-3">
            {/* Left: Checkbox + Job count + Filter chips */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none mr-2">
                <input
                  type="checkbox"
                  checked={selectedJobs.length === filteredJobs.length && filteredJobs.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-border text-[#0a66c2] focus:ring-[#0a66c2] w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-text-primary tracking-wider uppercase">
                  {filteredJobs.length} JOBS
                </span>
              </label>

              {/* Active Filter Chips */}
              {selectedStatuses.map(status => (
                <span
                  key={status}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                >
                  Status: {status}
                  <X
                    size={12}
                    className="cursor-pointer hover:opacity-75"
                    onClick={() => setSelectedStatuses(prev => prev.filter(s => s !== status))}
                  />
                </span>
              ))}

              {selectedLocations.map(loc => (
                <span
                  key={loc}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-border"
                >
                  Location: {loc}
                  <X
                    size={12}
                    className="cursor-pointer hover:opacity-75"
                    onClick={() => setSelectedLocations(prev => prev.filter(l => l !== loc))}
                  />
                </span>
              ))}

              {selectedWorkplaceTypes.map(type => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                >
                  Workplace: {type}
                  <X
                    size={12}
                    className="cursor-pointer hover:opacity-75"
                    onClick={() => setSelectedWorkplaceTypes(prev => prev.filter(t => t !== type))}
                  />
                </span>
              ))}

              {selectedPosters.map(poster => (
                <span
                  key={poster}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                >
                  Poster: {poster}
                  <X
                    size={12}
                    className="cursor-pointer hover:opacity-75"
                    onClick={() => setSelectedPosters(prev => prev.filter(p => p !== poster))}
                  />
                </span>
              ))}

              {selectedClients.map(client => (
                <span
                  key={client}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                >
                  Client: {client}
                  <X
                    size={12}
                    className="cursor-pointer hover:opacity-75"
                    onClick={() => setSelectedClients(prev => prev.filter(c => c !== client))}
                  />
                </span>
              ))}

              {searchQuery.trim().length > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                >
                  Search: "{searchQuery}"
                  <X
                    size={12}
                    className="cursor-pointer hover:opacity-75"
                    onClick={() => setSearchQuery('')}
                  />
                </span>
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-semibold text-[#0a66c2] hover:underline ml-1 cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Right: Sort dropdown & Pagination */}
            <div className="flex items-center gap-4 text-xs text-text-secondary self-end sm:self-auto">
              {/* Sort by */}
              <div className="flex items-center gap-1.5">
                <span>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent border-none text-xs font-semibold text-text-primary cursor-pointer focus:outline-hidden pr-2"
                >
                  <option value="last_viewed">Last viewed by me</option>
                  <option value="newest">Newest posted</option>
                  <option value="title">Job title (A-Z)</option>
                  <option value="applicants">Most applicants</option>
                </select>
              </div>

              {/* Pagination text and arrows */}
              <div className="flex items-center gap-2 pl-3 border-l border-border">
                <span className="text-xs text-text-secondary">
                  {totalItems > 0 ? `${startIndex + 1} – ${endIndex}` : '0'}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Job List Feed Items */}
          <div className="divide-y divide-border">
            {dbJobs === undefined || users === undefined ? (
              <div className="py-8 space-y-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="py-16 text-center text-text-secondary">
                <p className="text-sm font-semibold text-text-primary">No jobs found matching your filters.</p>
                <button
                  onClick={handleResetFilters}
                  className="mt-3 text-xs font-semibold text-[#0a66c2] hover:underline"
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              paginatedJobs.map((job) => {
                const isSelected = selectedJobs.includes(job.id);
                const isExpanded = expandedJobIds.includes(job.id);

                return (
                  <div
                    key={job.id}
                    onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                    className="py-5 px-3 hover:bg-surface-container-high/25 transition-colors rounded-xl group cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-5">
                      {/* Left: Checkbox + Job Details */}
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => handleSelectJob(job.id)}
                          className="rounded border-border text-[#0a66c2] focus:ring-[#0a66c2] w-4 h-4 cursor-pointer mt-1 shrink-0"
                        />

                        <div className="space-y-2 min-w-0 flex-1">
                          {/* 1. STATUS & JOB TITLE */}
                          <div className="flex items-center gap-2.5 flex-wrap">
                            {/* STATUS */}
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-0.5 rounded-full border border-border/80 bg-surface shadow-2xs shrink-0">
                              {job.status === 'Open' && (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Open</span>
                                </>
                              )}
                              {job.status === 'On Hold' && (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                  <span className="text-amber-700 dark:text-amber-400 font-semibold">On Hold</span>
                                </>
                              )}
                              {job.status === 'Fins' && (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                                  <span className="text-slate-600 dark:text-slate-400 font-semibold">Closed</span>
                                </>
                              )}
                              {job.status === 'Lost' && (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                  <span className="text-red-700 dark:text-red-400 font-semibold">Lost</span>
                                </>
                              )}
                              {job.status === 'Draft' && (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
                                  <span className="text-gray-600 dark:text-gray-400 font-semibold">Draft</span>
                                </>
                              )}
                            </span>

                            <Link
                              href={`/dashboard/jobs/${job.id}`}
                              className="text-[16px] font-semibold text-slate-800 dark:text-slate-100 hover:text-[#0a66c2] hover:underline transition-colors leading-snug tracking-tight"
                            >
                              {job.title}
                            </Link>
                          </div>

                          {/* 2. CLIENT · 3. LOCATION · 7. TA ASSIGNED */}
                          <div className="flex items-center gap-2.5 text-[13.5px] text-text-secondary flex-wrap leading-relaxed">
                            {/* CLIENT */}
                            <span className="font-semibold text-text-primary flex items-center gap-1.5">
                              <Building size={14} className="text-text-tertiary shrink-0" />
                              <span>{job.client}</span>
                            </span>
                            <span className="text-border font-bold">·</span>

                            {/* LOCATION */}
                            <span className="flex items-center gap-1.5">
                              <MapPin size={14} className="text-text-tertiary shrink-0" />
                              <span>{job.location} ({job.workplaceType})</span>
                            </span>
                            <span className="text-border font-bold">·</span>

                            {/* TA ASSIGNED */}
                            <span className="flex items-center gap-1.5">
                              <User size={14} className="text-text-tertiary shrink-0" />
                              <span className="text-text-tertiary font-medium">TA:</span>
                              <span className="font-medium text-text-primary">{job.taAssigned || 'Unassigned'}</span>
                            </span>
                          </div>

                          {/* 6. STAGE · 4. SOURCES ACTIVE · 5. NEW CVS */}
                          <div className="flex items-center gap-3 text-[13px] text-text-secondary flex-wrap pt-0.5 leading-relaxed">
                            {/* STAGE */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] font-medium text-text-tertiary">Stage:</span>
                              <span className={`px-2.5 py-0.5 rounded text-[12px] font-semibold border ${job.stage.bgClass} ${job.stage.textClass} ${job.stage.borderClass}`}>
                                {job.stage.label}
                              </span>
                            </div>

                            <span className="text-border font-bold">·</span>

                            {/* SOURCES ACTIVE */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] font-medium text-text-tertiary">Active Sources:</span>
                              {job.sources.length > 0 ? (
                                <div className="inline-flex items-center gap-1">
                                  {job.sources.map(src => (
                                    <span
                                      key={src.id}
                                      className={`w-4.5 h-4.5 rounded text-[9.5px] font-bold flex items-center justify-center ${src.bgClass} ${src.textClass}`}
                                      title={`Source: ${src.id}`}
                                    >
                                      {src.label}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-text-disabled text-[12px]">-</span>
                              )}
                            </div>

                            <span className="text-border font-bold">·</span>

                            {/* NEW CVS */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] font-medium text-text-tertiary">New CVs:</span>
                              <span className="font-bold text-text-primary text-[13px]">{job.newCvs}</span>
                              {job.newCvs > 0 && (
                                <span className="bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-[11px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                                  new
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Meta line: Posted date · Project Name */}
                          <div className="text-[12.5px] text-text-secondary flex items-center gap-2.5 flex-wrap pt-0.5 leading-relaxed">
                            <span>Posted: {job.created}</span>
                            <span className="text-border font-bold">·</span>
                            <span className="truncate">
                              <span className="font-medium text-text-tertiary">Project: </span>
                              <span className="font-semibold uppercase tracking-tight text-text-primary">
                                {job.keyword ? `${job.keyword} - ${job.client}` : `${job.title} - ${job.client}`}
                              </span>
                            </span>
                          </div>

                          {/* Expanded Details Drawer */}
                          {isExpanded && (
                            <div className="pt-3 mt-2 border-t border-border/60 text-[13px] text-text-secondary grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
                              <div>
                                <span className="font-semibold text-text-primary">Salary: </span>
                                {job.salary}
                              </div>
                              <div>
                                <span className="font-semibold text-text-primary">Seniority: </span>
                                {job.seniority}
                              </div>
                              <div>
                                <span className="font-semibold text-text-primary">Job ID: </span>
                                <span className="font-mono text-[11px]">{job.id}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Middle: Metrics / Views / Applicants */}
                      <div className="hidden md:flex flex-col items-start min-w-[160px] text-[13px] text-text-secondary pl-5 leading-relaxed">
                        <div>
                          <span>Views: </span>
                          <span className="font-semibold text-text-primary text-[13.5px]">{job.newCvs * 8 + 42}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span>Applicants: </span>
                          <span className="font-semibold text-text-primary text-[13.5px]">{job.totalApplications}</span>
                          {job.newCvs > 0 && (
                            <span className="text-[12px] text-emerald-700 dark:text-emerald-400 font-semibold ml-0.5">
                              ({job.newCvs} new)
                            </span>
                          )}
                          <HelpCircle size={13} className="text-text-disabled ml-0.5" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSeeMore(job.id);
                          }}
                          className="text-[12px] font-semibold text-[#0a66c2] hover:underline mt-1.5 cursor-pointer"
                        >
                          {isExpanded ? "See less" : "See more"}
                        </button>
                      </div>

                      {/* Right: Actions (Optimize, Edit, More Menu) */}
                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        {/* Scan DB / Pipeline Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/jobs/${job.id}`);
                          }}
                          className="px-4 py-1.5 rounded-full border border-[#0a66c2] text-[#0a66c2] hover:bg-[#0a66c2]/10 text-xs font-semibold transition-colors cursor-pointer"
                          title="Scan database for candidates"
                        >
                          Scan DB
                        </button>

                        {/* Edit Pencil Icon */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingJob(job.rawJob);
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-container-high transition-colors cursor-pointer"
                          title="Edit Job"
                        >
                          <Pencil size={15} />
                        </button>

                        {/* Three dots dropdown */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownJobId(prev => prev === job.id ? null : job.id);
                            }}
                            className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-container-high transition-colors cursor-pointer"
                            title="More actions"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {activeDropdownJobId === job.id && (
                            <div
                              className="absolute right-0 top-full mt-1 w-36 rounded-lg bg-surface border border-border shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={async () => {
                                  const newStatus = job.status === 'Open' ? 'on_hold' : 'active';
                                  try {
                                    await updateJobStatus({ jobId: job.id as any, status: newStatus as any });
                                  } catch (err: any) {
                                    alert('Failed to update status: ' + err.message);
                                  }
                                  setActiveDropdownJobId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-container-high transition-colors flex items-center gap-2 text-text-primary cursor-pointer"
                              >
                                {job.status === 'Open' ? (
                                  <>
                                    <PauseCircle size={14} className="text-amber-600" />
                                    <span>Put On Hold</span>
                                  </>
                                ) : (
                                  <>
                                    <PlayCircle size={14} className="text-emerald-600" />
                                    <span>Set Active</span>
                                  </>
                                )}
                              </button>

                              <button
                                onClick={async () => {
                                  if (confirm("Are you sure you want to completely delete this job? This cannot be undone.")) {
                                    try {
                                      await deleteJob({ jobId: job.id as any });
                                      alert("Job deleted successfully.");
                                    } catch (err: any) {
                                      alert("Failed to delete job: " + err.message);
                                    }
                                  }
                                  setActiveDropdownJobId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 transition-colors flex items-center gap-2 cursor-pointer"
                              >
                                <Trash2 size={14} />
                                <span>Delete Job</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Pagination */}
          {totalPages > 1 && (() => {
            const maxVisible = 3;
            const startPage = Math.max(1, Math.min(currentPage - 1, totalPages - maxVisible + 1));
            const endPage = Math.min(totalPages, startPage + maxVisible - 1);
            const visiblePages = [];
            for (let p = startPage; p <= endPage; p++) {
              visiblePages.push(p);
            }

            return (
              <div className="flex items-center justify-center gap-3 pt-6 mt-6 border-t border-border/70">
                {currentPage > 1 && (
                  <button
                    onClick={() => {
                      setCurrentPage(p => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-0.5 text-[13px] font-semibold text-[#0a66c2] hover:underline cursor-pointer mr-1"
                  >
                    <ChevronLeft size={15} />
                    <span>Previous</span>
                  </button>
                )}

                {startPage > 1 && (
                  <span className="px-0.5 text-xs text-text-secondary select-none">...</span>
                )}

                <div className="flex items-center gap-2">
                  {visiblePages.map((pageNum) => {
                    const isActive = currentPage === pageNum;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => {
                          setCurrentPage(pageNum);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                            : 'text-[#0a66c2] hover:underline hover:bg-surface-container-high/60'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                {endPage < totalPages && (
                  <span className="px-0.5 text-xs text-text-secondary select-none">...</span>
                )}

                {currentPage < totalPages && (
                  <button
                    onClick={() => {
                      setCurrentPage(p => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-0.5 text-[13px] font-semibold text-[#0a66c2] hover:underline cursor-pointer ml-1"
                  >
                    <span>Next</span>
                    <ChevronRight size={15} />
                  </button>
                )}
              </div>
            );
          })()}
        </main>
      </div>

      {/* Edit Job Modal */}
      {isEditModalOpen && editingJob && (
        <EditJobModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingJob(null);
          }}
          job={editingJob}
          onSuccess={() => {
            setIsEditModalOpen(false);
            setEditingJob(null);
          }}
        />
      )}
    </div>
  );
}
