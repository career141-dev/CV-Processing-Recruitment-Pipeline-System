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
    <div className="w-full max-w-[1400px] mx-auto pb-16">
      {/* ── Breadcrumbs ─────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 text-xs text-text-secondary mb-3">
        <Link href="/dashboard/clients" className="hover:text-primary-container transition-colors">Clients</Link>
        <ChevronRight size={12} />
        <span className="text-text-primary font-semibold">{clientName}</span>
      </nav>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-container/10 border border-primary-container/20 flex items-center justify-center text-primary-container shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">{clientName}</h1>
              {registeredClient?.industry && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-surface-container text-text-secondary border border-border">
                  {registeredClient.industry}
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              {isLoading ? '—' : `${filtered.length} ${filtered.length === 1 ? 'opening' : 'openings'} available`}
              {registeredClient?.contactPerson && ` · Contact: ${registeredClient.contactPerson}`}
            </p>
          </div>
        </div>

        <Link
          href={`/dashboard/jobs/new?clientName=${encodeURIComponent(clientName)}`}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-container text-on-primary rounded-lg text-xs font-semibold hover:bg-primary transition-all shadow-sm shrink-0 self-start sm:self-auto"
        >
          <Plus size={15} />
          New Opening
        </Link>
      </div>

      {/* ── Client Overview Notes Banner (if present) ──────────────────── */}
      {registeredClient?.notes && (
        <div className="mb-6 p-3.5 rounded-xl bg-surface border border-border shadow-2xs text-xs text-text-secondary flex items-start gap-2.5">
          <span className="font-semibold text-text-primary shrink-0">Client Notes:</span>
          <span className="italic">{registeredClient.notes}</span>
        </div>
      )}

      {/* ── Layout Grid (Sidebar + Openings List) ───────────────────────── */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* ── Left Sidebar Filter Panel ─────────────────────────────────── */}
        <aside className="w-full md:w-64 shrink-0 rounded-xl border border-border bg-surface p-4 space-y-5 sticky top-20 shadow-2xs">
          {/* Header & Reset */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Filters</span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-[11px] text-primary-container hover:underline font-semibold"
              >
                <RotateCcw size={11} /> Reset
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search openings..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-surface text-text-primary placeholder:text-text-disabled focus:outline-hidden focus:border-primary-container"
            />
          </div>

          {/* Status facet */}
          <div>
            <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-2">Job Status</p>
            <div className="space-y-1">
              {statusFacets.map(f => (
                <label key={f.status} className="flex items-center justify-between gap-2 px-2 py-1 rounded-md hover:bg-surface-container cursor-pointer group text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(f.status)}
                      onChange={() => toggleStatus(f.status)}
                      className="rounded text-primary-container focus:ring-primary-container w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="text-text-primary group-hover:text-primary-container transition-colors">
                      {f.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-text-disabled shrink-0 font-medium">
                    {f.count}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Main Openings List ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {/* Active filter chips */}
          {selectedStatuses.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              <span className="text-xs text-text-secondary font-medium mr-1">Active filters:</span>
              {selectedStatuses.map(s => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-container/10 text-primary-container border border-primary-container/20 hover:bg-primary-container/20"
                >
                  {STATUS_BADGE[s]?.label || s} <span className="text-sm leading-none">&times;</span>
                </button>
              ))}
              <button onClick={resetFilters} className="text-xs text-text-secondary hover:text-text-primary underline ml-1">
                Clear all
              </button>
            </div>
          )}

          {/* Openings Cards List */}
          <div className="space-y-2.5">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-border rounded-xl p-4 bg-surface shadow-2xs">
                  <Skeleton className="w-56 h-5 mb-2" />
                  <Skeleton className="w-80 h-3.5" />
                </div>
              ))
            ) : paginated.length === 0 ? (
              <div className="text-center py-16 px-4 bg-surface rounded-xl border border-border shadow-2xs">
                <Building2 className="w-10 h-10 text-text-disabled mx-auto mb-2.5" />
                <p className="font-semibold text-text-primary text-base">No openings found for {clientName}</p>
                <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                  {hasActiveFilters ? 'Try adjusting your search query or status filters.' : 'Get started by creating the first vacancy for this client.'}
                </p>
                <Link
                  href={`/dashboard/jobs/new?clientName=${encodeURIComponent(clientName)}`}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary-container text-on-primary rounded-lg text-xs font-semibold hover:bg-primary transition-all shadow-sm"
                >
                  <Plus size={14} /> Create Opening for {clientName}
                </Link>
              </div>
            ) : (
              paginated.map(job => (
                <button
                  key={job.id}
                  onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                  className="w-full text-left border border-border rounded-xl p-4 bg-surface hover:bg-surface-container-low hover:border-border-strong transition-all group shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${job.badge.bg} ${job.badge.text} border-current/20`}>
                          {job.badge.label}
                        </span>
                        <span className="text-sm font-bold text-text-primary group-hover:text-primary-container transition-colors truncate">
                          {job.title}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-secondary">
                        {job.location && (
                          <span className="flex items-center gap-1"><MapPin size={11} />{job.location}</span>
                        )}
                        {job.ta && (
                          <span className="flex items-center gap-1"><User size={11} />Assigned TA: <strong className="font-medium text-text-primary">{job.ta}</strong></span>
                        )}
                        {job.keyword && (
                          <span className="font-mono text-text-disabled">#{job.keyword}</span>
                        )}
                      </div>
                    </div>

                    {/* Right stats */}
                    <div className="flex items-center gap-6 shrink-0 text-right">
                      <div className="text-center w-18">
                        <p className="text-sm font-bold text-text-primary">{job.totalApplicants.toLocaleString()}</p>
                        <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Applicants</p>
                      </div>
                      {job.newCvs > 0 ? (
                        <div className="text-center w-16">
                          <p className="text-sm font-bold text-blue-600">{job.newCvs}</p>
                          <p className="text-[10px] text-blue-600 font-semibold">New CVs</p>
                        </div>
                      ) : (
                        <div className="w-16" />
                      )}
                      <ChevronRight size={15} className="text-text-disabled group-hover:text-primary-container transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* ── Unified Clean Bottom Pagination ───────────────────────── */}
          {!isLoading && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 px-1">
              <span className="text-xs text-text-secondary">
                Showing <strong className="text-text-primary">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to <strong className="text-text-primary">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</strong> of <strong className="text-text-primary">{filtered.length}</strong> openings
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setCurrentPage(p => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-border bg-surface hover:bg-surface-container text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <div className="flex items-center gap-1 mx-1">
                  {pageNumbers.map((p, idx) => (
                    p === '...' ? (
                      <span key={`dots-${idx}`} className="px-2 text-xs text-text-disabled">...</span>
                    ) : (
                      <button
                        key={`page-${p}`}
                        onClick={() => {
                          setCurrentPage(Number(p));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                          p === currentPage
                            ? 'bg-primary-container text-on-primary shadow-xs'
                            : 'bg-surface hover:bg-surface-container text-text-secondary hover:text-text-primary border border-border'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  ))}
                </div>
                <button
                  onClick={() => {
                    setCurrentPage(p => Math.min(totalPages, p + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-border bg-surface hover:bg-surface-container text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
