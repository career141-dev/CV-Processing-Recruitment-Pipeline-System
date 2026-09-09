"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  AlertCircle,
  Briefcase,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  Flame,
} from 'lucide-react';

interface NeedsAttentionTableProps {
  jobFilter?: string;
}

const ITEMS_PER_PAGE = 5;

function DaysBadge({ days }: { days: number }) {
  if (days >= 60) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
        <Flame size={10} />
        {days}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
      <Clock size={10} />
      {days}d
    </span>
  );
}

function RecruiterAvatar({ initials, colorClass, name }: { initials: string; colorClass: string; name: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${colorClass || 'bg-slate-400'}`}>
        {initials}
      </div>
      <span className="text-[11px] text-text-secondary hidden sm:block truncate max-w-[75px]">{name}</span>
    </div>
  );
}

export function NeedsAttentionTable({ jobFilter = 'All Jobs' }: NeedsAttentionTableProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'jobs' | 'candidates'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const items = useQuery(api.jobs.stats.getNeedsAttention, { jobFilter });

  const agingJobs = items?.filter((item) => item.type === 'aging_job') || [];
  const stalledCandidates = items?.filter((item) => item.type === 'stalled_candidate') || [];

  const displayItems =
    activeTab === 'jobs'
      ? agingJobs
      : activeTab === 'candidates'
      ? stalledCandidates
      : items || [];

  const totalItems = displayItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = displayItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleTabChange = (tab: 'all' | 'jobs' | 'candidates') => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const urgentCount = items?.filter((i) => i.days >= 60).length || 0;

  return (
    <div className="flex flex-col bg-surface border border-border rounded-xl overflow-hidden shadow-xs">
      {/* Compact Header */}
      <div className="px-4 py-2.5 border-b border-border bg-surface">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="flex items-center gap-1.5 text-[14px] font-bold text-text-primary"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <AlertCircle size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                Needs Attention
              </span>
              {items && items.length > 0 && (
                <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full leading-none">
                  {items.length}
                </span>
              )}
              {urgentCount > 0 && (
                <span className="bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-red-500/20 leading-none flex items-center gap-0.5">
                  <Flame size={9} />
                  {urgentCount} urgent
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-secondary">
              Aging jobs (&gt; 30 days open) and stalled pipeline candidates
            </p>
          </div>

          {/* Tab Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/50 p-0.5 rounded-lg border border-border/60 self-start sm:self-auto">
            {(
              [
                { key: 'all' as const, label: 'All', count: items?.length ?? 0, icon: null },
                { key: 'jobs' as const, label: 'Jobs', count: agingJobs.length, icon: <Briefcase size={10} /> },
                {
                  key: 'candidates' as const,
                  label: 'Candidates',
                  count: stalledCandidates.length,
                  icon: <User size={10} />,
                },
              ] as const
            ).map(({ key, label, count, icon }) => (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all ${
                  activeTab === key
                    ? 'bg-surface shadow-xs text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {icon}
                {label}
                <span
                  className={`text-[9px] ml-0.5 px-1 py-px rounded-full font-bold ${
                    activeTab === key
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alert List Rows */}
      <div className="divide-y divide-border/60">
        {items === undefined ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/5" />
                <div className="h-2 bg-slate-100 dark:bg-slate-900 rounded w-1/3" />
              </div>
              <div className="w-10 h-4 bg-slate-200 dark:bg-slate-800 rounded-full" />
              <div className="w-14 h-6 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
          ))
        ) : paginatedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-8 px-4">
            <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center">
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-text-primary font-semibold text-[12px]">All caught up!</span>
            <span className="text-text-secondary text-[11px] text-center max-w-xs">
              {activeTab === 'jobs'
                ? 'No active jobs opened for over 30 days.'
                : activeTab === 'candidates'
                ? 'No candidates currently stalled or needing action.'
                : 'No aging jobs or stalled candidates requiring attention.'}
            </span>
          </div>
        ) : (
          paginatedItems.map((row) => {
            const isUrgent = row.days >= 60;
            const isJob = row.type === 'aging_job';
            const href = isJob ? `/dashboard/jobs/${row.jobId}` : `/dashboard/candidates/${row.candidateId}`;

            return (
              <div
                key={row.id}
                className={`flex items-center gap-3 px-4 py-2 hover:bg-surface-container-low/60 transition-colors group ${
                  isUrgent
                    ? 'border-l-[3px] border-l-red-400 dark:border-l-red-500'
                    : 'border-l-[3px] border-l-transparent'
                }`}
              >
                {/* Type Icon (Emerald for Job, Blue for Candidate) */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isUrgent
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                      : isJob
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {isJob ? <Briefcase size={13} /> : <User size={13} />}
                </div>

                {/* Job / Candidate Title + Client */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="text-[12px] font-semibold text-text-primary truncate max-w-[210px] group-hover:text-accent-teal transition-colors"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {row.jobTitle}
                    </span>
                    {isUrgent && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0 uppercase tracking-wide">
                        Urgent
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-text-secondary truncate max-w-[150px]">{row.clientName}</span>
                    {row.stage && (
                      <>
                        <span className="text-text-disabled text-[10px]">·</span>
                        <span className="text-[11px] text-text-disabled truncate">{row.stage}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Alert Notice Details */}
                <div className="hidden lg:block flex-1 min-w-0 max-w-[200px]">
                  <span className="text-[11px] text-text-secondary line-clamp-1 leading-snug">
                    {row.alertMessage}
                  </span>
                </div>

                {/* Days Badge */}
                <DaysBadge days={row.days} />

                {/* Recruiter Avatar */}
                <RecruiterAvatar initials={row.initials} colorClass={row.avatarColor} name={row.recruiterName} />

                {/* Action Link Button */}
                <Link href={href}>
                  <button className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-container-low border border-border text-[11px] font-semibold text-text-primary hover:bg-accent-teal hover:text-white hover:border-accent-teal transition-all shrink-0">
                    View
                    <ArrowRight size={11} />
                  </button>
                </Link>
              </div>
            );
          })
        )}
      </div>

      {/* Compact Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-2 border-t border-border bg-surface-container-lowest/50">
          <span className="text-[11px] text-text-secondary">
            Showing{' '}
            <span className="font-semibold text-text-primary">
              {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}
            </span>{' '}
            of <span className="font-semibold text-text-primary">{totalItems}</span> alerts
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-6 h-6 flex items-center justify-center rounded border border-border text-text-secondary hover:bg-surface-container-high hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={12} />
            </button>

            <div className="flex items-center gap-0.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && <span className="px-0.5 text-text-disabled text-[10px]">…</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`w-6 h-6 rounded text-[10px] font-semibold transition-all ${
                          currentPage === p
                            ? 'bg-accent-teal text-white shadow-xs'
                            : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary border border-transparent'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-6 h-6 flex items-center justify-center rounded border border-border text-text-secondary hover:bg-surface-container-high hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
