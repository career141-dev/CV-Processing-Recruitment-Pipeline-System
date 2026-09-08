"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  Briefcase,
  ChevronRight as ArrowRight,
} from 'lucide-react';

const ITEMS_PER_PAGE = 15;

export default function ClientsPage() {
  const router = useRouter();
  const dbJobs = useQuery(api.jobs.jobs.list);
  const users  = useQuery(api.users.users.getAllUsers);
  const isLoading = dbJobs === undefined || users === undefined;

  // Filters
  const [searchQuery, setSearchQuery]           = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [currentPage, setCurrentPage]           = useState(1);

  // ── Build per-client aggregates ────────────────────────────────────────────
  const clients = useMemo(() => {
    if (!dbJobs || !users) return [];

    const map = new Map<string, {
      name: string;
      industry: string;
      openings: number;
      activeOpenings: number;
      totalApplicants: number;
      newCvs: number;
      taNames: string[];
      statuses: string[];
    }>();

    dbJobs.forEach((j: any) => {
      const name = j.clientName?.trim() || 'Unknown Client';
      const recruiter = users.find((u: any) => u._id === j.primaryRecruiterId);
      const taName = recruiter?.fullName || null;

      if (!map.has(name)) {
        map.set(name, {
          name,
          industry: j.clientIndustry || 'Other',
          openings: 0,
          activeOpenings: 0,
          totalApplicants: 0,
          newCvs: 0,
          taNames: [],
          statuses: [],
        });
      }
      const entry = map.get(name)!;
      entry.openings += 1;
      if (j.status === 'active' || j.status === 'open') entry.activeOpenings += 1;
      entry.totalApplicants += j.totalApplications ?? 0;
      entry.newCvs          += j.newCvsCount ?? 0;
      if (taName && !entry.taNames.includes(taName)) entry.taNames.push(taName);
      if (j.status && !entry.statuses.includes(j.status)) entry.statuses.push(j.status);
    });

    return Array.from(map.values()).sort((a, b) => b.totalApplicants - a.totalApplicants);
  }, [dbJobs, users]);

  // Industry facets
  const industryFacets = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach(c => map.set(c.industry, (map.get(c.industry) || 0) + 1));
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [clients]);

  // Filter + search
  const filtered = useMemo(() => {
    return clients.filter(c => {
      const q = searchQuery.toLowerCase();
      if (q && !c.name.toLowerCase().includes(q) && !c.industry.toLowerCase().includes(q)) return false;
      if (selectedIndustries.length && !selectedIndustries.includes(c.industry)) return false;
      return true;
    });
  }, [clients, searchQuery, selectedIndustries]);

  // Pagination
  const totalPages  = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated   = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedIndustries([]);
    setSelectedStatuses([]);
    setCurrentPage(1);
  };
  const hasActiveFilters = searchQuery || selectedIndustries.length || selectedStatuses.length;

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries(prev =>
      prev.includes(industry) ? prev.filter(i => i !== industry) : [...prev, industry]
    );
    setCurrentPage(1);
  };

  // Page window (max 3 visible page numbers)
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
      {/* ── Left Sidebar (filter panel) ─────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-border bg-surface px-4 py-6 space-y-6 sticky top-0 h-screen overflow-y-auto">
        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-sm text-primary-container hover:underline font-medium"
          >
            <RotateCcw size={13} /> Reset filters
          </button>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search for a client"
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-md bg-surface focus:outline-none focus:border-primary-container"
          />
        </div>

        {/* Industry facet */}
        <div>
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Industry</p>
          <div className="space-y-1">
            {industryFacets.map(f => (
              <label key={f.label} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedIndustries.includes(f.label)}
                  onChange={() => toggleIndustry(f.label)}
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

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="flex-1 px-6 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Clients</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {isLoading ? '—' : `${filtered.length} ${filtered.length === 1 ? 'client' : 'clients'}`}
            </p>
          </div>
          <Link
            href="/dashboard/jobs/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary rounded-lg text-sm font-semibold hover:bg-primary transition-colors shadow-sm"
          >
            Post a job
          </Link>
        </div>

        {/* Active filter chips */}
        {(selectedIndustries.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedIndustries.map(i => (
              <button
                key={i}
                onClick={() => toggleIndustry(i)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-container/10 text-primary-container border border-primary-container/30 hover:bg-primary-container/20 transition-colors"
              >
                {i} ×
              </button>
            ))}
            <button onClick={resetFilters} className="text-xs text-text-secondary hover:text-text-primary px-2">
              Clear all
            </button>
          </div>
        )}

        {/* Count + pagination top */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-text-secondary font-semibold uppercase tracking-wide">
            {isLoading ? <Skeleton className="w-20 h-4" /> : `${filtered.length} clients`}
          </span>
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center gap-1 text-sm">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              {pageWindow.map(p => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                    p === currentPage
                      ? 'bg-text-primary text-surface'
                      : 'hover:bg-surface-container-high text-text-secondary'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Client rows */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-border rounded-xl p-4 bg-surface">
                <Skeleton className="w-48 h-5 mb-2" />
                <Skeleton className="w-64 h-4" />
              </div>
            ))
          ) : paginated.length === 0 ? (
            <div className="text-center py-16 text-text-secondary">
              <Building2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No clients found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            paginated.map(client => (
              <button
                key={client.name}
                onClick={() => router.push(`/dashboard/clients/${encodeURIComponent(client.name)}`)}
                className="w-full text-left border border-border rounded-xl p-4 bg-surface hover:bg-surface-container-high/60 hover:border-border-strong transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary-container/10 shrink-0">
                        <Building2 size={16} className="text-primary-container" />
                      </span>
                      <span className="text-base font-semibold text-text-primary group-hover:text-primary-container transition-colors truncate">
                        {client.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 ml-10 text-xs text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Briefcase size={11} />
                        {client.industry}
                      </span>
                      {client.taNames.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users size={11} />
                          {client.taNames.slice(0, 2).join(', ')}
                          {client.taNames.length > 2 && ` +${client.taNames.length - 2}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: stats */}
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-lg font-bold text-text-primary">{client.openings}</p>
                      <p className="text-[11px] text-text-secondary">{client.openings === 1 ? 'Opening' : 'Openings'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-text-primary">{client.totalApplicants}</p>
                      <p className="text-[11px] text-text-secondary">Applicants</p>
                    </div>
                    {client.newCvs > 0 && (
                      <div className="text-center">
                        <p className="text-lg font-bold text-blue-600">{client.newCvs}</p>
                        <p className="text-[11px] text-text-secondary">New CVs</p>
                      </div>
                    )}
                    <ArrowRight size={16} className="text-text-disabled group-hover:text-primary-container transition-colors" />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Bottom pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex justify-center items-center gap-1 mt-6 text-sm">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            {pageWindow.map(p => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                  p === currentPage
                    ? 'bg-text-primary text-surface'
                    : 'hover:bg-surface-container-high text-text-secondary'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
