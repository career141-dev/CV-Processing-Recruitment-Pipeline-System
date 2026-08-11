"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { AddToJobModal } from '@/components/candidates/modals/AddToJobModal';
import { VoiceTestModal } from '@/components/voice/VoiceTestModal';
import { toast } from 'sonner';
import { ChevronLeft } from 'lucide-react';

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatYoe(years?: number | null): string {
  if (years == null) return "";
  const y = Math.floor(years);
  const m = Math.round((years - y) * 12);
  if (y === 0) return `${m} Months`;
  if (m === 0) return `${y} Years`;
  return `${y} Years, ${m} Months`;
}

const STAGE_LABELS: Record<string, string> = {
  new_cvs: "New CVs",
  matched_candidates: "TA Shortlisted",
  ta_shortlist: "TA Shortlisted",
  shortlisted: "TA Shortlisted",
  follow_up: "Follow-up",
  second_shortlist: "Second Shortlist",
  director_shortlist: "Director Shortlist",
  client_review: "Client Review",
  interview: "Interview",
  offer: "Offer",
  placed: "Placed",
  rejected: "Rejected",
  active: "Active",
  not_available: "Not Available",
  merged: "Merged"
};

export default function CandidateProfile() {
  const params = useParams<{ candidateId: string }>();
  
  const fetchedCandidate = useQuery(api.candidates.candidates.getCandidate, { id: params.candidateId as Id<"candidates"> });
  const triggerLazyParse = useAction(api.cvs.lazyParsing.triggerLazyParse);
  const createApplication = useMutation(api.applications.applications.createApplication);
  const setDoNotContact = useMutation(api.candidates.candidates.setDoNotContact);
  const triggerManualAiCall = useMutation(api.applications.applications.triggerManualAiCall);
  const reparseReferees = useAction(api.candidates.refereeActions.reparseSingleCandidateReferees);
  
  const [isAddToJobOpen, setIsAddToJobOpen] = useState(false);
  const [isVoiceTestOpen, setIsVoiceTestOpen] = useState(false);
  const [isTriggeringCall, setIsTriggeringCall] = useState(false);
  const [isReparsingReferees, setIsReparsingReferees] = useState(false);

  React.useEffect(() => {
    if (fetchedCandidate && fetchedCandidate.isParsed === false) {
      triggerLazyParse({ candidateId: fetchedCandidate._id }).catch(console.error);
    }
  }, [fetchedCandidate, triggerLazyParse]);

  const candidate = fetchedCandidate as any;

  const [activeTab, setActiveTab] = useState("overview");

  const cvUpload = useQuery(
    api.candidates.candidates.getCvUploadUrl,
    candidate?.cvUploadId ? { cvUploadId: candidate.cvUploadId } : "skip"
  );

  // Live data for profile tabs/sidebar
  const candidateId = candidate?._id as Id<"candidates">;
  const applications = useQuery(api.applications.applications.getByCandidate, candidateId ? { candidateId } : "skip");
  const timeline = useQuery(api.applications.applications.getCandidateTimeline, candidateId ? { candidateId } : "skip");
  const aiCalls = useQuery(api.applications.applications.getCandidateAiCalls, candidateId ? { candidateId } : "skip");
  const referees = useQuery(api.candidates.referees.getRefereesByCandidate, candidateId ? { candidateId } : "skip");

  if (candidate === undefined) {
    return (
      <div className="flex justify-center items-center h-64 text-text-disabled text-sm">
        Loading candidate...
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex justify-center items-center h-64 text-[#BA1A1A] text-sm">
        Candidate not found.
      </div>
    );
  }

  const educationText = candidate.education?.[0]
    ? `${candidate.education[0].degree || ""}${candidate.education[0].institution ? ` — ${candidate.education[0].institution}` : ""}`
    : null;

  return (
    <div className="flex flex-col bg-surface w-full pr-6 pt-6">
      <div className="flex-1 mt-2 min-w-0">
        {(candidate.isParsed === false || cvUpload?.status === 'processing' || cvUpload?.status === 'pending_retry') && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md mb-4 flex items-center text-sm font-medium shadow-sm">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            AI is extracting deeper details (skills & job history) in the background...
          </div>
        )}
        {/* Breadcrumb */}
        <div className="flex items-center self-stretch mb-4">
          <Link
            href="/dashboard/candidates"
            className="inline-flex items-center text-text-secondary text-xs hover:text-primary hover:underline font-medium transition-colors mr-2"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
            Candidates
          </Link>
          <img
            src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/c82l2plk_expires_30_days.png" 
            className="w-1 h-[7px] mr-2 object-fill"
            alt="Chevron"
          />
          <span className="text-text-primary text-xs font-semibold">
            {candidate.fullName || "Candidate"}
          </span>
        </div>

            {/* Candidate Header Card */}
            <div className="flex flex-col md:flex-row items-center self-stretch bg-surface py-[25px] px-[21px] mb-4 rounded-xl border border-solid border-border shadow-[0px_2px_4px_#0000000D]">
              <div className="flex flex-1 flex-col gap-4">
                <div className="flex items-center self-stretch gap-[35px]">
                  <div className="w-[108px] h-[111px] rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed text-3xl font-bold shrink-0 overflow-hidden">
                    {candidate.profileImageUrl ? (
                      <img src={candidate.profileImageUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-full h-full text-gray-400 bg-gray-200 p-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex flex-col shrink-0 items-start gap-[3px]">
                    <span className="text-text-primary text-[22px] font-bold">
                      {candidate.fullName || "Unknown"}
                    </span>
                    <span className="text-text-secondary text-[13px]">
                      {[candidate.currentTitle, candidate.currentEmployer].filter(Boolean).join(" · ") || "No title listed"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {candidate.location && (
                    <div className="flex shrink-0 items-center bg-[#91F78E26] py-[3px] px-3 gap-1 rounded-full">
                      <span className="text-[#006E1C] text-xs">{candidate.location}</span>
                    </div>
                  )}
                  {candidate.yearsOfExperience != null && (
                    <div className="flex shrink-0 items-center bg-[#EEEEE9] py-[3px] px-[11px] gap-1 rounded-full">
                      <span className="text-text-primary text-xs">{formatYoe(candidate.yearsOfExperience)} Experience</span>
                    </div>
                  )}
                  {educationText && (
                    <div className="flex shrink-0 items-center bg-[#EEEEE9] py-[3px] px-[11px] gap-1 rounded-full">
                      <span className="text-text-primary text-xs">{educationText}</span>
                    </div>
                  )}
                  {candidate.noticePeriod && (
                    <div className="flex items-center bg-[#EEEEE9] py-[3px] px-3 gap-1 rounded-full">
                      <span className="text-text-primary text-xs">Notice: {candidate.noticePeriod}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-start self-stretch pt-6 pb-1 gap-8 border-t border-border mt-2">
                  <div className="flex flex-col shrink-0 items-start gap-2">
                    {candidate.email && (
                      <div className="flex items-center">
                        <span className="text-text-secondary text-xs">{candidate.email}</span>
                      </div>
                    )}
                    {candidate.phone && (
                      <div className="flex items-center">
                        <span className="text-text-secondary text-xs">{candidate.phone}</span>
                      </div>
                    )}
                    {candidate.linkedinUrl && (
                      <div className="flex items-center">
                        <span className="text-text-secondary text-xs hover:underline cursor-pointer text-blue-600">{candidate.linkedinUrl}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col shrink-0 items-start gap-2">
                    {candidate.sourceChannel && (
                      <div className="flex items-center">
                        <span className="text-text-primary text-xs mr-2 w-24">Source:</span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-text-secondary text-xs font-medium">{candidate.sourceChannel}</span>
                        </div>
                      </div>
                    )}
                    {(candidate.overallStatus || candidate.status) && (
                      <div className="flex items-center">
                        <span className="text-text-primary text-xs mr-2 w-24">Status:</span>
                        <span className="text-text-secondary text-xs font-medium">
                          {STAGE_LABELS[candidate.overallStatus || candidate.status] || candidate.overallStatus || candidate.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Sidebar on Header */}
              <div className="flex flex-col shrink-0 items-center gap-4 w-full md:w-auto mt-6 md:mt-0 md:pl-6 md:border-l border-border">
                <div className="flex flex-col items-center bg-surface-container-low p-4 gap-1 rounded-lg border border-solid border-border w-full text-center">
                  <span className="text-primary-container text-sm font-bold">
                    Score Pending
                  </span>
                  <span className="text-text-secondary text-xs">
                    {candidate.currentTitle || candidate.currentEmployer || "Awaiting job match"}
                  </span>
                </div>
                <div className="flex flex-col items-stretch gap-2 w-full">
                  <button className="flex items-center justify-center bg-primary-container text-on-primary py-2 px-4 gap-2 rounded-md border-0 hover:bg-[#144718]"
                    onClick={() => setIsAddToJobOpen(true)}>
                    <span className="text-[13px] font-bold">Shortlist for Job</span>
                  </button>
                  <div className="flex items-center gap-2 w-full">
                    <button 
                      onClick={() => setIsVoiceTestOpen(true)}
                      title="Test real-time AI Voice prescreening in browser"
                      className="flex-1 flex justify-center items-center bg-emerald-50 hover:bg-emerald-100 py-2 px-2 gap-1 rounded-md border border-solid border-emerald-300 transition-colors shadow-sm cursor-pointer"
                    >
                      <span className="text-emerald-800 font-bold text-[12px] whitespace-nowrap flex items-center gap-1">
                        🎙️ Test AI Call
                      </span>
                    </button>
                    <button className="flex-1 flex justify-center items-center bg-transparent py-2 px-2 gap-1 rounded-md border border-solid border-border hover:bg-surface-container-high transition-colors"
                      onClick={() => setActiveTab("communications")}>
                      <span className="text-text-primary text-[13px] whitespace-nowrap">Send Email</span>
                    </button>
                  </div>
                  <button className="flex items-center justify-center bg-transparent py-2 px-4 gap-2 rounded-md border border-solid border-[#BA1A1A80] hover:bg-red-50 mt-1"
                    onClick={async () => {
                      if (window.confirm("Are you sure you want to reject this candidate?")) {
                        await setDoNotContact({ candidateId, reason: "Manual rejection from profile" });
                        toast.success("Candidate marked as Do Not Contact");
                      }
                    }}>
                    <span className="text-[#BA1A1A] text-[13px] font-bold">Reject</span>
                  </button>
                </div>
              </div>
            </div>
            
            <AddToJobModal
              isOpen={isAddToJobOpen}
              onClose={() => setIsAddToJobOpen(false)}
              selectedCount={1}
              onConfirm={async (jobId) => {
                await createApplication({
                  candidateId,
                  jobId: jobId as Id<"jobs">,
                  sourceChannel: candidate.firstSourceChannel || "manual_upload"
                });
              }}
            />

            {isVoiceTestOpen && (
              <VoiceTestModal
                isOpen={isVoiceTestOpen}
                onClose={() => setIsVoiceTestOpen(false)}
                candidateId={candidateId}
                jobId={applications?.[0]?.jobId || candidate?.firstSourceJobId || ("j9700000000000000000000000" as any)}
                applicationId={applications?.[0]?._id}
                candidateName={candidate.fullName || "Candidate"}
                jobTitle={applications?.[0]?.jobTitle || candidate.currentTitle || "Open Role"}
                jobDescription={candidate.summary || "General recruitment prescreening"}
              />
            )}

            {/* Tab Menu */}
            <div className="flex items-center self-stretch mb-6 border-b border-gray-200">
              {[
                { key: "overview", label: "Overview" },
                { key: "timeline", label: "Timeline" },
                { key: "communications", label: "Communications" },
                { key: "applications", label: "Job Applications", badge: applications?.length?.toString() ?? "0" },
                { key: "referees", label: "Referees", badge: referees?.length?.toString() ?? "0" },
              ].map((tab) => (
                <div
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex shrink-0 items-center py-3 px-4 cursor-pointer transition-colors hover:bg-surface-container-high ${
                    activeTab === tab.key
                      ? "border-b-2 border-[#00450D]"
                      : ""
                  }`}
                >
                  <span className={
                    activeTab === tab.key
                      ? "text-[#00450D] text-[13px] font-bold"
                      : "text-text-secondary text-[13px]"
                  }>
                    {tab.label}
                  </span>
                  {tab.badge && (
                    <div className="bg-[#DADAD5] py-0.5 px-2 rounded-full ml-2">
                      <span className="text-text-secondary text-[11px] font-bold">{tab.badge}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Main Content */}

            {activeTab === "overview" && (
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-6">
              
              {/* Left Column (Main Info) */}
              <div className="flex flex-col gap-6">
                
                {/* Extracted Profile CV Snapshot */}
                <div className="flex flex-col bg-surface rounded-xl border border-solid border-border shadow-[0px_2px_4px_#0000000D] overflow-hidden">
                  <div className="flex flex-col bg-[#F8FAF2] relative border-b border-border">
                    {cvUpload === undefined ? (
                      <div className="flex items-center justify-center h-[600px]">
                        <span className="text-text-disabled text-sm">Loading CV...</span>
                      </div>
                    ) : cvUpload && cvUpload.url ? (
                      <iframe
                        src={`${cvUpload.url.replace(/^http:\/\/(127\.0\.0\.1|localhost|convex)(:\d+)?/, process.env.NEXT_PUBLIC_CONVEX_URL || "https://api.career141.com")}#target=_blank`}
                        className="w-full h-[800px] border-0"
                        title="CV Preview"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-forms"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 h-[600px]">
                        <span className="text-text-disabled text-sm">No CV file available for preview.</span>
                        <span className="text-text-secondary text-xs">Upload a CV to enable preview.</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-surface border-t border-border p-6 pt-5">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <span className="text-text-primary text-[15px] font-bold">AI-Extracted Profile</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-xs font-medium uppercase tracking-wide">Current Title</span>
                          <span className="text-text-primary text-sm font-semibold">{candidate.currentTitle || "—"}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-xs font-medium uppercase tracking-wide">Current Employer</span>
                          <span className="text-text-primary text-sm font-semibold">{candidate.currentEmployer || "—"}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-xs font-medium uppercase tracking-wide">Total Experience</span>
                          <span className="text-text-primary text-sm font-semibold">{(candidate.totalExperienceYears ?? candidate.yearsOfExperience) != null ? formatYoe((candidate.totalExperienceYears ?? candidate.yearsOfExperience) as number) : "—"}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-text-secondary text-xs font-medium uppercase tracking-wide">Industry Focus</span>
                          <span className="text-text-primary text-sm font-semibold">{candidate.industries?.join(", ") || "—"}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Compact rendering of other AI Extracted details */}
                    <div className="flex flex-col gap-5 mt-6 pt-5 border-t border-gray-100">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-text-secondary text-xs font-medium uppercase tracking-wide">Professional Summary</span>
                        {candidate.summary ? (
                          <span className="text-text-primary text-[13px] leading-relaxed">{candidate.summary}</span>
                        ) : (
                          <span className="text-text-disabled text-[13px] italic">No summary extracted.</span>
                        )}
                      </div>
                      
                      {candidate.skills && candidate.skills.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <span className="text-text-secondary text-xs font-medium uppercase tracking-wide">Key Skills</span>
                          <div className="flex flex-wrap gap-1.5">
                            {candidate.skills.map((skill: string, i: number) => (
                              <div key={i} className="bg-[#E8F5E9] py-0.5 px-2 rounded text-[#00450D] text-[11px] font-medium border border-[#C8E6C9]">
                                {skill}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {candidate.certifications && candidate.certifications.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-text-secondary text-xs font-medium uppercase tracking-wide">Certifications</span>
                            <ul className="list-disc pl-4 m-0 text-text-primary text-[13px]">
                              {candidate.certifications.map((cert: string, i: number) => (
                                <li key={i} className="mb-0.5">{cert}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {candidate.languages && candidate.languages.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-text-secondary text-xs font-medium uppercase tracking-wide">Languages</span>
                            <div className="flex flex-wrap gap-1.5">
                              {candidate.languages.map((lang: string, i: number) => (
                                <span key={i} className="bg-gray-100 py-0.5 px-2 rounded text-text-secondary text-[11px] font-medium">
                                  {lang}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>



                {/* Experience */}
                <div className="flex flex-col bg-surface p-6 rounded-xl border border-solid border-border shadow-[0px_2px_4px_#0000000D] mb-6">
                  <div className="flex items-center mb-6">
                    <span className="text-text-primary text-base font-bold">Experience</span>
                  </div>
                  {candidate.jobHistory && candidate.jobHistory.length > 0 ? (
                    <div className="flex flex-col gap-5">
                      {candidate.jobHistory.map((job: any, i: number) => {
                        const dateStr = job.startDate ? `${job.startDate} — ${job.endDate || 'Present'}` : (job.endDate ? `Until ${job.endDate}` : "");
                        return (
                          <div key={i}>
                            {i > 0 && <div className="h-[1px] bg-gray-100 w-full mb-5"></div>}
                            <div className="flex items-start gap-4">
                              <div className="bg-[#F8FAF2] p-2 rounded-lg border border-border w-12 h-12 flex items-center justify-center text-primary-container text-sm font-bold shrink-0 uppercase">
                                {job.company?.charAt(0) || "C"}
                              </div>
                              <div className="flex flex-col w-full">
                                <span className="text-text-primary text-[14px] font-bold">{job.title || "Unknown Title"}</span>
                                <span className="text-text-secondary text-xs mt-0.5 font-medium">{job.company || "Unknown Company"}{dateStr ? ` • ${dateStr}` : ""}</span>
                                {job.description && (
                                  <p className="text-text-secondary text-xs mt-2.5 leading-relaxed whitespace-pre-wrap">
                                    {job.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-text-disabled text-sm">No experience data extracted.</span>
                  )}
                </div>

                {/* Education */}
                <div className="flex flex-col bg-surface p-6 rounded-xl border border-solid border-border shadow-[0px_2px_4px_#0000000D]">
                  <div className="flex items-center mb-6">
                    <span className="text-text-primary text-base font-bold">Education</span>
                  </div>
                  {candidate.education && candidate.education.length > 0 ? (
                    <div className="flex flex-col gap-5">
                      {candidate.education.map((edu: { degree?: string; institution?: string; year?: string | number; field?: string }, i: number) => (
                        <div key={i}>
                          {i > 0 && <div className="h-[1px] bg-gray-100 w-full mb-5"></div>}
                          <div className="flex items-start gap-4">
                            <div className="bg-[#F8FAF2] p-2 rounded-lg border border-border w-12 h-12 flex items-center justify-center text-primary-container text-sm font-bold shrink-0">
                              {edu.institution?.charAt(0) || "E"}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-text-primary text-[14px] font-bold">{edu.degree || ""}{edu.field ? ` in ${edu.field}` : ""}</span>
                              <span className="text-text-secondary text-xs mt-0.5">{edu.institution || ""}{edu.year ? ` • ${edu.year}` : ""}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-text-disabled text-sm">No education data extracted.</span>
                  )}
                </div>

                {/* Referees */}
                <div className="flex flex-col bg-surface p-6 rounded-xl border border-solid border-border shadow-[0px_2px_4px_#0000000D]">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-text-primary text-base font-bold">Referees</span>
                    {referees && referees.length > 0 && (
                      <span className="text-xs text-text-secondary bg-[#EEEEE9] py-0.5 px-2 rounded-full font-medium">
                        {referees.length} Reference{referees.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {referees === undefined ? (
                    <span className="text-text-disabled text-sm">Loading referees...</span>
                  ) : referees.length === 0 ? (
                    <span className="text-text-disabled text-sm">No referees extracted or listed.</span>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {referees.map((ref) => (
                        <div key={ref._id} className="flex flex-col p-4 bg-[#F8FAF2] rounded-lg border border-border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-text-primary text-[14px] font-bold">{ref.name}</span>
                            {ref.relationship && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                {ref.relationship}
                              </span>
                            )}
                          </div>
                          <span className="text-text-secondary text-xs font-medium">
                            {[ref.designation, ref.company].filter(Boolean).join(" • ") || "No designation listed"}
                          </span>
                          <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-border/50 text-xs">
                            {ref.email && (
                              <span className="text-text-secondary">
                                Email: <a href={`mailto:${ref.email}`} className="text-blue-600 hover:underline">{ref.email}</a>
                              </span>
                            )}
                            {ref.contactNo && (
                              <span className="text-text-secondary">
                                Phone: <a href={`tel:${ref.contactNo}`} className="text-text-primary font-medium hover:underline">{ref.contactNo}</a>
                              </span>
                            )}
                            {ref.notes && <p className="text-text-secondary italic mt-1">{ref.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Right Column (Sidebar widgets) */}
              <div className="flex flex-col gap-6">
                
                {/* Active Applications */}
                <div className="flex flex-col bg-surface rounded-xl border border-solid border-border shadow-[0px_2px_4px_#0000000D] overflow-hidden">
                  <div className="flex items-center bg-background py-3 px-4 border-b border-border">
                    <span className="text-text-primary text-sm font-bold">Active Applications</span>
                    {applications && <span className="ml-auto text-xs text-text-secondary">{applications.length} job{applications.length !== 1 ? 's' : ''}</span>}
                  </div>
                  <div className="flex flex-col divide-y divide-gray-100">
                    {applications === undefined ? (
                      <div className="py-4 px-4 text-xs text-text-disabled">Loading...</div>
                    ) : applications.length === 0 ? (
                      <div className="py-6 px-4 text-center text-text-disabled text-xs">No active applications yet.</div>
                    ) : (
                      applications.filter(a => a.currentStage !== 'rejected').slice(0, 5).map((app) => (
                        <div key={app._id} className="flex flex-col py-4 px-4 hover:bg-surface-container-high transition-colors cursor-pointer">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-text-primary text-[14px] font-bold text-blue-700 hover:underline">{app.jobTitle}</span>
                            {app.aiMatchScore != null && (
                              <div className={`py-0.5 px-2 rounded ${app.aiMatchScore >= 75 ? 'bg-primary-container' : 'bg-[#DADAD5]'}`}>
                                <span className={`text-[11px] font-bold ${app.aiMatchScore >= 75 ? 'text-on-primary' : 'text-text-primary'}`}>{app.aiMatchScore}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-text-secondary text-xs mb-2">{app.clientName}</span>
                          <span className="text-[#00450D] text-[11px] font-medium">Stage: {STAGE_LABELS[app.currentStage] || app.currentStage}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex flex-col bg-surface p-5 rounded-xl border border-solid border-border shadow-[0px_2px_4px_#0000000D]">
                  <div className="flex items-center mb-4">
                    <img
                      src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/helwqcbd_expires_30_days.png" 
                      className="w-4 h-4 mr-2 object-fill"
                      alt="Icon"
                    />
                    <span className="text-text-primary text-sm font-bold">AI Call Summary</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {aiCalls === undefined ? (
                      <span className="text-text-disabled text-xs">Loading...</span>
                    ) : aiCalls.length === 0 ? (
                      <span className="text-text-disabled text-xs">No AI calls recorded yet.</span>
                    ) : (
                      aiCalls.slice(0, 3).map((call) => (
                        <div key={call._id} className={`flex items-center p-3 gap-3 rounded-lg border ${call.callStatus === 'completed' ? 'bg-[#91F78E1A] border-[#91F78E4D]' : 'bg-[#F8FAF2] border-border'}`}>
                          <div className="flex flex-col flex-1">
                            <span className="text-text-primary text-[13px] font-medium capitalize">
                              {call.callScriptUsed.replace(/_/g, ' ')}
                            </span>
                            <span className="text-text-secondary text-xs mt-0.5">
                              {new Date(call.calledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • <span className={call.callStatus === 'completed' ? "text-[#00450D] font-medium" : "text-text-secondary capitalize"}>{call.ivrResponse?.replace(/pressed_[0-9]_/g, '').replace(/_/g, ' ') || call.callStatus.replace(/_/g, ' ')}</span>
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                    {aiCalls && aiCalls.length > 3 && (
                      <button className="text-[#00450D] text-[13px] font-bold bg-transparent border-0 mt-1 hover:underline cursor-pointer"
                        onClick={() => setActiveTab('communications')}>
                        View History
                      </button>
                    )}
                  </div>
                </div>

                {/* Source History */}
                <div className="flex flex-col bg-surface p-5 rounded-xl border border-solid border-border shadow-[0px_2px_4px_#0000000D]">
                  <div className="flex items-center mb-5">
                    <span className="text-text-primary text-sm font-bold">Source History</span>
                  </div>
                  <div className="flex flex-col gap-4">
                    {candidate?.firstSourceChannel ? (
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          candidate.firstSourceChannel === 'linkedin' ? 'bg-blue-500' :
                          candidate.firstSourceChannel === 'whatsapp' ? 'bg-[#25D366]' :
                          candidate.firstSourceChannel === 'email_campaign' ? 'bg-orange-400' :
                          candidate.firstSourceChannel === 'email' ? 'bg-orange-400' :
                          'bg-gray-400'
                        }`} />
                        <div className="flex flex-col">
                          <span className="text-text-primary text-[13px] font-medium leading-tight capitalize">
                            {candidate.firstSourceChannel.replace(/_/g, ' ')}
                          </span>
                          {candidate.firstSeenAt && (
                            <span className="text-text-secondary text-xs mt-1">
                              {new Date(candidate.firstSeenAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-text-disabled text-xs">No source data recorded.</span>
                    )}
                  </div>
                </div>

              </div>
            </div>
            )}

            {activeTab === "timeline" && (
              <div className="flex flex-col bg-surface rounded-xl border border-solid border-border overflow-hidden">
                <div className="flex items-center px-6 py-4 border-b border-border">
                  <span className="text-text-primary text-sm font-bold">Activity Timeline</span>
                </div>
                <div className="flex flex-col divide-y divide-border">
                  {timeline === undefined ? (
                    <div className="p-8 text-center text-text-disabled text-sm">Loading timeline...</div>
                  ) : timeline.length === 0 ? (
                    <div className="p-8 text-center text-text-disabled text-sm">No activity recorded yet.</div>
                  ) : (
                    timeline.map((event) => (
                      <div key={event._id} className="flex items-start gap-4 px-6 py-4 hover:bg-surface-container-high transition-colors">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          event.eventType === 'stage_change' ? 'bg-primary-container' :
                          event.eventType === 'note_added' ? 'bg-blue-400' :
                          'bg-gray-300'
                        }`} />
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-text-primary text-[13px] font-medium">
                              {event.eventType === 'stage_change'
                                ? `Moved to ${(event.toStage ?? '').replace(/_/g, ' ')}`
                                : event.eventType === 'note_added'
                                ? 'Note added'
                                : event.eventType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-text-secondary text-xs">
                              {new Date(event.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <span className="text-text-secondary text-xs mt-0.5">{event.jobTitle}</span>
                          {event.notes && <span className="text-text-secondary text-xs mt-1 italic">{event.notes}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "communications" && (
              <div className="flex flex-col items-center justify-center py-16 bg-surface rounded-xl border border-solid border-border">
                <span className="text-text-primary text-sm font-bold mb-2">Communications</span>
                <span className="text-text-disabled text-xs">Communication history coming soon.</span>
              </div>
            )}

            {activeTab === "applications" && (
              <div className="flex flex-col bg-surface rounded-xl border border-solid border-border overflow-hidden">
                <div className="flex items-center px-6 py-4 border-b border-border">
                  <span className="text-text-primary text-sm font-bold">Job Applications</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                        <th className="p-4">Job</th>
                        <th className="p-4">Company</th>
                        <th className="p-4">Stage</th>
                        <th className="p-4">Score</th>
                        <th className="p-4">Source</th>
                        <th className="p-4">Applied</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-[13px] text-text-primary">
                      {applications === undefined ? (
                        <tr><td colSpan={6} className="p-8 text-center text-text-disabled">Loading...</td></tr>
                      ) : applications.length === 0 ? (
                        <tr><td colSpan={6} className="p-8 text-center text-text-disabled">No applications yet.</td></tr>
                      ) : (
                        applications.map((app) => (
                          <tr key={app._id} className="hover:bg-surface-bright transition-colors">
                            <td className="p-4 font-medium">{app.jobTitle}</td>
                            <td className="p-4 text-text-secondary">{app.clientName || '—'}</td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-container text-text-primary">
                                {STAGE_LABELS[app.currentStage] || app.currentStage}
                              </span>
                            </td>
                            <td className="p-4">
                              {app.aiMatchScore != null
                                ? <span className={`font-bold ${app.aiMatchScore >= 75 ? 'text-primary-container' : 'text-text-secondary'}`}>{app.aiMatchScore}</span>
                                : <span className="text-text-disabled">—</span>}
                            </td>
                            <td className="p-4 text-text-secondary capitalize">{app.sourceChannel.replace(/_/g, ' ')}</td>
                            <td className="p-4 text-text-secondary">
                              {new Date(typeof app.createdAt === 'number' ? app.createdAt : Number(app.createdAt)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "referees" && (
              <div className="flex flex-col bg-surface rounded-xl border border-solid border-border overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <div className="flex flex-col">
                    <span className="text-text-primary text-sm font-bold">Referees</span>
                    <span className="text-text-secondary text-xs mt-0.5">Professional references extracted from CV or stored for this candidate</span>
                  </div>
                  <button
                    disabled={isReparsingReferees}
                    onClick={async () => {
                      setIsReparsingReferees(true);
                      try {
                        const res = await reparseReferees({ candidateId });
                        toast.success(`Referees extracted successfully! (${res.refereesCount} references found)`);
                      } catch (err: any) {
                        toast.error(err?.message || "Failed to re-extract referees");
                      } finally {
                        setIsReparsingReferees(false);
                      }
                    }}
                    className="flex items-center gap-1.5 bg-primary-container text-on-primary py-1.5 px-3 rounded-md text-xs font-bold hover:bg-[#144718] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isReparsingReferees ? "Extracting..." : "⚡ Re-extract Referees"}
                  </button>
                </div>
                <div className="flex flex-col p-6">
                  {referees === undefined ? (
                    <div className="p-8 text-center text-text-disabled text-sm">Loading referees...</div>
                  ) : referees.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {referees.map((ref) => (
                        <div key={ref._id} className="flex flex-col p-4 bg-surface-bright rounded-lg border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-text-primary text-[14px] font-bold">{ref.name}</span>
                            {ref.relationship && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                {ref.relationship}
                              </span>
                            )}
                          </div>
                          <span className="text-text-secondary text-xs font-medium">
                            {[ref.designation, ref.company].filter(Boolean).join(" • ") || "No designation listed"}
                          </span>
                          <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-border/50 text-xs">
                            {ref.email && (
                              <span className="text-text-secondary">
                                Email: <a href={`mailto:${ref.email}`} className="text-blue-600 hover:underline">{ref.email}</a>
                              </span>
                            )}
                            {ref.contactNo && (
                              <span className="text-text-secondary">
                                Phone: <a href={`tel:${ref.contactNo}`} className="text-text-primary font-medium hover:underline">{ref.contactNo}</a>
                              </span>
                            )}
                            {ref.notes && <p className="text-text-secondary italic mt-1">{ref.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-text-secondary mb-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <span className="text-text-primary text-sm font-bold mb-1">No Referees Found</span>
                      <span className="text-text-secondary text-xs max-w-sm">No professional references have been extracted or stored for this candidate yet.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
  );
}
