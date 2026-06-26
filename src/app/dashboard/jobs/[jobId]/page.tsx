"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, Check, Copy, ChevronRight, 
  Users, Layers, FileText, ListTodo, PhoneCall, 
  CheckCircle2, UserCheck, Building2, Video, 
  Award, Star, XCircle, Tag, Calendar, User,
  QrCode, Edit, Download, MoreVertical, ArrowUpDown, Filter, Bot
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from '../../../../../convex/_generated/dataModel';
import { formatDistanceToNow } from 'date-fns';

const PIPELINE_STAGES = [
  { id: "new_cvs", label: "New CVs" },
  { id: "ta_shortlist", label: "TA Shortlist" },
  { id: "ai_call", label: "AI Phone Screen" },
  { id: "second_shortlist", label: "2nd Shortlist" },
  { id: "director_review", label: "Director Review" },
  { id: "client_review", label: "Client Review" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
  { id: "placed", label: "Placed" },
  { id: "rejected", label: "Rejected" },
];

const MOCK_DATA = {
  'New CVs': [
    { id: '1', name: 'Kasun Fernando', source: 'LinkedIn', score: 92, status: 'Not Called' },
    { id: '2', name: 'Priya Sharma', source: 'WhatsApp', score: 87, status: 'Not Called' },
    { id: '3', name: 'Ashan Mendis', source: 'Email', score: 79, status: 'Not Called' },
    ...Array.from({ length: 44 }).map((_, i) => ({
       id: `n${i}`, name: `Candidate N${i}`, source: 'Workable', score: 70 + (i % 20), status: 'Not Called'
    }))
  ],
  'TA Shortlist': [
    { id: '1', name: 'Kasun Fernando', score: 92, status: 'Not Called' },
    { id: '2', name: 'Priya Sharma', score: 87, status: 'Not Called' },
    { id: '3', name: 'Ashan Mendis', score: 79, status: 'Scheduled' },
    ...Array.from({ length: 9 }).map((_, i) => ({
       id: `t${i}`, name: `Candidate T${i}`, score: 85, status: 'Not Called'
    }))
  ],
  'AI Call': [
    { id: '1', name: 'Kasun Fernando', currentSalary: '$2,500', expectedSalary: '$3,200', noticePeriod: '1 month', budgetFit: true },
    { id: '2', name: 'Priya Sharma', currentSalary: '$4,000', expectedSalary: '$6,500', noticePeriod: '2 months', budgetFit: false },
    { id: '3', name: 'Ashan Mendis', currentSalary: '—', expectedSalary: '—', noticePeriod: '—', budgetFit: null },
    ...Array.from({ length: 5 }).map((_, i) => ({
       id: `a${i}`, name: `Candidate A${i}`, currentSalary: '$2,800', expectedSalary: '$3,000', noticePeriod: '1 month', budgetFit: true
    }))
  ],
  '2nd Shortlist': [
    { id: '1', name: 'Kasun Fernando', expectedSalary: '$3,200', noticePeriod: '1 month', fit: 'Good' },
    ...Array.from({ length: 5 }).map((_, i) => ({
       id: `s2_${i}`, name: `Candidate S${i}`, expectedSalary: '$3,000', noticePeriod: '1 month', fit: 'Good'
    }))
  ],
  'Director Review': [
    { id: '1', name: 'Kasun Fernando', score: 92, salaryFit: 'Good', decision: 'Pending' },
    ...Array.from({ length: 5 }).map((_, i) => ({
       id: `d${i}`, name: `Candidate D${i}`, score: 88, salaryFit: 'Good', decision: 'Pending'
    }))
  ],
  'Client Review': [
    { id: '1', name: 'Kasun Fernando', score: 92, decision: 'Pending' },
    ...Array.from({ length: 3 }).map((_, i) => ({
       id: `c${i}`, name: `Candidate C${i}`, score: 90, decision: 'Pending'
    }))
  ],
  'Interview': [
    { id: '1', name: 'Kasun Fernando', date: '15 Jun 2026', feedback: 'Pending' },
    { id: '2', name: 'Sarah Connor', date: '16 Jun 2026', feedback: 'Good' }
  ],
  'Offer': [
    { id: '1', name: 'Kasun Fernando', salary: '$3,200', startDate: '1 Aug', status: 'Pending' }
  ],
  'Placed': [
    { id: '10', name: 'John Doe', role: 'Brand Manager', date: '01 Jun 2026' }
  ],
  'Rejected': [
    { id: '2', name: 'Priya Sharma', reason: 'Expected salary over budget ($6,500)' },
    ...Array.from({ length: 15 }).map((_, i) => ({
       id: `r${i}`, name: `Rejected Candidate ${i}`, reason: 'Not a good fit'
    }))
  ]
};

const TABS = [
  { id: 'New CVs', label: 'New CVs', icon: FileText },
  { id: 'TA Shortlist', label: 'TA Shortlist', icon: ListTodo },
  { id: 'AI Call', label: 'AI Call', icon: PhoneCall },
  { id: '2nd Shortlist', label: 'Second Shortlist', icon: CheckCircle2 },
  { id: 'Director Review', label: 'Director Review', icon: UserCheck },
  { id: 'Client Review', label: 'Client Review', icon: Building2 },
  { id: 'Interview', label: 'Interview', icon: Video },
  { id: 'Offer', label: 'Offer', icon: Award },
  { id: 'Placed', label: 'Placed', icon: Star },
  { id: 'Rejected', label: 'Rejected', icon: XCircle },
];

const ScoreRing = ({ score }: { score: number | string }) => {
  if (score === 'Pending') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-text-secondary">
        Pending
      </span>
    );
  }
  
  const numScore = typeof score === 'number' ? score : parseInt(String(score).replace('%', ''));
  const colorClass = numScore >= 80 ? 'text-green-500' : numScore >= 60 ? 'text-yellow-500' : 'text-red-500';
  const strokeDasharray = `${numScore}, 100`;

  return (
    <div className="flex items-center gap-2">
      <div className="relative inline-flex items-center justify-center w-8 h-8">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <path className="text-border" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path className={`${colorClass} transition-all duration-1000 ease-out`} strokeDasharray={strokeDasharray} strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
        <span className={`absolute text-[10px] font-bold ${colorClass}`}>{numScore}</span>
      </div>
      <span className="text-xs font-medium text-text-secondary">Match</span>
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

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as Id<"jobs">;

  const [activeMainTab, setActiveMainTab] = useState<'matches' | 'pipeline'>('matches');
  const [activePipelineTab, setActivePipelineTab] = useState('TA Shortlist');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Fetch job details
  const job = useQuery(api.jobs.getJob, { jobId });
  
  // Fetch candidates via applications
  const applications = useQuery(api.applications.getByJobId, { jobId });
  const setPipelineStage = useMutation(api.pipeline.stages.setPipelineStage);
  
  const runReverseMatch = useAction(api.reverseMatch.runReverseMatch);
  const [isScanning, setIsScanning] = useState(false);

  const handleScanDatabase = async () => {
    setIsScanning(true);
    try {
      await runReverseMatch({ jobId: jobId as Id<"jobs"> });
    } catch (error) {
      console.error(error);
      alert("Error scanning database");
    } finally {
      setIsScanning(false);
    }
  };

  const [copiedLink, setCopiedLink] = useState(false);
  const copyPublicLink = () => {
    alert("Public apply URL feature not enabled yet.");
  };

  // Reset pagination on tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [activePipelineTab, activeMainTab]);

  if (job === undefined || applications === undefined) {
    return <div className="p-8">Loading...</div>;
  }

  if (job === null) {
    return <div className="p-8">Job not found.</div>;
  }

  const newCvs = applications.filter(app => app.currentStage === "new_cvs");
  
  const handleStageChange = async (appId: string, newStage: string) => {
    if (!appId.startsWith('dummy|')) {
      try {
        await setPipelineStage({ applicationId: appId as Id<"applications">, newStage });
      } catch (e: any) {
        alert("Error changing stage: " + e.message);
      }
    } else {
      alert("Cannot move mock dummy data!");
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

  
  const renderMatchesTable = () => (
    <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col mb-0">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex justify-between items-center bg-surface">
        <div className="flex gap-2 text-[13px]">
          <h3 className="font-semibold text-[15px]">AI Matches from Database</h3>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleScanDatabase}
            disabled={isScanning}
            className="border border-primary text-primary px-3 py-1.5 rounded-[8px] text-[13px] font-medium hover:bg-primary/10 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <Bot className="w-4 h-4" /> {isScanning ? "Scanning..." : "Scan Database"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
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
            {(!job?.reverseMatchResults || job.reverseMatchResults.length === 0) ? (
              <tr><td colSpan={7} className="p-8 text-center text-text-secondary">No AI matches found. Click 'Scan Database' to find candidates!</td></tr>
            ) : (
              job.reverseMatchResults.map((match: any) => (
                <tr key={match.cvId} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4"><input className="rounded border-border text-primary-container focus:ring-primary-container" type="checkbox" /></td>
                  <td className="p-4 font-medium">
                    <Link href={`/dashboard/candidates/${match.cvId}`} className="text-text-primary hover:underline">
                      Candidate ID: {match.cvId.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="p-4"><span className="text-[#0A66C2] font-medium">{match.sourceLevel1 || 'Database'}</span></td>
                  <td className="p-4"><ScoreRing score={match.overallScore} /></td>
                  <td className="p-4 text-text-secondary">
                    Matched: {match.matchedSkills?.length || 0} / Missing: {match.missingSkills?.length || 0}
                  </td>
                  <td className="p-4 text-xs text-text-secondary max-w-[200px] truncate" title={match.reason}>{match.reason || 'N/A'}</td>
                  <td className="p-4 text-right">
                    <Link href={`/dashboard/candidates/${match.cvId}`}>
                      <button className="border border-border text-text-secondary px-3 py-1.5 rounded-[8px] hover:bg-surface-container transition-colors">
                        View
                      </button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderNewCVsTable = () => (
    <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col mb-0">
            {/* Toolbar */}
            <div className="p-4 border-b border-border flex justify-between items-center bg-surface">
              <div className="flex gap-2 text-[13px]">
                <button className="px-3 py-1.5 bg-surface-container rounded-[6px] text-text-primary font-medium flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary-container"></div> All Sources
                </button>
                <button className="px-3 py-1.5 hover:bg-surface-container rounded-[6px] text-text-secondary flex items-center gap-2 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-[#0A66C2]"></div> LinkedIn
                </button>
                <button className="px-3 py-1.5 hover:bg-surface-container rounded-[6px] text-text-secondary flex items-center gap-2 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-[#25D366]"></div> WhatsApp
                </button>
              </div>
              <div className="flex gap-3">
                <button className="border border-border text-text-secondary px-3 py-1.5 rounded-[8px] text-[13px] hover:bg-surface-container transition-colors flex items-center gap-1">
                  <ArrowUpDown className="w-4 h-4" /> Sort: Score
                </button>
                <button className="border border-border text-text-secondary px-3 py-1.5 rounded-[8px] text-[13px] hover:bg-surface-container transition-colors flex items-center gap-1">
                  <Filter className="w-4 h-4" /> Filter
                </button>
                <button className="border border-primary-container text-primary-container px-3 py-1.5 rounded-[8px] text-[13px] font-medium hover:bg-primary-container/10 transition-colors flex items-center gap-1">
                  <Bot className="w-4 h-4" /> Bulk AI Call
                </button>
              </div>
            </div>
            
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                    <th className="p-4 w-10"><input className="rounded border-border text-primary-container focus:ring-primary-container" type="checkbox" /></th>
                    <th className="p-4">Candidate</th>
                    <th className="p-4">Source</th>
                    <th className="p-4">Match Score</th>
                    <th className="p-4">Role & Exp</th>
                    <th className="p-4">AI Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-[13px] text-text-primary divide-y divide-border">
                  {newCvs.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-text-secondary">No candidates found. Start by sourcing!</td></tr>
                  ) : (
                    newCvs.map(app => (
                      <tr key={app._id} className="hover:bg-surface-bright transition-colors group">
                        <td className="p-4"><input className="rounded border-border text-primary-container focus:ring-primary-container" type="checkbox" /></td>
                        <td className="p-4 font-medium">
                          <Link href={`/dashboard/candidates/${app.candidateId}`} className="text-text-primary hover:underline">
                            {app.candidate?.fullName || 'Unknown Candidate'}
                          </Link>
                        </td>
                        <td className="p-4"><span className="text-[#0A66C2] font-medium">{(app.candidate as any)?.source || 'LinkedIn'}</span></td>
                        <td className="p-4"><ScoreRing score={app.aiMatchScore || 'Pending'} /></td>
                        <td className="p-4 text-text-secondary">
                          {app.candidate?.currentJobTitle || 'Unknown'} 
                          {(app.candidate as any)?.experienceTotalYears ? ` (${(app.candidate as any).experienceTotalYears}y)` : ''}
                        </td>
                        <td className="p-4"><StatusDot status={app.aiCallStatus || 'Not Called'} /></td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end">
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
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
  );

  const renderPipelineTable = () => {
    // Map TABS to PIPELINE_STAGES ids
    const stageMap: Record<string, string> = {
      'New CVs': 'new_cvs',
      'TA Shortlist': 'ta_shortlist',
      'AI Call': 'ai_call',
      '2nd Shortlist': 'second_shortlist',
      'Director Review': 'director_review',
      'Client Review': 'client_review',
      'Interview': 'interview',
      'Offer': 'offer',
      'Placed': 'placed',
      'Rejected': 'rejected'
    };

    const currentStageId = stageMap[activePipelineTab];
    let stageApps = applications.filter(app => app.currentStage === currentStageId);
    
    // Map real data to mock data format to reuse the tables
    let itemsToRender: any[] = [];
    
    if (stageApps.length > 0) {
      itemsToRender = stageApps.map(app => ({
        id: app._id,
        name: app.candidate?.fullName || 'Unknown Candidate',
        score: app.aiMatchScore || 'Pending',
        status: app.taShortlistStatus || 'Pending',
        currentSalary: app.candidate?.currentSalary ? '$' + app.candidate.currentSalary : '—',
        expectedSalary: app.candidate?.expectedSalary ? '$' + app.candidate.expectedSalary : '—',
        noticePeriod: app.candidate?.noticePeriodDays ? app.candidate.noticePeriodDays + ' days' : '—',
        budgetFit: true,
        fit: 'Good',
        salaryFit: 'Good',
        decision: 'Pending',
        date: app.lastStageChangedAt ? formatDistanceToNow(app.lastStageChangedAt) + ' ago' : '—',
        feedback: 'Pending',
        salary: app.candidate?.expectedSalary ? '$' + app.candidate.expectedSalary : '—',
        startDate: 'TBD',
        role: job.title,
        reason: app.taRejectionReason || 'Not a fit'
      }));
    } else {
      // Use MOCK DATA as dummy data
      itemsToRender = MOCK_DATA[activePipelineTab as keyof typeof MOCK_DATA] || [];
      itemsToRender = itemsToRender.map(item => ({...item, id: 'dummy|' + item.id}));
    }

    const totalItems = itemsToRender.length;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentItems = itemsToRender.slice(startIndex, startIndex + itemsPerPage);

    const renderKanbanDropdown = (itemId: string, defaultStage: string) => (
      <div className="flex justify-end">
        <select 
          className="appearance-none bg-primary text-on-primary border border-transparent rounded-[6px] px-3 py-1.5 text-[12px] font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer shadow-sm text-center min-w-[120px]"
          onChange={(e) => handleStageChange(itemId, e.target.value)}
          value={defaultStage}
        >
          <option value="" disabled>Move To...</option>
          {PIPELINE_STAGES.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>
    );

    let tableContent = null;
    
    switch(activePipelineTab) {
      case 'New CVs':
        tableContent = renderNewCVsTable();
        break;


      case 'TA Shortlist':
        tableContent = (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Match Score</th>
                <th className="p-4">AI Call Status</th>
                <th className="p-4 text-right">Move To Stage</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4"><ScoreRing score={item.score} /></td>
                  <td className="p-4"><StatusDot status={item.status} /></td>
                  <td className="p-4 text-right">
                    {renderKanbanDropdown(item.id, 'ta_shortlist')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
        break;
      case 'AI Call':
        tableContent = (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Current Salary</th>
                <th className="p-4">Expected Salary</th>
                <th className="p-4">Notice Period</th>
                <th className="p-4 text-right">Move To Stage</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4">{item.currentSalary}</td>
                  <td className="p-4">
                    {item.expectedSalary}
                    {item.budgetFit === false && <span className="ml-2 text-error text-[11px] font-medium bg-error/10 px-2 py-0.5 rounded-full">Over Budget</span>}
                  </td>
                  <td className="p-4">{item.noticePeriod}</td>
                  <td className="p-4 text-right">
                    {renderKanbanDropdown(item.id, 'ai_call')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
        break;
      case '2nd Shortlist':
        tableContent = (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Expected Salary</th>
                <th className="p-4">Notice Period</th>
                <th className="p-4">Fit</th>
                <th className="p-4 text-right">Move To Stage</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4">{item.expectedSalary}</td>
                  <td className="p-4">{item.noticePeriod}</td>
                  <td className="p-4"><span className="text-green-500 font-medium">✅ {item.fit}</span></td>
                  <td className="p-4 text-right">
                    {renderKanbanDropdown(item.id, 'second_shortlist')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
        break;
      case 'Director Review':
        tableContent = (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Score</th>
                <th className="p-4">Salary Fit</th>
                <th className="p-4">Director Decision</th>
                <th className="p-4 text-right">Move To Stage</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4"><ScoreRing score={item.score} /></td>
                  <td className="p-4">✅ {item.salaryFit}</td>
                  <td className="p-4"><StatusDot status={item.decision} /></td>
                  <td className="p-4 text-right">
                    {renderKanbanDropdown(item.id, 'director_review')}
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
                <th className="p-4">Client Decision</th>
                <th className="p-4 text-right">Move To Stage</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4"><ScoreRing score={item.score} /></td>
                  <td className="p-4"><StatusDot status={item.decision} /></td>
                  <td className="p-4 text-right">
                    {renderKanbanDropdown(item.id, 'client_review')}
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
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
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
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4 font-bold">{item.salary}</td>
                  <td className="p-4">{item.startDate}</td>
                  <td className="p-4"><StatusDot status={item.status} /></td>
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
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
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
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
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
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {tableContent}
        </div>
        {renderPagination(totalItems)}
      </div>
    );
  };

  return (
    <div className="flex-1 w-full bg-background p-8 min-h-screen font-body max-w-[1400px] mx-auto pb-32">
      {/* Header */}
      <div className="bg-surface rounded-[12px] border border-border shadow-subtle p-[24px] mb-[24px]">
        <div className="text-[12px] text-text-secondary mb-2 font-body flex items-center gap-1">
          <Link className="hover:text-primary-container" href="/dashboard/jobs">Jobs</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>{job.title} — {(job as any).client || 'Atlas Holdings'}</span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-[22px] font-semibold text-text-primary mb-3">{job.title}</h1>
            <div className="flex items-center gap-4 text-body font-body text-text-secondary mb-4">
              <div className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {(job as any).client || 'Atlas Holdings'}</div>
              <div className="flex items-center gap-1"><Tag className="w-4 h-4" /> Keyword: BRAND24</div>
              <div className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Created: 12 Jun 2026</div>
              <div className="flex items-center gap-1"><User className="w-4 h-4" /> TA: Shambra Ameen</div>
            </div>
            <div className="flex gap-2">
              <span className="bg-primary-container/15 text-primary-container px-3 py-1 rounded-full text-[12px] font-medium border border-primary-container/20">
                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
              </span>
              <span className="bg-surface-container text-text-secondary px-3 py-1 rounded-full text-[12px] border border-border">{job.location}</span>
              <span className="bg-surface-container text-text-secondary px-3 py-1 rounded-full text-[12px] border border-border">FMCG</span>
              <span className="bg-surface-container text-text-secondary px-3 py-1 rounded-full text-[12px] border border-border">Confidential</span>
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
                <div className="text-[20px] font-bold text-primary-container">78<span className="text-[12px] text-text-secondary font-normal">/100</span></div>
                <div className="text-[11px] text-text-secondary">AI Avg Score</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => alert("QR feature not implemented yet.")}
                className="border border-border text-text-primary hover:border-primary-container hover:text-primary-container px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1"
              >
                <QrCode className="w-4 h-4" /> Ad QR Code
              </button>
              <button className="border border-border text-text-primary hover:border-primary-container hover:text-primary-container px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1">
                <Edit className="w-4 h-4" /> Edit Job
              </button>
              <button className="border border-border text-text-primary hover:border-primary-container hover:text-primary-container px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1">
                <Download className="w-4 h-4" /> Export CVs
              </button>
              <button className="border border-border text-text-primary hover:bg-surface-container px-2 py-1.5 rounded-[8px] transition-colors flex items-center">
                <MoreVertical className="w-4 h-4" />
              </button>
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
          Matches ({job?.reverseMatchResults?.length || 0})
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

      {/* Secondary Navigation (Pipeline Sub-tabs) */}
      <div className="flex flex-wrap gap-2 mb-6 sticky top-0 bg-background/95 backdrop-blur z-10 py-4 border-b border-border shadow-sm">
        {TABS.map(tab => {
          const Icon = tab.icon;
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
    </div>
  );
}