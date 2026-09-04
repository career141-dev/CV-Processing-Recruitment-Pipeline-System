"use client";

import React, { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AvatarBadge } from '@/components/ui/Badge';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AlertCircle, Clock, Briefcase, CheckCircle2, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { SkeletonTableRows } from '@/components/ui/Skeleton';


interface NeedsAttentionTableProps {
  jobFilter?: string;
}

const ITEMS_PER_PAGE = 5;

export function NeedsAttentionTable({ jobFilter = 'All Jobs' }: NeedsAttentionTableProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'jobs' | 'candidates'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Live Convex Query
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

  return (
    <Card noPadding className="p-[1px] border border-border/80 shadow-sm bg-surface">
      <div className="px-4 py-2.5 border-b border-border/70 bg-surface">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 w-full">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-text-primary text-[13px] font-bold flex items-center gap-1.5">
                <AlertCircle size={15} className="text-amber-500" />
                Needs Attention
              </span>
              {items && items.length > 0 && (
                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold px-1.5 py-0.2 rounded-full border border-amber-500/20">
                  {items.length} alert{items.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <span className="text-text-secondary text-[11px] block">
              Long-open aging jobs (&gt; 1 month) and stalled pipeline candidates
            </span>
          </div>

          {/* Filter Sub-Tabs */}
          <div className="flex items-center gap-1 bg-surface-container-high p-0.5 rounded-lg border border-border/60 self-start sm:self-auto">
            <button
              onClick={() => handleTabChange('all')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all ${
                activeTab === 'all'
                  ? 'bg-surface shadow-xs text-text-primary font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All ({items?.length ?? 0})
            </button>
            <button
              onClick={() => handleTabChange('jobs')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all flex items-center gap-1 ${
                activeTab === 'jobs'
                  ? 'bg-surface shadow-xs text-amber-600 dark:text-amber-400 font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Briefcase size={11} />
              Aging Jobs ({agingJobs.length})
            </button>
            <button
              onClick={() => handleTabChange('candidates')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all flex items-center gap-1 ${
                activeTab === 'candidates'
                  ? 'bg-surface shadow-xs text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <User size={11} />
              Candidates ({stalledCandidates.length})
            </button>
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-[1px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-solid border-border bg-surface-container-low/40">
              <th className="py-2 px-3.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">
                Position / Candidate
              </th>
              <th className="py-2 px-3.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">
                Client / Context
              </th>
              <th className="py-2 px-3.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">
                Alert Notice
              </th>
              <th className="py-2 px-3 text-text-secondary font-semibold text-[11px] uppercase tracking-wider text-center">
                Days
              </th>
              <th className="py-2 px-3 text-text-secondary font-semibold text-[11px] uppercase tracking-wider text-center">
                Assigned
              </th>
              <th className="py-2 px-3 text-text-secondary font-semibold text-[11px] uppercase tracking-wider text-center">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {items === undefined ? (
              <SkeletonTableRows rows={4} cols={6} />
            ) : paginatedItems.length > 0 ? (

              paginatedItems.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`${
                    idx !== paginatedItems.length - 1 ? 'border-b border-border/70' : ''
                  } hover:bg-surface-container-high/50 transition-colors group`}
                >
                  {/* Position / Title */}
                  <td className="py-2 px-3.5 text-text-primary text-[12px]">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                          row.type === 'aging_job'
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {row.type === 'aging_job' ? <Briefcase size={12} /> : <User size={12} />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-text-primary group-hover:text-primary transition-colors text-[12px] truncate max-w-[240px]">
                          {row.jobTitle}
                        </div>
                        {row.candidateName && (
                          <div className="text-[10px] text-text-secondary truncate max-w-[240px]">{row.candidateName}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Client / Context */}
                  <td className="py-2 px-3.5 text-text-secondary text-[12px]">
                    <div className="font-medium text-text-primary text-[12px]">{row.clientName}</div>
                    <span className="text-[10px] text-text-tertiary block">{row.stage}</span>
                  </td>

                  {/* Alert Notice */}
                  <td className="py-2 px-3.5">
                    <div
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                        row.days >= 60
                          ? 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                      }`}
                    >
                      <Clock size={11} className="shrink-0" />
                      <span>{row.alertMessage}</span>
                    </div>
                  </td>

                  {/* Days */}
                  <td className={`py-2 px-3 ${row.daysColor} text-[12px] font-bold text-center`}>
                    {row.days}d
                  </td>

                  {/* Assigned Recruiter */}
                  <td className="py-2 px-3 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <AvatarBadge
                        initials={row.initials}
                        colorClass={row.avatarColor}
                        size="w-5 h-5 text-[9px] mx-auto"
                      />
                      <span className="text-[9px] text-text-tertiary max-w-[70px] truncate block mt-0.5">
                        {row.recruiterName}
                      </span>
                    </div>
                  </td>

                  {/* Action Link */}
                  <td className="py-2 px-3 text-center">
                    <Link
                      href={
                        row.type === 'aging_job'
                          ? `/dashboard/jobs/${row.jobId}`
                          : `/dashboard/candidates/${row.candidateId}`
                      }
                    >
                      <Button variant="secondary" size="sm" className="h-6 px-2 gap-1 text-[11px]">
                        View
                        <ChevronRight size={11} />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              // Empty State
              <tr>
                <td colSpan={6} className="py-8 px-4 text-center bg-surface-container-lowest">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={16} />
                    </div>
                    <span className="text-text-primary font-medium text-[12px]">
                      All caught up!
                    </span>
                    <span className="text-text-secondary text-[11px] max-w-sm">
                      {activeTab === 'jobs'
                        ? 'No active jobs currently opened for over 30 days.'
                        : activeTab === 'candidates'
                        ? 'No candidates currently stalled or needing action.'
                        : 'No aging jobs (> 30 days) or stalled candidates requiring attention.'}
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Compact Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-2 border-t border-border bg-surface-container-lowest text-[11px] text-text-secondary">
          <div>
            Showing <span className="font-semibold text-text-primary">{startIndex + 1}</span>–
            <span className="font-semibold text-text-primary">
              {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}
            </span>{' '}
            of <span className="font-semibold text-text-primary">{totalItems}</span> alerts
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-6 px-2 text-[11px] gap-0.5"
            >
              <ChevronLeft size={12} />
              Prev
            </Button>

            <div className="flex items-center gap-0.5 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && <span className="px-0.5 text-text-tertiary text-[10px]">...</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`w-6 h-6 rounded text-[11px] font-medium transition-all ${
                          currentPage === p
                            ? 'bg-primary text-on-primary font-bold shadow-xs'
                            : 'hover:bg-surface-container-high text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-6 px-2 text-[11px] gap-0.5"
            >
              Next
              <ChevronRight size={12} />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
