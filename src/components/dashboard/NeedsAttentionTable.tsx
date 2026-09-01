"use client";

import React, { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AvatarBadge } from '@/components/ui/Badge';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AlertCircle, Clock, Briefcase, CheckCircle2, ChevronRight, User } from 'lucide-react';

interface NeedsAttentionTableProps {
  jobFilter?: string;
}

export function NeedsAttentionTable({ jobFilter = 'All Jobs' }: NeedsAttentionTableProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'jobs' | 'candidates'>('all');

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

  return (
    <Card noPadding className="p-[1px] border border-border/80 shadow-sm bg-surface">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-text-primary text-sm font-bold flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-500" />
                Needs Attention
              </span>
              {items && items.length > 0 && (
                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-500/20">
                  {items.length} alert{items.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <span className="text-text-secondary text-xs mt-0.5 block">
              Long-open aging jobs (&gt; 1 month) and stalled pipeline candidates
            </span>
          </div>

          {/* Filter Sub-Tabs */}
          <div className="flex items-center gap-1 bg-surface-container-high p-1 rounded-lg border border-border/60 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                activeTab === 'all'
                  ? 'bg-surface shadow-xs text-text-primary font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All ({items?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('jobs')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                activeTab === 'jobs'
                  ? 'bg-surface shadow-xs text-amber-600 dark:text-amber-400 font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Briefcase size={12} />
              Aging Jobs ({agingJobs.length})
            </button>
            <button
              onClick={() => setActiveTab('candidates')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                activeTab === 'candidates'
                  ? 'bg-surface shadow-xs text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <User size={12} />
              Candidates ({stalledCandidates.length})
            </button>
          </div>
        </div>
      </CardHeader>

      <div className="w-full overflow-x-auto pb-[1px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-solid border-border bg-surface-container-low/50">
              <th className="py-3 px-5 text-text-secondary font-semibold text-[12px] uppercase tracking-wider">
                Position / Candidate
              </th>
              <th className="py-3 px-5 text-text-secondary font-semibold text-[12px] uppercase tracking-wider">
                Client / Context
              </th>
              <th className="py-3 px-5 text-text-secondary font-semibold text-[12px] uppercase tracking-wider">
                Alert Notice
              </th>
              <th className="py-3 px-5 text-text-secondary font-semibold text-[12px] uppercase tracking-wider text-center">
                Days
              </th>
              <th className="py-3 px-5 text-text-secondary font-semibold text-[12px] uppercase tracking-wider text-center">
                Assigned
              </th>
              <th className="py-3 px-5 text-text-secondary font-semibold text-[12px] uppercase tracking-wider text-center">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {items === undefined ? (
              // Loading Skeleton
              <tr>
                <td colSpan={6} className="py-8 px-5 text-center">
                  <div className="flex items-center justify-center gap-2 text-text-secondary text-xs">
                    <Clock size={16} className="animate-spin text-primary" />
                    Checking pipeline & aging jobs...
                  </div>
                </td>
              </tr>
            ) : displayItems.length > 0 ? (
              displayItems.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`${
                    idx !== displayItems.length - 1 ? 'border-b border-border' : ''
                  } hover:bg-surface-container-high/60 transition-colors group`}
                >
                  {/* Position / Title */}
                  <td className="py-3.5 px-5 text-text-primary text-[13px]">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          row.type === 'aging_job'
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {row.type === 'aging_job' ? <Briefcase size={14} /> : <User size={14} />}
                      </div>
                      <div>
                        <div className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                          {row.jobTitle}
                        </div>
                        {row.candidateName && (
                          <div className="text-xs text-text-secondary">{row.candidateName}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Client / Context */}
                  <td className="py-3.5 px-5 text-text-secondary text-[13px]">
                    <div className="font-medium text-text-secondary">{row.clientName}</div>
                    <span className="text-[11px] text-text-tertiary">{row.stage}</span>
                  </td>

                  {/* Alert Notice */}
                  <td className="py-3.5 px-5">
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                        row.days >= 60
                          ? 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                      }`}
                    >
                      <Clock size={12} className="shrink-0" />
                      <span>{row.alertMessage}</span>
                    </div>
                  </td>

                  {/* Days */}
                  <td className={`py-3.5 px-5 ${row.daysColor} text-[13px] font-bold text-center`}>
                    {row.days}d
                  </td>

                  {/* Assigned Recruiter */}
                  <td className="py-3.5 px-5 text-center">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <AvatarBadge
                        initials={row.initials}
                        colorClass={row.avatarColor}
                        size="w-6 h-6 text-[10px] mx-auto"
                      />
                      <span className="text-[10px] text-text-tertiary max-w-[80px] truncate block">
                        {row.recruiterName}
                      </span>
                    </div>
                  </td>

                  {/* Action Link */}
                  <td className="py-3.5 px-5 text-center">
                    <Link
                      href={
                        row.type === 'aging_job'
                          ? `/dashboard/jobs/${row.jobId}`
                          : `/dashboard/candidates/${row.candidateId}`
                      }
                    >
                      <Button variant="secondary" size="sm" className="gap-1 text-xs">
                        View
                        <ChevronRight size={12} />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              // Empty State
              <tr>
                <td colSpan={6} className="py-12 px-5 text-center bg-surface-container-lowest">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={20} />
                    </div>
                    <span className="text-text-primary font-medium text-[13px]">
                      All caught up!
                    </span>
                    <span className="text-text-secondary text-xs max-w-sm">
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
    </Card>
  );
}
