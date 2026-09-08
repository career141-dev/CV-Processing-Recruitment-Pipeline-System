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
  const hasActiveFilters = searchQuery || selectedStatuses.length;

  const toggleStatus = (s: string) => {
    setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    setCurrentPage(1);
  };

  const pageWindow = useMemo(() => {
    const half = 1;
    let start = Math.max(1, currentPage - half);
    let end   = Math.min(totalPages, start + 2);
    if (end - start < 2) start = Math.max(1, end - 2);
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-border bg-surface px-4 py-6 space-y-6 sticky top-0 h-screen overflow-y-auto">
        {hasActiveFilters && (
          <button onClick={resetFilters} className="flex items-center gap-1.5 text-sm text-primary-container hover:underline font-medium">
            <RotateCcw size={13} /> Reset filters
          </button>
        )}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search openings"
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-md bg-surface focus:outline-none focus:border-primary-container"
          />
        </div>

        {/* Status facet */}
        <div>
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Job Status</p>
          <div className="space-y-1">
            {statusFacets.map(f => (
              <label key={f.status} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes(f.status)}
                  onChange={() => toggleStatus(f.status)}
                  className="rounded text-primary-container focus:ring-primary-container w-3.5 h-3.5"
                />
                <span className="text-sm text-text-primary group-hover:text-primary-container transition-colors">
                  {f.label} <span className="text-text-disabled">({f.count})</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <main className="flex-1 px-6 py-6 max-w-5xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-text-secondary mb-4">
          <Link href="/dashboard/clients" className="hover:text-primary-container transition-colors">Clients</Link>
          <ChevronRight size={13} />
          <span className="text-text-primary font-semibold">{clientName}</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center">
              <Building2 size={20} className="text-primary-container" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary">{clientName}</h1>
              <p className="text-sm text-text-secondary">
                {isLoading ? '—' : `${filtered.length} ${filtered.length === 1 ? 'opening' : 'openings'}`}
              </p>
            </div>
          </div>
          <Link
            href={`/dashboard/jobs/new`}
            className="flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary rounded-lg text-sm font-semibold hover:bg-primary transition-colors shadow-sm"
          >
            Post a job
          </Link>
        </div>

        {/* Active filter chips */}
        {selectedStatuses.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedStatuses.map(s => (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-container/10 text-primary-container border border-primary-container/30 hover:bg-primary-container/20"
              >
                {STATUS_BADGE[s]?.label || s} ×
              </button>
            ))}
            <button onClick={resetFilters} className="text-xs text-text-secondary hover:text-text-primary px-2">Clear all</button>
          </div>
        )}

        {/* Count + top pagination */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-text-secondary font-semibold uppercase tracking-wide">
            {isLoading ? <Skeleton className="w-24 h-4" /> : `${filtered.length} openings`}
          </span>
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center gap-1 text-sm">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="p-1 rounded hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={16} />
              </button>
              {pageWindow.map(p => (
                <button key={p} onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors ${p === currentPage ? 'bg-text-primary text-surface' : 'hover:bg-surface-container-high text-text-secondary'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Opening rows */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="border border-border rounded-xl p-4 bg-surface">
                <Skeleton className="w-56 h-5 mb-2" />
                <Skeleton className="w-80 h-4" />
              </div>
            ))
          ) : paginated.length === 0 ? (
            <div className="text-center py-16 text-text-secondary">
              <p className="font-medium">No openings found</p>
            </div>
          ) : (
            paginated.map(job => (
              <button
                key={job.id}
                onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                className="w-full text-left border border-border rounded-xl p-4 bg-surface hover:bg-surface-container-high/60 hover:border-border-strong transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {/* Status badge */}
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${job.badge.bg} ${job.badge.text} border-current/20`}>
                        {job.badge.label}
                      </span>
                      <span className="text-base font-semibold text-text-primary group-hover:text-primary-container transition-colors truncate">
                        {job.title}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                      {job.location && (
                        <span className="flex items-center gap-1"><MapPin size={11} />{job.location}</span>
                      )}
                      {job.ta && (
                        <span className="flex items-center gap-1"><User size={11} />{job.ta}</span>
                      )}
                      {job.keyword && (
                        <span className="font-mono text-text-disabled">{job.keyword}</span>
                      )}
                    </div>
                  </div>
                  {/* Right: stats */}
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-base font-bold text-text-primary">{job.totalApplicants}</p>
                      <p className="text-[11px] text-text-secondary">Applicants</p>
                    </div>
                    {job.newCvs > 0 && (
                      <div className="text-center">
                        <p className="text-base font-bold text-blue-600">{job.newCvs}</p>
                        <p className="text-[11px] text-text-secondary">New CVs</p>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
