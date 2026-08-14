import React, { useEffect, useState } from 'react';
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from '../../../convex/_generated/dataModel';
import { format, differenceInDays } from 'date-fns';
import { X, MessageSquare, ArrowRightLeft, UserPlus, Info, CheckCircle2, Clock, Mail, MessageCircle, AlertCircle, FileText, DollarSign, Calendar, CircleDashed, ExternalLink, HelpCircle } from 'lucide-react';

interface CandidateTimelineDrawerProps {
  applicationId: Id<"applications"> | null;
  onClose: () => void;
}

export function CandidateTimelineDrawer({ applicationId, onClose }: CandidateTimelineDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (applicationId) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [applicationId]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => onClose(), 300); // Wait for transition
  };

  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'email'>('all');

  const data = useQuery(api.candidates.timeline.getTimeline, 
    applicationId ? { applicationId } : "skip"
  );

  if (!applicationId) return null;

  const events = data?.events;
  const info = data?.applicationInfo;

  const filteredEvents = events?.filter((e: any) => {
    if (e.type !== 'communication') return false;
    if (channelFilter === 'all') return true;
    return e.metadata?.channel === channelFilter;
  });

  const renderIcon = (event: any) => {
    if (event.type === 'application_created') return <UserPlus className="w-4 h-4 text-white" />;
    if (event.type === 'stage_change') return <ArrowRightLeft className="w-4 h-4 text-white" />;
    if (event.type === 'communication') {
      if (event.metadata?.channel === 'whatsapp') return <MessageCircle className="w-4 h-4 text-white" />;
      if (event.metadata?.channel === 'email') return <Mail className="w-4 h-4 text-white" />;
      return <MessageSquare className="w-4 h-4 text-white" />;
    }
    return <Info className="w-4 h-4 text-white" />;
  };

  const getIconColor = (event: any) => {
    if (event.type === 'application_created') return 'bg-purple-500';
    if (event.type === 'stage_change') return 'bg-slate-700';
    if (event.type === 'communication') {
      if (event.metadata?.channel === 'whatsapp') {
        return event.metadata?.direction === 'inbound' ? 'bg-[#25D366]' : 'bg-[#128C7E]';
      }
      if (event.metadata?.channel === 'email') {
        return event.metadata?.direction === 'inbound' ? 'bg-blue-500' : 'bg-blue-600';
      }
      return 'bg-blue-400';
    }
    return 'bg-gray-400';
  };

  // Calculate follow up sequence day
  let daysInFollowUp = 0;
  if (info?.currentStage === 'follow_up' && info?.lastStageChangedAt) {
    daysInFollowUp = differenceInDays(new Date(), new Date(info.lastStageChangedAt));
  }

  const sequenceNodes = [
    { day: 0, label: "Day 0", desc: "Initial Outreach" },
    { day: 4, label: "Day 4", desc: "Ping Notice" },
    { day: 6, label: "Day 6", desc: "Final Notice" },
    { day: 7, label: "Day 7", desc: "Unresponsive" },
  ];

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={handleClose} 
      />
      
      <div 
        className={`fixed top-0 right-0 h-full w-[500px] max-w-full bg-surface border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-5 border-b border-border bg-surface-bright">
          <div>
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              AI Follow-Up Tracker
            </h2>
            <p className="text-sm text-text-secondary mt-1">Complete history and automated sequence log</p>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-surface-container rounded-full text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-surface pb-10">
          {!data ? (
            <div className="flex items-center justify-center h-full text-text-secondary">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
            </div>
          ) : (
            <div className="flex flex-col gap-6 p-6">
              
              {/* SECTION 1: Profile Completion Tracker */}
              <div className="bg-surface-bright border border-border rounded-xl p-4 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-4 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> 
                  Target Data Collection
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <StatusBadge 
                    label="CV Document" 
                    icon={<FileText className="w-3.5 h-3.5" />} 
                    isComplete={info?.followUpCvReceived} 
                  />
                  <StatusBadge 
                    label="Current Salary" 
                    icon={<DollarSign className="w-3.5 h-3.5" />} 
                    isComplete={info?.followUpCurrentSalary} 
                  />
                  <StatusBadge 
                    label="Expected Salary" 
                    icon={<DollarSign className="w-3.5 h-3.5" />} 
                    isComplete={info?.followUpExpectedSalary} 
                  />
                  <StatusBadge 
                    label="Notice Period" 
                    icon={<Calendar className="w-3.5 h-3.5" />} 
                    isComplete={info?.followUpNoticePeriod} 
                  />
                </div>

                {/* Job Custom Questions */}
                {info?.jobCustomQuestions && info.jobCustomQuestions.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border/60">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-2.5 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-primary" />
                      Job Screening Questions
                    </h4>
                    <div className="flex flex-col gap-2">
                      {info.jobCustomQuestions.map((q: string, idx: number) => {
                        const ans = info.customFollowUpAnswers?.[q] || info.candidateCustomCallData?.[q];
                        const isComplete = !!ans && String(ans).trim() !== '' && String(ans).trim() !== '—';
                        const answerStr = isComplete ? String(ans).trim() : '';
                        const isUrlAnswer = isComplete && (/^(https?:\/\/|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})(\/[^\s]*)?$/i.test(answerStr) || answerStr.includes('drive.google.com') || answerStr.includes('behance.net') || answerStr.includes('vimeo.com') || answerStr.includes('youtube.com') || answerStr.includes('github.com'));
                        const linkTarget = isUrlAnswer ? (!/^https?:\/\//i.test(answerStr) ? `https://${answerStr}` : answerStr) : '';

                        return (
                          <div 
                            key={idx} 
                            className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs transition-all ${
                              isComplete ? 'bg-success/10 border-success/20 text-success' : 'bg-surface border-border text-text-secondary'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              {isComplete ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
                              )}
                              <div className="flex flex-col overflow-hidden">
                                <span className="font-semibold text-text-primary text-[11px] truncate" title={q}>
                                  {q}
                                </span>
                                {isComplete ? (
                                  <span className="text-[10px] text-text-secondary truncate max-w-[260px]" title={answerStr}>
                                    {answerStr}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-orange-500 italic font-medium">Pending response</span>
                                )}
                              </div>
                            </div>
                            {isUrlAnswer && (
                              <a
                                href={linkTarget}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors shrink-0 shadow-2xs cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Open Link</span>
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: Sequence Graph */}
              {info?.currentStage === 'follow_up' && (
                <div className="bg-surface-bright border border-border rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-5 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4" /> 
                    Sequence Progress
                  </h3>
                  
                  <div className="relative">
                    {/* Connecting line */}
                    <div className="absolute top-4 left-4 right-4 h-0.5 bg-border -z-0"></div>
                    
                    <div className="flex justify-between relative z-10">
                      {sequenceNodes.map((node, i) => {
                        const isPast = daysInFollowUp >= node.day;
                        const isCurrent = (
                          daysInFollowUp === node.day || 
                          (daysInFollowUp > node.day && (i === sequenceNodes.length - 1 || daysInFollowUp < sequenceNodes[i+1].day))
                        );

                        return (
                          <div key={node.day} className="flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 bg-surface transition-all
                              ${isCurrent ? 'border-primary shadow-[0_0_0_4px_rgba(var(--primary),0.15)] ring-2 ring-primary/20 scale-110' : 
                                isPast ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-disabled'}`}
                            >
                              {isCurrent ? <div className="w-2.5 h-2.5 rounded-full bg-primary" /> :
                               isPast ? <CheckCircle2 className="w-4 h-4" /> :
                               <CircleDashed className="w-4 h-4" />}
                            </div>
                            <div className="text-center">
                              <div className={`text-xs font-bold ${isCurrent ? 'text-primary' : isPast ? 'text-text-primary' : 'text-text-disabled'}`}>
                                {node.label}
                              </div>
                              <div className="text-[10px] text-text-secondary mt-0.5 max-w-[60px] leading-tight">
                                {node.desc}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: Timeline Log */}
              <div>
                <div className="flex items-center justify-between mb-4 ml-2 pr-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" />
                    AI Conversation Log
                  </h3>
                  
                  {/* Channel Filter Toggle */}
                  <div className="flex items-center bg-surface-container rounded-lg p-0.5 border border-border">
                    <button 
                      onClick={() => setChannelFilter('all')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${channelFilter === 'all' ? 'bg-surface-bright text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                      ALL
                    </button>
                    <button 
                      onClick={() => setChannelFilter('whatsapp')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors flex items-center gap-1 ${channelFilter === 'whatsapp' ? 'bg-[#25D366]/10 text-[#128C7E] shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                      <MessageCircle className="w-3 h-3" /> WA
                    </button>
                    <button 
                      onClick={() => setChannelFilter('email')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors flex items-center gap-1 ${channelFilter === 'email' ? 'bg-blue-500/10 text-blue-600 shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                      <Mail className="w-3 h-3" /> EMAIL
                    </button>
                  </div>
                </div>
                
                {filteredEvents?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 bg-surface-bright rounded-xl border border-dashed border-border text-text-disabled">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">No {channelFilter !== 'all' ? channelFilter : ''} conversation history found.</p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-border ml-4 mt-2">
                    {filteredEvents?.map((event: any) => (
                      <div key={event.id} className="mb-6 relative pl-6">
                        <div className={`absolute -left-[17px] top-0.5 flex items-center justify-center w-8 h-8 rounded-full border-4 border-surface ${getIconColor(event)} shadow-sm transition-transform hover:scale-110`}>
                          {renderIcon(event)}
                        </div>
                        
                        <div className="flex flex-col">
                          <span className="text-[11px] font-semibold text-text-secondary mb-0.5">
                            {format(new Date(event.timestamp), "MMM d, h:mm a")}
                          </span>
                          
                          <div className={`mt-1 p-3.5 rounded-xl border ${
                            event.metadata?.channel === 'whatsapp' ? 'bg-[#25D366]/5 border-[#25D366]/20' :
                            event.metadata?.channel === 'email' ? 'bg-blue-500/5 border-blue-500/20' :
                            'bg-surface-bright border-border'
                          }`}>
                            <div className="flex justify-between items-start mb-1.5">
                              <h3 className="text-[13px] font-bold text-text-primary leading-snug">
                                {event.title}
                              </h3>
                              {event.metadata?.status && (
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${
                                  ['delivered', 'read', 'replied'].includes(event.metadata.status) 
                                    ? 'bg-green-500/10 text-green-600'
                                    : event.metadata.status === 'failed'
                                    ? 'bg-red-500/10 text-red-600'
                                    : 'bg-blue-500/10 text-blue-600'
                                }`}>
                                  {event.metadata.status.toUpperCase()}
                                </span>
                              )}
                            </div>
                            
                            {event.description && (
                              <div className="text-[12.5px] text-text-secondary leading-relaxed whitespace-pre-wrap">
                                {event.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatusBadge({ label, icon, isComplete }: { label: string, icon: React.ReactNode, isComplete?: boolean }) {
  if (isComplete) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-success/10 border border-success/20 text-success">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span className="text-[11px] font-bold tracking-tight">{label}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-border text-text-disabled">
      <div className="opacity-50">{icon}</div>
      <span className="text-[11px] font-semibold tracking-tight">{label}</span>
    </div>
  );
}
