"use client";

import React from 'react';
import { useUser } from '@clerk/nextjs';
import { StatCard } from '@/components/dashboard/StatCard';
import { NeedsAttentionTable } from '@/components/dashboard/NeedsAttentionTable';
import { PipelineActivityTable } from '@/components/dashboard/PipelineActivityTable';
import { TeamActivityFeed } from '@/components/dashboard/TeamActivityFeed';
import { CvIngestionQueue } from '@/components/dashboard/CvIngestionQueue';
import { DirectCvUploadModal } from '@/components/dashboard/DirectCvUploadModal';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { FileText, Briefcase, UserCheck, Trophy, Upload, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function Dashboard() {
  const { user } = useUser();
  const router = useRouter();
  const firstName = user?.firstName || 'User';

  const [dateRange, setDateRange] = React.useState('This Week');
  const [jobFilter, setJobFilter] = React.useState('All Jobs');
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);

  const stats = useQuery((api.stats.stats as any).getDashboardStats);

  return (
    <div className="w-full bg-background pb-16 min-h-screen">
      {/* Welcome & Actions Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col items-start gap-1">
          <h1 className="text-text-primary text-xl sm:text-2xl font-bold tracking-tight">
            Good morning, {firstName} 👋
          </h1>
          <p className="text-text-secondary text-xs sm:text-[13px]">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            className="flex-1 sm:flex-initial flex items-center justify-center bg-surface text-text-primary py-2 px-3.5 gap-2 rounded-lg border border-solid border-border hover:bg-surface-container-high transition-colors cursor-pointer text-[13px] font-semibold shadow-2xs"
            onClick={() => setIsUploadModalOpen(true)}
          >
            <Upload className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>Upload CV</span>
          </button>
          <button
            className="flex-1 sm:flex-initial flex items-center justify-center bg-accent-teal text-white py-2 px-4 gap-2 rounded-lg hover:bg-[#00504d] transition-colors cursor-pointer text-[13px] font-semibold shadow-xs"
            onClick={() => router.push('/dashboard/jobs/new')}
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Create Job</span>
          </button>
        </div>
      </div>

      {/* Global Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <CustomSelect
          label="Date Range"
          labelColorClass="text-accent-teal"
          hoverColorClass="hover:shadow-[0_4px_20px_rgba(0,103,99,0.1)] group-hover:text-accent-teal"
          gradientFromClass="bg-gradient-to-r from-[#006763]/5 to-transparent"
          value={dateRange}
          onChange={setDateRange}
          options={["Last 30 Days", "This Week", "This Month", "All Time"]}
        />

        <CustomSelect
          label="Job Filter"
          labelColorClass="text-emerald-700 dark:text-emerald-400"
          hoverColorClass="hover:shadow-[0_4px_20px_rgba(0,103,99,0.1)] group-hover:text-accent-teal"
          gradientFromClass="bg-gradient-to-r from-[#006763]/5 to-transparent"
          value={jobFilter}
          onChange={setJobFilter}
          options={["All Jobs", "My Jobs", "Active Jobs"]}
        />
      </div>

      {/* Stats Cards: 1 col on mobile, 2 on tablet, 4 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 mb-6">
        <StatCard
          title="CANDIDATES IN DATABASE"
          value={stats?.candidates.total ?? 0}
          trendText={stats?.candidates.trendText ?? '...'}
          trendType={(stats?.candidates.trendType as any) ?? 'neutral'}
          bgColorClass="bg-[#E8F5E9] dark:bg-green-900/40"
          href="/dashboard/candidates"
          icon={<UserCheck size={20} />}
        />
        <StatCard
          title="CVS TODAY"
          value={stats?.cvsToday.total ?? 0}
          trendText={stats?.cvsToday.trendText ?? '...'}
          trendType={(stats?.cvsToday.trendType as any) ?? 'neutral'}
          bgColorClass="bg-[#E3F2FD] dark:bg-blue-900/40"
          href="/dashboard/candidates?filter=today"
          icon={<FileText size={20} />}
        />
        <StatCard
          title="ACTIVE JOBS"
          value={stats?.activeJobs.total ?? 0}
          trendText={stats?.activeJobs.trendText ?? '...'}
          trendType={(stats?.activeJobs.trendType as any) ?? 'neutral'}
          bgColorClass="bg-[#FFF3E0] dark:bg-orange-900/40"
          href="/dashboard/jobs?status=active"
          icon={<Briefcase size={20} />}
        />
        <StatCard
          title="PLACED THIS MONTH"
          value={stats?.placedThisMonth.total ?? 0}
          trendText={stats?.placedThisMonth.trendText ?? '...'}
          trendType={(stats?.placedThisMonth.trendType as any) ?? 'neutral'}
          bgColorClass="bg-[#F3E5F5] dark:bg-purple-900/40"
          href="/dashboard/jobs?status=placed"
          icon={<Trophy size={20} />}
        />
      </div>

      {/* Main Content Area: Stacks vertically on mobile/tablet, side-by-side on desktop */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Left Column (Needs Attention) */}
        <div className="w-full flex-1 min-w-0 flex flex-col gap-6">
          <NeedsAttentionTable jobFilter={jobFilter} />
          {/* <PipelineActivityTable jobFilter={jobFilter} /> */}
        </div>

        {/* Right Column (Team Activity) */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
          <TeamActivityFeed />
          {/* <CvIngestionQueue /> */}
        </div>
      </div>

      {/* In-Place CV Upload Modal (Supports ZIP & Destination Database) */}
      <DirectCvUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  );
}
