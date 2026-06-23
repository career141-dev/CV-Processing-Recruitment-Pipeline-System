"use client";

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { StatCard } from '@/components/dashboard/StatCard';
import { PhoneCall, ThumbsUp, ThumbsDown, Mail } from 'lucide-react';
import { TriggerCallModal } from '@/components/outreach/TriggerCallModal';
import { SendMessageModal } from '@/components/outreach/SendMessageModal';
import { Id } from '../../../../convex/_generated/dataModel';

export default function OutreachPage() {
  const [activeTab, setActiveTab] = useState('AI Phone Calls');
  
  // Filter states
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [selectedOutcome, setSelectedOutcome] = useState<string>("All Outcomes");
  const [dateRange, setDateRange] = useState<string>("Today");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [showTriggerCall, setShowTriggerCall] = useState(false);
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [actionCandidateId, setActionCandidateId] = useState<Id<"candidates"> | undefined>();
  const [actionJobId, setActionJobId] = useState<Id<"jobs"> | undefined>();

  const TABS = [
    'AI Phone Calls',
    'Email Sequences',
    'Call Scripts',
    'Settings'
  ];

  const jobs = useQuery(api.jobs.list);
  const aiCalls = useQuery(api.outreach.getAiCalls, {
    jobId: selectedJob ? (selectedJob as Id<"jobs">) : undefined,
    outcome: selectedOutcome,
    dateRange: dateRange,
  });

  const handleTriggerCall = (candidateId?: Id<"candidates">, jobId?: Id<"jobs">) => {
    setActionCandidateId(candidateId);
    setActionJobId(jobId);
    setShowTriggerCall(true);
  };

  const handleSendMessage = (candidateId?: Id<"candidates">, jobId?: Id<"jobs">) => {
    setActionCandidateId(candidateId);
    setActionJobId(jobId);
    setShowSendMessage(true);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatOutcome = (callStatus: string, ivrResponse?: string) => {
    if (callStatus === "no_answer") return { label: "No Answer", color: "bg-[#FFF9C4] text-[#F57F17]", dot: "bg-[#FBC02D]" };
    if (callStatus === "declined" || ivrResponse === "pressed_2_declined") return { label: "Declined", color: "bg-error/15 text-error", dot: "bg-error" };
    if (ivrResponse === "pressed_1_interested") return { label: "Interested", color: "bg-primary-container/15 text-primary", dot: "bg-primary" };
    if (callStatus === "completed") return { label: "Completed", color: "bg-blue-100 text-blue-800", dot: "bg-blue-500" };
    if (callStatus === "failed") return { label: "Failed", color: "bg-gray-100 text-gray-800", dot: "bg-gray-500" };
    return { label: "Scheduled", color: "bg-purple-100 text-purple-800", dot: "bg-purple-500" };
  };

  // Stats calculation
  const callsToday = aiCalls?.length || 0;
  const interested = aiCalls?.filter((c: any) => c.ivrResponse === "pressed_1_interested").length || 0;
  const declined = aiCalls?.filter((c: any) => c.ivrResponse === "pressed_2_declined" || c.callStatus === "declined").length || 0;
  const noAnswer = aiCalls?.filter((c: any) => c.callStatus === "no_answer").length || 0;

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
          value={callsToday} 
          trendText="Daily volume" 
          trendType="neutral" 
          bgColorClass="bg-[#E8F5E9] dark:bg-[#1B5E20]/20" 
          icon={<PhoneCall size={20} />} 
        />
        <StatCard 
          title="INTERESTED" 
          value={interested} 
          trendText="High intent" 
          trendType="up" 
          bgColorClass="bg-[#E3F2FD] dark:bg-blue-900/20" 
          icon={<ThumbsUp size={20} />} 
        />
        <StatCard 
          title="DECLINED" 
          value={declined} 
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
            <select 
              className="border border-border rounded-md text-body py-1.5 pl-3 pr-8 focus:border-primary focus:ring-0 bg-surface"
              value={selectedJob}
              onChange={e => setSelectedJob(e.target.value)}
            >
              <option value="">All Jobs</option>
              {jobs?.map((job: any) => (
                <option key={job._id} value={job._id}>{job.title} — {job.clientName}</option>
              ))}
            </select>
            <select 
              className="border border-border rounded-md text-body py-1.5 pl-3 pr-8 focus:border-primary focus:ring-0 bg-surface"
              value={selectedOutcome}
              onChange={e => setSelectedOutcome(e.target.value)}
            >
              <option>All Outcomes</option>
              <option>Interested</option>
              <option>Declined</option>
              <option>No Answer</option>
            </select>
            <select 
              className="border border-border rounded-md text-body py-1.5 pl-3 pr-8 focus:border-primary focus:ring-0 bg-surface"
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
            >
              <option>Today</option>
              <option>Last 7 Days</option>
              <option>All Time</option>
            </select>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[16px]">search</span>
              <input 
                className="pl-9 pr-4 py-1.5 border border-border rounded-md text-body focus:border-primary focus:ring-0 w-48 bg-surface" 
                placeholder="Search candidates..." 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <button 
            onClick={() => handleTriggerCall()}
            className="bg-primary-container text-on-primary px-4 py-2 rounded-md font-nav-item text-nav-item font-semibold flex items-center gap-2 hover:bg-primary transition-colors"
          >
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
              {aiCalls === undefined ? (
                <tr><td colSpan={8} className="p-8 text-center text-text-secondary">Loading...</td></tr>
              ) : aiCalls.length === 0 ? (
                <tr className="hover:bg-surface-container-low transition-colors group">
                  <td className="p-4 font-medium">
                    John Doe
                    <div className="text-[11px] text-text-secondary font-normal mt-0.5">Software Engineer</div>
                  </td>
                  <td className="p-4 text-text-secondary">Senior Developer — Tech Corp</td>
                  <td className="p-4 text-text-secondary whitespace-nowrap">
                    23 Jun 10:30
                  </td>
                  <td className="p-4 text-text-secondary">2m 45s</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-primary-container/15 text-primary">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                      Interested
                    </span>
                  </td>
                  <td className="p-4 text-text-secondary text-helper-text">Notice: 30 days · Expected: $120k</td>
                  <td className="p-4 text-text-secondary">
                    Added to pipeline
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <div className="relative group/menu inline-block text-left">
                      <button className="text-text-secondary hover:text-text-primary p-1 rounded-full hover:bg-surface-container transition-colors flex items-center justify-center">
                        <span className="material-symbols-outlined">more_vert</span>
                      </button>
                      <div className="absolute right-0 top-full mt-1 w-48 bg-surface rounded-md shadow-md border border-border z-10 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all">
                        <div className="py-1 flex flex-col text-left">
                          <button className="px-4 py-2 text-sm text-text-primary hover:bg-surface-container flex items-center gap-2">
                            <span>🎧</span> View Recording
                          </button>
                          <button className="px-4 py-2 text-sm text-text-primary hover:bg-surface-container flex items-center gap-2">
                            <span>✉️</span> Message
                          </button>
                          <button className="px-4 py-2 text-sm text-text-primary hover:bg-surface-container flex items-center gap-2">
                            <span>👤</span> View Profile
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                aiCalls
                  .filter((c: any) => !searchQuery || c.candidateName?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((call: any) => {
                    const outcome = formatOutcome(call.callStatus, call.ivrResponse);
                    const callDate = new Date(call.calledAt);
                    let detailsStr = "—";
                    if (call.ivrResponse === "pressed_1_interested") {
                      detailsStr = `Notice: ${call.candidateNoticePeriod || "N/A"} · Expected: ${call.candidateExpectedSalary || "N/A"}`;
                    }

                    return (
                      <tr key={call._id} className="hover:bg-surface-container-low transition-colors group">
                        <td className="p-4 font-medium">
                          {call.candidateName}
                          <div className="text-[11px] text-text-secondary font-normal mt-0.5">{call.candidateCurrentTitle}</div>
                        </td>
                        <td className="p-4 text-text-secondary">{call.jobTitle} — {call.clientName}</td>
                        <td className="p-4 text-text-secondary whitespace-nowrap">
                          {callDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {callDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4 text-text-secondary">{formatDuration(call.callDurationSeconds)}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${outcome.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${outcome.dot}`}></span>
                            {outcome.label}
                          </span>
                        </td>
                        <td className="p-4 text-text-secondary text-helper-text">{detailsStr}</td>
                        <td className="p-4 text-text-secondary">
                          {call.callStatus === 'no_answer' ? 'Email sequence triggered' : (call.ivrResponse === 'pressed_1_interested' ? 'Added to pipeline' : 'Marked not interested')}
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="relative group/menu inline-block text-left">
                            <button className="text-text-secondary hover:text-text-primary p-1 rounded-full hover:bg-surface-container transition-colors flex items-center justify-center">
                              <span className="material-symbols-outlined">more_vert</span>
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-48 bg-surface rounded-md shadow-md border border-border z-10 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all">
                              <div className="py-1 flex flex-col text-left">
                                {call.callStatus === 'no_answer' ? (
                                  <>
                                    <button onClick={() => handleTriggerCall(call.candidateId, call.jobId)} className="px-4 py-2 text-sm text-text-primary hover:bg-surface-container flex items-center gap-2">
                                      <span>📞</span> Re-call
                                    </button>
                                    <button onClick={() => handleSendMessage(call.candidateId, call.jobId)} className="px-4 py-2 text-sm text-text-primary hover:bg-surface-container flex items-center gap-2">
                                      <span>✉️</span> Message
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {call.recordingUrl && (
                                      <button className="px-4 py-2 text-sm text-text-primary hover:bg-surface-container flex items-center gap-2">
                                        <span>🎧</span> View Recording
                                      </button>
                                    )}
                                    <button onClick={() => handleSendMessage(call.candidateId, call.jobId)} className="px-4 py-2 text-sm text-text-primary hover:bg-surface-container flex items-center gap-2">
                                      <span>✉️</span> Message
                                    </button>
                                  </>
                                )}
                                <button className="px-4 py-2 text-sm text-text-primary hover:bg-surface-container flex items-center gap-2">
                                  <span>👤</span> View Profile
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-4 border-t border-border bg-surface-container-low/30 flex justify-center text-helper-text font-helper-text text-text-secondary rounded-b-[10px]">
          Showing {callsToday} calls {dateRange.toLowerCase()} — {interested} interested · {declined} declined · {noAnswer} no answer
        </div>
      </div>
      ) : activeTab === 'Email Sequences' ? (
        <div className="bg-surface rounded-[12px] border border-border shadow-subtle p-8 text-center text-text-secondary mb-24">
          <span className="material-symbols-outlined text-[48px] text-border mb-4">mail</span>
          <h3 className="text-text-primary font-medium mb-1">Email Sequences</h3>
          <p className="text-[13px] mb-4">Manage your automated email and WhatsApp follow-up campaigns.</p>
          <button className="bg-surface border border-border px-4 py-2 rounded shadow-sm text-sm font-medium hover:bg-surface-variant text-text-primary">
            Create New Sequence
          </button>
        </div>
      ) : activeTab === 'Call Scripts' ? (
        <div className="bg-surface rounded-[12px] border border-border shadow-subtle p-8 text-center text-text-secondary mb-24">
          <span className="material-symbols-outlined text-[48px] text-border mb-4">record_voice_over</span>
          <h3 className="text-text-primary font-medium mb-1">AI Call Scripts</h3>
          <p className="text-[13px] mb-4">Configure the scripts used by Agent 5 during phone screening.</p>
          <button className="bg-surface border border-border px-4 py-2 rounded shadow-sm text-sm font-medium hover:bg-surface-variant text-text-primary">
            Manage Scripts
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-[12px] border border-border shadow-subtle p-8 text-center text-text-secondary mb-24">
          <span className="material-symbols-outlined text-[48px] text-border mb-4">settings</span>
          <h3 className="text-text-primary font-medium mb-1">Outreach Settings</h3>
          <p className="text-[13px]">Global configuration for outbound communications.</p>
        </div>
      )}

      {showTriggerCall && (
        <TriggerCallModal 
          onClose={() => setShowTriggerCall(false)} 
          candidateId={actionCandidateId}
          jobId={actionJobId}
        />
      )}

      {showSendMessage && (
        <SendMessageModal 
          onClose={() => setShowSendMessage(false)}
          candidateId={actionCandidateId}
          jobId={actionJobId}
        />
      )}
    </div>
  );
}
