"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Skeleton } from '@/components/ui/Skeleton';
import { AddClientModal } from '@/components/clients/AddClientModal';
import {
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  Briefcase,
  Plus,
  ChevronRight as ArrowRight,
} from 'lucide-react';

const ITEMS_PER_PAGE = 12;

export default function ClientsPage() {
  const router = useRouter();
  const dbJobs = useQuery(api.jobs.jobs.list);
  const users  = useQuery(api.users.users.getAllUsers);
  const registeredClients = useQuery(api.clients.clients.list);
  const isLoading = dbJobs === undefined || users === undefined || registeredClients === undefined;

  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery]           = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
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
      notes?: string | null;
      contactPerson?: string | null;
      contactEmail?: string | null;
    }>();

    // 1. Seed with registered clients from database
    if (registeredClients) {
      registeredClients.forEach(rc => {
        const name = rc.name.trim();
        if (!map.has(name)) {
          map.set(name, {
            name,
            industry: rc.industry || 'Other',
            openings: 0,
            activeOpenings: 0,
            totalApplicants: 0,
            newCvs: 0,
            taNames: [],
            statuses: [],
            notes: rc.notes || null,
            contactPerson: rc.contactPerson || null,
            contactEmail: rc.contactEmail || null,
          });
        }
      });
    }

    // 2. Populate and aggregate jobs per client
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
          notes: null,
          contactPerson: null,
          contactEmail: null,
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

    return Array.from(map.values()).sort((a, b) => b.totalApplicants - a.totalApplicants || b.openings - a.openings);
  }, [dbJobs, users, registeredClients]);

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
    setCurrentPage(1);
  };
  const hasActiveFilters = Boolean(searchQuery.trim().length > 0 || selectedIndustries.length > 0);

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries(prev =>
      prev.includes(industry) ? prev.filter(i => i !== industry) : [...prev, industry]
    );
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
      {/* ── Top Header Section (Matching LinkedIn Recruiter) ─────────────── */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 mb-6 border-b border-border/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Clients</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {isLoading ? 'Loading clients...' : `${clients.length} client ${clients.length === 1 ? 'company' : 'companies'} registered`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/jobs/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#0a66c2] text-[#0a66c2] hover:bg-blue-50/80 dark:hover:bg-blue-950/40 text-xs sm:text-[13px] font-semibold transition-all active:scale-[0.98] cursor-pointer"
          >
            <Briefcase size={14} />
            Post a Job
          </Link>
          <button
            onClick={() => setIsAddClientModalOpen(true)}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#0a66c2] hover:bg-[#004182] text-white text-xs sm:text-[13px] font-semibold transition-all shadow-xs hover:shadow active:scale-[0.98] cursor-pointer"
          >
            <Plus size={15} />
            Add Client
          </button>
        </div>
      </div>

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

          {/* Search for a client input */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search for a client"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-surface text-text-primary placeholder:text-text-secondary focus:outline-hidden focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition-colors"
            />
          </div>

          {/* Industry Facet */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-text-primary">Industry</h3>
            <div className="space-y-2 pt-1">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ) : (
                industryFacets.map(f => {
                  const isChecked = selectedIndustries.includes(f.label);
                  return (
                    <label key={f.label} className="flex items-center gap-2.5 text-[13px] text-text-secondary hover:text-text-primary cursor-pointer select-none leading-normal">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleIndustry(f.label)}
                        className="rounded border-border text-[#0a66c2] focus:ring-[#0a66c2] w-4 h-4 cursor-pointer"
                      />
                      <span className="truncate flex-1">{f.label}</span>
                      <span className="text-text-disabled text-xs">({f.count})</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* ── Main Content Area: Clients Feed ────────────────────────── */}
        <main className="flex-1 w-full min-w-0">
          {/* Top Toolbar: Selection, Active Filter Chips, Sort & Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border mb-3">
            {/* Left: Client count + Active Filter Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-text-primary tracking-wider uppercase mr-2">
                {filtered.length} CLIENTS
              </span>

              {selectedIndustries.map(i => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                >
                  Industry: {i}
                  <span
                    className="cursor-pointer hover:opacity-75 font-bold ml-0.5"
                    onClick={() => toggleIndustry(i)}
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

          {/* Client Feed Items */}
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="py-8 space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="py-5 px-3 flex items-start gap-4">
                    <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="w-48 h-5" />
                      <Skeleton className="w-72 h-3.5" />
                      <Skeleton className="w-36 h-3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-text-secondary">
                <Building2 className="w-12 h-12 text-text-disabled mx-auto mb-3" />
                <h3 className="text-base font-semibold text-text-primary">No clients found</h3>
                <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                  {hasActiveFilters ? 'Try adjusting your search query or industry filters.' : 'Add your first client company to get started.'}
                </p>
                {hasActiveFilters ? (
                  <button
                    onClick={resetFilters}
                    className="mt-3 text-xs font-semibold text-[#0a66c2] hover:underline cursor-pointer"
                  >
                    Reset all filters
                  </button>
                ) : (
                  <button
                    onClick={() => setIsAddClientModalOpen(true)}
                    className="mt-4 px-5 py-2 rounded-full bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Add Client
                  </button>
                )}
              </div>
            ) : (
              paginated.map(client => (
                <div
                  key={client.name}
                  onClick={() => router.push(`/dashboard/clients/${encodeURIComponent(client.name)}`)}
                  className="py-4.5 px-3 hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-all duration-150 rounded-xl group cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-5">
                    {/* Left: Client Logo/Icon + Details */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center text-[#0a66c2] dark:text-blue-300 font-bold text-base shrink-0 mt-0.5">
                        {client.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="space-y-1.5 min-w-0 flex-1">
                        {/* 1. Client Name & Industry Badge */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-[15.5px] font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-[#0a66c2] group-hover:underline transition-colors leading-snug">
                            {client.name}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-border">
                            {client.industry}
                          </span>
                        </div>

                        {/* 2. Assigned TAs & Contact Person */}
                        <div className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-400 flex-wrap leading-relaxed">
                          {client.taNames.length > 0 ? (
                            <span className="flex items-center gap-1.5">
                              <Users size={13} className="text-slate-400 shrink-0" />
                              <span>TA: <strong className="text-slate-700 dark:text-slate-300 font-medium">{client.taNames.join(', ')}</strong></span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">No TAs assigned</span>
                          )}

                          {client.contactPerson && (
                            <>
                              <span className="text-slate-300 dark:text-slate-600 font-bold">·</span>
                              <span>Contact: <strong className="text-slate-700 dark:text-slate-300 font-medium">{client.contactPerson}</strong></span>
                            </>
                          )}
                        </div>

                        {/* 3. Client Notes (if present) */}
                        {client.notes && (
                          <div className="pt-0.5">
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-1">
                              &ldquo;{client.notes}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle: Metrics Column (Openings / Applicants) */}
                    <div className="hidden sm:flex flex-col items-start min-w-[140px] text-[13px] text-text-secondary pl-4 leading-relaxed">
                      <div>
                        <span>Openings: </span>
                        <span className="font-semibold text-text-primary text-[13.5px]">{client.openings}</span>
                        {client.activeOpenings > 0 && (
                          <span className="text-emerald-700 dark:text-emerald-400 text-xs font-semibold ml-1">
                            ({client.activeOpenings} active)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span>Applicants: </span>
                        <span className="font-semibold text-text-primary text-[13.5px]">{client.totalApplicants.toLocaleString()}</span>
                        {client.newCvs > 0 && (
                          <span className="text-blue-700 dark:text-blue-400 text-xs font-semibold ml-1">
                            ({client.newCvs} new)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/clients/${encodeURIComponent(client.name)}`);
                        }}
                        className="px-4 py-1.5 rounded-full border border-[#0a66c2] text-[#0a66c2] hover:bg-[#0a66c2]/10 font-semibold text-xs transition-all active:scale-95 cursor-pointer"
                      >
                        View Openings
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

      {/* Add Client Modal */}
      <AddClientModal
        isOpen={isAddClientModalOpen}
        onClose={() => setIsAddClientModalOpen(false)}
      />
    </div>
  );
}
