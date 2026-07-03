"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

type Source = { id: string, label: string, bgClass: string, textClass: string };

type Job = {
  id: string;
  title: string;
  client: string;
  keyword: string;
  location: string;
  seniority: string;
  type: string;
  salary: string;
  sources: Source[];
  newCvs: number;
  newCvsBadge?: { text: string, bgClass: string, textClass: string };
  stage: { label: string, bgClass: string, textClass: string, borderClass: string };
  taAssigned: string;
  status: string; // 'Active', 'On Hold', 'Fins', 'Lost', 'Placed'
  statusBadge: { label: string, bgClass: string, textClass: string, borderClass: string };
  created: string;
};

// Mock jobs removed in favor of real DB jobs.];

export default function JobsPage() {
  const [activeTab, setActiveTab] = useState<string>('All Jobs');
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [activeDropdownJobId, setActiveDropdownJobId] = useState<string | null>(null);
  const router = useRouter();
  
  const dbJobs = useQuery(api.jobs.list);
  const deleteJob = useMutation(api.jobs.deleteJob);

  React.useEffect(() => {
    const handleWindowClick = () => {
      setActiveDropdownJobId(null);
    };
    window.addEventListener('click', handleWindowClick);
    return () => {
      window.removeEventListener('click', handleWindowClick);
    };
  }, []);
  const users = useQuery(api.users.getAllUsers);

  const MOCK_JOBS: Job[] = dbJobs && users ? dbJobs.map((j: any) => {
    const recruiter = users.find((u: any) => u._id === j.primaryRecruiterId);
    
    // Map status to formatted text and badge
    let statusFormatted = 'Active';
    let statusBadge = { label: "Active", bgClass: "bg-green-50", textClass: "text-green-700", borderClass: "border-green-200" };
    
    if (j.status === 'on_hold') {
      statusFormatted = 'On Hold';
      statusBadge = { label: "On Hold", bgClass: "bg-amber-50", textClass: "text-amber-700", borderClass: "border-amber-200" };
    } else if (j.status === 'closed') {
      statusFormatted = 'Fins';
      statusBadge = { label: "Fins", bgClass: "bg-primary-container/10", textClass: "text-primary-container", borderClass: "border-primary-container/20" };
    } else if (j.status === 'lost') {
      statusFormatted = 'Lost';
      statusBadge = { label: "Lost", bgClass: "bg-red-50", textClass: "text-red-700", borderClass: "border-red-200" };
    } else if (j.status === 'draft') {
      statusFormatted = 'Draft';
      statusBadge = { label: "Draft", bgClass: "bg-gray-100", textClass: "text-gray-700", borderClass: "border-gray-200" };
    }
    
    return {
      id: j._id,
      title: j.title,
      client: j.clientName,
      keyword: j.keyword,
      location: j.location || 'Remote',
      seniority: j.seniorityLevel || 'N/A',
      type: j.recruitmentType || 'N/A',
      salary: j.salaryMin ? `${j.salaryMin}${j.salaryMax ? `-${j.salaryMax}` : ''} ${j.salaryCurrency || 'LKR'}` : '-',
      sources: [], // To be populated later when channels are implemented
      newCvs: 0, // Placeholder
      stage: { label: "New Job", bgClass: "bg-blue-50", textClass: "text-blue-700", borderClass: "border-blue-200" },
      taAssigned: recruiter ? recruiter.fullName.split(' ')[0] : 'Unassigned',
      status: statusFormatted,
      statusBadge: statusBadge,
      created: new Date(j._creationTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    };
  }) : [];

  const handleSelectJob = (id: string) => {
    setSelectedJobs(prev => prev.includes(id) ? prev.filter(jId => jId !== id) : [...prev, id]);
  };
  
  const handleSelectAll = () => {
    if (selectedJobs.length === filteredJobs.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(filteredJobs.map(j => j.id));
    }
  };

  const filteredJobs = MOCK_JOBS.filter(job => {
    if (activeTab === 'All Jobs') return true;
    if (activeTab === 'Active') return job.status === 'Active';
    if (activeTab === 'On Hold') return job.status === 'On Hold';
    if (activeTab === 'Fins') return job.status === 'Fins';
    if (activeTab === 'Lost') return job.status === 'Lost';
    return true;
  });

  const getTabCount = (tabName: string) => {
    if (tabName === 'All Jobs') return MOCK_JOBS.length;
    return MOCK_JOBS.filter(j => j.status === tabName).length;
  };

  const tabs = ['All Jobs', 'Active', 'On Hold', 'Fins', 'Lost'];

  return (
    <div className="p-8 w-full space-y-[24px]">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-text-primary leading-tight">Jobs</h1>
          <p className="text-[13px] text-text-secondary mt-1">Manage all active recruitment positions</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button className="flex-1 md:flex-none px-4 py-2 bg-surface text-text-primary border border-primary-container rounded-[6px] font-medium text-[13px] hover:bg-surface-container-low transition-colors shadow-sm">
            Import Jobs
          </button>
          <button 
            onClick={() => router.push('/dashboard/jobs/new')}
            className="flex-1 md:flex-none px-4 py-2 bg-primary-container text-on-primary rounded-[6px] font-medium text-[13px] hover:bg-[#154c19] transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-[1px]">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Create New Job
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-surface rounded-xl border border-border p-3 shadow-[0_4px_12px_rgba(0,0,0,0.03)] flex flex-col xl:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="relative w-full md:w-[280px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled text-[18px]">search</span>
            <input className="w-full pl-10 pr-3 py-2 bg-surface border border-border rounded-lg text-[13px] focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-[#1B5E20] transition-all" placeholder="Search jobs, clients, keywords..." type="text" />
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="py-2 pl-3 pr-8 bg-surface border border-border rounded-lg text-[13px] text-text-secondary focus:outline-none focus:border-primary-container appearance-none cursor-pointer">
              <option>All Status</option>
              <option>Active</option>
              <option>On Hold</option>
            </select>
            <select className="py-2 pl-3 pr-8 bg-surface border border-border rounded-lg text-[13px] text-text-secondary focus:outline-none focus:border-primary-container appearance-none cursor-pointer">
              <option>All Sources</option>
            </select>
            <select className="py-2 pl-3 pr-8 bg-surface border border-border rounded-lg text-[13px] text-text-secondary focus:outline-none focus:border-primary-container appearance-none cursor-pointer">
              <option>All TAs</option>
            </select>
            <select className="py-2 pl-3 pr-8 bg-surface border border-border rounded-lg text-[13px] text-text-secondary focus:outline-none focus:border-primary-container appearance-none cursor-pointer">
              <option>All Clients</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full xl:w-auto justify-between xl:justify-end border-t xl:border-t-0 border-border pt-3 xl:pt-0">
          <span className="text-[13px] text-text-secondary">Showing {filteredJobs.length} jobs</span>
          <div className="flex items-center bg-surface-container-low rounded-lg p-1 border border-border">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'bg-surface shadow-sm text-primary-container' : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'}`}
            >
              <span className={`material-symbols-outlined text-[18px] ${viewMode === 'list' ? 'fill' : ''}`}>view_list</span>
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-surface shadow-sm text-primary-container' : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'}`}
            >
              <span className={`material-symbols-outlined text-[18px] ${viewMode === 'grid' ? 'fill' : ''}`}>grid_view</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`bg-surface rounded-xl border border-border shadow-[0_4px_12px_rgba(0,0,0,0.03)] flex flex-col overflow-hidden ${viewMode === 'grid' ? 'bg-transparent border-none shadow-none' : ''}`}>
        {/* Tabs - Only show as part of the card in list view, or separate in grid view */}
        <div className={`p-5 flex justify-between items-center ${viewMode === 'list' ? 'border-b border-border bg-surface' : 'bg-surface rounded-xl border border-border shadow-[0_4px_12px_rgba(0,0,0,0.03)] mb-4'}`}>
          <div className="flex gap-4 text-[13px] font-medium overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab;
              const count = getTabCount(tab);
              return (
                <span 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`${isActive ? 'text-primary-container border-b-2 border-primary-container pb-1' : 'text-text-secondary hover:text-text-primary pb-1'} cursor-pointer whitespace-nowrap flex items-center gap-2 transition-colors`}
                >
                  {tab} 
                  <span className={`${isActive ? 'bg-primary-container/10 text-primary-container' : 'bg-surface-container-high text-text-secondary'} px-2 py-0.5 rounded-full text-[11px] transition-colors`}>
                    {count}
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        {viewMode === 'list' ? (
          /* List View Container */
          <div className="overflow-x-auto p-0 min-h-[400px]">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-text-secondary border-b border-border bg-surface-container-lowest">
                  <th className="px-5 py-3 w-12"><input checked={selectedJobs.length === filteredJobs.length && filteredJobs.length > 0} onChange={handleSelectAll} className="rounded border-border text-primary-container focus:ring-[#1B5E20] w-4 h-4 cursor-pointer mt-0.5" type="checkbox" /></th>
                  <th className="font-medium px-5 py-3 uppercase text-[11px] tracking-wider">Job Title</th>
                  <th className="font-medium px-5 py-3 uppercase text-[11px] tracking-wider">Client</th>
                  <th className="font-medium px-5 py-3 uppercase text-[11px] tracking-wider">Location</th>
                  <th className="font-medium px-5 py-3 uppercase text-[11px] tracking-wider">Sources Active</th>
                  <th className="font-medium px-5 py-3 uppercase text-[11px] tracking-wider">New CVs</th>
                  <th className="font-medium px-5 py-3 uppercase text-[11px] tracking-wider">Stage</th>
                  <th className="font-medium px-5 py-3 uppercase text-[11px] tracking-wider">TA Assigned</th>
                  <th className="font-medium px-5 py-3 uppercase text-[11px] tracking-wider">Status</th>
                  <th className="font-medium px-5 py-3 uppercase text-[11px] tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border relative">
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-text-secondary">
                      No jobs found in this category.
                    </td>
                  </tr>
                ) : null}
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[#F1F8E9] transition-colors group">
                    <td className="px-5 py-3"><input checked={selectedJobs.includes(job.id)} onChange={() => handleSelectJob(job.id)} className="rounded border-border text-primary-container focus:ring-[#1B5E20] w-4 h-4 cursor-pointer mt-0.5" type="checkbox" /></td>
                    <td className="px-5 py-3 font-medium text-text-primary whitespace-nowrap">
                      <Link href={`/dashboard/jobs/${job.id}`} className="hover:text-primary-container hover:underline">
                        {job.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-text-secondary whitespace-nowrap">{job.client}</td>
                    <td className="px-5 py-3 text-text-secondary whitespace-nowrap">{job.location}</td>
                    <td className="px-5 py-3">
                      {job.sources.length > 0 ? (
                        <div className="flex items-center gap-1">
                          {job.sources.map(src => (
                            <div key={src.id} className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${src.bgClass} ${src.textClass}`}>
                              {src.label}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-text-disabled">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {job.newCvs > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary">{job.newCvs}</span>
                          {job.newCvsBadge && (
                            <span className={`${job.newCvsBadge.bgClass} ${job.newCvsBadge.textClass} text-[10px] px-1.5 py-0.5 rounded font-medium`}>
                              {job.newCvsBadge.text}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="font-medium text-text-disabled">{job.newCvs}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap"><span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-medium border ${job.stage.bgClass} ${job.stage.textClass} ${job.stage.borderClass}`}>{job.stage.label}</span></td>
                    <td className="px-5 py-3 text-text-secondary whitespace-nowrap">{job.taAssigned}</td>
                    <td className="px-5 py-3 whitespace-nowrap"><span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-medium border ${job.statusBadge.bgClass} ${job.statusBadge.textClass} ${job.statusBadge.borderClass}`}>{job.statusBadge.label}</span></td>
                    <td className="px-5 py-3 text-center relative" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdownJobId(prev => prev === job.id ? null : job.id);
                        }}
                        className="text-text-disabled hover:text-primary-container transition-colors p-1"
                      >
                        <span className="material-symbols-outlined text-[18px]">more_vert</span>
                      </button>

                      {activeDropdownJobId === job.id && (
                        <div 
                          className="absolute right-5 mt-1 w-32 bg-surface border border-border rounded-lg shadow-lg z-50 py-1 text-left"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              alert("Edit Job feature coming soon!");
                              setActiveDropdownJobId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-xs hover:bg-surface-container-high transition-colors text-text-primary flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                            Edit Job
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm("Are you sure you want to completely delete this job? This cannot be undone.")) {
                                try {
                                  await deleteJob({ jobId: job.id as any });
                                  alert("Job deleted successfully.");
                                } catch (err: any) {
                                  alert("Failed to delete job: " + err.message);
                                }
                              }
                              setActiveDropdownJobId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-xs hover:bg-error/10 text-error transition-colors flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                            Delete Job
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View Container */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 min-h-[400px] items-start">
            {filteredJobs.length === 0 ? (
              <div className="col-span-full py-12 text-center text-text-secondary bg-surface rounded-xl border border-border">
                No jobs found in this category.
              </div>
            ) : null}
            {filteredJobs.map((job) => (
              <div 
                key={job.id} 
                onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                className="bg-surface rounded-xl border border-border p-5 flex flex-col gap-4 hover:shadow-[0_12px_24px_rgba(0,0,0,0.06),0_4px_8px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 relative group cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col pr-6">
                    <h3 className="text-[15px] font-bold text-text-primary leading-tight line-clamp-2">{job.title}</h3>
                    <span className="text-[12px] text-text-secondary mt-1.5 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">domain</span>
                      {job.client}
                    </span>
                    <span className="text-[11px] text-text-secondary mt-0.5 flex items-center gap-1.5 opacity-70">
                      <span className="material-symbols-outlined text-[13px]">tag</span>
                      {job.keyword}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdownJobId(prev => prev === job.id ? null : job.id);
                    }}
                    className="absolute top-4 right-4 text-text-disabled hover:text-primary-container transition-colors p-1 bg-surface rounded-full hover:bg-surface-container-low z-20"
                  >
                    <span className="material-symbols-outlined text-[18px]">more_vert</span>
                  </button>

                  {activeDropdownJobId === job.id && (
                    <div 
                      className="absolute top-12 right-4 w-32 bg-surface border border-border rounded-lg shadow-lg z-30 py-1 text-left"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          alert("Edit Job feature coming soon!");
                          setActiveDropdownJobId(null);
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-surface-container-high transition-colors text-text-primary flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                        Edit Job
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm("Are you sure you want to completely delete this job? This cannot be undone.")) {
                            try {
                              await deleteJob({ jobId: job.id as any });
                              alert("Job deleted successfully.");
                            } catch (err: any) {
                              alert("Failed to delete job: " + err.message);
                            }
                          }
                          setActiveDropdownJobId(null);
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-error/10 text-error transition-colors flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                        Delete Job
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${job.statusBadge.bgClass} ${job.statusBadge.textClass} ${job.statusBadge.borderClass}`}>{job.statusBadge.label}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${job.stage.bgClass} ${job.stage.textClass} ${job.stage.borderClass}`}>{job.stage.label}</span>
                </div>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border border-dashed">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-1.5">
                      {job.sources.map(src => (
                         <div key={src.id} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-surface z-10 ${src.bgClass} ${src.textClass}`} title={src.label}>
                           {src.label}
                         </div>
                      ))}
                      {job.sources.length === 0 && <span className="text-text-disabled text-[12px] bg-surface-container w-6 h-6 rounded-full flex items-center justify-center">-</span>}
                    </div>
                    
                    {job.newCvs > 0 && (
                      <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                        <span className="material-symbols-outlined text-[14px] text-blue-600">description</span>
                        <span className="text-[11px] font-bold text-blue-700">{job.newCvs} new</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-1 rounded-md">
                    <span className="material-symbols-outlined text-[14px] text-text-disabled">person</span>
                    <span className="text-[11px] text-text-secondary font-semibold truncate max-w-[70px]">{job.taAssigned}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Footer */}
        <div className={`p-4 flex flex-col sm:flex-row justify-between items-center gap-4 ${viewMode === 'list' ? 'border-t border-border bg-surface' : 'bg-transparent mt-2'}`}>
          <span className="text-[13px] text-text-secondary bg-surface px-3 py-1.5 rounded-lg border border-border shadow-sm">
            Showing 1–{Math.min(8, filteredJobs.length)} of {filteredJobs.length} jobs
          </span>
          <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border shadow-sm">
            <button className="px-3 py-1 rounded text-text-disabled cursor-not-allowed text-[13px] font-medium hover:bg-surface-container-low transition-colors">Prev</button>
            <button className="w-8 h-8 rounded-md bg-primary-container text-on-primary text-[13px] font-medium flex items-center justify-center shadow-sm">1</button>
            {filteredJobs.length > 8 && (
               <button className="w-8 h-8 rounded-md hover:bg-surface-container text-text-secondary text-[13px] font-medium flex items-center justify-center transition-colors">2</button>
            )}
            <button className={`px-3 py-1 rounded transition-colors text-[13px] font-medium ${filteredJobs.length > 8 ? 'text-text-primary hover:bg-surface-container' : 'text-text-disabled cursor-not-allowed'}`}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
