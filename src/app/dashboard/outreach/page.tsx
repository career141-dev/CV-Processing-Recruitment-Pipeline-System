"use client";

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { StatCard } from '@/components/dashboard/StatCard';
import { PhoneCall, ThumbsUp, ThumbsDown, Mail } from 'lucide-react';
import { TriggerCallModal } from '@/components/outreach/TriggerCallModal';
import { SendMessageModal } from '@/components/outreach/SendMessageModal';
import { Id } from '../../../../convex/_generated/dataModel';
import { CheckCircle2, XCircle, Clock, Play } from 'lucide-react';
import { useMutation } from 'convex/react';

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
    'Follow-up Automation',
  ];

  const jobs = useQuery(api.jobs.jobs.list);
  const aiCalls = useQuery(api.pipeline.outreach.getAiCalls, {
    jobId: selectedJob ? (selectedJob as Id<"jobs">) : undefined,
    outcome: selectedOutcome,
    dateRange: dateRange,
  });

  const followUpCandidates = useQuery(api.pipeline.outreach.getFollowUpCandidates, {});
  const triggerFollowUpCall = useMutation(api.pipeline.outreach.forceTriggerFollowUpCall);

  const handleForceTrigger = async (applicationId: Id<"applications">) => {
    try {
      await triggerFollowUpCall({ applicationId });
      alert("Follow-up call triggered successfully!");
    } catch (e: any) {
      alert("Error triggering call: " + e.message);
    }
  };

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
          title="FOLLOW-UP PIPELINE" 
          value={followUpCandidates?.length || 0} 
          trendText="Active automated candidates" 
          trendType="neutral" 
          bgColorClass="bg-[#FFF3E0] dark:bg-orange-900/20" 
          icon={<Clock size={20} />} 
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
                <tr><td colSpan={8} className="p-8 text-center text-text-secondary">No AI calls found.</td></tr>
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
      ) : activeTab === 'Follow-up Automation' ? (
        <div className="bg-surface border border-border rounded-[10px] shadow-[0px_2px_4px_rgba(0,0,0,0.05)] flex flex-col">
          <div className="p-[20px] border-b border-border flex flex-wrap items-center justify-between gap-4 bg-surface-bright">
            <div>
              <h3 className="font-semibold text-text-primary text-[15px]">Automated Pipeline Dashboard</h3>
              <p className="text-text-secondary text-[13px] mt-1">Candidates actively managed by the Follow-up Cron Job.</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-600 rounded-md text-[13px] font-medium border border-green-500/20">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              Autopilot Active
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-text-secondary font-label-caps text-label-caps bg-surface-container-low/50">
                  <th className="p-4 font-semibold uppercase">Candidate</th>
                  <th className="p-4 font-semibold uppercase">Timeline</th>
                  <th className="p-4 font-semibold uppercase">Next Action</th>
                  <th className="p-4 font-semibold uppercase">Data Missing</th>
                  <th className="p-4 font-semibold uppercase text-right">Manual Override</th>
                </tr>
              </thead>
              <tbody className="text-body text-text-primary divide-y divide-border">
                {!followUpCandidates ? (
                  <tr><td colSpan={5} className="p-8 text-center text-text-secondary">Loading...</td></tr>
                ) : followUpCandidates.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-text-secondary">No candidates currently in the Follow-up Pipeline.</td></tr>
                ) : (
                  followUpCandidates.map((c: any) => {
                    const flagItem = (label: string, done: boolean) => (
                      <div className="flex items-center gap-1.5 text-[12px]" key={label}>
                        {done 
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        }
                        <span className={done ? 'text-text-secondary' : 'text-orange-600 font-medium'}>{label}</span>
                      </div>
                    );

                    return (
                      <tr key={c.applicationId} className="hover:bg-surface-bright transition-colors group">
                        <td className="p-4">
                          <div className="font-semibold text-[14px]">{c.candidateName}</div>
                          <div className="text-text-secondary text-[12px] mt-0.5">{c.jobTitle}</div>
                        </td>
                        <td className="p-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-surface-container text-text-secondary">
                            <Clock className="w-3.5 h-3.5" />
                            Day {c.daysInStage} of 7
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`text-[12px] font-medium px-2 py-1 rounded-md ${
                            c.nextAction.includes("Wait") 
                              ? 'bg-surface-container text-text-secondary border border-border'
                              : 'bg-primary/10 text-primary border border-primary/20'
                          }`}>
                            {c.nextAction}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1.5 bg-surface p-2 rounded border border-border shadow-sm inline-block min-w-[140px]">
                            {flagItem('CV', c.hasCV)}
                            {flagItem('Current Salary', c.hasCurrentSalary)}
                            {flagItem('Expected Salary', c.hasExpectedSalary)}
                            {flagItem('Notice Period', c.hasNoticePeriod)}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleForceTrigger(c.applicationId)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container hover:bg-border border border-border rounded-md text-[13px] font-medium text-text-primary transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" /> Force Call
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

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
