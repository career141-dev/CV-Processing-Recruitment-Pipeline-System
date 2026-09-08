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
    <div className="w-full max-w-[1400px] mx-auto pb-16">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Clients</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {isLoading ? 'Loading clients...' : `${filtered.length} client ${filtered.length === 1 ? 'company' : 'companies'} registered`}
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

      {/* ── Layout Grid (Sidebar + Table) ────────────────────────────────── */}
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
              placeholder="Search for a client..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-surface text-text-primary placeholder:text-text-disabled focus:outline-hidden focus:border-primary-container"
            />
          </div>

          {/* Industry facet */}
          <div>
            <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-2">Industry</p>
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {industryFacets.map(f => (
                <label key={f.label} className="flex items-center justify-between gap-2 px-2 py-1 rounded-md hover:bg-surface-container cursor-pointer group text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <input
                      type="checkbox"
                      checked={selectedIndustries.includes(f.label)}
                      onChange={() => toggleIndustry(f.label)}
                      className="rounded text-primary-container focus:ring-primary-container w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="text-text-primary group-hover:text-primary-container transition-colors truncate">
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

        {/* ── Main Table Content ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {/* Active filter chips */}
          {selectedIndustries.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              <span className="text-xs text-text-secondary font-medium mr-1">Active filters:</span>
              {selectedIndustries.map(i => (
                <button
                  key={i}
                  onClick={() => toggleIndustry(i)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-container/10 text-primary-container border border-primary-container/20 hover:bg-primary-container/20 transition-colors"
                >
                  {i} <span className="text-sm leading-none">&times;</span>
                </button>
              ))}
              <button 
                onClick={resetFilters} 
                className="text-xs text-text-secondary hover:text-text-primary underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Table Container */}
          <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-2xs">
            {isLoading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-4">
                    <div className="space-y-2">
                      <Skeleton className="w-48 h-5" />
                      <Skeleton className="w-32 h-3.5" />
                    </div>
                    <div className="flex items-center gap-6">
                      <Skeleton className="w-20 h-4" />
                      <Skeleton className="w-24 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : paginated.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Building2 className="w-12 h-12 text-text-disabled mx-auto mb-3" />
                <h3 className="text-base font-semibold text-text-primary">No clients found</h3>
                <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                  {hasActiveFilters ? 'Try adjusting your search query or industry filters.' : 'Add your first client company to get started.'}
                </p>
                {hasActiveFilters ? (
                  <button
                    onClick={resetFilters}
                    className="mt-4 text-xs font-semibold text-primary-container hover:underline"
                  >
                    Reset filters
                  </button>
                ) : (
                  <button
                    onClick={() => setIsAddClientModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary-container text-on-primary rounded-lg text-xs font-semibold hover:bg-primary transition-all shadow-sm"
                  >
                    <Plus size={14} /> Add Client
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {paginated.map(client => (
                  <div
                    key={client.name}
                    onClick={() => router.push(`/dashboard/clients/${encodeURIComponent(client.name)}`)}
                    className="flex items-center justify-between px-5 py-4 hover:bg-surface-container-low transition-colors cursor-pointer group"
                  >
                    {/* Left: Client name + industry + TAs + notes */}
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-container shrink-0 border border-border mt-0.5">
                          <Building2 size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-text-primary group-hover:text-primary-container transition-colors truncate">
                              {client.name}
                            </span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container text-text-secondary border border-border shrink-0">
                              {client.industry}
                            </span>
                          </div>
                          {client.notes && (
                            <p className="text-xs text-text-secondary mt-0.5 line-clamp-1 italic">
                              &ldquo;{client.notes}&rdquo;
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-text-secondary flex-wrap">
                            {client.taNames.length > 0 ? (
                              <span className="flex items-center gap-1 text-text-tertiary">
                                <Users size={12} />
                                Assigned TAs: <strong className="text-text-secondary font-medium">{client.taNames.join(', ')}</strong>
                              </span>
                            ) : (
                              <span className="text-text-disabled">No TAs assigned yet</span>
                            )}
                            {client.contactPerson && (
                              <>
                                <span>·</span>
                                <span>Contact: {client.contactPerson}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Metrics + arrow */}
                    <div className="flex items-center gap-5 shrink-0 text-right">
                      {/* Openings count */}
                      <div className="w-20 text-center">
                        <span className="text-sm font-bold text-text-primary block">
                          {client.openings}
                        </span>
                        <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                          {client.openings === 1 ? 'Opening' : 'Openings'}
                        </span>
                      </div>

                      {/* Total applicants */}
                      <div className="w-20 text-center">
                        <span className="text-sm font-bold text-text-primary block">
                          {client.totalApplicants.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                          Applicants
                        </span>
                      </div>

                      {/* New CVs badge */}
                      <div className="w-18 text-center">
                        {client.newCvs > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                            {client.newCvs} new
                          </span>
                        ) : (
                          <span className="text-xs text-text-disabled">—</span>
                        )}
                      </div>

                      <ArrowRight size={15} className="text-text-disabled group-hover:text-primary-container transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Unified Clean Bottom Pagination ───────────────────────── */}
          {!isLoading && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 px-1">
              <span className="text-xs text-text-secondary">
                Showing <strong className="text-text-primary">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to <strong className="text-text-primary">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</strong> of <strong className="text-text-primary">{filtered.length}</strong> clients
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

      {/* Add Client Modal */}
      <AddClientModal
        isOpen={isAddClientModalOpen}
        onClose={() => setIsAddClientModalOpen(false)}
      />
    </div>
  );
}
