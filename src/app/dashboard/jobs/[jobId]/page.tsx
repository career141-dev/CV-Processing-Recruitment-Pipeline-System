"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, Check, Copy, ChevronRight, 
  Users, Layers, FileText, ListTodo, PhoneCall, 
  CheckCircle2, UserCheck, Building2, Video, 
  Award, Star, XCircle, Tag, Calendar, User,
  QrCode, Edit, Download, MoreVertical, ArrowUpDown, Filter, Bot, Info, X,
  Phone, Upload, AlertTriangle, ArrowRight, Clock, Send, ChevronDown, Sparkles, MessageSquarePlus, Trash2, RefreshCw, Plus, Mail, MessageSquare, DollarSign
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useAction, useConvex } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from '../../../../../convex/_generated/dataModel';
import { formatDistanceToNow, format } from 'date-fns';
import { useUser } from '@clerk/nextjs';
import { EditJobModal } from '@/components/jobs/EditJobModal';
import { SendBulkFollowUpModal } from '@/components/outreach/SendBulkFollowUpModal';
import { CandidateTimelineDrawer } from '@/components/candidates/CandidateTimelineDrawer';
import { toast } from 'sonner';
import { useErrorPopup } from "@/components/ui/ErrorPopupProvider";

const PIPELINE_STAGES = [
  { id: "new_cvs", label: "New CVs" },
  { id: "ta_shortlist", label: "TA Shortlisted" },
  { id: "follow_up", label: "Follow-up" },
  { id: "second_shortlist", label: "2nd Shortlist" },
  { id: "director_shortlist", label: "Director Shortlist" },
  { id: "client_review", label: "Client Review" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
  { id: "placed", label: "Placed" },
  { id: "rejected", label: "Rejected" },
];

// Stages that can be manually moved to
const MOVEABLE_STAGES = PIPELINE_STAGES.filter(s => s.id !== "director_shortlist" && s.id !== "client_review");

// AI call status → color config
const AI_CALL_STATUS: Record<string, { label: string; color: string; bg: string; pulse?: boolean }> = {
  scheduled:   { label: "Scheduled",    color: "text-blue-600",   bg: "bg-blue-500/10",   pulse: true },
  in_progress: { label: "In Progress",  color: "text-yellow-600", bg: "bg-yellow-500/10", pulse: true },
  completed:   { label: "Completed",    color: "text-green-600",  bg: "bg-green-500/10" },
  no_answer:   { label: "No Answer",    color: "text-orange-600", bg: "bg-orange-500/10" },
  failed:      { label: "Failed",       color: "text-red-600",    bg: "bg-red-500/10" },
  declined:    { label: "Declined",     color: "text-red-600",    bg: "bg-red-500/10" },
  not_called:  { label: "Not Called",   color: "text-text-secondary", bg: "bg-surface-container" },
};



// Pipeline tab list — Matched Candidates is NOT a pipeline stage;
// it lives in the Matches main tab as a separate entry point.
const TABS = [
  { id: 'New CVs', label: 'New CVs', icon: FileText },
  { id: 'TA Shortlist & Follow-up', label: 'TA Shortlisted & Follow-up', icon: ListTodo },
  { id: '2nd Shortlist', label: 'Second Shortlist', icon: CheckCircle2 },
  { id: 'Director Shortlist', label: 'Director Shortlist', icon: UserCheck },
  { id: 'Client Review', label: 'Client Review', icon: Building2 },
  { id: 'Interview', label: 'Interview', icon: Video },
  { id: 'Offer', label: 'Offer', icon: Award },
  { id: 'Placed', label: 'Placed', icon: Star },
  { id: 'Rejected', label: 'Rejected', icon: XCircle },
];

const ScoreRing = ({ score }: { score: number | string }) => {
  if (score === 'Pending' || score === null || score === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-disabled bg-surface-container px-2 py-1 rounded-full">
        Pending
      </span>
    );
  }
  
  const numScore = typeof score === 'number' ? score : parseInt(String(score).replace('%', ''));
  const colorClass = numScore >= 80 ? 'text-green-500' : numScore >= 60 ? 'text-yellow-500' : 'text-red-500';
  const strokeDasharray = `${numScore}, 100`;

  return (
    <div className="flex items-center gap-3">
      <div className="relative inline-flex items-center justify-center w-8 h-8 shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <path className="text-border" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path className={`${colorClass} transition-all duration-1000 ease-out`} strokeDasharray={strokeDasharray} strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
        <span className={`absolute text-[10px] font-bold ${colorClass}`}>{numScore}</span>
      </div>
    </div>
  );
};

const AiReasonDisplay = ({ reason }: { reason?: string | null }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!reason || reason.trim() === '') {
    return <span className="text-text-disabled italic text-[11px]">No AI match reason generated yet</span>;
  }

  const isLong = reason.length > 90;

  return (
    <div className="text-[12px] text-text-secondary leading-snug max-w-[280px]">
      <div className={isExpanded ? "" : "line-clamp-2"} title={reason}>
        {reason}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-primary hover:underline text-[11px] font-semibold mt-0.5 inline-block"
        >
          {isExpanded ? "See Less" : "See More"}
        </button>
      )}
    </div>
  );
};

