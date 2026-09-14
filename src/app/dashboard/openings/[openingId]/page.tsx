"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Skeleton } from '@/components/ui/Skeleton';
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  ChevronRight, Plus, Briefcase, Clock, Users,
  FolderOpen, MapPin, ArrowLeft,
} from 'lucide-react';

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  active:    { label: 'Open',      bg: 'bg-emerald-50', text: 'text-emerald-700' },
  open:      { label: 'Open',      bg: 'bg-emerald-50', text: 'text-emerald-700' },
  on_hold:   { label: 'On Hold',   bg: 'bg-amber-50',   text: 'text-amber-700'   },
  closed:    { label: 'Closed',    bg: 'bg-slate-100',  text: 'text-slate-600'   },
  draft:     { label: 'Draft',     bg: 'bg-gray-100',   text: 'text-gray-600'    },
  filled:    { label: 'Filled',    bg: 'bg-blue-50',    text: 'text-blue-700'    },
  cancelled: { label: 'Cancelled', bg: 'bg-red-50',     text: 'text-red-600'     },
  completed: { label: 'Completed', bg: 'bg-blue-50',    text: 'text-blue-700'    },
};

function getBadge(status: string) { return STATUS_BADGE[status] || STATUS_BADGE.active; }
function formatDate(ts: number) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OpeningDetailPage() {
  const router = useRouter();
  const params = useParams();
  const openingId = params.openingId as Id<"openings">;

  const data = useQuery(api.openings.openings.getOpeningWithJobs, { id: openingId });
  const users = useQuery(api.users.users.getAllUsers);
  const isLoading = data === undefined || users === undefined;

  if (!isLoading && !data) {
    return (
      <div className="w-full max-w-[1440px] mx-auto pb-20 pt-8 text-center">
        <FolderOpen className="w-14 h-14 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-700">Opening not found</h2>
        <Link href="/dashboard/clients" className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#0a66c2] hover:underline font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </Link>
      </div>
    );
  }

  const opening = data as any;
  const jobs: any[] = data?.jobs || [];
  const clientName = opening?.clientName || '';
  const badge = getBadge(opening?.status || 'active');
  const activeJobs = jobs.filter((j: any) => j.status === 'active' || j.status === 'open');

  return (
    <div className="w-full max-w-[1440px] mx-auto pb-20 pt-1">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-text-secondary mb-4 flex-wrap">
        <Link href="/dashboard/clients" className="hover:text-[#0a66c2] hover:underline font-medium">Clients</Link>
        <ChevronRight size={12} className="text-text-disabled" />
        <Link href={`/dashboard/clients/${encodeURIComponent(clientName)}`} className="hover:text-[#0a66c2] hover:underline font-medium">
          {clientName || 'Client'}
        </Link>
        <ChevronRight size={12} className="text-text-disabled" />
        {isLoading ? <Skeleton className="w-32 h-3.5" /> : <span className="text-text-primary font-semibold">{opening?.title}</span>}
      </nav>

      {/* Opening Header Card */}
      <div className="bg-white border border-border rounded-2xl shadow-xs p-6 mb-6">
        {isLoading ? (
          <div className="space-y-3"><Skeleton className="w-64 h-7" /><Skeleton className="w-48 h-4" /></div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0a66c2] shrink-0">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-xl font-bold text-slate-900">{opening?.title}</h1>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.text}`}>{badge.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-sm text-slate-500 flex-wrap">
                    <Link href={`/dashboard/clients/${encodeURIComponent(clientName)}`} className="font-semibold text-slate-700 hover:text-[#0a66c2] hover:underline">{clientName}</Link>
                    {opening?.createdAt && (<><span className="text-slate-300">·</span><span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDate(opening.createdAt)}</span></>)}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
                    <span className="text-slate-300">·</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{activeJobs.length} active</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/dashboard/clients/${encodeURIComponent(clientName)}`} className="px-4 py-2 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Client
                </Link>
                <Link href={`/dashboard/jobs/new?openingId=${openingId}&clientName=${encodeURIComponent(clientName)}`} className="px-4 py-2 rounded-full bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Job
                </Link>
              </div>
            </div>
            {opening?.description && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line line-clamp-4">{opening.description}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Jobs Section */}
      <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
        <span className="text-xs font-bold text-text-primary tracking-wider uppercase">
          {isLoading ? '—' : `${jobs.length} Job${jobs.length !== 1 ? 's' : ''}`} in this Opening
        </span>
        {!isLoading && jobs.length > 0 && (
          <Link href={`/dashboard/jobs/new?openingId=${openingId}&clientName=${encodeURIComponent(clientName)}`} className="text-xs font-semibold text-[#0a66c2] hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add another job
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-border rounded-xl p-4 space-y-2.5"><Skeleton className="w-56 h-5" /><Skeleton className="w-80 h-3.5" /></div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="py-14 text-center bg-white border border-dashed border-slate-300 rounded-2xl">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-600">No jobs under this opening yet</h3>
          <Link href={`/dashboard/jobs/new?openingId=${openingId}&clientName=${encodeURIComponent(clientName)}`} className="mt-4 px-5 py-2 rounded-full bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-semibold inline-flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add First Job
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border bg-white border border-border rounded-2xl overflow-hidden shadow-xs">
          {jobs.map((job: any) => {
            const recruiter = users?.find((u: any) => u._id === job.primaryRecruiterId);
            const taName = recruiter?.fullName || null;
            const jobBadge = getBadge(job.status);
            const location = (job.location || '').replace(/\s*\((on-site|hybrid|remote)\)/gi, '').trim();
            const totalApplicants = job.totalApplications ?? 0;
            const newCvs = job.newCvsCount ?? 0;
            return (
              <div key={job._id} onClick={() => router.push(`/dashboard/jobs/${job._id}`)} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50/80 transition-colors cursor-pointer group">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold text-slate-900 group-hover:text-[#0a66c2] group-hover:underline transition-colors">{job.title}</span>
                    <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full border ${jobBadge.bg} ${jobBadge.text}`}>{jobBadge.label}</span>
                    {newCvs > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{newCvs} new</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-slate-500 flex-wrap">
                    {location && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{location}</span>}
                    {taName && (<><span className="text-slate-300">·</span><span>{taName}</span></>)}
                    <span className="text-slate-300">·</span>
                    <span>{totalApplicants} applicant{totalApplicants !== 1 ? 's' : ''}</span>
                    {job.keyword && (<><span className="text-slate-300">·</span><span className="font-mono text-[11px] text-[#0a66c2]">{job.keyword}</span></>)}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/jobs/${job._id}`); }} className="px-3.5 py-1.5 rounded-full border border-[#0a66c2] text-[#0a66c2] hover:bg-[#0a66c2]/10 font-semibold text-[11px] transition-all active:scale-95 cursor-pointer shrink-0">
                  View Pipeline
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}