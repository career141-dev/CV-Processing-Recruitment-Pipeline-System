"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// MOCK DATA GENERATION
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
  { id: 'New CVs', label: 'New CVs' },
  { id: 'TA Shortlist', label: 'TA Shortlist' },
  { id: 'AI Call', label: 'AI Call' },
  { id: '2nd Shortlist', label: 'Second Shortlist' },
  { id: 'Director Review', label: 'Director Review' },
  { id: 'Client Review', label: 'Client Review' },
  { id: 'Interview', label: 'Interview' },
  { id: 'Offer', label: 'Offer' },
  { id: 'Placed', label: 'Placed' },
  { id: 'Rejected', label: 'Rejected' },
];

export default function JobDetailsPage() {
  const [activeTab, setActiveTab] = useState('New CVs');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset page on tab change
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setCurrentPage(1);
  };

  const activeData = MOCK_DATA[activeTab as keyof typeof MOCK_DATA] || [];
  const totalPages = Math.ceil(activeData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = activeData.slice(startIndex, startIndex + itemsPerPage);

  const renderPagination = () => {
    if (activeData.length === 0) return null;
    return (
      <div className="p-4 border-t border-border flex justify-between items-center text-[12px] text-text-secondary bg-surface-bright">
        <span>Showing {Math.min(startIndex + 1, activeData.length)} to {Math.min(startIndex + itemsPerPage, activeData.length)} of {activeData.length} candidates (Page {currentPage} of {totalPages})</span>
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

  const renderTabContent = () => {
    switch(activeTab) {
      case 'New CVs':
        return (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Source</th>
                <th className="p-4">Match Score</th>
                <th className="p-4">AI Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium text-primary-container">{item.name}</td>
                  <td className="p-4">{item.source}</td>
                  <td className="p-4 font-bold text-primary-container">{item.score}</td>
                  <td className="p-4">{item.status}</td>
                  <td className="p-4 text-right">
                    <button className="px-3 py-1 bg-primary-container text-on-primary rounded-[6px] text-[12px] font-medium mr-2 hover:bg-primary">Shortlist</button>
                    <button className="px-3 py-1 border border-error text-error rounded-[6px] text-[12px] font-medium hover:bg-error/5">Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'TA Shortlist':
        return (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Match Score</th>
                <th className="p-4">AI Call Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4 font-bold">{item.score}</td>
                  <td className="p-4">{item.status}</td>
                  <td className="p-4 text-right">
                    {item.status === 'Scheduled' ? (
                      <button className="px-3 py-1 border border-border rounded-[6px] text-[12px] font-medium hover:bg-surface-container">View</button>
                    ) : (
                      <button className="px-3 py-1 bg-primary-container text-on-primary rounded-[6px] text-[12px] font-medium hover:bg-primary">Trigger Call</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'AI Call':
        return (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Current Salary</th>
                <th className="p-4">Expected Salary</th>
                <th className="p-4">Notice Period</th>
                <th className="p-4 text-right">Action</th>
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
                    {item.expectedSalary === '—' ? (
                      <button className="px-3 py-1 bg-surface-container rounded-[6px] text-[12px] font-medium hover:bg-surface-container-high">Re-call</button>
                    ) : (
                      <>
                        <button className="px-3 py-1 bg-primary-container text-on-primary rounded-[6px] text-[12px] font-medium mr-2 hover:bg-primary">2nd Shortlist</button>
                        <button className="px-3 py-1 border border-error text-error rounded-[6px] text-[12px] font-medium hover:bg-error/5">Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case '2nd Shortlist':
        return (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Expected Salary</th>
                <th className="p-4">Notice Period</th>
                <th className="p-4">Fit</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4">{item.expectedSalary}</td>
                  <td className="p-4">{item.noticePeriod}</td>
                  <td className="p-4"><span className="text-primary-container font-medium">✅ {item.fit}</span></td>
                  <td className="p-4 text-right">
                    <button className="px-3 py-1 bg-primary-container text-on-primary rounded-[6px] text-[12px] font-medium mr-2 hover:bg-primary">Send to Director</button>
                    <button className="px-3 py-1 border border-error text-error rounded-[6px] text-[12px] font-medium hover:bg-error/5">Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'Director Review':
        return (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Score</th>
                <th className="p-4">Salary Fit</th>
                <th className="p-4">Director Decision</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4 font-bold">{item.score}</td>
                  <td className="p-4">✅ {item.salaryFit}</td>
                  <td className="p-4 text-[#8B6508]">{item.decision}</td>
                  <td className="p-4 text-right">
                    <button className="px-3 py-1 bg-primary-container text-on-primary rounded-[6px] text-[12px] font-medium mr-2 hover:bg-primary">Approve</button>
                    <button className="px-3 py-1 border border-error text-error rounded-[6px] text-[12px] font-medium hover:bg-error/5 mr-2">Reject</button>
                    <button className="px-3 py-1 bg-surface-container rounded-[6px] text-[12px] font-medium hover:bg-surface-container-high">Req Changes</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'Client Review':
        return (
          <div className="relative">
            {currentItems.length > 0 && currentItems.every((i:any) => i.decision === 'Rejected') && (
               <div className="bg-error/10 border border-error/20 m-4 p-4 rounded-[8px] flex justify-between items-center">
                 <div>
                   <h4 className="text-error font-semibold text-[14px]">⚠ All candidates rejected</h4>
                   <p className="text-[12px] text-text-secondary">The client has rejected all candidates in this batch.</p>
                 </div>
                 <button className="bg-error text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-red-700">Restart Sourcing Process</button>
               </div>
            )}
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                  <th className="p-4">Candidate</th>
                  <th className="p-4">Score</th>
                  <th className="p-4">Client Decision</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-[13px] text-text-primary divide-y divide-border">
                {currentItems.map((item: any) => (
                  <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                    <td className="p-4 font-medium">{item.name}</td>
                    <td className="p-4 font-bold">{item.score}</td>
                    <td className="p-4 text-[#8B6508]">{item.decision}</td>
                    <td className="p-4 text-right">
                      <button className="px-3 py-1 bg-primary-container text-on-primary rounded-[6px] text-[12px] font-medium mr-2 hover:bg-primary">Interview</button>
                      <button className="px-3 py-1 border border-border rounded-[6px] text-[12px] font-medium mr-2 hover:bg-surface-container">Hold</button>
                      <button className="px-3 py-1 border border-error text-error rounded-[6px] text-[12px] font-medium hover:bg-error/5">Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'Interview':
        return (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Date</th>
                <th className="p-4">Feedback</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4">{item.date}</td>
                  <td className="p-4">{item.feedback}</td>
                  <td className="p-4 text-right">
                    <button className="px-3 py-1 bg-surface-container rounded-[6px] text-[12px] font-medium mr-2 hover:bg-surface-container-high">Add Feedback</button>
                    <button className="px-3 py-1 bg-primary-container text-on-primary rounded-[6px] text-[12px] font-medium mr-2 hover:bg-primary">Make Offer</button>
                    <button className="px-3 py-1 border border-error text-error rounded-[6px] text-[12px] font-medium hover:bg-error/5">Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'Offer':
        return (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Offer Salary</th>
                <th className="p-4">Start Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4 font-bold">{item.salary}</td>
                  <td className="p-4">{item.startDate}</td>
                  <td className="p-4 text-[#8B6508]">{item.status}</td>
                  <td className="p-4 text-right">
                    <button className="px-3 py-1 bg-primary-container text-on-primary rounded-[6px] text-[12px] font-medium mr-2 hover:bg-primary">Placed ✅</button>
                    <button className="px-3 py-1 border border-error text-error rounded-[6px] text-[12px] font-medium hover:bg-error/5">Declined</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'Placed':
        return (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Role</th>
                <th className="p-4">Placement Date</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4">{item.role}</td>
                  <td className="p-4">{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'Rejected':
        return (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="p-4">Candidate</th>
                <th className="p-4">Rejection Reason</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {currentItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-surface-bright transition-colors group">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4 text-error">{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 w-full bg-background p-[32px] relative min-h-screen font-body">
      {/* SECTION 1: JOB HEADER CARD */}
      <div className="bg-surface rounded-[12px] border border-border shadow-subtle p-[24px] mb-[24px]">
        <div className="text-[12px] text-text-secondary mb-2 font-body flex items-center gap-1">
          <Link className="hover:text-primary-container" href="/dashboard/jobs">Jobs</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span>Brand Manager — Atlas Holdings</span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-[22px] font-semibold text-text-primary mb-3">Brand Manager</h1>
            <div className="flex items-center gap-4 text-body font-body text-text-secondary mb-4">
              <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">business</span> Atlas Holdings</div>
              <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">tag</span> Keyword: BRAND24</div>
              <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">calendar_today</span> Created: 12 Jun 2026</div>
              <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">person</span> TA: Shambra Ameen</div>
            </div>
            <div className="flex gap-2">
              <span className="bg-primary-container/15 text-primary-container px-3 py-1 rounded-full text-[12px] font-medium border border-primary-container/20">Active</span>
              <span className="bg-surface-container text-text-secondary px-3 py-1 rounded-full text-[12px] border border-border">Colombo, Sri Lanka</span>
              <span className="bg-surface-container text-text-secondary px-3 py-1 rounded-full text-[12px] border border-border">FMCG</span>
              <span className="bg-surface-container text-text-secondary px-3 py-1 rounded-full text-[12px] border border-border">Budget: $3,500</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-4">
            <div className="flex gap-2">
              <button className="border border-border text-text-primary hover:border-primary-container hover:text-primary-container px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">edit</span> Edit Job
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: 10-STAGE PIPELINE TABS */}
      <div className="bg-surface border-b border-border sticky top-0 z-30 -mx-[32px] px-[32px] pt-2 mb-6 shadow-sm">
        <div className="flex gap-5 text-[13px] font-medium text-text-secondary overflow-x-auto custom-scrollbar">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = MOCK_DATA[tab.id as keyof typeof MOCK_DATA]?.length || 0;
            return (
              <button 
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`pb-3 flex items-center gap-2 whitespace-nowrap border-b-[3px] transition-colors ${
                  isActive 
                    ? 'text-primary-container border-primary-container' 
                    : 'hover:text-text-primary border-transparent hover:border-border'
                }`}
              >
                {tab.label}
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                  isActive 
                    ? 'bg-primary-container/15 text-primary-container' 
                    : 'bg-surface-container text-text-secondary'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: TAB CONTENT */}
      <div className="bg-surface rounded-[12px] border border-border shadow-subtle flex flex-col mb-24 overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center bg-surface">
          <h2 className="text-[15px] font-semibold text-text-primary">{TABS.find(t => t.id === activeTab)?.label}</h2>
          {activeTab === 'New CVs' && (
            <div className="flex gap-3">
              <button className="border border-primary-container text-primary-container px-3 py-1.5 rounded-[8px] text-[13px] font-medium hover:bg-primary-container/5 transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">smart_toy</span> Bulk AI Call
              </button>
            </div>
          )}
          {activeTab === 'TA Shortlist' && (
            <button className="border border-primary-container text-primary-container px-3 py-1.5 rounded-[8px] text-[13px] font-medium hover:bg-primary-container/5 transition-colors flex items-center gap-1">
              Trigger AI Call for All
            </button>
          )}
        </div>
        
        <div className="overflow-x-auto min-h-[300px]">
          {activeData.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-text-secondary">
              <span className="material-symbols-outlined text-[48px] text-border mb-4">group</span>
              <p>No candidates in this stage yet.</p>
            </div>
          ) : (
            renderTabContent()
          )}
        </div>
        
        {renderPagination()}
      </div>

    </div>
  );
}
