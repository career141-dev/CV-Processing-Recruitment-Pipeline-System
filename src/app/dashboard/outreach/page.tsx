"use client";

import React, { useState } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { PhoneCall, ThumbsUp, ThumbsDown, Mail } from 'lucide-react';

export default function OutreachPage() {
  const [activeTab, setActiveTab] = useState('AI Phone Calls');

  const TABS = [
    'AI Phone Calls',
    'Email Sequences',
    'Call Scripts',
    'Settings'
  ];

  return (
    <div className="flex-1 w-full bg-background p-[24px] min-h-screen font-body max-w-[1280px] mx-auto">
      {/* Page Header */}
      <div className="mb-[24px]">
        <h2 className="font-page-title text-page-title text-text-primary">AI Outreach</h2>
        <p className="font-helper-text text-helper-text text-text-secondary mt-1">Manage AI phone calls and automated email sequences</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-[24px] mb-[24px]">
        <StatCard 
          title="CALLS TODAY" 
          value={23} 
          trendText="Daily volume" 
          trendType="neutral" 
          bgColorClass="bg-[#E8F5E9] dark:bg-[#1B5E20]/20" 
          icon={<PhoneCall size={20} />} 
        />
        <StatCard 
          title="INTERESTED" 
          value={8} 
          trendText="High intent" 
          trendType="up" 
          bgColorClass="bg-[#E3F2FD] dark:bg-blue-900/20" 
          icon={<ThumbsUp size={20} />} 
        />
        <StatCard 
          title="DECLINED" 
          value={4} 
          trendText="Not interested" 
          trendType="down" 
          bgColorClass="bg-[#FFEBEE] dark:bg-red-900/20" 
          icon={<ThumbsDown size={20} />} 
        />
        <StatCard 
          title="SEQUENCES ACTIVE" 
          value={11} 
          trendText="Running campaigns" 
          trendType="neutral" 
          bgColorClass="bg-[#FFF3E0] dark:bg-orange-900/20" 
          icon={<Mail size={20} />} 
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-[24px] flex gap-6">
        {TABS.map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 border-b-[2px] font-nav-item text-nav-item ${
              activeTab === tab 
                ? 'border-primary text-primary font-semibold' 
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Panel */}
      {activeTab === 'AI Phone Calls' ? (
      <div className="bg-surface border border-border rounded-[10px] shadow-[0px_2px_4px_rgba(0,0,0,0.05)] flex flex-col">
        {/* Filter Bar */}
        <div className="p-[20px] border-b border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <select className="border border-border rounded-md text-body py-1.5 pl-3 pr-8 focus:border-primary focus:ring-0 bg-surface">
              <option>All Jobs</option>
              <option>Brand Manager — Atlas</option>
              <option>CFO — LPI</option>
            </select>
            <select className="border border-border rounded-md text-body py-1.5 pl-3 pr-8 focus:border-primary focus:ring-0 bg-surface">
              <option>All Outcomes</option>
              <option>Interested</option>
              <option>Declined</option>
              <option>No Answer</option>
            </select>
            <select className="border border-border rounded-md text-body py-1.5 pl-3 pr-8 focus:border-primary focus:ring-0 bg-surface">
              <option>Today</option>
              <option>Last 7 Days</option>
            </select>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[16px]">search</span>
              <input className="pl-9 pr-4 py-1.5 border border-border rounded-md text-body focus:border-primary focus:ring-0 w-48 bg-surface" placeholder="Search candidates..." type="text" />
            </div>
          </div>
          <button className="bg-primary-container text-on-primary px-4 py-2 rounded-md font-nav-item text-nav-item font-semibold flex items-center gap-2 hover:bg-primary transition-colors">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Trigger New Call
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-text-secondary font-label-caps text-label-caps bg-surface-container-low/50">
                <th className="p-4 font-semibold uppercase">Candidate</th>
                <th className="p-4 font-semibold uppercase">Job</th>
                <th className="p-4 font-semibold uppercase">Called At</th>
                <th className="p-4 font-semibold uppercase">Duration</th>
                <th className="p-4 font-semibold uppercase">Outcome</th>
                <th className="p-4 font-semibold uppercase">Details Captured</th>
                <th className="p-4 font-semibold uppercase">Follow-Up</th>
                <th className="p-4 font-semibold uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="font-body text-body text-text-primary divide-y divide-border">
              {/* Row 1 */}
              <tr className="hover:bg-surface-container-low transition-colors">
                <td className="p-4 font-medium">Kasun Fernando</td>
                <td className="p-4 text-text-secondary">Brand Manager — Atlas</td>
                <td className="p-4 text-text-secondary">12 Jun 10:30 AM</td>
                <td className="p-4 text-text-secondary">1m 23s</td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-primary-container/15 text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                    Interested
                  </span>
                </td>
                <td className="p-4 text-text-secondary text-helper-text">Notice: 1M · Expected: 250k · Current: 180k</td>
                <td className="p-4 text-text-secondary">Added to pipeline</td>
                <td className="p-4 text-right whitespace-nowrap">
                  <button className="text-primary hover:text-primary-fixed-dim font-medium mr-3">View Recording</button>
                  <button className="text-text-secondary hover:text-text-primary font-medium">View Profile</button>
                </td>
              </tr>
              {/* Row 2 */}
              <tr className="hover:bg-surface-container-low transition-colors">
                <td className="p-4 font-medium">Priya Sharma</td>
                <td className="p-4 text-text-secondary">Brand Manager — Atlas</td>
                <td className="p-4 text-text-secondary">12 Jun 10:45 AM</td>
                <td className="p-4 text-text-secondary">0m 45s</td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-primary-container/15 text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                    Interested
                  </span>
                </td>
                <td className="p-4 text-text-secondary text-helper-text">Notice: 2M · Expected: 280k</td>
                <td className="p-4 text-text-secondary">Added to pipeline</td>
                <td className="p-4 text-right whitespace-nowrap">
                  <button className="text-primary hover:text-primary-fixed-dim font-medium mr-3">View Recording</button>
                  <button className="text-text-secondary hover:text-text-primary font-medium">View Profile</button>
                </td>
              </tr>
              {/* Row 3 */}
              <tr className="hover:bg-surface-container-low transition-colors">
                <td className="p-4 font-medium">Ashan Mendis</td>
                <td className="p-4 text-text-secondary">Brand Manager — Atlas</td>
                <td className="p-4 text-text-secondary">12 Jun 11:00 AM</td>
                <td className="p-4 text-text-secondary">0s</td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FFF9C4] text-[#F57F17]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FBC02D]"></span>
                    No Answer
                  </span>
                </td>
                <td className="p-4 text-text-secondary">—</td>
                <td className="p-4 text-text-secondary">Email sequence triggered</td>
                <td className="p-4 text-right whitespace-nowrap">
                  <button className="text-primary hover:text-primary-fixed-dim font-medium mr-3">Re-call</button>
                  <button className="text-text-secondary hover:text-text-primary font-medium">View Profile</button>
                </td>
              </tr>
              {/* Row 4 */}
              <tr className="hover:bg-surface-container-low transition-colors">
                <td className="p-4 font-medium">Nimal Perera</td>
                <td className="p-4 text-text-secondary">CFO — LPI</td>
                <td className="p-4 text-text-secondary">12 Jun 09:15 AM</td>
                <td className="p-4 text-text-secondary">0m 31s</td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-error/15 text-error">
                    <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                    Declined
                  </span>
                </td>
                <td className="p-4 text-text-secondary">—</td>
                <td className="p-4 text-text-secondary">Marked not interested</td>
                <td className="p-4 text-right whitespace-nowrap">
                  <button className="text-text-secondary hover:text-text-primary font-medium">View Profile</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-4 border-t border-border bg-surface-container-low/30 flex justify-center text-helper-text font-helper-text text-text-secondary rounded-b-[10px]">
          Showing 23 calls today — 8 interested · 4 declined · 11 no answer
        </div>
      </div>
      ) : (
        <div className="bg-surface rounded-[12px] border border-border shadow-subtle p-8 text-center text-text-secondary mb-24">
          <span className="material-symbols-outlined text-[48px] text-border mb-4">campaign</span>
          <h3 className="text-text-primary font-medium mb-1">No data for {activeTab} yet</h3>
          <p className="text-[13px]">Information for this section will appear here.</p>
        </div>
      )}
    </div>
  );
}
