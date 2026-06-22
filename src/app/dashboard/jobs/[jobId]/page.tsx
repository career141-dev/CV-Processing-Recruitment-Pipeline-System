"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';

export default function JobDetailsPage() {
  const [isCvPreviewOpen, setIsCvPreviewOpen] = useState(false);
  const [isAiWidgetOpen, setIsAiWidgetOpen] = useState(true);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('New CVs');

  const TABS = [
    { id: 'New CVs', label: 'New CVs', count: 47 },
    { id: 'TA Shortlist', label: 'TA Shortlist', count: 12 },
    { id: 'Director Review', label: 'Director Review', count: 6 },
    { id: 'Client Review', label: 'Client Review', count: 3 },
    { id: 'Interview & Offer', label: 'Interview & Offer', count: 1 },
  ];

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
              <span className="bg-surface-container text-text-secondary px-3 py-1 rounded-full text-[12px] border border-border">Confidential</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-4">
            <div className="flex gap-3">
              <div className="bg-surface border border-border rounded-[8px] px-4 py-2 text-center min-w-[80px]">
                <div className="text-[20px] font-bold text-text-primary">47</div>
                <div className="text-[11px] text-text-secondary">Total CVs</div>
              </div>
              <div className="bg-surface border border-border rounded-[8px] px-4 py-2 text-center min-w-[80px]">
                <div className="text-[20px] font-bold text-text-primary">12</div>
                <div className="text-[11px] text-text-secondary">Shortlisted</div>
              </div>
              <div className="bg-surface border border-border rounded-[8px] px-4 py-2 text-center min-w-[80px]">
                <div className="text-[20px] font-bold text-primary-container">78<span className="text-[12px] text-text-secondary font-normal">/100</span></div>
                <div className="text-[11px] text-text-secondary">AI Avg Score</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsQrModalOpen(true)}
                className="border border-border text-text-primary hover:border-primary-container hover:text-primary-container px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">qr_code</span> Ad QR Code
              </button>
              <button className="border border-border text-text-primary hover:border-primary-container hover:text-primary-container px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">edit</span> Edit Job
              </button>
              <button className="border border-border text-text-primary hover:border-primary-container hover:text-primary-container px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">download</span> Export CVs
              </button>
              <button className="border border-border text-text-primary hover:bg-surface-container px-2 py-1.5 rounded-[8px] transition-colors flex items-center">
                <span className="material-symbols-outlined text-[18px]">more_vert</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: STICKY PRIMARY TABS */}
      <div className="bg-surface border-b border-border sticky top-0 z-30 -mx-[32px] px-[32px] pt-2 mb-6">
        <div className="flex gap-6 text-[14px] font-medium text-text-secondary overflow-x-auto custom-scrollbar">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
                  {tab.count}
                </span>
              </button>
            );
          })}
          <button className="pb-3 hover:text-text-primary flex items-center gap-2 whitespace-nowrap border-b-[3px] border-transparent hover:border-border transition-colors ml-auto text-primary-container">
            <span className="material-symbols-outlined text-[16px]">search</span> CV Search
          </button>
        </div>
      </div>

      {/* SECTION 3: NEW CVs TAB CONTENT */}
      {activeTab === 'New CVs' ? (
      <div className="bg-surface rounded-[12px] border border-border shadow-subtle flex flex-col mb-24 overflow-hidden">
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
              <span className="material-symbols-outlined text-[16px]">sort</span> Sort: Score
            </button>
            <button className="border border-border text-text-secondary px-3 py-1.5 rounded-[8px] text-[13px] hover:bg-surface-container transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">filter_list</span> Filter
            </button>
            <button className="border border-primary-container text-primary-container px-3 py-1.5 rounded-[8px] text-[13px] font-medium hover:bg-primary-container/5 transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">smart_toy</span> Bulk AI Call
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase tracking-wider font-semibold">
                <th className="p-4 w-10"><input className="rounded border-border text-primary-container focus:ring-primary-container" type="checkbox" /></th>
                <th className="p-4">Candidate</th>
                <th className="p-4">Source</th>
                <th className="p-4">Match Score</th>
                <th className="p-4">Role &amp; Exp</th>
                <th className="p-4">AI Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-text-primary divide-y divide-border">
              {/* Row 1 */}
              <tr className="hover:bg-surface-bright transition-colors group">
                <td className="p-4"><input className="rounded border-border text-primary-container focus:ring-primary-container" type="checkbox" /></td>
                <td className="p-4 font-medium cursor-pointer text-primary-container" onClick={() => setIsCvPreviewOpen(true)}>Kasun Fernando</td>
                <td className="p-4"><span className="text-[#0A66C2] font-medium">LinkedIn</span></td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary-container">92</span>
                    <div className="w-16 h-1.5 bg-surface-container rounded-full overflow-hidden"><div className="h-full bg-primary-container w-[92%]"></div></div>
                  </div>
                </td>
                <td className="p-4 text-text-secondary">Brand Exec (4y)</td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-container/15 text-primary-container text-[11px] font-medium border border-primary-container/20">
                    <span className="material-symbols-outlined text-[12px]">done</span> Interested
                  </span>
                </td>
                <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-1 bg-primary-container text-on-primary rounded-[6px] text-[12px] font-medium">Shortlist</button>
                    <button className="px-2 py-1 border border-error text-error rounded-[6px] hover:bg-error/5"><span className="material-symbols-outlined text-[14px]">close</span></button>
                  </div>
                </td>
              </tr>
              {/* Row 2 */}
              <tr className="hover:bg-surface-bright transition-colors group">
                <td className="p-4"><input className="rounded border-border text-primary-container focus:ring-primary-container" type="checkbox" /></td>
                <td className="p-4 font-medium cursor-pointer hover:text-primary-container" onClick={() => setIsCvPreviewOpen(true)}>Priya Sharma</td>
                <td className="p-4"><span className="text-[#0A66C2] font-medium">LinkedIn</span></td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary-container">87</span>
                    <div className="w-16 h-1.5 bg-surface-container rounded-full overflow-hidden"><div className="h-full bg-primary-container w-[87%]"></div></div>
                  </div>
                </td>
                <td className="p-4 text-text-secondary">Mktg Mgr (6y)</td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-text-secondary text-[11px] font-medium border border-border">
                    <span className="material-symbols-outlined text-[12px]">schedule</span> Not Called
                  </span>
                </td>
                <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-1 bg-primary-container text-on-primary rounded-[6px] text-[12px] font-medium">Shortlist</button>
                    <button className="px-2 py-1 border border-error text-error rounded-[6px] hover:bg-error/5"><span className="material-symbols-outlined text-[14px]">close</span></button>
                  </div>
                </td>
              </tr>
              {/* Row 3 */}
              <tr className="hover:bg-surface-bright transition-colors group">
                <td className="p-4"><input className="rounded border-border text-primary-container focus:ring-primary-container" type="checkbox" /></td>
                <td className="p-4 font-medium cursor-pointer hover:text-primary-container" onClick={() => setIsCvPreviewOpen(true)}>Ashan Mendis</td>
                <td className="p-4"><span className="text-[#25D366] font-medium">WhatsApp</span></td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary">79</span>
                    <div className="w-16 h-1.5 bg-surface-container rounded-full overflow-hidden"><div className="h-full bg-accent-yellow w-[79%]"></div></div>
                  </div>
                </td>
                <td className="p-4 text-text-secondary">Asst Mgr (3y)</td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-yellow/20 text-[#8B6508] text-[11px] font-medium border border-[#8B6508]/20">
                    <span className="material-symbols-outlined text-[12px]">warning</span> No Answer
                  </span>
                </td>
                <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-1 bg-primary-container text-on-primary rounded-[6px] text-[12px] font-medium">Shortlist</button>
                    <button className="px-2 py-1 border border-error text-error rounded-[6px] hover:bg-error/5"><span className="material-symbols-outlined text-[14px]">close</span></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-border flex justify-between items-center text-[12px] text-text-secondary bg-surface-bright">
          <span>Showing 1-3 of 47 candidates</span>
          <div className="flex gap-1">
            <button className="p-1 border border-border rounded hover:bg-surface-container"><span className="material-symbols-outlined text-[16px]">chevron_left</span></button>
            <button className="p-1 border border-border rounded hover:bg-surface-container"><span className="material-symbols-outlined text-[16px]">chevron_right</span></button>
          </div>
        </div>
      </div>
      ) : (
        <div className="bg-surface rounded-[12px] border border-border shadow-subtle p-8 text-center text-text-secondary mb-24">
          <span className="material-symbols-outlined text-[48px] text-border mb-4">group</span>
          <h3 className="text-text-primary font-medium mb-1">No candidates in {activeTab} yet</h3>
          <p className="text-[13px]">Candidates moved to this stage will appear here.</p>
        </div>
      )}

      {/* SECTION 4: CV PREVIEW SIDE PANEL (Open State) */}
      {isCvPreviewOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/20 z-[60]" 
            onClick={() => setIsCvPreviewOpen(false)}
          ></div>
          
          {/* Panel */}
          <aside className="fixed right-0 top-0 h-full w-[480px] bg-surface shadow-modal z-[70] transform transition-transform border-l border-border flex flex-col">
            <div className="p-6 border-b border-border flex justify-between items-start">
              <div>
                <h2 className="text-[20px] font-semibold text-text-primary mb-1">Kasun Fernando</h2>
                <p className="text-[13px] text-text-secondary">Brand Executive • 4 Years Exp • LinkedIn</p>
              </div>
              <button 
                onClick={() => setIsCvPreviewOpen(false)}
                className="text-text-secondary hover:bg-surface-container p-1 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="px-6 pt-2 border-b border-border">
              <div className="flex gap-6 text-[13px] font-medium text-text-secondary">
                <button className="pb-3 text-primary-container border-b-[2px] border-primary-container">CV Preview</button>
                <button className="pb-3 hover:text-text-primary border-b-[2px] border-transparent">Profile</button>
                <button className="pb-3 hover:text-text-primary border-b-[2px] border-transparent">Timeline</button>
                <button className="pb-3 hover:text-text-primary border-b-[2px] border-transparent">Comms</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-[#F9F9F9] custom-scrollbar">
              {/* Extracted Fields Card */}
              <div className="bg-surface border border-border rounded-[8px] p-4 mb-4 shadow-subtle">
                <h3 className="text-[12px] uppercase font-semibold text-text-secondary tracking-wider mb-3">Key Details</h3>
                <div className="grid grid-cols-2 gap-y-3 text-[13px]">
                  <div><span className="text-text-secondary block text-[11px]">Email</span> kasun.f@email.com</div>
                  <div><span className="text-text-secondary block text-[11px]">Phone</span> +94 77 123 4567</div>
                  <div><span className="text-text-secondary block text-[11px]">Current Employer</span> Hemas Holdings</div>
                  <div><span className="text-text-secondary block text-[11px]">Notice Period</span> 1 Month</div>
                </div>
              </div>

              {/* Mock PDF Viewer */}
              <div className="bg-surface border border-border rounded-[8px] shadow-subtle min-h-[400px] flex flex-col">
                <div className="bg-surface-container-high px-4 py-2 border-b border-border flex justify-between items-center rounded-t-[8px]">
                  <span className="text-[12px] font-medium text-text-secondary">Kasun_CV_2026.pdf</span>
                  <div className="flex gap-2">
                    <button className="text-text-secondary hover:text-primary"><span className="material-symbols-outlined text-[16px]">zoom_in</span></button>
                    <button className="text-text-secondary hover:text-primary"><span className="material-symbols-outlined text-[16px]">download</span></button>
                  </div>
                </div>
                <div className="p-8 text-text-secondary text-center flex-1 flex flex-col items-center justify-center bg-surface">
                  <span className="material-symbols-outlined text-[48px] text-border mb-2">description</span>
                  <p className="text-[13px]">PDF Viewer Content Area</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-surface flex justify-end gap-3">
              <button className="px-4 py-2 border border-error text-error rounded-[8px] text-[13px] font-medium hover:bg-error/5">Reject</button>
              <button className="px-4 py-2 bg-primary-container text-on-primary rounded-[8px] text-[13px] font-medium hover:bg-primary shadow-subtle">Shortlist Candidate</button>
            </div>
          </aside>
        </>
      )}

      {/* SECTION 5: FLOATING AI STATUS WIDGET */}
      <div className="fixed bottom-[24px] right-[24px] z-40 bg-surface rounded-[12px] border border-border shadow-modal w-[320px] overflow-hidden">
        <div 
          className="bg-surface-container px-4 py-3 border-b border-border flex justify-between items-center cursor-pointer hover:bg-surface-container-high transition-colors"
          onClick={() => setIsAiWidgetOpen(!isAiWidgetOpen)}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary-container">smart_toy</span>
            <span className="font-semibold text-[13px] text-text-primary">AI Agents — This Job</span>
          </div>
          <span className="material-symbols-outlined text-[18px] text-text-secondary">
            {isAiWidgetOpen ? 'expand_more' : 'expand_less'}
          </span>
        </div>
        
        {isAiWidgetOpen && (
          <div className="p-2 flex flex-col gap-1 max-h-[200px] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center p-2 hover:bg-surface-bright rounded-[6px]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#25D366]"></div>
                <span className="text-[12px] text-text-primary">Agent 4 (WhatsApp)</span>
              </div>
              <span className="text-[11px] text-text-secondary">Idle</span>
            </div>
            <div className="flex justify-between items-center p-2 hover:bg-surface-bright rounded-[6px]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></div>
                <span className="text-[12px] text-text-primary">Agent 5 (Phone)</span>
              </div>
              <span className="text-[11px] text-primary-container font-medium">3 Queued</span>
            </div>
            <div className="flex justify-between items-center p-2 hover:bg-surface-bright rounded-[6px]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-border"></div>
                <span className="text-[12px] text-text-secondary">Agent 7 (Email)</span>
              </div>
              <span className="text-[11px] text-text-secondary">Completed</span>
            </div>
          </div>
        )}
      </div>
      
      {/* SECTION 6: QR CODE MODAL */}
      {isQrModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-surface rounded-[16px] shadow-modal max-w-md w-full overflow-hidden border border-border">
            <div className="p-4 border-b border-border flex justify-between items-center bg-surface-container-low">
              <h3 className="font-semibold text-[16px] text-text-primary">Job Ad QR Code</h3>
              <button onClick={() => setIsQrModalOpen(false)} className="text-text-secondary hover:bg-surface-container p-1 rounded-full transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-8 flex flex-col items-center">
              <div className="bg-white p-4 rounded-[12px] shadow-subtle mb-6 inline-block">
                <QRCode value="https://wa.me/94770000001?text=BRAND24" size={200} />
              </div>
              <h4 className="font-semibold text-text-primary text-[15px] mb-2 text-center">Scan to Apply via WhatsApp</h4>
              <p className="text-[13px] text-text-secondary text-center mb-6 max-w-[300px]">
                Candidates scan this code to open WhatsApp with the <strong className="text-text-primary">BRAND24</strong> keyword pre-filled. They just hit send and attach their CV.
              </p>
              
              <div className="w-full">
                <label className="block text-[12px] font-medium text-text-secondary mb-1">Direct Link</label>
                <div className="flex gap-2">
                  <input type="text" readOnly value="https://wa.me/94770000001?text=BRAND24" className="flex-1 bg-surface-container-low border border-border rounded-[8px] px-3 py-2 text-[13px] text-text-primary outline-none" />
                  <button onClick={() => { navigator.clipboard.writeText("https://wa.me/94770000001?text=BRAND24"); alert('Copied!'); }} className="border border-border bg-surface px-3 py-2 rounded-[8px] text-[13px] font-medium hover:bg-surface-container transition-colors">
                    Copy
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border bg-surface-container-low flex justify-end gap-3">
              <button onClick={() => setIsQrModalOpen(false)} className="px-4 py-2 border border-border text-text-secondary rounded-[8px] text-[13px] font-medium hover:bg-surface transition-colors">Close</button>
              <button className="px-4 py-2 bg-primary-container text-on-primary rounded-[8px] text-[13px] font-medium hover:bg-primary shadow-subtle flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">download</span> Download PNG
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