const StatusDot = ({ status }: { status: string }) => {
  if (!status) return <span>-</span>;
  const isRed = status.toLowerCase().includes('not called') || status.toLowerCase().includes('rejected');
  const isGreen = status.toLowerCase().includes('good') || status.toLowerCase().includes('placed') || status.toLowerCase().includes('scheduled') || status.toLowerCase().includes('approved');
  const colorClass = isRed ? 'bg-red-500' : isGreen ? 'bg-green-500' : 'bg-yellow-500';
  
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${colorClass} shadow-sm animate-pulse`} />
      <span className="text-[13px] font-medium">{status}</span>
    </div>
  );
};


const CandidateNameDisplay = ({ name, cvUploadId, doNotContact, candidateId }: { name: string, cvUploadId?: Id<"cvUploads"> | null, doNotContact?: boolean, candidateId?: string }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2">
      {candidateId ? (
        <Link href={`/dashboard/candidates/${candidateId}`} className="hover:underline hover:text-primary transition-colors">
          {name}
        </Link>
      ) : name}
      <CvViewButton cvUploadId={cvUploadId} candidateName={name} />
    </div>
    {doNotContact && (
      <span className="w-fit inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20" title="This candidate is blacklisted">
        🚫 Do Not Contact
      </span>
    )}
  </div>
);


const MatchRow = ({ match, jobId, applications, onNavigate }: { match: any, jobId: Id<"jobs">, applications: any[] | undefined, onNavigate: () => void }) => {
  const { showError } = useErrorPopup();
  const candidate = useQuery(api.candidates.candidates.getCandidate, { id: match.cvId as Id<"candidates"> });
  const createApplication = useMutation(api.applications.applications.createApplication);
  const removeApplication = useMutation(api.applications.applications.removeApplication);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isShortlisting, setIsShortlisting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const applicationForCandidate = applications?.find(app => app.candidateId === match.cvId);
  const isAlreadyInPipeline = !!applicationForCandidate;

  const handleShortlist = async () => {
    setIsShortlisting(true);
    try {
      await createApplication({
        candidateId: match.cvId as Id<"candidates">,
        jobId,
        sourceChannel: "database",
      });
      onNavigate();
    } catch (e: any) {
      showError(e, { title: "Shortlist Failed" });
    } finally {
      setIsShortlisting(false);
    }
  };

  const handleRevert = async () => {
    if (!applicationForCandidate) return;
    if (!confirm("Are you sure you want to revert this shortlist? This will remove them from the pipeline for this job.")) return;
    
    setIsShortlisting(true);
    try {
      await removeApplication({ applicationId: applicationForCandidate._id });
    } catch (e: any) {
      showError(e, { title: "Revert Shortlist Failed" });
    } finally {
      setIsShortlisting(false);
    }
  };

  return (
    <>
      <tr className="hover:bg-surface-bright transition-colors group">
        <td className="p-4"><input className="rounded border-border text-primary-container focus:ring-primary-container" type="checkbox" /></td>
        <td className="p-4 font-medium">
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/candidates/${match.cvId}`} className="text-text-primary hover:underline">
              {candidate === undefined && !match.candidateName ? "Loading..." : (candidate?.fullName || candidate?.email || match.candidateName || `Candidate ID: ${match.cvId.slice(0, 8)}...`)}
            </Link>
            <CvViewButton cvUploadId={candidate?.cvUploadId as Id<"cvUploads"> | undefined} />
          </div>
        </td>
        <td className="p-4"><span className="text-[#0A66C2] font-medium">{match.sourceLevel1 || 'Database'}</span></td>
        <td className="p-4"><ScoreRing score={match.overallScore} /></td>
        <td className="p-4 text-[13px]">
          <div className="font-medium text-text-primary truncate max-w-[200px]" title={(candidate as any)?.currentTitle || candidate?.currentJobTitle || match.candidateRole || 'Unknown Role'}>{(candidate as any)?.currentTitle || candidate?.currentJobTitle || match.candidateRole || 'Unknown Role'}</div>
          <div className="text-text-secondary text-xs">{candidate?.totalExperienceYears ? `${candidate.totalExperienceYears} yrs exp` : ((candidate as any)?.experience ? `${(candidate as any).experience} yrs exp` : (match.candidateExp ? `${match.candidateExp} yrs exp` : 'Exp not specified'))}</div>
        </td>
        <td className="p-4">
          <AiReasonDisplay reason={match.reason} />
        </td>
        <td className="p-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {!isAlreadyInPipeline ? (
              <button 
                onClick={handleShortlist}
                disabled={isShortlisting}
                className="text-[12px] font-bold bg-green-600 hover:bg-green-500 text-white px-3.5 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isShortlisting ? "Adding..." : "Add to Shortlist"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={onNavigate}
                  className="text-[12px] font-medium text-green-600 bg-green-500/10 hover:bg-green-500/20 px-2 py-1.5 rounded-[6px] flex items-center gap-1 border border-green-500/20 transition-colors"
                  title="View in Pipeline"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Added to Matched
                </button>
                <button 
                  onClick={handleRevert}
                  disabled={isShortlisting}
                  className="text-text-secondary hover:text-error hover:bg-error/10 p-1.5 rounded-[6px] transition-colors"
                  title="Remove from Pipeline"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && match.reason && (
        <tr className="bg-surface-bright border-b border-border">
          <td colSpan={7} className="p-4 px-12">
            <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
              <Bot className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <p className="whitespace-pre-wrap leading-relaxed text-[13.5px] text-green-900 dark:text-green-300">
                <strong className="font-medium block mb-1">AI Reasoning:</strong>
                {match.reason}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const CvViewButton = ({ cvUploadId, candidateName }: { cvUploadId?: Id<"cvUploads"> | null, candidateName?: string }) => {
  const cvUpload = useQuery(api.candidates.candidates.getCvUploadUrl, cvUploadId ? { cvUploadId } : "skip");
  const [isOpen, setIsOpen] = useState(false);
  
  if (!cvUploadId) return (
    <button disabled className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] border border-border bg-surface/50 text-text-disabled text-[11px] font-medium" title="No CV attached">
      <FileText className="w-3 h-3" />
      View CV
    </button>
  );
  
  if (cvUpload === undefined) return (
    <button disabled className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] border border-border bg-surface/50 text-text-disabled text-[11px] font-medium animate-pulse">
      <FileText className="w-3 h-3" />
      View CV
    </button>
  );
  
  if (cvUpload?.isMissingMigrationFile || (!cvUpload?.url && cvUpload !== undefined)) return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        alert(`Cloud Migration Notice:\n\nThis candidate's database profile and AI matching scores are 100% active, but their historical binary CV file was not transferred during the Cloud-to-Self-Hosted Convex migration.\n\nFile access will be enabled automatically as soon as historical storage files are transferred over.`);
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
      title="CV file pending cloud migration transfer. Click for details."
    >
      <FileText className="w-3 h-3 text-amber-600" />
      <span>Pending Migration</span>
      <Info className="w-3 h-3 text-amber-600 ml-0.5" />
    </button>
  );
  
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] border border-border bg-surface hover:bg-surface-container transition-colors text-[11px] font-medium text-text-secondary hover:text-text-primary whitespace-nowrap"
        title="View CV"
      >
        <FileText className="w-3 h-3" />
        View CV
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative flex flex-col bg-surface rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-bright shrink-0">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-[14px] font-semibold text-text-primary">
                  {candidateName ? `${candidateName}'s CV` : 'Candidate CV'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {cvUpload?.url && (
                  <a
                    href={cvUpload.url.replace(/^http:\/\/(127\.0\.0\.1|localhost|convex)(:\d+)?/, process.env.NEXT_PUBLIC_CONVEX_URL || "https://api.career141.com")}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-secondary hover:text-primary transition-colors px-3 py-1.5 rounded-[6px] border border-border hover:bg-surface-container"
                    onClick={(e) => e.stopPropagation()}
                  >
                    ↗ Open in new tab
                  </a>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-surface-container transition-colors text-text-secondary hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* CV iframe */}
            <div className="flex-1 overflow-hidden">
              {cvUpload?.url ? (
                <iframe
                  src={`${cvUpload.url.replace(/^http:\/\/(127\.0\.0\.1|localhost|convex)(:\d+)?/, process.env.NEXT_PUBLIC_CONVEX_URL || "https://api.career141.com")}#toolbar=1&view=FitH&target=_blank`}
                  className="w-full h-full border-0"
                  title="CV Preview"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-forms"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-text-secondary text-sm">
                  <span>No CV file available for preview.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};


const MatchedCandidateRow = ({ item, renderKanbanDropdown }: { item: any, renderKanbanDropdown: any }) => {
  const { showError } = useErrorPopup();
  const { user } = useUser();
  const [isLoggingCall, setIsLoggingCall] = useState(false);
  const [outcome, setOutcome] = useState<string>('');
  const [currentSalary, setCurrentSalary] = useState(item.currentSalary !== '—' ? item.currentSalary : '');
  const [expectedSalary, setExpectedSalary] = useState(item.expectedSalary !== '—' ? item.expectedSalary : '');
  const [noticePeriod, setNoticePeriod] = useState(item.noticePeriod !== '—' ? item.noticePeriod : '');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
  const logManualCall = useMutation(api.applications.applications.logManualCall);
  const setPipelineStage = useMutation(api.pipeline.stages.setPipelineStage);
  const generateUploadUrl = useAction(api.storage.r2.generateUploadUrl);
  const saveUpload = useMutation(api.cvs.cvUploads.saveUpload);

  const isCallLogged = item.manualCallOutcome === "Interested";
  const hasOutcome = !!item.manualCallOutcome;

  const handleSaveLog = async () => {
    setIsSaving(true);
    try {
      const parsedCurrentSalary = currentSalary ? parseFloat(currentSalary.replace(/[^0-9.]/g, '')) : undefined;
      const parsedExpectedSalary = expectedSalary ? parseFloat(expectedSalary.replace(/[^0-9.]/g, '')) : undefined;
      const parsedNoticePeriod = noticePeriod ? parseInt(noticePeriod.replace(/[^0-9]/g, '')) : undefined;

      let cvUploadId: Id<"cvUploads"> | undefined = undefined;
      if (cvFile && user?.id) {
        let { url: uploadUrl, key: s3Key } = await generateUploadUrl({ fileName: cvFile.name, contentType: cvFile.type });
        const resp = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": cvFile.type }, body: cvFile });
        
        let cvUploadId = await saveUpload({
          s3Key,
          storageProvider: "r2",
          fileName: cvFile.name,
          fileSize: cvFile.size,
          fileType: cvFile.type,
          source: "Manual",
          uploadedBy: user.id,
        });
      }

      await logManualCall({
        applicationId: item.id,
        candidateId: item.candidateId,
        outcome,
        currentSalary: isNaN(parsedCurrentSalary as number) ? undefined : parsedCurrentSalary,
        expectedSalary: isNaN(parsedExpectedSalary as number) ? undefined : parsedExpectedSalary,
        noticePeriodDays: isNaN(parsedNoticePeriod as number) ? undefined : parsedNoticePeriod,
        cvUploadId,
      });
      setIsLoggingCall(false);
      setCvFile(null);
    } catch (e: any) {
      showError(e, { title: "Failed to Save Call Log" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveToFollowUp = async () => {
    try {
      await setPipelineStage({ applicationId: item.id, newStage: "follow_up" });
    } catch (e: any) {
      showError(e, { title: "Stage Transition Failed" });
    }
  };

  const handleReject = () => {
    const reason = window.prompt("Rejection reason:");
    if (reason) {
      setPipelineStage({ applicationId: item.id, newStage: "rejected" });
      // In a real app we'd also call a reject mutation to save the reason.
      // We can rely on the newly created rejectApplication mutation.
    }
  };

  return (
    <tr className="hover:bg-surface-bright transition-colors group border-b border-border">
      <td className="p-4 font-medium align-top">
        <div className="flex flex-col gap-1">
          <CandidateNameDisplay name={item.name} cvUploadId={item.cvUploadId} doNotContact={item.doNotContact} candidateId={item.candidateId} />
          <span className="text-[11px] text-text-secondary font-normal">
            Match: {item.score} • Database Candidate
          </span>
        </div>
      </td>
      
      <td className="p-4 align-top">
        {!isLoggingCall ? (
          <div className="flex flex-col gap-1">
            {hasOutcome ? (
              <div className="text-[12px] text-text-primary">
                <span className="inline-flex items-center gap-1 text-green-600 font-medium mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Logged — {item.manualCallOutcome}
                </span>
                {item.manualCallOutcome === "Interested" && (
                  <div className="text-text-secondary">
                    Salary: {item.expectedSalary} • Notice: {item.noticePeriod}
                  </div>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-text-secondary text-[12px]">
                <div className="w-2 h-2 rounded-full border border-text-tertiary" /> Not yet logged
              </span>
            )}
            
            {!hasOutcome && (
              <button 
                onClick={() => setIsLoggingCall(true)}
                className="mt-2 text-[12px] font-medium bg-surface-container hover:bg-border text-text-primary px-3 py-1.5 rounded-[6px] w-fit transition-colors border border-border"
              >
                Log Call
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 bg-surface-container p-3 rounded-lg border border-border mt-1">
            <select 
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
              className="bg-surface border border-border rounded px-2 py-1.5 text-[12px] focus:outline-none focus:border-primary-container"
            >
              <option value="" disabled>Select Outcome...</option>
              <option value="Interested">Interested</option>
              <option value="Not Interested">Not Interested</option>
              <option value="No Answer">No Answer</option>
            </select>
            
            {outcome === "Interested" && (
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Current Salary" className="bg-surface border border-border rounded px-2 py-1.5 text-[12px] focus:outline-none focus:border-primary-container" value={currentSalary} onChange={e => setCurrentSalary(e.target.value)} />
                <input type="text" placeholder="Expected Salary" className="bg-surface border border-border rounded px-2 py-1.5 text-[12px] focus:outline-none focus:border-primary-container" value={expectedSalary} onChange={e => setExpectedSalary(e.target.value)} />
                <input type="text" placeholder="Notice Period" className="bg-surface border border-border rounded px-2 py-1.5 text-[12px] focus:outline-none focus:border-primary-container col-span-2" value={noticePeriod} onChange={e => setNoticePeriod(e.target.value)} />
                
                <div className="col-span-2 mt-1">
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary mb-1.5">
                    <Upload className="w-3.5 h-3.5" /> Upload New CV (Optional)
                  </label>
                  <input 
                    type="file" 
                    onChange={e => setCvFile(e.target.files?.[0] || null)}
                    className="w-full text-[11px] text-text-secondary file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-surface-container-high file:text-text-primary hover:file:bg-border transition-colors cursor-pointer" 
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-1">
              <button 
                onClick={() => setIsLoggingCall(false)}
                className="text-[11px] font-medium text-text-secondary hover:text-text-primary px-2 py-1"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveLog} 
                disabled={isSaving || !outcome}
                className="text-[11px] font-medium bg-primary text-on-primary px-3 py-1.5 rounded-[4px] hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isSaving ? "Saving..." : "Save Log"}
              </button>
            </div>
          </div>
        )}
      </td>
      
      <td className="p-4 align-top">
        <AiReasonDisplay reason={item.scoreReason} />
      </td>
      
      <td className="p-4 text-right align-top">
        <div className="flex flex-col items-end gap-2">
          <button
            disabled={!isCallLogged}
            onClick={handleMoveToFollowUp}
            className={`text-[12px] font-medium px-4 py-2 rounded-[6px] transition-all shadow-sm ${
              isCallLogged 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-surface-container text-text-disabled cursor-not-allowed border border-border'
            }`}
          >
            Move to Follow-up
          </button>
          
          <button 
            onClick={handleReject}
            className="text-[12px] font-medium text-text-secondary hover:text-error px-4 py-1.5 rounded-[6px] transition-colors"
          >
            Reject
          </button>
        </div>
      </td>
    </tr>
  );
};

const LogManualCallCard = ({
  candidateName,
  outcome,
  setOutcome,
  currentSalary,
  setCurrentSalary,
  expectedSalary,
  setExpectedSalary,
  noticePeriod,
  setNoticePeriod,
  customFields,
  setCustomFields,
  cvFile,
  setCvFile,
  isSaving,
  onCancel,
  onSave,
}: {
  candidateName: string;
  outcome: string;
  setOutcome: (val: string) => void;
  currentSalary: string;
  setCurrentSalary: (val: string) => void;
  expectedSalary: string;
  setExpectedSalary: (val: string) => void;
  noticePeriod: string;
  setNoticePeriod: (val: string) => void;
  customFields: { key: string; value: string }[];
  setCustomFields: (val: { key: string; value: string }[]) => void;
  cvFile: File | null;
  setCvFile: (file: File | null) => void;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) => {
  return (
    <div className="bg-surface rounded-2xl border border-amber-300/40 dark:border-amber-700/50 p-5 shadow-lg relative overflow-hidden transition-all animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Top Banner Accent */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-300/30">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
              Log Manual Call Outcome
            </h4>
            <p className="text-xs text-text-secondary">
              Record conversation response for <span className="font-semibold text-text-primary">{candidateName}</span>
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-bright transition-colors cursor-pointer"
          title="Close Form"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Outcome Selection Buttons */}
      <div className="mb-5">
        <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
          Call Outcome <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setOutcome("Interested")}
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
              outcome === "Interested"
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20 shadow-xs"
                : "bg-surface border-border text-text-secondary hover:bg-surface-bright hover:border-text-tertiary"
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 ${outcome === "Interested" ? "text-emerald-500" : "text-text-tertiary"}`} />
            <div className="text-left">
              <div className="font-bold">Interested</div>
              <div className="text-[10px] opacity-75 font-normal">Advance to 2nd Shortlist</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOutcome("Not Interested")}
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
              outcome === "Not Interested"
                ? "bg-red-500/10 border-red-500 text-red-700 dark:text-red-400 ring-2 ring-red-500/20 shadow-xs"
                : "bg-surface border-border text-text-secondary hover:bg-surface-bright hover:border-text-tertiary"
            }`}
          >
            <XCircle className={`w-4 h-4 ${outcome === "Not Interested" ? "text-red-500" : "text-text-tertiary"}`} />
            <div className="text-left">
              <div className="font-bold">Not Interested</div>
              <div className="text-[10px] opacity-75 font-normal">Move to Rejected</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOutcome("No Answer")}
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
              outcome === "No Answer"
                ? "bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400 ring-2 ring-amber-500/20 shadow-xs"
                : "bg-surface border-border text-text-secondary hover:bg-surface-bright hover:border-text-tertiary"
            }`}
          >
            <Clock className={`w-4 h-4 ${outcome === "No Answer" ? "text-amber-500" : "text-text-tertiary"}`} />
            <div className="text-left">
              <div className="font-bold">No Answer</div>
              <div className="text-[10px] opacity-75 font-normal">Keep in Follow-up</div>
            </div>
          </button>
        </div>
      </div>

      {/* Interested Details Fields */}
      {outcome === "Interested" && (
        <div className="space-y-4 pt-3 border-t border-border/60 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <span>Update Mandatory Candidate Requirements</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Current Salary */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                Current Salary
              </label>
              <div className="relative rounded-lg shadow-xs">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-xs text-text-tertiary font-medium">
                  $
                </span>
                <input
                  type="text"
                  placeholder="50,000"
                  value={currentSalary}
                  onChange={(e) => setCurrentSalary(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                />
              </div>
            </div>

            {/* Expected Salary */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                Expected Salary
              </label>
              <div className="relative rounded-lg shadow-xs">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-xs text-text-tertiary font-medium">
                  $
                </span>
                <input
                  type="text"
                  placeholder="60,000"
                  value={expectedSalary}
                  onChange={(e) => setExpectedSalary(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                />
              </div>
            </div>

            {/* Notice Period */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                Notice Period (Days)
              </label>
              <div className="relative rounded-lg shadow-xs">
                <input
                  type="text"
                  placeholder="30"
                  value={noticePeriod}
                  onChange={(e) => setNoticePeriod(e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                />
                <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[10px] text-text-tertiary font-semibold uppercase">
                  Days
                </span>
              </div>
            </div>
          </div>

          {/* Custom Additional Fields */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                <span>Additional Notes & Fields</span>
              </label>
              <button
                type="button"
                onClick={() => setCustomFields([...customFields, { key: '', value: '' }])}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Custom Field
              </button>
            </div>

            {customFields.map((field, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <input
                  type="text"
                  placeholder="Field Name (e.g. Reason for Leaving)"
                  value={field.key}
                  onChange={(e) => {
                    const newFields = [...customFields];
                    newFields[idx].key = e.target.value;
                    setCustomFields(newFields);
                  }}
                  className="flex-1 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={field.value}
                  onChange={(e) => {
                    const newFields = [...customFields];
                    newFields[idx].value = e.target.value;
                    setCustomFields(newFields);
                  }}
                  className="flex-1 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newFields = [...customFields];
                    newFields.splice(idx, 1);
                    setCustomFields(newFields);
                  }}
                  className="p-1.5 text-text-tertiary hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Stylized File Upload Box */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-text-secondary mb-1.5">
              Upload Updated CV (Optional)
            </label>
            <div className="p-3 bg-surface border border-dashed border-border hover:border-amber-500/50 rounded-xl transition-all flex items-center gap-3">
              <Upload className="w-5 h-5 text-amber-500 shrink-0" />
              <input
                type="file"
                onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-text-secondary file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-500/10 file:text-amber-700 dark:file:text-amber-300 hover:file:bg-amber-500/20 transition-colors cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer Buttons */}
      <div className="flex items-center justify-end gap-2.5 mt-5 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-bright transition-colors cursor-pointer"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || !outcome}
          className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white transition-all disabled:opacity-50 shadow-sm cursor-pointer flex items-center gap-1.5"
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Saving Call Log...
            </>
          ) : (
            <>
              <Phone className="w-3.5 h-3.5" />
              Save Call Log
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const FollowUpCandidateRow = ({ item, renderKanbanDropdown, api, convex, showError, setTimelineAppId, triggerWhatsAppFollowUp, triggerEmailFollowUp }: any) => {
  const { user } = useUser();
  const [isLoggingCall, setIsLoggingCall] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [currentSalary, setCurrentSalary] = useState(item.currentSalary !== '—' ? item.currentSalary : '');
  const [expectedSalary, setExpectedSalary] = useState(item.expectedSalary !== '—' ? item.expectedSalary : '');
  const [noticePeriod, setNoticePeriod] = useState(item.noticePeriod !== '—' ? item.noticePeriod : '');
  const [customFields, setCustomFields] = useState<{key: string, value: string}[]>([]);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sendingWhatsAppId, setSendingWhatsAppId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

  const logManualCall = useMutation(api.applications.applications.logManualCall);
  const generateUploadUrl = useAction(api.storage.r2.generateUploadUrl);
  const saveUpload = useMutation(api.cvs.cvUploads.saveUpload);

  const handleSaveLog = async () => {
    setIsSaving(true);
    try {
      const parseField = (val: string | number) => {
        if (!val) return undefined;
        const str = String(val).trim();
        // If it only contains numbers, commas, and dots, parse it as a number
        if (/^[\d,.]+$/.test(str)) {
          const num = parseFloat(str.replace(/,/g, ''));
          return isNaN(num) ? str : num;
        }
        return str; // Otherwise keep it as a string
      };

      const finalCurrentSalary = parseField(currentSalary);
      const finalExpectedSalary = parseField(expectedSalary);
      const finalNoticePeriod = parseField(noticePeriod);

      let cvUploadId: any = undefined;
      if (cvFile && user?.id) {
        let { url: uploadUrl, key: s3Key } = await generateUploadUrl({ fileName: cvFile.name, contentType: cvFile.type });
        const resp = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": cvFile.type }, body: cvFile });
        if (!resp.ok) throw new Error(`Failed to upload to R2: ${resp.status} ${resp.statusText}`);
        cvUploadId = await saveUpload({
          s3Key, storageProvider: "r2", fileName: cvFile.name, fileSize: cvFile.size, fileType: cvFile.type, source: "Manual", uploadedBy: user.id,
        });
      }

      await logManualCall({
        applicationId: item.id,
        candidateId: item.candidateId,
        outcome: outcome as any,
        currentSalary: finalCurrentSalary,
        expectedSalary: finalExpectedSalary,
        noticePeriodDays: typeof finalNoticePeriod === 'number' ? finalNoticePeriod : undefined,
        cvUploadId,
        customFields: customFields.filter(f => f.key.trim() && f.value.trim()),
      });

      toast.success("Call log saved successfully!");
      setIsLoggingCall(false);
    } catch (err: any) {
      console.error(err);
      showError(err, { title: "Failed to Save Call Log" });
    } finally {
      setIsSaving(false);
    }
  };

  const daysInStage = Math.floor((item.timeInStageRaw || 0) / (1000 * 60 * 60 * 24));
  const daysLeft = item.followUpEnteredAt ? Math.max(0, 7 - Math.floor((Date.now() - item.followUpEnteredAt) / (1000 * 60 * 60 * 24))) : 7;
  const isDbMatch = item.isDbMatch || false;
  const hasCV = item.followUpCvReceived === true || !!item.cvUploadId || !!item.candidate?.cvUploadId;
  const hasCurrentSalary = item.followUpCurrentSalary === true || (item.candidate?.currentSalary !== undefined && item.candidate?.currentSalary !== null) || (item.currentSalary !== undefined && item.currentSalary !== '—' && item.currentSalary !== null);
  const hasExpectedSalary = item.followUpExpectedSalary === true || (item.candidate?.expectedSalary !== undefined && item.candidate?.expectedSalary !== null) || (item.expectedSalary !== undefined && item.expectedSalary !== '—' && item.expectedSalary !== null);
  const hasNoticePeriod = item.followUpNoticePeriod === true || (item.candidate?.noticePeriodDays !== undefined && item.candidate?.noticePeriodDays !== null) || (item.noticePeriod !== undefined && item.noticePeriod !== '—' && item.noticePeriod !== null);
  const allComplete = item.followUpCvReceived && item.followUpCurrentSalary && item.followUpExpectedSalary && item.followUpNoticePeriod;

  const flagItem = (label: string, done: boolean, value?: any) => {
    const rawVal = value !== undefined && value !== null && value !== '—' && value !== '' ? String(value).trim() : '';
    let displayVal = rawVal;
    
    if (rawVal && !rawVal.includes('$') && label.includes('Salary') && !isNaN(Number(rawVal.replace(/,/g, '')))) {
      displayVal = '$' + Number(rawVal.replace(/,/g, '')).toLocaleString();
    } else if (rawVal && label.includes('Notice') && !rawVal.toLowerCase().includes('day') && !isNaN(Number(rawVal))) {
      displayVal = rawVal + ' days';
    }

    // When done=true but no actual value captured (e.g. test seeded flag or AI-only flag)
    const badgeLabel = displayVal || (done ? '✓ Received' : '');
    const tooltipValue = displayVal || (done ? 'Flagged as received — exact value not stored as text' : 'Missing / Pending');

    return (
      <div 
        className="group/flag relative flex items-center gap-1.5 text-[11px] cursor-help w-fit py-0.5"
        title={`${label}: ${tooltipValue}`}
      >
        {done ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
        )}
        <span className={done ? 'text-green-700 dark:text-green-400 font-medium' : 'text-orange-600 font-medium'}>
          {label}
        </span>
        {done && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border max-w-[140px] truncate ${displayVal ? 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20' : 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20'}`} title={`${label}: ${tooltipValue}`}>
            {badgeLabel}
          </span>
        )}

        {/* Hover Tooltip Card */}
        <div className="absolute left-0 bottom-full mb-1 hidden group-hover/flag:flex flex-col bg-gray-900 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-xl z-50 whitespace-nowrap pointer-events-none border border-gray-700">
          <span className="text-gray-400 text-[9px] uppercase font-bold tracking-wider">{label}</span>
          <span className={`font-semibold text-[12px] ${displayVal ? 'text-white' : 'text-gray-400 italic'}`}>
            {tooltipValue}
          </span>
        </div>
      </div>
    );
  };

  if (isLoggingCall) {
    return (
      <tr className="border-b border-border bg-surface-bright/30">
        <td colSpan={6} className="p-4">
          <LogManualCallCard
            candidateName={item.name}
            outcome={outcome}
            setOutcome={setOutcome}
            currentSalary={currentSalary}
            setCurrentSalary={setCurrentSalary}
            expectedSalary={expectedSalary}
            setExpectedSalary={setExpectedSalary}
            noticePeriod={noticePeriod}
            setNoticePeriod={setNoticePeriod}
            customFields={customFields}
            setCustomFields={setCustomFields}
            cvFile={cvFile}
            setCvFile={setCvFile}
            isSaving={isSaving}
            onCancel={() => setIsLoggingCall(false)}
            onSave={handleSaveLog}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className={`hover:bg-surface-bright transition-colors group ${allComplete ? 'bg-green-500/5' : ''}`}>
      <td className="p-4 font-medium align-top">
        <CandidateNameDisplay name={item.name} cvUploadId={item.cvUploadId} doNotContact={item.doNotContact} candidateId={item.candidateId} />
        {allComplete && (
          <div className="mt-1 text-[10px] text-green-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> All complete — advancing to 2nd Shortlist
          </div>
        )}
      </td>
      <td className="p-4 align-top">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isDbMatch ? 'bg-blue-500/10 text-blue-600' : 'bg-green-500/10 text-green-600'}`}>
          {isDbMatch ? 'DB Match' : 'External'}
        </span>
      </td>
      <td className="p-4 align-top">
        {(() => {
          const lastDay = item.followUpState?.lastContactDay ?? -1;
          const contactStatus =
            lastDay === -1 ? { label: 'Not Contacted Yet', sub: 'Awaiting sequence start', color: 'bg-surface-container text-text-secondary', dot: 'bg-text-secondary/30' }
            : lastDay === 0 ? { label: '1st Outreach Sent', sub: 'WhatsApp + Email — Day 1', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' }
            : lastDay === 4 ? { label: '2nd Reminder Sent', sub: 'WhatsApp + Email — Day 5', color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' }
            : lastDay === 6 ? { label: 'Final Reminder Sent', sub: 'WhatsApp + Email — Day 7', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400', dot: 'bg-orange-500 animate-pulse' }
            : { label: `Day ${lastDay} Contacted`, sub: 'WhatsApp + Email', color: 'bg-surface-container text-text-secondary', dot: 'bg-text-secondary/50' };

          return (
            <div className="flex flex-col gap-1">
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full w-fit ${contactStatus.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${contactStatus.dot}`} />
                {contactStatus.label}
              </span>
              <span className="text-[10px] text-text-secondary pl-1 flex items-center gap-1">
                {contactStatus.sub}
              </span>
            </div>
          );
        })()}
      </td>
      <td className="p-4 align-top">
        {(() => {
          // Read from candidate profile (set by logManualCall when value is numeric)
          const candidateObj = (item as any).candidate;
          const customCallData = candidateObj?.customCallData || {};

          // For each field: try raw number first, then customCallData string notes
          const actualCurrentSalary = 
            (item as any).rawCurrentSalary ??
            customCallData['Current Salary (Note)'] ??
            ((item.currentSalary && item.currentSalary !== '—') ? item.currentSalary : undefined);

          const actualExpectedSalary = 
            (item as any).rawExpectedSalary ??
            customCallData['Expected Salary (Note)'] ??
            ((item.expectedSalary && item.expectedSalary !== '—') ? item.expectedSalary : undefined);

          const rawNotice = 
            (item as any).rawNoticePeriodDays ??
            customCallData['Notice Period (Note)'] ??
            ((item.noticePeriod && item.noticePeriod !== '—') ? item.noticePeriod : undefined);

          return (
            <div className="flex flex-col gap-1">
              {flagItem('CV', hasCV, item.cvUploadId ? 'CV Uploaded' : candidateObj?.cvUploadId ? 'CV Attached' : undefined)}
              {flagItem('Current Salary', hasCurrentSalary, actualCurrentSalary)}
              {flagItem('Expected Salary', hasExpectedSalary, actualExpectedSalary)}
              {flagItem('Notice Period', hasNoticePeriod, rawNotice)}
            </div>
          );
        })()}
      </td>
      <td className="p-4 align-top">
        <div className={`inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-full ${
          daysLeft <= 1 ? 'bg-error/10 text-error' :
          daysLeft <= 3 ? 'bg-yellow-500/10 text-yellow-600' :
          'bg-surface-container text-text-secondary'
        }`}>
          <Clock className="w-3 h-3" />
          {daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}
        </div>
      </td>
      <td className="p-4 text-right align-top">
        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
          {/* Log Call Icon Button */}
          <button
            onClick={() => setIsLoggingCall(true)}
            className="p-2 h-8 w-8 inline-flex items-center justify-center bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-300/40 dark:border-amber-700/50 rounded-lg transition-all shadow-xs cursor-pointer shrink-0"
            title="Log Call Outcome"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Send WhatsApp Icon Button */}
          <button
            disabled={sendingWhatsAppId === item.id}
            onClick={async () => {
              setSendingWhatsAppId(item.id);
              try {
                const result = await triggerWhatsAppFollowUp({ applicationId: item.id });
                if (result?.communicationId) {
                  let isSent = false;
                  let errorMessage = "";
                  for (let i = 0; i < 5; i++) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    const statusRes = await convex.query(api.pipeline.outreach.getCommunicationStatus, { communicationId: result.communicationId });
                    if (statusRes) {
                      if (statusRes.deliveryStatus === "sent") { isSent = true; break; }
                      else if (statusRes.deliveryStatus === "failed") { errorMessage = statusRes.errorMessage || "Unknown error"; break; }
                    }
                  }
                  if (isSent) { toast.success("WhatsApp follow-up sent successfully!"); }
                  else if (errorMessage) { showError(new Error(errorMessage), { title: "WhatsApp Delivery Failed" }); }
                  else { toast.info("WhatsApp follow-up is queued. It should deliver shortly."); }
                } else {
                  toast.success("WhatsApp follow-up initiated successfully!");
                }
              } catch (err: any) {
                console.error(err); showError(err, { title: "Failed to Send WhatsApp" });
              } finally {
                setSendingWhatsAppId(null);
              }
            }}
            className="p-2 h-8 w-8 inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all disabled:opacity-50 shadow-xs cursor-pointer shrink-0"
            title="Send WhatsApp Message"
          >
            <MessageSquare className={`w-4 h-4 ${sendingWhatsAppId === item.id ? 'animate-pulse' : ''}`} />
          </button>

          {/* Send Email Icon Button */}
          <button
            disabled={sendingEmailId === item.id}
            onClick={async () => {
              setSendingEmailId(item.id);
              try {
                const result = await triggerEmailFollowUp({ applicationId: item.id });
                if (result?.communicationId) {
                  let isSent = false;
                  let errorMessage = "";
                  for (let i = 0; i < 5; i++) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    const statusRes = await convex.query(api.pipeline.outreach.getCommunicationStatus, { communicationId: result.communicationId });
                    if (statusRes) {
                      if (statusRes.deliveryStatus === "sent") { isSent = true; break; }
                      else if (statusRes.deliveryStatus === "failed") { errorMessage = statusRes.errorMessage || "Unknown error"; break; }
                    }
                  }
                  if (isSent) { toast.success("Email follow-up sent successfully!"); }
                  else if (errorMessage) { showError(new Error(errorMessage), { title: "Email Delivery Failed" }); }
                  else { toast.info("Email follow-up is queued. It should deliver shortly."); }
                } else {
                  toast.success("Email follow-up initiated successfully!");
                }
              } catch (err: any) {
                console.error(err); showError(err, { title: "Failed to Send Email" });
              } finally {
                setSendingEmailId(null);
              }
            }}
            className="p-2 h-8 w-8 inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50 shadow-xs cursor-pointer shrink-0"
            title="Send Email Message"
          >
            <Mail className={`w-4 h-4 ${sendingEmailId === item.id ? 'animate-pulse' : ''}`} />
          </button>

          {/* View Timeline Icon Button */}
          <button
            onClick={() => setTimelineAppId(item.id)}
            className="p-2 h-8 w-8 inline-flex items-center justify-center bg-surface-container hover:bg-surface-container-high border border-border rounded-lg text-text-secondary hover:text-text-primary transition-all shadow-xs cursor-pointer shrink-0"
            title="View Candidate Timeline"
          >
            <Clock className="w-4 h-4" />
          </button>

          {/* Stage Change Dropdown */}
          {renderKanbanDropdown(item.id, 'follow_up')}

          {/* Clear Test Details Helper Button */}
          <button
            onClick={async () => {
              try {
                const targetCandidateId = item.candidateId || item.candidate?._id;
                if (!targetCandidateId) {
                  toast.error("Candidate ID missing on record");
                  return;
                }
                await convex.mutation(api.admin.qaTests.resetCandidateTestDetails, {
                  candidateId: targetCandidateId,
                  applicationId: item.id,
                });
                toast.success("Cleared salary & notice period fields for testing!");
              } catch (err: any) {
                console.error(err);
                toast.error("Failed to clear details: " + (err.message || "Error"));
              }
            }}
            className="p-2 h-8 w-8 inline-flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-300/40 dark:border-red-700/50 rounded-lg transition-all shadow-xs cursor-pointer shrink-0"
            title="Clear Salary & Notice Details to re-test follow-up"
          >
            <RefreshCw className="w-4 h-4 text-red-500" />
          </button>
        </div>
        
        <div className="mt-1">
          <button
            onClick={async () => {
              try {
                const targetCandidateId = item.candidateId || item.candidate?._id;
                if (!targetCandidateId) {
                  toast.error("Candidate ID missing on record");
                  return;
                }
                await convex.mutation(api.admin.qaTests.resetCandidateTestDetails, {
                  candidateId: targetCandidateId,
                  applicationId: item.id,
                });
                toast.success("Cleared salary & notice period fields for testing!");
              } catch (err: any) {
                console.error(err);
                toast.error("Failed to clear details: " + (err.message || "Error"));
              }
            }}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-600 hover:underline transition-all cursor-pointer"
            title="Clear Salary & Notice Details to re-test follow-up"
          >
            <RefreshCw className="w-3 h-3" /> Clear Test Details
          </button>
        </div>
      </td>
    </tr>
  );
};


