"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Building2,
  MapPin,
  User,
  Plus,
  Briefcase,
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  active:  { label: 'Open',    bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  open:    { label: 'Open',    bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  on_hold: { label: 'On Hold', bg: 'bg-amber-50',    text: 'text-amber-700'   },
  closed:  { label: 'Closed',  bg: 'bg-slate-100',   text: 'text-slate-600'   },
  draft:   { label: 'Draft',   bg: 'bg-gray-100',    text: 'text-gray-600'    },
  lost:    { label: 'Lost',    bg: 'bg-red-50',      text: 'text-red-700'     },
};

export default function ClientOpeningsPage() {
  const router   = useRouter();
  const params   = useParams();
  const clientName = decodeURIComponent(params.clientName as string);

  const dbJobs = useQuery(api.jobs.jobs.list);
  const users  = useQuery(api.users.users.getAllUsers);
  const registeredClient = useQuery(api.clients.clients.getByName, { name: clientName });
  const isLoading = dbJobs === undefined || users === undefined;

  const [searchQuery, setSearchQuery]         = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [currentPage, setCurrentPage]         = useState(1);

  // Filter to this client only
  const clientJobs = useMemo(() => {
    if (!dbJobs || !users) return [];
    return dbJobs
      .filter((j: any) => (j.clientName?.trim() || 'Unknown Client') === clientName)
      .map((j: any) => {
        const recruiter = users.find((u: any) => u._id === j.primaryRecruiterId);
        const badge = STATUS_BADGE[j.status] || STATUS_BADGE.active;
        return {
          id: j._id,
          title: j.title || 'Untitled',
          keyword: j.keyword || '',
          location: (j.location || 'Sri Lanka').replace(/\s*\((on-site|hybrid|remote)\)/gi, '').trim(),
          seniority: j.seniorityLevel || '',
          totalApplicants: j.totalApplications ?? 0,
          newCvs: j.newCvsCount ?? 0,
          ta: recruiter?.fullName || null,
          status: j.status,
          badge,
          createdAt: j._creationTime,
          industry: j.clientIndustry || '',
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [dbJobs, users, clientName]);

  // Status facets
  const statusFacets = useMemo(() => {
    const map = new Map<string, number>();
    clientJobs.forEach(j => map.set(j.status, (map.get(j.status) || 0) + 1));
    return Array.from(map.entries())
      .map(([status, count]) => ({ status, label: STATUS_BADGE[status]?.label || status, count }));
  }, [clientJobs]);

  const filtered = useMemo(() => {
    return clientJobs.filter(j => {
      const q = searchQuery.toLowerCase();
      if (q && !j.title.toLowerCase().includes(q) && !j.keyword.toLowerCase().includes(q)) return false;
      if (selectedStatuses.length && !selectedStatuses.includes(j.status)) return false;
      return true;
    });
  }, [clientJobs, searchQuery, selectedStatuses]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedStatuses([]);
    setCurrentPage(1);
  };
  const hasActiveFilters = Boolean(searchQuery.trim().length > 0 || selectedStatuses.length > 0);

  const toggleStatus = (s: string) => {
    setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    setCurrentPage(1);
  };

  // Generate page numbers
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="w-full max-w-[1440px] mx-auto pb-20 pt-1">
      {/* ── Breadcrumbs ─────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 text-xs text-text-secondary mb-4">
        <Link href="/dashboard/clients" className="hover:text-[#0a66c2] hover:underline transition-colors font-medium">Clients</Link>
        <ChevronRight size={12} className="text-text-disabled" />
        <span className="text-text-primary font-semibold">{clientName}</span>
      </nav>

      {/* ── Page Header (LinkedIn Recruiter Style) ────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 mb-6 border-b border-border/80">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center text-[#0a66c2] dark:text-blue-300 font-bold text-lg shrink-0">
            {clientName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary uppercase">{clientName}</h1>
              {registeredClient?.industry && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-border">
                  {registeredClient.industry}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>{isLoading ? '—' : `${filtered.length} ${filtered.length === 1 ? 'opening' : 'openings'}`}</span>
              {registeredClient?.contactPerson && (
                <>
                  <span className="text-slate-300 dark:text-slate-600 font-bold">·</span>
                  <span>Contact: <strong>{registeredClient.contactPerson}</strong></span>
                </>
              )}
              {registeredClient?.contactEmail && (
                <>
                  <span className="text-slate-300 dark:text-slate-600 font-bold">·</span>
                  <span>{registeredClient.contactEmail}</span>
                </>
              )}
              {registeredClient?.contactPhone && (
                <>
                  <span className="text-slate-300 dark:text-slate-600 font-bold">·</span>
                  <span>{registeredClient.contactPhone}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/jobs/new?clientName=${encodeURIComponent(clientName)}`}
            className="px-5 py-2 rounded-full bg-[#0a66c2] hover:bg-[#004182] text-white text-xs sm:text-[13px] font-semibold transition-all shadow-xs hover:shadow active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={15} />
            New Opening
          </Link>
        </div>
      </div>

      {/* ── Client Overview Notes Banner (if present) ──────────────────── */}
      {registeredClient?.notes && (
        <div className="mb-6 p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
          <span className="font-semibold text-[#0a66c2] dark:text-blue-300 shrink-0">Client Notes:</span>
          <span className="italic">{registeredClient.notes}</span>
        </div>
      )}

      {/* ── Two-Column Layout: Left Filter Sidebar + Main Feed ────────────── */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* ── Left Sidebar Filters ────────────────────────── */}
        <aside className="w-full lg:w-64 shrink-0 space-y-5 lg:pr-2 lg:sticky lg:top-20">
          {/* Reset filters header */}
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#0a66c2] hover:underline cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Reset filters</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search openings"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-surface text-text-primary placeholder:text-text-secondary focus:outline-hidden focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition-colors"
            />
          </div>

          {/* Status facet */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-text-primary">Job status</h3>
            <div className="space-y-2 pt-1">
              {statusFacets.map(f => (
                <label key={f.status} className="flex items-center gap-2.5 text-[13px] text-text-secondary hover:text-text-primary cursor-pointer select-none leading-normal">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(f.status)}
                    onChange={() => toggleStatus(f.status)}
                    className="rounded border-border text-[#0a66c2] focus:ring-[#0a66c2] w-4 h-4 cursor-pointer"
                  />
                  <span className="truncate flex-1">{f.label}</span>
                  <span className="text-text-disabled text-xs">({f.count})</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Main Openings List Feed ────────────────────────────────────────── */}
        <main className="flex-1 w-full min-w-0">
          {/* Top Toolbar: Count, Filter Chips, Top Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-text-primary tracking-wider uppercase mr-2">
                {filtered.length} OPENINGS
              </span>

              {selectedStatuses.map(s => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                >
                  Status: {STATUS_BADGE[s]?.label || s}
                  <span
                    className="cursor-pointer hover:opacity-75 font-bold ml-0.5"
                    onClick={() => toggleStatus(s)}
                  >
                    ×
                  </span>
                </span>
              ))}

              {searchQuery.trim().length > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-border"
                >
                  Search: "{searchQuery}"
                  <span
                    className="cursor-pointer hover:opacity-75 font-bold ml-0.5"
                    onClick={() => setSearchQuery('')}
                  >
                    ×
                  </span>
                </span>
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-semibold text-[#0a66c2] hover:underline ml-1 cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Right: Top Pagination Text & Arrows */}
            <div className="flex items-center gap-4 text-xs text-text-secondary self-end sm:self-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary">
                  {filtered.length > 0 ? `${(currentPage - 1) * ITEMS_PER_PAGE + 1} – ${Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}` : '0'}
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

          {/* Openings Feed Items */}
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="py-8 space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="py-5 px-3 space-y-2">
                    <Skeleton className="w-56 h-5" />
                    <Skeleton className="w-80 h-3.5" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-text-secondary">
                <Building2 className="w-12 h-12 text-text-disabled mx-auto mb-3" />
                <h3 className="text-base font-semibold text-text-primary">No openings found for {clientName}</h3>
                <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                  {hasActiveFilters ? 'Try adjusting your search query or status filters.' : 'Get started by creating the first vacancy for this client.'}
                </p>
                {hasActiveFilters ? (
                  <button
                    onClick={resetFilters}
                    className="mt-3 text-xs font-semibold text-[#0a66c2] hover:underline cursor-pointer"
                  >
                    Reset all filters
                  </button>
                ) : (
                  <Link
                    href={`/dashboard/jobs/new?clientName=${encodeURIComponent(clientName)}`}
                    className="mt-4 px-5 py-2 rounded-full bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Create Opening
                  </Link>
                )}
              </div>
            ) : (
              paginated.map(job => (
                <div
                  key={job.id}
                  onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                  className="py-4.5 px-3 hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-all duration-150 rounded-xl group cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-5">
                    {/* Left: Opening Details */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      {/* 1. Title + Status Dot */}
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <Link
                          href={`/dashboard/jobs/${job.id}`}
                          className="text-[15.5px] font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-[#0a66c2] group-hover:underline transition-colors leading-snug"
                        >
                          {job.title}
                        </Link>

                        {/* Status Dot */}
                        {job.status === 'active' || job.status === 'open' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span>Open</span>
                          </span>
                        ) : (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${job.badge.bg} ${job.badge.text} border-current/20`}>
                            {job.badge.label}
                          </span>
                        )}
                      </div>

                      {/* 2. Company · Location · TA */}
                      <div className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-400 flex-wrap leading-relaxed">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{clientName}</span>
                        <span className="text-slate-300 dark:text-slate-600 font-bold">·</span>
                        <span>{job.location}</span>
                        <span className="text-slate-300 dark:text-slate-600 font-bold">·</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {job.ta || 'Unassigned TA'}
                        </span>
                      </div>

                      {/* 3. Project Tag */}
                      <div className="pt-0.5">
                        <span className="inline-block px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50/90 text-[#0a66c2] dark:bg-blue-950/60 dark:text-blue-300 border border-blue-100 dark:border-blue-800/60">
                          Project: {job.keyword ? `${job.keyword} - ${clientName}` : `${job.title} - ${clientName}`}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Metrics Column (Applicants / New CVs) */}
                    <div className="hidden sm:flex flex-col items-start min-w-[140px] text-[13px] text-text-secondary pl-4 leading-relaxed">
                      <div>
                        <span>Applicants: </span>
                        <span className="font-semibold text-text-primary text-[13.5px]">{job.totalApplicants.toLocaleString()}</span>
                        {job.newCvs > 0 && (
                          <span className="text-emerald-700 dark:text-emerald-400 text-xs font-semibold ml-1">
                            ({job.newCvs} new)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Action Button */}
                    <div className="flex items-center gap-2 shrink-0 pt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/jobs/${job.id}`);
                        }}
                        className="px-4 py-1.5 rounded-full border border-[#0a66c2] text-[#0a66c2] hover:bg-[#0a66c2]/10 font-semibold text-xs transition-all active:scale-95 cursor-pointer"
                      >
                        View Pipeline
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Unified Clean Bottom Pagination ───────────────────────── */}
          {!isLoading && totalPages > 1 && (
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

              <div className="flex items-center gap-1.5">
                {pageNumbers.map((p, idx) => (
                  p === '...' ? (
                    <span key={`dots-${idx}`} className="px-1 text-xs text-text-disabled">...</span>
                  ) : (
                    <button
                      key={`page-${p}`}
                      onClick={() => {
                        setCurrentPage(Number(p));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                        p === currentPage
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                          : 'text-[#0a66c2] hover:underline hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {p}
                    </button>
                  )
                ))}
              </div>

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
          )}
        </main>
      </div>
    </div>
  );
}
