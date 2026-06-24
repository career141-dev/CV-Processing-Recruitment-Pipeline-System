"use client";

import React from 'react';
import { useUser } from '@clerk/nextjs';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { NeedsAttentionTable } from '@/components/dashboard/NeedsAttentionTable';
import { PipelineActivityTable } from '@/components/dashboard/PipelineActivityTable';
import { TeamActivityFeed } from '@/components/dashboard/TeamActivityFeed';
import { CvIngestionQueue } from '@/components/dashboard/CvIngestionQueue';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { FileText, Briefcase, UserCheck, Trophy } from 'lucide-react';

import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const { user } = useUser();
  const router = useRouter();
  const firstName = user?.firstName || 'User';

  const [dateRange, setDateRange] = React.useState('This Week');
  const [jobFilter, setJobFilter] = React.useState('All Jobs');

  return (
    <div className="self-stretch bg-background pb-[133px] min-h-screen w-full">
      <PageHeader title="" />

      {/* Welcome Section */}
      <div className="flex items-start self-stretch mb-[19px] ml-[21px] mr-[43px]">
        <div className="flex flex-col shrink-0 items-start gap-1">
          <span className="text-text-primary text-2xl font-bold">
            Good morning, {firstName} 👋
          </span>
          <span className="text-text-secondary text-[13px]">
            Tuesday, 16 June 2026
          </span>
        </div>
        <div className="flex-1"></div>
        <button
          className="flex shrink-0 items-center bg-surface text-text-primary text-left py-2 px-4 mt-[18px] mr-2.5 gap-2 rounded-md border border-solid border-border hover:bg-surface-container-high transition-colors transition-colors cursor-pointer"
          onClick={() => router.push('/dashboard/ingestion-monitor')}
        >
          <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/8051779b-2400-47b2-bd7d-080c98e29a8a"
            className="w-2.5 h-[13px] rounded-md object-fill"
            alt="Upload"
          />
          <span className="text-[13px] font-bold">Upload cv</span>
        </button>
        <button
          className="flex shrink-0 items-center bg-accent-teal text-left py-2 px-[15px] mt-[18px] gap-2 rounded-md border-0 hover:bg-[#00504d] transition-colors cursor-pointer"
          onClick={() => router.push('/dashboard/jobs/new')}
        >
          <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/e82473bc-1ad1-46a0-92f8-ec8dd70b542f"
            className="w-2.5 h-2.5 rounded-md object-fill"
            alt="Create"
          />
          <span className="text-on-primary text-[13px]">Create Job</span>
        </button>
      </div>

      {/* Global Filters */}
      <div className="flex items-center self-stretch mb-6 ml-5 mr-12 gap-4">
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
          labelColorClass="text-[#E65100]"
          hoverColorClass="hover:shadow-[0_4px_20px_rgba(230,81,0,0.1)] group-hover:text-[#E65100]"
          gradientFromClass="bg-gradient-to-r from-[#E65100]/5 to-transparent"
          value={jobFilter}
          onChange={setJobFilter}
          options={["All Jobs", "My Jobs", "Active Jobs"]}
        />
      </div>

      {/* Stats Cards */}
      <div className="flex items-center self-stretch mb-[25px] ml-5 mr-12 gap-4">
        <StatCard title="CANDIDATES IN DATABASE" value={115247} trendText="1,043 this week" trendType="up" bgColorClass="bg-[#E8F5E9] dark:bg-[#1B5E20]/20" href="/dashboard/candidates" icon={<UserCheck size={20} />} />
        <StatCard title="CVS TODAY" value={43} trendText="8 vs yesterday" trendType="neutral" bgColorClass="bg-[#E3F2FD] dark:bg-blue-900/20" href="/dashboard/candidates?filter=today" icon={<FileText size={20} />} />
        <StatCard title="ACTIVE JOBS" value={12} trendText="2 added this week" trendType="up" bgColorClass="bg-[#FFF3E0] dark:bg-orange-900/20" href="/dashboard/jobs?status=active" icon={<Briefcase size={20} />} />
        <StatCard title="PLACED THIS MONTH" value={7} trendText="2 vs last month" trendType="up" bgColorClass="bg-[#F3E5F5] dark:bg-purple-900/20" href="/dashboard/jobs?status=placed" icon={<Trophy size={20} />} />
      </div>

      {/* Main Content Area */}
      <div className="flex items-start self-stretch ml-5 mr-12 gap-[25px]">
        {/* Left Column Container */}
        <div className="flex-1 flex flex-col gap-[25px]">
          <NeedsAttentionTable jobFilter={jobFilter} />
          <PipelineActivityTable jobFilter={jobFilter} />
        </div>

        {/* Right Column */}
        <div className="flex flex-col shrink-0 w-80 gap-6">
          <TeamActivityFeed />
          <CvIngestionQueue />
        </div>
      </div>
    </div>
  );
}