const UnresponsiveCandidateRow = ({ u, api, onViewTimeline }: { u: any, api: any, onViewTimeline: (id: Id<"applications">) => void }) => {
  const { showError } = useErrorPopup();
  const { user } = useUser();
  const [isLoggingCall, setIsLoggingCall] = useState(false);
  const [outcome, setOutcome] = useState<string>('');
  const [currentSalary, setCurrentSalary] = useState(u.currentSalary != null ? u.currentSalary : '');
  const [expectedSalary, setExpectedSalary] = useState(u.expectedSalary != null ? u.expectedSalary : '');
  const [noticePeriod, setNoticePeriod] = useState(u.noticePeriodDays != null ? u.noticePeriodDays : '');
  const [customFields, setCustomFields] = useState<{key: string, value: string}[]>([]);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const logManualCall = useMutation(api.applications.applications.logManualCall);
  const generateUploadUrl = useAction(api.storage.r2.generateUploadUrl);
  const saveUpload = useMutation(api.cvs.cvUploads.saveUpload);

  const handleSaveLog = async () => {
    setIsSaving(true);
    try {
      const parseField = (val: string | number) => {
        if (!val) return undefined;
        const str = String(val).trim();
        if (/^[\d,.]+$/.test(str)) {
          const num = parseFloat(str.replace(/,/g, ''));
          return isNaN(num) ? str : num;
        }
        return str;
      };

      const finalCurrentSalary = parseField(currentSalary);
      const finalExpectedSalary = parseField(expectedSalary);
      const finalNoticePeriod = parseField(noticePeriod);

      let cvUploadId: Id<"cvUploads"> | undefined = undefined;
      if (cvFile && user?.id) {
        let { url: uploadUrl, key: s3Key } = await generateUploadUrl({ fileName: cvFile.name, contentType: cvFile.type });
        const resp = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": cvFile.type }, body: cvFile });
        if (!resp.ok) {
          throw new Error(`Failed to upload to R2: ${resp.status} ${resp.statusText}`);
        }
        
        cvUploadId = await saveUpload({
          s3Key,
          storageProvider: "r2",
          fileName: cvFile.name,
          fileSize: cvFile.size,
          fileType: cvFile.type,
          source: "Manual",
          uploadedBy: user.id,
        });
      }

      await logManualCall({
        applicationId: u.applicationId,
        candidateId: u.candidateId,
        outcome,
        currentSalary: finalCurrentSalary,
        expectedSalary: finalExpectedSalary,
        noticePeriodDays: finalNoticePeriod,
        customCallFields: customFields.length > 0 ? customFields : undefined,
        cvUploadId,
      });
      setIsLoggingCall(false);
      setCvFile(null);
    } catch (e: any) {
      showError(e, { title: "Failed to Save Call Log" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoggingCall) {
    return (
      <tr className="hover:bg-surface-container/50 transition-colors border-b border-border">
        <td className="p-4">
          <Link
            href={`/dashboard/candidates/${u.candidateId}`}
            className="font-semibold text-text-primary hover:text-primary transition-colors hover:underline"
          >
            {u.candidateName}
          </Link>
        </td>
        <td className="p-4">
          {u.candidatePhone ? (
            <a
              href={`tel:${u.candidatePhone}`}
              className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline"
            >
              <Phone className="w-3.5 h-3.5" />
              {u.candidatePhone}
            </a>
          ) : (
            <span className="text-text-secondary">—</span>
          )}
        </td>
        <td className="p-4">
          {u.hasCurrentSalary ? (
            <span className="text-[13px] font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {u.currentSalary != null ? u.currentSalary : "Received"}
            </span>
          ) : (
            <span className="text-[11px] font-semibold bg-error/10 text-error px-2 py-0.5 rounded-full">Not received</span>
          )}
        </td>
        <td className="p-4">
          {u.hasExpectedSalary ? (
            <span className="text-[13px] font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {u.expectedSalary != null ? u.expectedSalary : "Received"}
            </span>
          ) : (
            <span className="text-[11px] font-semibold bg-error/10 text-error px-2 py-0.5 rounded-full">Not received</span>
          )}
        </td>
        <td className="p-4">
          {u.hasNoticePeriod ? (
            <span className="text-[13px] font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {u.noticePeriodDays != null ? `${u.noticePeriodDays} days` : "Received"}
            </span>
          ) : (
            <span className="text-[11px] font-semibold bg-error/10 text-error px-2 py-0.5 rounded-full">Not received</span>
          )}
        </td>
        <td className="p-4">
          <span className={`inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-full ${
            u.daysUnresponsive >= 14
              ? 'bg-error/10 text-error'
              : u.daysUnresponsive >= 10
              ? 'bg-orange-500/10 text-orange-600'
              : 'bg-yellow-500/10 text-yellow-600'
          }`}>
            <Clock className="w-3 h-3" />
            {u.daysUnresponsive}d
          </span>
        </td>
        <td className="p-4 text-right">
          <div className="flex items-center justify-end gap-1.5 flex-nowrap">
            {/* Log Call Icon Button */}
            <button 
              onClick={() => setIsLoggingCall(true)}
              className="p-2 h-8 w-8 inline-flex items-center justify-center bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-300/40 dark:border-amber-700/50 rounded-lg transition-all shadow-xs cursor-pointer shrink-0"
              title="Log Call Outcome"
            >
              <Phone className="w-4 h-4" />
            </button>

            {/* View Timeline Icon Button */}
            <button 
              onClick={() => onViewTimeline(u.applicationId)}
              className="p-2 h-8 w-8 inline-flex items-center justify-center bg-surface-container hover:bg-surface-container-high border border-border rounded-lg text-text-secondary hover:text-text-primary transition-all shadow-xs cursor-pointer shrink-0"
              title="View Candidate Timeline"
            >
              <Clock className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  // Edit Mode
  return (
    <tr className="border-b border-border bg-surface-bright/30">
      <td colSpan={7} className="p-4">
        <LogManualCallCard
          candidateName={u.candidateName}
          outcome={outcome}
          setOutcome={setOutcome}
          currentSalary={currentSalary}
          setCurrentSalary={setCurrentSalary}
          expectedSalary={expectedSalary}
          setExpectedSalary={setExpectedSalary}
          noticePeriod={noticePeriod}
          setNoticePeriod={setNoticePeriod}
          customFields={customFields}
          setCustomFields={setCustomFields}
          cvFile={cvFile}
          setCvFile={setCvFile}
          isSaving={isSaving}
          onCancel={() => setIsLoggingCall(false)}
          onSave={handleSaveLog}
        />
      </td>
    </tr>
  );
};

// ─── Reject Modal ─────────────────────────────────────────────────────────────
const RejectModal = ({ 
  isOpen, onClose, onConfirm, candidateName, stage 
}: { 
  isOpen: boolean; onClose: () => void; onConfirm: (reason: string) => void; 
  candidateName: string; stage: string; 
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { if (!isOpen) setReason(''); }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setIsSubmitting(true);
    await onConfirm(reason.trim());
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div 
        className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-error/10 rounded-full flex items-center justify-center">
            <XCircle className="w-5 h-5 text-error" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary">Reject Candidate</h3>
            <p className="text-[12px] text-text-secondary">{candidateName} · from {stage.replace(/_/g, ' ')}</p>
          </div>
        </div>

        <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
          Rejection Reason <span className="text-error">*</span>
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Expected salary exceeds budget, overqualified for role..."
          rows={3}
          className="w-full bg-surface-container border border-border rounded-xl px-3 py-2.5 text-[13px] text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-primary resize-none"
          autoFocus
        />
        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-text-secondary hover:text-text-primary border border-border rounded-[8px] hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim() || isSubmitting}
            className="px-4 py-2 text-[13px] font-medium bg-error text-white rounded-[8px] hover:bg-error/90 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Rejecting...' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Headhunt Upload Modal ─────────────────────────────────────────────────────
const HeadhuntModal = ({
  isOpen, onClose, jobId
}: {
  isOpen: boolean; onClose: () => void; jobId: Id<"jobs">;
}) => {
  const createHeadhunt = useMutation(api.applications.applications.createHeadhuntApplication);
  const generateUploadUrl = useAction(api.storage.r2.generateUploadUrl);
  const saveUpload = useMutation(api.cvs.cvUploads.saveUpload);
  const { user } = useUser();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', currentSalary: '', expectedSalary: '', noticePeriodDays: '' });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [candidateConsent, setCandidateConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setForm({ fullName: '', email: '', phone: '', currentSalary: '', expectedSalary: '', noticePeriodDays: '' });
      setCvFile(null);
      setCandidateConsent(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const field = (key: keyof typeof form, label: string, placeholder: string, required = false, type = 'text') => (
    <div>
      <label className="block text-[12px] font-medium text-text-secondary mb-1">
        {label} {required && <span className="text-error">*</span>}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-surface-container border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-primary"
      />
    </div>
  );

  const handleSubmit = async () => {
    if (!form.fullName.trim()) return setError('Candidate name is required.');
    if (!form.currentSalary || !form.expectedSalary || !form.noticePeriodDays) return setError('Salary and notice period are required.');
    if (!cvFile) return setError('A CV file is required for headhunted uploads.');
    if (!candidateConsent) return setError('You must confirm the candidate is aware of this opportunity.');

    setIsSubmitting(true);
    setError('');
    try {
      // Upload CV first
      let { url: uploadUrl, key: s3Key } = await generateUploadUrl({ fileName: cvFile.name, contentType: cvFile.type });
        const resp = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": cvFile.type }, body: cvFile });
        
        let cvUploadId = await saveUpload({
          s3Key,
          storageProvider: "r2",
          fileName: cvFile.name,
        fileSize: cvFile.size,
        fileType: cvFile.type,
        source: 'Headhunting',
        uploadedBy: user?.id || 'system',
      });

      await createHeadhunt({
        jobId,
        fullName: form.fullName.trim(),
        email: form.email || undefined,
        phone: form.phone || undefined,
        currentSalary: parseFloat(form.currentSalary.replace(/[^0-9.]/g, '')),
        expectedSalary: parseFloat(form.expectedSalary.replace(/[^0-9.]/g, '')),
        noticePeriodDays: parseInt(form.noticePeriodDays.replace(/[^0-9]/g, '')),
        cvUploadId,
        candidateConsent: true,
      });
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to add headhunt candidate.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-text-primary">Upload Headhunt CV</h3>
              <p className="text-[12px] text-text-secondary">Drops candidate directly into 2nd Shortlist</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-container rounded-lg transition-colors">
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">{field('fullName', 'Candidate Name', 'e.g. Kasun Fernando', true)}</div>
          {field('email', 'Email', 'optional@email.com', false, 'email')}
          {field('phone', 'Phone', '+94 77 xxx xxxx')}
          {field('currentSalary', 'Current Salary', 'e.g. 250000', true)}
          {field('expectedSalary', 'Expected Salary', 'e.g. 320000', true)}
          <div className="col-span-2">{field('noticePeriodDays', 'Notice Period (days)', 'e.g. 30', true, 'number')}</div>
        </div>

        {/* CV File Upload — required for headhunted candidates */}
        <div className="mt-4">
          <label className="block text-[12px] font-medium text-text-secondary mb-1">
            CV File <span className="text-error">*</span>
          </label>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={e => setCvFile(e.target.files?.[0] || null)}
            className="w-full text-[12px] text-text-secondary file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors cursor-pointer border border-border rounded-lg px-2 py-1.5"
          />
          {cvFile && (
            <p className="mt-1 text-[11px] text-green-600">✅ {cvFile.name} selected</p>
          )}
        </div>

        {/* Consent checkbox — required gate */}
        <div className="mt-4 p-3 bg-surface-container border border-border rounded-lg">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={candidateConsent}
              onChange={e => setCandidateConsent(e.target.checked)}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-[12px] text-text-primary leading-relaxed">
              I confirm this candidate has been contacted and is <strong>aware of this specific opportunity</strong>. They have expressed interest and consent to being submitted into this pipeline.
            </span>
          </label>
        </div>

        {error && (
          <p className="mt-3 text-[12px] text-error bg-error/10 border border-error/20 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-text-secondary hover:text-text-primary border border-border rounded-[8px] hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !cvFile || !candidateConsent}
            className="px-5 py-2 text-[13px] font-medium bg-primary text-on-primary rounded-[8px] hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {isSubmitting ? 'Adding...' : <><Upload className="w-3.5 h-3.5" /> Add to 2nd Shortlist</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── AI Call Status Badge ──────────────────────────────────────────────────────
const AiCallStatusBadge = ({ status }: { status?: string }) => {
  const key = (status ?? 'not_called').toLowerCase().replace(/ /g, '_');
  const cfg = AI_CALL_STATUS[key] ?? AI_CALL_STATUS['not_called'];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${cfg.color} ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${cfg.pulse ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
};

// ─── Pipeline Tracker (stage count bar) ───────────────────────────────────────
const PipelineTracker = ({ applications, onTabClick }: { applications: any[]; onTabClick: (tab: string) => void }) => {
  const stages = [
    { id: 'new_cvs',          label: 'New CVs',                   tab: 'New CVs' },
    { id: 'ta_shortlist',     label: 'TA Shortlisted & Follow-up', tab: 'TA Shortlist & Follow-up' },
    { id: 'second_shortlist', label: '2nd Shortlist',             tab: '2nd Shortlist' },
    { id: 'director_shortlist', label: 'Director',                tab: 'Director Shortlist' },
    { id: 'client_review',    label: 'Client Review',             tab: 'Client Review' },
    { id: 'interview',        label: 'Interview',                 tab: 'Interview' },
    { id: 'offer',            label: 'Offer',                     tab: 'Offer' },
    { id: 'placed',           label: 'Placed',                    tab: 'Placed', highlight: true },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-5 scrollbar-hide">
      {stages.map((s, i) => {
        const count = s.id === 'ta_shortlist'
          ? applications.filter(a => a.currentStage === 'ta_shortlist' || a.currentStage === 'follow_up' || a.currentStage === 'matched_candidates').length
          : applications.filter(a => a.currentStage === s.id).length;
        const isLast = i === stages.length - 1;
        return (
          <React.Fragment key={s.id}>
            <button
              onClick={() => onTabClick(s.tab)}
              className={`flex flex-col items-center justify-center px-2 py-2 rounded-lg hover:bg-surface-container transition-colors shrink-0 group min-w-[76px] ${
                s.highlight && count > 0 ? 'bg-green-500/5' : ''
              }`}
            >
              <span className={`text-[14px] font-bold px-3 py-0.5 rounded-md mb-1.5 transition-colors ${
                s.highlight && count > 0 
                  ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
                  : count > 0 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-surface-container text-text-secondary/50 border border-border/50'
              }`}>{count}</span>
              <span className={`text-[10px] font-medium leading-tight text-center ${
                count > 0 ? 'text-text-secondary' : 'text-text-secondary/50'
              }`}>{s.label}</span>
            </button>
            {!isLast && (
              <ArrowRight className="w-3 h-3 text-border shrink-0" />
            )}
          </React.Fragment>
        );
      })}
      <div className="ml-1 pl-2 border-l border-border shrink-0">
        <button onClick={() => onTabClick('Rejected')} className="flex flex-col items-center justify-center px-2 py-2 rounded-lg hover:bg-error/5 transition-colors min-w-[76px]">
          <span className="text-[14px] font-bold px-3 py-0.5 rounded-md mb-1.5 bg-error/10 text-error border border-error/20">
            {applications.filter(a => a.currentStage === 'rejected').length}
          </span>
          <span className="text-[10px] font-medium text-text-secondary/60">Rejected</span>
        </button>
      </div>
    </div>
  );
};

export default function JobDetailPage() {
  const { showError } = useErrorPopup();
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const jobId = params.jobId as Id<"jobs">;

  const [activeMainTab, setActiveMainTab] = useState<'matches' | 'pipeline'>('matches');
  const [activePipelineTab, setActivePipelineTab] = useState('New CVs');
  const [activeFollowUpTab, setActiveFollowUpTab] = useState<'active' | 'unresponsive'>('active');
  const [timelineAppId, setTimelineAppId] = useState<Id<"applications"> | null>(null);
  const [activeSourceFilter, setActiveSourceFilter] = useState<'All Sources' | 'LinkedIn' | 'WhatsApp'>('All Sources');
  const [currentPage, setCurrentPage] = useState(1);
  const [matchesPage, setMatchesPage] = useState(1);
  const [isRescoring, setIsRescoring] = useState<Record<string, boolean>>({});
  const [isBulkRescoring, setIsBulkRescoring] = useState(false);
  const itemsPerPage = 6;

  // Modal state
  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; itemId: string; name: string; stage: string } | null>(null);
  const [showHeadhuntModal, setShowHeadhuntModal] = useState(false);

  // Fetch job details
  const job = useQuery(api.jobs.jobs.getJob, { jobId });
  const jobChannels = useQuery(api.jobs.jobs.getJobChannels, { jobId });
  
  const rawApplications = useQuery(api.applications.applications.getByJobId, { jobId });
  const applications = rawApplications ? (rawApplications.filter(Boolean) as any[]) : [];
  const filteredMatches = (job?.reverseMatchResults || []).filter((match: any) => !applications.some(app => app && app.candidateId === match.cvId));
  const unresponsiveCandidates = useQuery(api.applications.applications.getUnresponsiveForJob, { jobId: job?._id || jobId });
  const allUsers = useQuery(api.users.users.getAllUsers);
  const recruiter = job ? allUsers?.find(u => u._id === job.primaryRecruiterId) : null;
  const setPipelineStage = useMutation(api.pipeline.stages.setPipelineStage);
  const rejectApplication = useMutation(api.applications.applications.rejectApplication);
  const removeApplication = useMutation(api.applications.applications.removeApplication);
  const processCvScoring = useAction(api.cvs.cvScoringActions.processCvScoring);
  const triggerAiCallMutation = useMutation(api.applications.applications.triggerAiCall);
  const directorApproveMutation = useMutation(api.pipeline.stages.directorApprove);
  const directorRejectMutation = useMutation(api.pipeline.stages.directorReject);
  const directorRequestChangesMutation = useMutation(api.pipeline.stages.directorRequestChanges);
  const clientApproveMutation = useMutation(api.pipeline.stages.clientApprove);
  const clientHoldMutation = useMutation(api.pipeline.stages.clientHold);
  const clientRejectMutation = useMutation(api.pipeline.stages.clientReject);
  const convex = useConvex();
  const triggerWhatsAppFollowUp = useMutation(api.pipeline.outreach.triggerWhatsAppFollowUp);
  const triggerEmailFollowUp = useMutation(api.pipeline.outreach.triggerEmailFollowUp);
  const [sendingWhatsAppId, setSendingWhatsAppId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  
  const triggerReverseMatch = useMutation(api.jobs.jobs.triggerReverseMatch);
  const updateTaPreferencesMutation = useMutation(api.jobs.jobs.updateTaPreferences);
  const publishJob = useMutation(api.jobs.jobs.publishJob);
  const [isScanning, setIsScanning] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPreferenceModalOpen, setIsPreferenceModalOpen] = useState(false);
  const [customPreferencesText, setCustomPreferencesText] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkFollowUpOpen, setIsBulkFollowUpOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useAction(api.storage.r2.generateUploadUrl);
  const processCvIngestion = useMutation(api.pipeline.ingestion.processCvIngestion);

  const handlePublishJob = async () => {
    setIsPublishing(true);
    const toastId = toast.loading("Publishing job...");
    try {
      await publishJob({ jobId });
      toast.success("Job published successfully!", { id: toastId });
    } catch (e: any) {
      toast.error(e.message || "Failed to publish job", { id: toastId });
      showError(e, { title: "Publish Failed" });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleScanDatabase = async (customPrompt?: string) => {
    setIsScanning(true);
    const toastId = toast.loading(customPrompt !== undefined && customPrompt.trim() !== "" ? "Rescanning database with TA preferences..." : "Scanning candidate database...");
    try {
      await triggerReverseMatch({
        jobId: jobId as Id<"jobs">,
        customPreferences: customPrompt,
      });
      setMatchesPage(1);
      setIsPreferenceModalOpen(false);
      toast.success("Background scan started!", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error starting database scan", { id: toastId });
    } finally {
      setIsScanning(false);
    }
  };

  const handleClearPreferences = async () => {
    const toastId = toast.loading("Clearing custom TA preferences...");
    try {
      await updateTaPreferencesMutation({ jobId: jobId as Id<"jobs">, taPreferences: undefined });
      setCustomPreferencesText("");
      await triggerReverseMatch({ jobId: jobId as Id<"jobs">, customPreferences: "" });
      toast.success("Preferences cleared & background scan started", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear preferences", { id: toastId });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading("Uploading and ingesting CV...");
    try {
      // 1. Calculate SHA-256 hash in browser
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      // 2. Generate Convex upload URL
      let { url: uploadUrl, key: s3Key } = await generateUploadUrl({ fileName: file.name, contentType: file.type || "application/pdf" });
      const resp = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/pdf" }, body: file });
      if (!resp.ok) {
        throw new Error(`Failed to upload to R2: ${resp.status} ${resp.statusText}`);
      }
      
      const result = await processCvIngestion({
        s3Key,
        storageProvider: "r2",
        jobId: jobId as any,
        sourceChannel: "headhunting",
        rawSender: user?.fullName || user?.primaryEmailAddress?.emailAddress || "recruiter",
        fileHash,
        fileName: file.name,
        fileType: file.type || "application/pdf",
        fileSizeBytes: file.size,
      });

      if (result.success) {
        toast.success("CV uploaded successfully and queued for AI parsing!", { id: toastId });
      } else {
        throw new Error(result.reason || "Ingestion failed");
      }
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`, { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const [sortOrder, setSortOrder] = useState<'score' | 'time'>('score');
  const [copiedLink, setCopiedLink] = useState(false);
  const copyPublicLink = () => {
    toast.info("Public apply URL feature not enabled yet.");
  };

  // Reset pagination on tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [activePipelineTab, activeMainTab]);

  if (job === undefined || rawApplications === undefined) {
    return <div className="p-8">Loading...</div>;
  }

  if (job === null) {
    return <div className="p-8">Job not found.</div>;
  }

  const newCvsRaw = applications.filter(app => app.currentStage === "new_cvs");
  const newCvs = newCvsRaw.filter(app => {
    if (activeSourceFilter === 'All Sources') return true;
    if (activeSourceFilter === 'LinkedIn') return app.sourceChannel === 'linkedin';
    if (activeSourceFilter === 'WhatsApp') return app.sourceChannel === 'whatsapp';
    return true;
  });
  
  newCvs.sort((a, b) => {
    if (sortOrder === 'score') {
      const scoreA = typeof a.aiMatchScore === 'number' ? a.aiMatchScore : -1;
      const scoreB = typeof b.aiMatchScore === 'number' ? b.aiMatchScore : -1;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return b._creationTime - a._creationTime;
    } else {
      return b._creationTime - a._creationTime;
    }
  });
  
  // Issue #10: Average across ALL applications with an AI match score, not just reverseMatchResults
  const scoredApps = applications.filter(a => a.aiMatchScore != null);
  const avgAiScore = scoredApps.length > 0
    ? Math.round(scoredApps.reduce((sum, a) => sum + (a.aiMatchScore ?? 0), 0) / scoredApps.length)
    : '--';

  // Reject handler — opens modal
  const openRejectModal = (itemId: string, name: string, stage: string) => {
    setRejectModal({ isOpen: true, itemId, name, stage });
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectModal) return;
    try {
      await rejectApplication({ applicationId: rejectModal.itemId as Id<"applications">, reason, stage: rejectModal.stage });
    } catch (e: any) {
      showError(e, { title: "Rejection Failed" });
    }
  };

  const handleTriggerAiCall = async (appId: string) => {
    try {
      await triggerAiCallMutation({ applicationId: appId as Id<"applications"> });
    } catch (e: any) {
      showError(e, { title: "Failed to Trigger AI Call" });
    }
  };
  
  const handleStageChange = async (appId: string, newStage: string) => {
    try {
      await setPipelineStage({ applicationId: appId as Id<"applications">, newStage });
    } catch (e: any) {
      showError(e, { title: "Stage Transition Failed" });
    }
  };

  const handleDeleteApplication = async (appId: string) => {
    if (!window.confirm("Are you sure you want to completely delete this candidate's application from this job? This action cannot be undone.")) return;
    try {
      await removeApplication({ applicationId: appId as Id<"applications"> });
      toast.success("Candidate application deleted from this job.");
    } catch (e: any) {
      showError(e, { title: "Failed to Delete Application" });
    }
  };

  const handleRescore = async (candidateId: string) => {
    setIsRescoring(prev => ({ ...prev, [candidateId]: true }));
    const toastId = toast.loading("Rescoring candidate against updated job requirements...");
    try {
      await processCvScoring({ candidateId: candidateId as Id<"candidates">, jobId: jobId as Id<"jobs"> });
      toast.success("Candidate rescored successfully!", { id: toastId });
    } catch (e: any) {
      toast.error("Failed to rescore candidate", { id: toastId });
      showError(e, { title: "Rescore Failed" });
    } finally {
      setIsRescoring(prev => ({ ...prev, [candidateId]: false }));
    }
  };

  const handleBulkRescore = async () => {
    const pipelineApps = applications.filter(a => a.currentStage !== 'new_cvs' && a.currentStage !== 'rejected' && a.candidateId);
    if (pipelineApps.length === 0) {
      toast.info("No candidates in the active pipeline to rescore.");
      return;
    }
    if (!window.confirm(`Are you sure you want to rescore all ${pipelineApps.length} active pipeline candidates against the current job requirements? This may take a few moments.`)) return;

    setIsBulkRescoring(true);
    const toastId = toast.loading(`Rescoring ${pipelineApps.length} candidates...`);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const app of pipelineApps) {
        try {
          await processCvScoring({ candidateId: app.candidateId as Id<"candidates">, jobId: jobId as Id<"jobs"> });
          successCount++;
        } catch (e) {
          console.error(`Failed to rescore candidate ${app.candidateId}:`, e);
          errorCount++;
        }
      }
      
      if (errorCount === 0) {
        toast.success(`Successfully rescored all ${successCount} pipeline candidates!`, { id: toastId });
      } else {
        toast.warning(`Rescored ${successCount} candidates, but ${errorCount} failed.`, { id: toastId });
      }
    } catch (e: any) {
      toast.error("Failed to execute bulk rescore", { id: toastId });
      showError(e, { title: "Bulk Rescore Failed" });
    } finally {
      setIsBulkRescoring(false);
    }
  };

  const renderPagination = (totalItems: number) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    if (totalItems === 0) return null;
    return (
      <div className="p-4 border-t border-border flex justify-between items-center text-[12px] text-text-secondary bg-surface-bright">
        <span>Showing {Math.min(startIndex + 1, totalItems)} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} candidates (Page {currentPage} of {totalPages})</span>
        <div className="flex gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="flex items-center gap-1 border border-border px-2 py-1 rounded hover:bg-surface-container disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="flex items-center gap-1 border border-border px-2 py-1 rounded hover:bg-surface-container disabled:opacity-50"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  
  const renderMatchesPagination = () => {
    const matchesPerPage = 6;
    const totalItems = filteredMatches.length;
    const totalPages = Math.ceil(totalItems / matchesPerPage);
    const startIndex = (matchesPage - 1) * matchesPerPage;
    if (totalItems === 0) return null;
    return (
      <div className="p-4 border-t border-border flex justify-between items-center text-[12px] text-text-secondary bg-surface-bright">
        <span>Showing {Math.min(startIndex + 1, totalItems)} to {Math.min(startIndex + matchesPerPage, totalItems)} of {totalItems} candidates (Page {matchesPage} of {totalPages})</span>
        <div className="flex gap-2">
          <button
            disabled={matchesPage === 1}
            onClick={() => setMatchesPage(p => p - 1)}
            className="flex items-center gap-1 border border-border px-2 py-1 rounded hover:bg-surface-container disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <button
            disabled={matchesPage === totalPages}
            onClick={() => setMatchesPage(p => p + 1)}
            className="flex items-center gap-1 border border-border px-2 py-1 rounded hover:bg-surface-container disabled:opacity-50"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderMatchesTable = () => {
    const matchesPerPage = 6;
    const startIndex = (matchesPage - 1) * matchesPerPage;
    const currentMatches = filteredMatches.slice(startIndex, startIndex + matchesPerPage);

    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col mb-0">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex justify-between items-center bg-surface">
          <div className="flex items-center gap-3 text-[13px]">
            <h3 className="font-semibold text-[15px]">AI Matches from Database</h3>
            {job?.taPreferences && (
              <span className="bg-primary/10 text-primary border border-primary/20 text-[11px] font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Custom TA Criteria Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setCustomPreferencesText(job?.taPreferences || "");
                setIsPreferenceModalOpen(true);
              }}
              disabled={isScanning}
              className="bg-surface text-text-secondary border border-border px-3 py-1.5 rounded-[8px] text-[13px] font-medium hover:bg-surface-bright transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              title="Add custom preferences or required skills before rescanning"
            >
              <MessageSquarePlus className="w-4 h-4" /> Add Preferences
            </button>
            <button 
              onClick={() => handleScanDatabase()}
              disabled={isScanning}
              className="bg-primary text-on-primary px-3 py-1.5 rounded-[8px] text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              title="Rescan database with standard job description"
            >
              <Bot className="w-4 h-4" /> {isScanning ? "Scanning..." : "Scan Database"}
            </button>
          </div>
        </div>

        {/* Active Preferences Banner */}
        {job?.taPreferences && (
          <div className="bg-primary/5 border-b border-primary/15 px-4 py-2 flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-2 text-primary font-medium truncate pr-4">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">Active Filter Criteria: <strong className="font-semibold text-text-primary">"{job.taPreferences}"</strong></span>
            </div>
            <button 
              onClick={handleClearPreferences}
              className="text-text-secondary hover:text-red-500 text-[11px] font-medium flex items-center gap-1 shrink-0 transition-colors"
              title="Clear preferences and rescan"
            >
              <X className="w-3.5 h-3.5" /> Clear Preferences
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4 w-10"><input className="rounded border-border text-primary-container focus:ring-primary-container" type="checkbox" /></th>
                <th className="p-4">Candidate</th>
                <th className="p-4">Source</th>
                <th className="p-4">JD Match Score</th>
                <th className="p-4">Role & Exp</th>
                <th className="p-4">AI Reason</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {(filteredMatches.length === 0) ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-surface-bright/30">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Bot className="w-8 h-8 text-primary" />
                      </div>
                      <h4 className="text-[16px] font-semibold text-text-primary mb-2">No Candidates Found</h4>
                      <p className="text-[13px] text-text-secondary max-w-[420px] mb-6 leading-relaxed">
                        We couldn't find any matching candidates in your database. You can scan with standard requirements or add custom TA preferences & skills.
                      </p>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleScanDatabase()}
                          disabled={isScanning}
                          className="bg-primary text-white px-5 py-2.5 rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          <Bot className="w-4 h-4" /> {isScanning ? "Scanning Database..." : "Scan Database Now"}
                        </button>
                        <button
                          onClick={() => {
                            setCustomPreferencesText(job?.taPreferences || "");
                            setIsPreferenceModalOpen(true);
                          }}
                          disabled={isScanning}
                          className="border border-primary text-primary px-4 py-2.5 rounded-lg text-[13px] font-medium hover:bg-primary/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <MessageSquarePlus className="w-4 h-4" /> Add Preferences & Rescan <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                currentMatches.map((match: any) => (
                  <MatchRow 
                    key={match.cvId} 
                    match={match} 
                    jobId={jobId} 
                    applications={applications} 
                    onNavigate={() => {
                      setActiveMainTab('pipeline');
                      setActivePipelineTab('TA Shortlist');
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        {renderMatchesPagination()}
      </div>
    );
  };

  const renderNewCVsTable = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentNewCvs = newCvs.slice(startIndex, startIndex + itemsPerPage);
    
    return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                    <th className="p-4 w-10"><input className="rounded border-border text-primary-container focus:ring-primary-container" type="checkbox" /></th>
                    <th className="p-4">Candidate</th>
                    <th className="p-4">Source</th>
                    <th className="p-4">Match Score</th>
                    <th className="p-4">Role & Exp</th>
                    <th className="p-4">AI Reason</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-[13px] text-text-primary divide-y divide-border">
                  {currentNewCvs.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-text-secondary">No candidates found. Start by sourcing!</td></tr>
                  ) : (
                    currentNewCvs.map(app => (
                      <tr key={app._id} className="hover:bg-surface-bright transition-colors group">
                        <td className="p-4"><input className="rounded border-border text-primary-container focus:ring-primary-container" type="checkbox" /></td>
                        <td className="p-4 font-medium">
                          <div className="flex items-center gap-2">
                            <Link href={`/dashboard/candidates/${app.candidateId}`} className="text-text-primary hover:underline">
                              {app.candidate?.fullName || 'Unknown Candidate'}
                            </Link>
                            <CvViewButton cvUploadId={(app as any).cvFileId || (app.candidate as any)?.cvUploadId || app.candidateId || app._id} />
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`font-medium ${
                            (app.sourceChannel === 'whatsapp') ? 'text-[#25D366]' : 
                            (app.sourceChannel === 'linkedin') ? 'text-[#0A66C2]' : 
                            'text-text-secondary'
                          }`}>
                            {app.sourceChannel === 'whatsapp' ? 'WhatsApp' : 
                             app.sourceChannel === 'linkedin' ? 'LinkedIn' : 
                             app.sourceChannel ? app.sourceChannel.charAt(0).toUpperCase() + app.sourceChannel.slice(1).replace('_', ' ') : 
                             ((app.candidate as any)?.source || 'Manual')}
                          </span>
                        </td>
                        <td className="p-4"><ScoreRing score={app.aiMatchScore || 'Pending'} /></td>
                        <td className="p-4 text-[13px]">
                          <div className="font-medium text-text-primary truncate max-w-[200px]" title={(app.candidate as any)?.currentTitle || (app.candidate as any)?.currentJobTitle || 'Unknown Role'}>{(app.candidate as any)?.currentTitle || (app.candidate as any)?.currentJobTitle || 'Unknown Role'}</div>
                          <div className="text-text-secondary text-xs">{(app.candidate as any)?.totalExperienceYears ? `${(app.candidate as any).totalExperienceYears} yrs exp` : ((app.candidate as any)?.experience ? `${(app.candidate as any).experience} yrs exp` : 'Exp not specified')}</div>
                        </td>
                        <td className="p-4">
                          <AiReasonDisplay reason={(app as any).aiMatchExplanation || (app.candidate as any)?.summary} />
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <select 
                              className="appearance-none bg-primary text-on-primary border border-transparent rounded-[6px] px-3 py-1.5 text-[12px] font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer shadow-sm text-center min-w-[120px]"
                              onChange={(e) => handleStageChange(app._id, e.target.value)}
                              defaultValue=""
                            >
                              <option value="" disabled>Add to Pipeline...</option>
                              {PIPELINE_STAGES.filter(s => s.id !== 'new_cvs').map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleRescore(app.candidateId)}
                              disabled={isRescoring[app.candidateId]}
                              className="p-1.5 text-text-secondary hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                              title="Rescore against updated requirements"
                            >
                              <RefreshCw className={`w-4 h-4 ${isRescoring[app.candidateId] ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                              onClick={() => handleDeleteApplication(app._id)}
                              className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete Candidate Application"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
    </table>
  );
  };

  const renderPipelineTable = () => {
    // Map TABS to PIPELINE_STAGES ids
    const stageMap: Record<string, string> = {
      'New CVs': 'new_cvs',
      'Matched Candidates': 'matched_candidates',
      'TA Shortlist & Follow-up': 'ta_shortlist',
      'TA Shortlist': 'ta_shortlist',
      'Follow-up': 'follow_up',
      '2nd Shortlist': 'second_shortlist',
      'Director Shortlist': 'director_shortlist',
      'Client Review': 'client_review',
      'Interview': 'interview',
      'Offer': 'offer',
      'Placed': 'placed',
      'Rejected': 'rejected'
    };

    const currentStageId = stageMap[activePipelineTab];
    const stageApps = applications.filter(app => {
      let stageMatch = false;
      if (activePipelineTab === 'TA Shortlist & Follow-up' || activePipelineTab === 'TA Shortlist' || activePipelineTab === 'Follow-up') {
        stageMatch = app.currentStage === 'ta_shortlist' || app.currentStage === 'follow_up' || app.currentStage === 'matched_candidates';
      } else {
        stageMatch = app.currentStage === currentStageId;
      }
      if (!stageMatch) return false;
      
      if (activeSourceFilter === 'LinkedIn') return app.sourceChannel === 'linkedin';
      if (activeSourceFilter === 'WhatsApp') return app.sourceChannel === 'whatsapp';
      return true;
    });
    

    const itemsToRender = stageApps.map(app => ({
      id: app._id,
      candidateId: app.candidateId,
      cvUploadId: (app as any).cvFileId || app.candidate?.cvUploadId,
      name: app.candidate?.fullName || 'Unknown Candidate',
      doNotContact: (app.candidate as any)?.doNotContact,
      score: app.aiMatchScore || 'Pending',
      scoreReason: (app as any).aiMatchExplanation || undefined,
      status: app.taShortlistStatus || 'Pending',
      // Raw values for tooltip display — pulled from candidate profile first (updated by logManualCall)
      currentSalary: app.currentSalary !== undefined && app.currentSalary !== null ? String(app.currentSalary) : ((app.candidate as any)?.currentSalary ? String((app.candidate as any).currentSalary) : '—'),
      expectedSalary: app.expectedSalary !== undefined && app.expectedSalary !== null ? String(app.expectedSalary) : ((app.candidate as any)?.expectedSalary ? String((app.candidate as any).expectedSalary) : '—'),
      noticePeriod: app.noticePeriodDays !== undefined && app.noticePeriodDays !== null ? String(app.noticePeriodDays) : ((app.candidate as any)?.noticePeriodDays ? String((app.candidate as any).noticePeriodDays) : ((app as any).noticePeriod || '—')),
      // Pass raw candidate object so FollowUpCandidateRow can read updated values directly
      candidate: app.candidate,
      // Also expose direct raw numbers for the tooltip
      rawCurrentSalary: (app.candidate as any)?.currentSalary ?? app.currentSalary,
      rawExpectedSalary: (app.candidate as any)?.expectedSalary ?? app.expectedSalary,
      rawNoticePeriodDays: (app.candidate as any)?.noticePeriodDays ?? app.noticePeriodDays,
      budgetFit: true,
      fit: 'Good',
      salaryFit: 'Good',
      decision: 'Pending',
      manualCallOutcome: app.manualCallOutcome,
      aiCallStatus: app.aiCallStatus,
      aiCallIvrResponse: (app as any).aiCallIvrResponse,
      sourceChannel: app.sourceChannel,
      currentStage: app.currentStage,
      date: app.lastStageChangedAt ? formatDistanceToNow(app.lastStageChangedAt) + ' ago' : '—',
      // Use followUpEnteredAt for accurate 7-day clock; fall back to lastStageChangedAt
      timeInStageRaw: (app as any).followUpEnteredAt
        ? Date.now() - (app as any).followUpEnteredAt
        : (app.lastStageChangedAt ? Date.now() - app.lastStageChangedAt : 0),
      // Per-application completion flags (the source of truth for follow-up)
      followUpCvReceived: (app as any).followUpCvReceived,
      followUpCurrentSalary: (app as any).followUpCurrentSalary,
      followUpExpectedSalary: (app as any).followUpExpectedSalary,
      followUpNoticePeriod: (app as any).followUpNoticePeriod,
      followUpState: (app as any).followUpState,
      feedback: 'Pending',
      salary: app.candidate?.expectedSalary ? '$' + app.candidate.expectedSalary : '—',
      startDate: 'TBD',
      role: job.title,
      reason: app.taRejectionReason || 'Not a fit'
    }));
    
    itemsToRender.sort((a, b) => {
      if (sortOrder === 'score') {
        const scoreA = typeof a.score === 'number' ? a.score : -1;
        const scoreB = typeof b.score === 'number' ? b.score : -1;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.timeInStageRaw - b.timeInStageRaw; // Fallback to newest time
      } else {
        return a.timeInStageRaw - b.timeInStageRaw; // Newest first (smallest timeInStageRaw)
      }
    });

    const totalItems = itemsToRender.length;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentItems = itemsToRender.slice(startIndex, startIndex + itemsPerPage);

    // Use MOVEABLE_STAGES for dropdown targets
    const renderKanbanDropdown = (itemId: string, defaultStage: string, candidateId?: string) => (
      <div className="flex justify-end items-center gap-2">
        <select 
          className="appearance-none bg-primary text-on-primary border border-transparent rounded-[6px] px-3 py-1.5 text-[12px] font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer shadow-sm text-center min-w-[120px]"
          onChange={(e) => handleStageChange(itemId, e.target.value)}
          value={defaultStage}
        >
          <option value="" disabled>Move To...</option>
          {MOVEABLE_STAGES.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        {candidateId && (
          <button
            onClick={() => handleRescore(candidateId)}
            disabled={isRescoring[candidateId]}
            className="p-1.5 text-text-secondary hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
            title="Rescore against updated requirements"
          >
            <RefreshCw className={`w-4 h-4 ${isRescoring[candidateId] ? 'animate-spin' : ''}`} />
          </button>
        )}
        <button
          onClick={() => handleDeleteApplication(itemId)}
          className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
          title="Delete Candidate Application"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );

    let tableContent = null;
    
    switch(activePipelineTab) {
      case 'New CVs':
        tableContent = renderNewCVsTable();
        break;


      case 'TA Shortlist & Follow-up':
      case 'TA Shortlist':
      case 'Follow-up':
        const unresponsiveList = unresponsiveCandidates ?? [];
        tableContent = (
          <div className="flex flex-col gap-4">
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              {/* Internal Workspace Sub-Tab Navigation Header */}
              <div className="p-3 border-b border-border bg-surface-bright flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveFollowUpTab('active')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                      activeFollowUpTab === 'active'
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface hover:bg-surface-container text-text-secondary border border-border'
                    }`}
                  >
                    <span>Active Candidates</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      activeFollowUpTab === 'active' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                    }`}>
                      {currentItems.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveFollowUpTab('unresponsive')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                      activeFollowUpTab === 'unresponsive'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50 hover:bg-orange-500/20'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Unresponsive (7 Days)</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      activeFollowUpTab === 'unresponsive' ? 'bg-white/20 text-white' : 'bg-orange-500/20 text-orange-800 dark:text-orange-300'
                    }`}>
                      {unresponsiveList.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Sub-Tab View Rendering */}
              {activeFollowUpTab === 'active' ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                      <th className="p-4">Candidate</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Outreach Status</th>
                      <th className="p-4">Required Details (4 Flags)</th>
                      <th className="p-4">Time Left</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px] text-text-primary divide-y divide-border">
                    {currentItems.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-text-secondary">No active candidates in TA Shortlisted & Follow-up.</td></tr>
                    ) : currentItems.map((item: any) => (
                      <FollowUpCandidateRow 
                        key={item.id} 
                        item={item} 
                        api={api}
                        convex={convex}
                        showError={showError}
                        setTimelineAppId={setTimelineAppId}
                        renderKanbanDropdown={renderKanbanDropdown}
                        triggerWhatsAppFollowUp={triggerWhatsAppFollowUp}
                        triggerEmailFollowUp={triggerEmailFollowUp}
                      />
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse bg-surface">
                  <thead>
                    <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                      <th className="p-4">Candidate</th>
                      <th className="p-4">Phone</th>
                      <th className="p-4">Current Salary</th>
                      <th className="p-4">Expected Salary</th>
                      <th className="p-4">Notice Period</th>
                      <th className="p-4">Days Unresponsive</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px] text-text-primary divide-y divide-border">
                    {unresponsiveList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-[13px] text-text-secondary">
                          No unresponsive candidates — great work! 🎉
                        </td>
                      </tr>
                    ) : (
                      unresponsiveList.map((u: any) => (
                        <UnresponsiveCandidateRow key={u.applicationId} u={u} api={api} onViewTimeline={setTimelineAppId} />
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
        break;
      case '2nd Shortlist':
        tableContent = (
          <>
            {/* Headhunt upload toolbar */}
            <div className="p-4 border-b border-border flex justify-between items-center bg-surface">
              <div className="text-[13px] font-medium text-text-secondary">
                {currentItems.length} candidates in 2nd Shortlist
              </div>
              <button
                onClick={() => setShowHeadhuntModal(true)}
                className="inline-flex items-center gap-2 text-[13px] font-medium bg-primary text-on-primary px-3 py-1.5 rounded-[8px] hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Upload className="w-4 h-4" /> Upload Headhunt CV
              </button>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                  <th className="p-4">Candidate</th>
                  <th className="p-4">Current Salary</th>
                  <th className="p-4">Expected Salary</th>
                  <th className="p-4">Notice Period</th>
                  <th className="p-4">Fit</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[13px] text-text-primary divide-y divide-border">
                {currentItems.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-text-secondary">No candidates in 2nd Shortlist.</td></tr>
                ) : currentItems.map((item: any) => (
                  <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                    <td className="p-4 font-medium">
                      <CandidateNameDisplay name={item.name} cvUploadId={item.cvUploadId} doNotContact={item.doNotContact} candidateId={item.candidateId} />
                    </td>
                    <td className="p-4">{item.currentSalary}</td>
                    <td className="p-4">{item.expectedSalary}</td>
                    <td className="p-4">{item.noticePeriod}</td>
                    <td className="p-4"><span className="text-green-500 font-medium">✅ {item.fit}</span></td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {renderKanbanDropdown(item.id, 'second_shortlist')}
                        <button
                          onClick={() => openRejectModal(item.id, item.name, 'second_shortlist')}
                          className="text-[12px] font-medium text-text-secondary hover:text-error px-2 py-1.5 rounded-[6px] transition-colors border border-border"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        );
        break;
      case 'Director Shortlist':
        tableContent = (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Score</th>
                <th className="p-4">Salary Fit</th>
                <th className="p-4 text-right">Director Actions</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-text-secondary">No candidates in Director Shortlist.</td></tr>
              ) : currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">
                    <CandidateNameDisplay name={item.name} cvUploadId={item.cvUploadId} doNotContact={item.doNotContact} candidateId={item.candidateId} />
                  </td>
                  <td className="p-4"><ScoreRing score={item.score} /></td>
                  <td className="p-4">✅ {item.salaryFit}</td>
                  <td className="p-4 text-right">
                    {/* Issue #7: Gated Director actions — no free-form dropdown */}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={async () => { try { await directorApproveMutation({ applicationId: item.id }); } catch(e: any) { showError(e, { title: "Director Approval Failed" }); } }}
                        className="inline-flex items-center gap-1 text-[12px] font-medium bg-green-600 text-white px-3 py-1.5 rounded-[6px] hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => openRejectModal(item.id, item.name, 'director_shortlist')}
                        className="inline-flex items-center gap-1 text-[12px] font-medium border border-error/40 text-error px-3 py-1.5 rounded-[6px] hover:bg-error/10 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button
                        onClick={async () => {
                          const note = window.prompt('Note for TA (changes requested):');
                          if (note) { try { await directorRequestChangesMutation({ applicationId: item.id, note }); } catch(e: any) { showError(e, { title: "Request Changes Failed" }); } }
                        }}
                        className="inline-flex items-center gap-1 text-[12px] font-medium border border-border text-text-secondary px-3 py-1.5 rounded-[6px] hover:bg-surface-container transition-colors"
                      >
                        🔄 Changes
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
        break;
      case 'Client Review':
        tableContent = (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Score</th>
                <th className="p-4 text-right">Client Actions</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.length === 0 ? (
                <tr><td colSpan={3} className="p-8 text-center text-text-secondary">No candidates in Client Review.</td></tr>
              ) : currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">
                    <CandidateNameDisplay name={item.name} cvUploadId={item.cvUploadId} doNotContact={item.doNotContact} candidateId={item.candidateId} />
                  </td>
                  <td className="p-4"><ScoreRing score={item.score} /></td>
                  <td className="p-4 text-right">
                    {/* Issue #7: Gated Client actions */}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={async () => { try { await clientApproveMutation({ applicationId: item.id }); } catch(e: any) { showError(e, { title: "Client Selection Failed" }); } }}
                        className="inline-flex items-center gap-1 text-[12px] font-medium bg-green-600 text-white px-3 py-1.5 rounded-[6px] hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Select for Interview
                      </button>
                      <button
                        onClick={async () => { try { await clientHoldMutation({ applicationId: item.id, note: 'Client placed on hold' }); } catch(e: any) { showError(e, { title: "Client Hold Failed" }); } }}
                        className="inline-flex items-center gap-1 text-[12px] font-medium border border-yellow-500/40 text-yellow-600 px-3 py-1.5 rounded-[6px] hover:bg-yellow-500/10 transition-colors"
                      >
                        ⏸ Hold
                      </button>
                      <button
                        onClick={() => openRejectModal(item.id, item.name, 'client_review')}
                        className="inline-flex items-center gap-1 text-[12px] font-medium border border-error/40 text-error px-3 py-1.5 rounded-[6px] hover:bg-error/10 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
        break;
      case 'Interview':
        tableContent = (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Date</th>
                <th className="p-4">Feedback</th>
                <th className="p-4 text-right">Move To Stage</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-text-secondary">No interviews scheduled.</td></tr>
              ) : currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">
                    <CandidateNameDisplay name={item.name} cvUploadId={item.cvUploadId} doNotContact={item.doNotContact} candidateId={item.candidateId} />
                  </td>
                  <td className="p-4">{item.date}</td>
                  <td className="p-4"><StatusDot status={item.feedback} /></td>
                  <td className="p-4 text-right">
                    {renderKanbanDropdown(item.id, 'interview')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
        break;
      case 'Offer':
        tableContent = (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Offer Salary</th>
                <th className="p-4">Start Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Move To Stage</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-text-secondary">No offers extended.</td></tr>
              ) : currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">
                    <CandidateNameDisplay name={item.name} cvUploadId={item.cvUploadId} doNotContact={item.doNotContact} candidateId={item.candidateId} />
                  </td>
                  <td className="p-4 font-bold">{item.salary}</td>
                  <td className="p-4">{item.startDate}</td>
                                    <td className="p-4">
                    {item.timeInStageRaw > 432000000 && (
                      <div className="text-[11px] font-bold text-orange-600 bg-orange-500/10 px-2 py-1 rounded w-fit flex items-center gap-1 mb-1 border border-orange-500/20">
                        ⚠️ Stale Offer ({Math.floor(item.timeInStageRaw / 86400000)}d)
                      </div>
                    )}
                    <StatusDot status={item.status} />
                  </td>
                  <td className="p-4 text-right">
                    {renderKanbanDropdown(item.id, 'offer')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
        break;
      case 'Placed':
        tableContent = (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Role</th>
                <th className="p-4">Placement Date</th>
                <th className="p-4 text-right">Move To Stage</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-text-secondary">No placements made yet.</td></tr>
              ) : currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">
                    <CandidateNameDisplay name={item.name} cvUploadId={item.cvUploadId} doNotContact={item.doNotContact} candidateId={item.candidateId} />
                  </td>
                  <td className="p-4">{item.role}</td>
                  <td className="p-4">{item.date}</td>
                  <td className="p-4 text-right">
                    {renderKanbanDropdown(item.id, 'placed')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
        break;
      case 'Rejected':
        tableContent = (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Rejection Reason</th>
                <th className="p-4 text-right">Move To Stage</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.length === 0 ? (
                <tr><td colSpan={3} className="p-8 text-center text-text-secondary">No rejected candidates.</td></tr>
              ) : currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">
                    <CandidateNameDisplay name={item.name} cvUploadId={item.cvUploadId} doNotContact={item.doNotContact} candidateId={item.candidateId} />
                  </td>
                  <td className="p-4 text-error">{item.reason}</td>
                  <td className="p-4 text-right">
                    {renderKanbanDropdown(item.id, 'rejected')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
        break;
      default:
        tableContent = <div className="p-8 text-center text-text-secondary">No candidates found.</div>;
    }

    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col mb-0">
        <div className="p-4 border-b border-border flex justify-between items-center bg-surface">
          <div className="flex gap-2 text-[13px]">
            <button 
              onClick={() => setActiveSourceFilter('All Sources')}
              className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium flex items-center gap-2 transition-colors ${activeSourceFilter === 'All Sources' ? 'bg-surface-container text-text-primary' : 'hover:bg-surface-container text-text-secondary'}`}
            >
              <div className="w-2 h-2 rounded-full bg-primary-container"></div> All Sources
            </button>
            <button 
              onClick={() => setActiveSourceFilter('LinkedIn')}
              className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium flex items-center gap-2 transition-colors ${activeSourceFilter === 'LinkedIn' ? 'bg-surface-container text-text-primary' : 'hover:bg-surface-container text-text-secondary'}`}
            >
              <div className="w-2 h-2 rounded-full bg-[#0A66C2]"></div> LinkedIn
            </button>
            <button 
              onClick={() => setActiveSourceFilter('WhatsApp')}
              className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium flex items-center gap-2 transition-colors ${activeSourceFilter === 'WhatsApp' ? 'bg-surface-container text-text-primary' : 'hover:bg-surface-container text-text-secondary'}`}
            >
              <div className="w-2 h-2 rounded-full bg-[#25D366]"></div> WhatsApp
            </button>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setSortOrder(prev => prev === 'score' ? 'time' : 'score')}
              className="border border-border text-text-secondary px-3 py-1.5 rounded-[8px] text-[13px] hover:bg-surface-container transition-colors flex items-center gap-1"
            >
              <ArrowUpDown className="w-4 h-4" /> Sort: {sortOrder === 'score' ? 'Score' : 'Time'}
            </button>
            <button className="border border-border text-text-secondary px-3 py-1.5 rounded-[8px] text-[13px] hover:bg-surface-container transition-colors flex items-center gap-1">
              <Filter className="w-4 h-4" /> Filter
            </button>
            <button 
              disabled
              title="Bulk AI Call feature is disabled for now"
              className="border border-border text-text-disabled px-3 py-1.5 rounded-[8px] text-[13px] font-medium opacity-50 cursor-not-allowed flex items-center gap-1"
            >
              <Bot className="w-4 h-4 text-text-disabled" /> Bulk AI Call (Disabled)
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {tableContent}
        </div>
        {renderPagination(totalItems)}
      </div>
    );
  };

  return (
    <div className="flex-1 w-full bg-background p-8 min-h-screen font-body max-w-[1400px] mx-auto pb-32">
      {/* Global Modals */}
      <RejectModal
        isOpen={!!rejectModal?.isOpen}
        onClose={() => setRejectModal(null)}
        onConfirm={handleRejectConfirm}
        candidateName={rejectModal?.name ?? ''}
        stage={rejectModal?.stage ?? ''}
      />
      <HeadhuntModal
        isOpen={showHeadhuntModal}
        onClose={() => setShowHeadhuntModal(false)}
        jobId={jobId}
      />
      {/* Header */}
      <div className="bg-surface rounded-[12px] border border-border shadow-subtle p-[24px] mb-[24px]">
        <div className="text-[12px] text-text-secondary mb-2 font-body flex items-center gap-1">
          <Link className="hover:text-primary-container" href="/dashboard/jobs">Jobs</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>{job.title} — {job.clientName || 'Atlas Holdings'}</span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-[22px] font-semibold text-text-primary mb-3">{job.title}</h1>
            <div className="flex items-center gap-4 text-body font-body text-text-secondary mb-4">
              <div className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {job.clientName || 'Atlas Holdings'}</div>
              <div className="flex items-center gap-1"><Tag className="w-4 h-4" /> Keyword: {job.keyword}</div>
              <div className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Created: {format(new Date(job._creationTime), 'dd MMM yyyy')}</div>
              {job.isAssignedTAExplicit !== false && (
                <div className="flex items-center gap-1"><User className="w-4 h-4" /> TA: {recruiter?.fullName || 'Loading...'}</div>
              )}
            </div>
            <div className="flex gap-2">
              <span className="bg-primary-container/15 text-primary-container px-3 py-1 rounded-full text-[12px] font-medium border border-primary-container/20">
                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
              </span>
              <span className="bg-surface-container text-text-secondary px-3 py-1 rounded-full text-[12px] border border-border">{job.location}</span>
              <span className="bg-surface-container text-text-secondary px-3 py-1 rounded-full text-[12px] border border-border">{job.clientIndustry}</span>
              {job.isConfidential && (
                <span className="bg-surface-container text-text-secondary px-3 py-1 rounded-full text-[12px] border border-border">Confidential</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-4">
              <span className="text-[11px] uppercase tracking-wider font-bold text-text-secondary">Active Sources:</span>
              <div className="flex items-center gap-2">
                {/* Manual Upload is always available for every job */}
                <span className="flex items-center gap-1 bg-surface-container text-text-secondary px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm border border-border" title="Manual Upload Always Available">
                  📤 Manual
                </span>
                {/* Only show channels that were actually configured during job creation */}
                {(jobChannels || []).map(ch => {
                  if (!ch.isEnabled) return null;
                  const channelConfig: Record<string, { label: string; color: string; title: string }> = {
                    whatsapp:       { label: 'WhatsApp',   color: 'bg-[#25D366]',  title: 'WhatsApp Ingestion Active' },
                    whatsapp_campaign: { label: 'WhatsApp', color: 'bg-[#25D366]', title: 'WhatsApp Campaign Active' },
                    linkedin:       { label: 'LinkedIn',   color: 'bg-[#0A66C2]',  title: 'LinkedIn Ingestion Active' },
                    email_campaign: { label: 'Email',      color: 'bg-orange-400', title: 'Email Campaign Active' },
                    meta_campaign:  { label: 'Meta Ads',   color: 'bg-blue-600',   title: 'Meta Campaign Active' },
                    workable:       { label: 'Workable',   color: 'bg-sky-500',    title: 'Workable API Active' },
                    headhunting:    { label: 'Headhunt',   color: 'bg-purple-500', title: 'Headhunting Active' },
                  };
                  const cfg = channelConfig[ch.channelType];
                  if (!cfg) return null;
                  return (
                    <span key={ch._id} className={`flex items-center gap-1 ${cfg.color} text-white px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm`} title={cfg.title}>
                      {cfg.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-4">
            <div className="flex gap-3">
              <div className="bg-surface border border-border rounded-[8px] px-4 py-2 text-center min-w-[80px]">
                <div className="text-[20px] font-bold text-text-primary">{applications.length}</div>
                <div className="text-[11px] text-text-secondary">Total CVs</div>
              </div>
              <div className="bg-surface border border-border rounded-[8px] px-4 py-2 text-center min-w-[80px]">
                <div className="text-[20px] font-bold text-text-primary">{applications.filter(a => a.currentStage !== 'new_cvs' && a.currentStage !== 'rejected').length}</div>
                <div className="text-[11px] text-text-secondary">Shortlisted</div>
              </div>
              <div className="bg-surface border border-border rounded-[8px] px-4 py-2 text-center min-w-[80px]">
                <div className="text-[20px] font-bold text-primary-container">{avgAiScore}<span className="text-[12px] text-text-secondary font-normal">/100</span></div>
                <div className="text-[11px] text-text-secondary">AI Avg Score</div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.docx"
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-primary text-on-primary hover:bg-primary/90 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>Uploading...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" /> Upload CV
                    </>
                  )}
                </button>
                <button 
                  onClick={() => alert("QR feature not implemented yet.")}
                  className="border border-border text-text-primary hover:border-primary-container hover:text-primary-container px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1"
                >
                  <QrCode className="w-4 h-4" /> Ad QR Code
                </button>
                {job.status === 'draft' && (
                  <button 
                    onClick={handlePublishJob}
                    disabled={isPublishing}
                    className="bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" /> {isPublishing ? "Publishing..." : "Publish Job"}
                  </button>
                )}
                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className="border border-border text-text-primary hover:border-primary-container hover:text-primary-container px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1"
                >
                  <Edit className="w-4 h-4" /> Edit Job
                </button>
                <button className="border border-border text-text-primary hover:bg-surface-container px-2 py-1.5 rounded-[8px] transition-colors flex items-center">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <button className="border border-border text-text-primary hover:border-primary-container hover:text-primary-container px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1">
                  <Download className="w-4 h-4" /> Export CVs
                </button>
                <button 
                  onClick={handleBulkRescore}
                  disabled={isBulkRescoring}
                  className="border border-border text-text-primary hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isBulkRescoring ? 'animate-spin' : ''}`} /> 
                  {isBulkRescoring ? 'Rescoring...' : 'Rescore Pipeline'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Main Tabs */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveMainTab('matches')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeMainTab === 'matches' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'}`}
        >
          <Users className="w-4 h-4" />
          Matches ({filteredMatches.length})
        </button>
        <button
          onClick={() => setActiveMainTab('pipeline')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeMainTab === 'pipeline' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'}`}
        >
          <Layers className="w-4 h-4" />
          Pipeline ({applications.filter(a => a.currentStage !== 'new_cvs' && a.currentStage !== 'rejected').length})
        </button>
      </div>

      {activeMainTab === 'matches' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="mb-24">
            {renderMatchesTable()}
          </div>
        </div>
      )}

      {activeMainTab === 'pipeline' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* Issue #8: Pipeline stage count tracker */}
      <PipelineTracker
        applications={applications}
        onTabClick={(tab) => setActivePipelineTab(tab)}
      />

      {/* Secondary Navigation (Pipeline Sub-tabs) */}
      <div className="flex flex-wrap gap-2 mb-6 sticky top-0 bg-background/95 backdrop-blur z-10 py-4 border-b border-border shadow-sm">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const stageId = {
            'New CVs': 'new_cvs',
            'TA Shortlist & Follow-up': 'ta_shortlist',
            'TA Shortlist': 'ta_shortlist',
            'Follow-up': 'follow_up',
            '2nd Shortlist': 'second_shortlist',
            'Director Shortlist': 'director_shortlist', 'Client Review': 'client_review',
            'Interview': 'interview', 'Offer': 'offer', 'Placed': 'placed', 'Rejected': 'rejected'
          }[tab.id];
          const count = (tab.id === 'TA Shortlist & Follow-up' || tab.id === 'TA Shortlist' || tab.id === 'Follow-up')
            ? applications.filter(a => a.currentStage === 'ta_shortlist' || a.currentStage === 'follow_up' || a.currentStage === 'matched_candidates').length
            : stageId ? applications.filter(a => a.currentStage === stageId).length : 0;
          return (
            <button
              key={tab.id}
              onClick={() => setActivePipelineTab(tab.id)}
              className={`px-4 py-2 text-[13px] font-medium rounded-full transition-all flex items-center gap-2 border shadow-sm ${
                activePipelineTab === tab.id 
                  ? 'bg-primary text-on-primary border-primary hover:bg-primary/90' 
                  : 'bg-surface border-border text-text-secondary hover:text-text-primary hover:border-text-tertiary hover:bg-surface-bright'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                  activePipelineTab === tab.id ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Pipeline Table */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {renderPipelineTable()}
      </div>
        </div>
      )}
      
      <EditJobModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        job={job}
      />

      {/* Rescan with TA Preferences Modal */}
      {isPreferenceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-border flex justify-between items-center bg-surface-bright">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[16px] text-text-primary">Custom TA Preferences for Database Matching</h3>
                  <p className="text-[12px] text-text-secondary">Guide the AI on candidate background, skills, or domain focus</p>
                </div>
              </div>
              <button 
                onClick={() => setIsPreferenceModalOpen(false)}
                className="text-text-secondary hover:text-text-primary p-1 rounded-lg hover:bg-surface-container transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-text-primary mb-1.5">
                  Candidate Preferences & Required Skills
                </label>
                <textarea
                  value={customPreferencesText}
                  onChange={(e) => setCustomPreferencesText(e.target.value)}
                  placeholder="e.g., Looking for candidates with strong banking/fintech domain experience, proficient in React Native and AWS, minimum 4 years experience..."
                  className="w-full h-32 px-3 py-2.5 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed text-text-primary placeholder:text-text-secondary/60"
                />
              </div>

              <div>
                <span className="block text-[11px] font-semibold uppercase text-text-secondary tracking-wider mb-2">Quick Preference Suggestions:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Fintech / Banking domain experience",
                    "Strong React Native & Node.js skills",
                    "Senior management / team leadership",
                    "Prior experience in MNC environment",
                    "Certifications: AWS / Azure Certified"
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setCustomPreferencesText(prev => prev ? `${prev}, ${chip}` : chip);
                      }}
                      className="text-[11px] bg-surface-bright hover:bg-primary/10 border border-border text-text-secondary hover:text-primary px-2.5 py-1 rounded-full transition-colors"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-surface-bright flex justify-end gap-3">
              <button
                onClick={() => setIsPreferenceModalOpen(false)}
                className="px-4 py-2 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleScanDatabase(customPreferencesText)}
                disabled={isScanning}
                className="bg-primary text-white px-5 py-2 rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Bot className="w-4 h-4" /> {isScanning ? "Rescanning..." : "Submit & Rescan Database"}
              </button>
            </div>
          </div>
        </div>
      )}

      <SendBulkFollowUpModal
        isOpen={isBulkFollowUpOpen}
        onClose={() => setIsBulkFollowUpOpen(false)}
        jobTitle={job?.title || 'the position'}
        applications={applications
          .filter(a => a.currentStage === 'follow_up' || a.currentStage === 'ta_shortlist')
          .map(app => ({
            id: app._id,
            name: app.candidate?.fullName || 'Unknown Candidate',
            email: app.candidate?.email,
            phone: app.candidate?.phone,
            followUpCvReceived: (app as any).followUpCvReceived,
            followUpCurrentSalary: (app as any).followUpCurrentSalary,
            followUpExpectedSalary: (app as any).followUpExpectedSalary,
            followUpNoticePeriod: (app as any).followUpNoticePeriod,
          }))}
      />

      <CandidateTimelineDrawer 
        applicationId={timelineAppId} 
        onClose={() => setTimelineAppId(null)} 
      />
    </div>
  );
}