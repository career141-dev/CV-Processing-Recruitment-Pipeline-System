"use client";

import React, { useState } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { FileText, Briefcase, UserCheck, MessageSquare, Trophy } from 'lucide-react';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('Overview');

  const TABS = [
    'Overview',
    'Source Performance',
    'Recruiter KPIs',
    'Time-to-Hire',
    'Commission Tracker',
  ];

  return (
    <div className="flex-1 w-full bg-background p-[24px] min-h-screen font-body">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-[16px]">
        <div>
          <h1 className="font-page-title text-page-title text-text-primary">Analytics &amp; Reports</h1>
          <p className="font-body text-body text-text-secondary mt-1">Performance across all jobs, sources, and recruiters</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Picker Pseudo-component */}
          <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2 shadow-sm cursor-pointer hover:border-outline transition-colors">
            <span className="material-symbols-outlined text-[18px] text-text-secondary">calendar_today</span>
            <span className="font-nav-item text-nav-item text-text-primary">Last 30 Days</span>
            <span className="material-symbols-outlined text-[18px] text-text-secondary">expand_more</span>
          </div>
          {/* Export Button */}
          <button className="bg-primary-container text-on-primary text-on-primary font-nav-item text-nav-item px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-secondary transition-colors shadow-sm">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export All
          </button>
        </div>
      </div>

      {/* Primary Tabs */}
      <div className="flex gap-6 border-b border-border mb-[24px] overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`font-nav-item text-nav-item pb-2 px-1 whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'text-primary-container border-b-2 border-primary-container'
                : 'text-text-secondary hover:text-text-primary border-b-2 border-transparent hover:border-border'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'Overview' ? (
        <div className="space-y-[24px]">
          {/* ROW 1: KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-[24px]">
            <StatCard 
              title="TOTAL CVS" 
              value={247} 
              trendText="+12% vs last mo" 
              trendType="up" 
              bgColorClass="bg-[#E8F5E9] dark:bg-[#1B5E20]/20" 
              icon={<FileText size={20} />} 
            />
            <StatCard 
              title="ACTIVE JOBS" 
              value={12} 
              trendText="Consistent" 
              trendType="neutral" 
              bgColorClass="bg-[#E3F2FD] dark:bg-blue-900/20" 
              icon={<Briefcase size={20} />} 
            />
            <StatCard 
              title="SHORTLISTED" 
              value={89} 
              trendText="36% Conversion" 
              trendType="up" 
              bgColorClass="bg-[#FFF3E0] dark:bg-orange-900/20" 
              icon={<UserCheck size={20} />} 
            />
            <StatCard 
              title="INTERVIEWS" 
              value={14} 
              trendText="15% of Shortlisted" 
              trendType="neutral" 
              bgColorClass="bg-[#F3E5F5] dark:bg-purple-900/20" 
              icon={<MessageSquare size={20} />} 
            />
            <StatCard 
              title="PLACEMENTS" 
              value={4} 
              trendText="+1 this week" 
              trendType="up" 
              bgColorClass="bg-[#E0F2F1] dark:bg-teal-900/20" 
              icon={<Trophy size={20} />} 
            />
          </div>

          {/* ROW 2: Main Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px]">
            {/* Left: Line Chart (60%) */}
            <div className="lg:col-span-7 bg-surface border border-border rounded-[10px] p-[20px] shadow-[0px_2px_4px_rgba(0,0,0,0.02)] flex flex-col h-[380px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-card-header text-card-header text-text-primary">CV Intake Over Time</h2>
                <button className="text-text-secondary hover:text-text-primary"><span className="material-symbols-outlined text-[20px]">more_vert</span></button>
              </div>
              <div className="flex-1 relative w-full h-full mt-2">
                {/* Simulated Line Chart with SVG */}
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 600 200">
                  {/* Grid lines */}
                  <line stroke="#E0E0E0" strokeDasharray="4" strokeWidth="1" x1="0" x2="600" y1="50" y2="50"></line>
                  <line stroke="#E0E0E0" strokeDasharray="4" strokeWidth="1" x1="0" x2="600" y1="100" y2="100"></line>
                  <line stroke="#E0E0E0" strokeDasharray="4" strokeWidth="1" x1="0" x2="600" y1="150" y2="150"></line>
                  <line stroke="#E0E0E0" strokeWidth="1" x1="0" x2="600" y1="200" y2="200"></line>
                  {/* Total Line (Primary) */}
                  <path d="M0,180 L100,140 L200,160 L300,90 L400,110 L500,40 L600,20" fill="none" stroke="#1b5e20" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
                  {/* LinkedIn Line (Teal) */}
                  <path d="M0,190 L100,160 L200,170 L300,120 L400,140 L500,80 L600,60" fill="none" opacity="0.7" stroke="#006763" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
                {/* X-axis labels */}
                <div className="flex justify-between mt-3 font-helper-text text-helper-text text-text-disabled">
                  <span>Week 1</span>
                  <span>Week 2</span>
                  <span>Week 3</span>
                  <span>Week 4</span>
                </div>
              </div>
              {/* Legend */}
              <div className="flex gap-4 mt-6 justify-center">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary-container"></div><span className="font-helper-text text-helper-text text-text-secondary">Total CVs</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-accent-teal"></div><span className="font-helper-text text-helper-text text-text-secondary">LinkedIn</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-tertiary-container"></div><span className="font-helper-text text-helper-text text-text-secondary">Email</span></div>
              </div>
            </div>

            {/* Right: Donut Chart (40%) */}
            <div className="lg:col-span-5 bg-surface border border-border rounded-[10px] p-[20px] shadow-[0px_2px_4px_rgba(0,0,0,0.02)] flex flex-col h-[380px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-card-header text-card-header text-text-primary">CVs by Source</h2>
                <button className="text-text-secondary hover:text-text-primary"><span className="material-symbols-outlined text-[20px]">more_vert</span></button>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center">
                {/* Pure CSS/SVG Donut */}
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    {/* Background circle (WhatsApp/Other small) */}
                    <circle cx="18" cy="18" fill="transparent" r="15.915" stroke="#e3e3de" strokeWidth="4"></circle>
                    {/* LinkedIn (Primary Container) 55% */}
                    <circle cx="18" cy="18" fill="transparent" r="15.915" stroke="#1b5e20" strokeDasharray="55 45" strokeWidth="4"></circle>
                    {/* Email (Teal) 25% */}
                    <circle cx="18" cy="18" fill="transparent" r="15.915" stroke="#006763" strokeDasharray="25 75" strokeDashoffset="-55" strokeWidth="4"></circle>
                    {/* Meta (Tertiary) 15% */}
                    <circle cx="18" cy="18" fill="transparent" r="15.915" stroke="#883454" strokeDasharray="15 85" strokeDashoffset="-80" strokeWidth="4"></circle>
                  </svg>
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-page-title text-page-title text-text-primary tabular-nums">247</span>
                    <span className="font-helper-text text-helper-text text-text-secondary">Total</span>
                  </div>
                </div>
                {/* Custom Legend below donut */}
                <div className="w-full mt-8 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-primary-container"></div><span className="font-body text-body text-text-secondary">LinkedIn</span></div>
                    <span className="font-body text-body font-medium tabular-nums">55% (136)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-accent-teal"></div><span className="font-body text-body text-text-secondary">Email Parsing</span></div>
                    <span className="font-body text-body font-medium tabular-nums">25% (62)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-tertiary-container"></div><span className="font-body text-body text-text-secondary">Meta Ads</span></div>
                    <span className="font-body text-body font-medium tabular-nums">15% (37)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3: Secondary Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[24px]">
            {/* Left: Pipeline Stage Distribution */}
            <div className="bg-surface border border-border rounded-[10px] p-[20px] shadow-[0px_2px_4px_rgba(0,0,0,0.02)]">
              <h2 className="font-card-header text-card-header text-text-primary mb-6">Pipeline Stage Distribution</h2>
              <div className="space-y-4">
                {/* Bar 1 */}
                <div>
                  <div className="flex justify-between font-helper-text text-helper-text text-text-secondary mb-1">
                    <span>New CVs</span>
                    <span className="tabular-nums font-medium text-text-primary">247</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2.5">
                    <div className="bg-outline-variant h-2.5 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                </div>
                {/* Bar 2 */}
                <div>
                  <div className="flex justify-between font-helper-text text-helper-text text-text-secondary mb-1">
                    <span>Shortlisted</span>
                    <span className="tabular-nums font-medium text-text-primary">89</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2.5">
                    <div className="bg-primary-fixed-dim h-2.5 rounded-full" style={{ width: '36%' }}></div>
                  </div>
                </div>
                {/* Bar 3 */}
                <div>
                  <div className="flex justify-between font-helper-text text-helper-text text-text-secondary mb-1">
                    <span>Interviews Scheduled</span>
                    <span className="tabular-nums font-medium text-text-primary">14</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2.5">
                    <div className="bg-primary-container h-2.5 rounded-full" style={{ width: '15%' }}></div>
                  </div>
                </div>
                {/* Bar 4 */}
                <div>
                  <div className="flex justify-between font-helper-text text-helper-text text-text-secondary mb-1">
                    <span>Offer Stage</span>
                    <span className="tabular-nums font-medium text-text-primary">6</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2.5">
                    <div className="bg-accent-teal h-2.5 rounded-full" style={{ width: '5%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Job Status Overview (Stacked Bar conceptual) */}
            <div className="bg-surface border border-border rounded-[10px] p-[20px] shadow-[0px_2px_4px_rgba(0,0,0,0.02)]">
              <h2 className="font-card-header text-card-header text-text-primary mb-6">Job Status Overview</h2>
              <div className="flex h-32 items-end gap-6 mb-4">
                {/* Column 1 */}
                <div className="flex-1 flex flex-col justify-end group">
                  <div className="w-full bg-primary-container rounded-t-sm transition-all h-[60%] hover:opacity-90 relative"></div>
                  <div className="text-center mt-2 font-helper-text text-helper-text text-text-secondary">Engineering</div>
                </div>
                {/* Column 2 */}
                <div className="flex-1 flex flex-col justify-end">
                  <div className="w-full bg-accent-teal rounded-t-sm h-[40%] hover:opacity-90"></div>
                  <div className="text-center mt-2 font-helper-text text-helper-text text-text-secondary">Sales</div>
                </div>
                {/* Column 3 */}
                <div className="flex-1 flex flex-col justify-end">
                  <div className="w-full bg-tertiary-container rounded-t-sm h-[80%] hover:opacity-90"></div>
                  <div className="text-center mt-2 font-helper-text text-helper-text text-text-secondary">Marketing</div>
                </div>
                {/* Column 4 */}
                <div className="flex-1 flex flex-col justify-end">
                  <div className="w-full bg-outline-variant rounded-t-sm h-[30%] hover:opacity-90"></div>
                  <div className="text-center mt-2 font-helper-text text-helper-text text-text-secondary">Operations</div>
                </div>
              </div>
              <div className="pt-4 border-t border-border flex justify-between font-helper-text text-helper-text">
                <span className="text-text-secondary">Total Active Requisitions: <strong className="text-text-primary tabular-nums">12</strong></span>
                <a className="text-primary-container font-medium hover:underline" href="/dashboard/jobs">View All Jobs</a>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-[12px] border border-border shadow-subtle p-8 text-center text-text-secondary mb-24">
          <span className="material-symbols-outlined text-[48px] text-border mb-4">analytics</span>
          <h3 className="text-text-primary font-medium mb-1">No data for {activeTab} yet</h3>
          <p className="text-[13px]">Analytics for this section will appear here.</p>
        </div>
      )}
    </div>
  );
}
