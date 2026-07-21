"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';

export function PipelineActivityTable({ jobFilter = 'All Jobs' }: { jobFilter?: string }) {
  const [activeTab, setActiveTab] = useState('All Jobs');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  const dbJobs = useQuery(api.jobs.jobs.list);
  const users = useQuery(api.users.users.getAllUsers);

  const allPipelineJobs = dbJobs && users ? dbJobs.map((j: any) => {
    const recruiter = users.find((u: any) => u._id === j.primaryRecruiterId);
    
    let statusFormatted = 'Active';
    if (j.status === 'on_hold') statusFormatted = 'On Hold';
    else if (j.status === 'urgent') statusFormatted = 'Urgent';
    else if (j.status === 'closed') statusFormatted = 'Closed';
    else if (j.status === 'lost') statusFormatted = 'Lost';
    else if (j.status === 'draft') statusFormatted = 'Draft';

    return {
      id: j._id,
      title: j.title,
      client: j.clientName,
      source: "Organic",
      sourceColor: "bg-primary-container/15 text-primary-container",
      newCvs: "-",
      stage: "Active",
      assigned: recruiter ? recruiter.fullName.split(' ')[0] : 'Unassigned',
      status: statusFormatted,
    };
  }) : [];
  


  const pipelineJobs = jobFilter === 'Active Jobs' 
    ? allPipelineJobs.filter(job => job.status === 'Active' || job.status === 'Urgent')
    : jobFilter === 'My Jobs'
    ? allPipelineJobs.filter(job => job.assigned === 'Shambra')
    : allPipelineJobs;

  const filteredJobs = pipelineJobs.filter(job => activeTab === 'All Jobs' || job.status === activeTab);
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentJobs = filteredJobs.slice(startIndex, endIndex);

  return (
    <Card noPadding className="pt-[1px] w-full">
      <div className="flex items-center py-4 px-5 w-full border-b border-solid border-b-border justify-between">
        <span className="text-text-primary text-sm font-bold">
          Pipeline Activity
        </span>
        <div className="flex shrink-0 items-center gap-6">
          {['All Jobs', 'Active', 'On Hold', 'Urgent'].map(tab => (
            <div 
              key={tab} 
              onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
              className={`flex flex-col shrink-0 items-center pb-1 cursor-pointer ${activeTab === tab ? 'border-b-2 border-solid border-b-[#1B5E20]' : 'hover:text-gray-900'}`}
            >
              <span className={activeTab === tab ? 'text-primary-container text-[13px] font-medium' : 'text-text-secondary text-[13px]'}>{tab}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="w-full overflow-x-auto pb-[1px]">
        <table className="w-full text-left border-collapse font-sans">
          <thead>
            <tr className="border-b border-solid border-border bg-surface">
              <th className="py-3 px-5 text-text-secondary font-bold text-[13px]">Job Title</th>
              <th className="py-3 px-5 text-text-secondary font-bold text-[13px]">Client</th>
              <th className="py-3 px-5 text-text-secondary font-bold text-[13px]">Source</th>
              <th className="py-3 px-5 text-text-secondary font-bold text-[13px] text-center">New CVs</th>
              <th className="py-3 px-5 text-text-secondary font-bold text-[13px]">Stage</th>
              <th className="py-3 px-5 text-text-secondary font-bold text-[13px]">TA Assigned</th>
              <th className="py-3 px-5 text-text-secondary font-bold text-[13px] text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {currentJobs.map(job => (
              <tr key={job.id} className="border-b border-border hover:bg-surface-container-high transition-colors">
                <td className="py-4 px-5 text-text-primary text-[13px] whitespace-pre-line">{job.title}</td>
                <td className="py-4 px-5 text-text-secondary text-[13px]">{job.client}</td>
                <td className="py-4 px-5">
                  <span className={`${job.sourceColor} text-[11px] py-1 px-2 rounded`}>{job.source}</span>
                </td>
                <td className="py-4 px-5 text-center">
                  {job.newCvs === 'snippet' ? (
                    <FileText className="w-4 h-4 text-emerald-800 dark:text-emerald-400 mx-auto" />
                  ) : (
                    <span className="text-text-primary text-[13px] font-medium">{job.newCvs}</span>
                  )}
                </td>
                <td className="py-4 px-5 text-text-secondary text-[13px] whitespace-pre-line">{job.stage}</td>
                <td className="py-4 px-5 text-text-secondary text-[13px]">{job.assigned}</td>
                <td className="py-4 px-5 text-center">
                  <Link href={`/dashboard/jobs/${job.id}`} className="flex items-center justify-center text-primary-container text-[13px] hover:underline mx-auto no-underline cursor-pointer">
                    View
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      {filteredJobs.length > 0 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface">
          <div className="text-[13px] text-text-secondary">
            Showing <span className="font-medium text-text-primary">{Math.min(startIndex + 1, filteredJobs.length)}</span> to <span className="font-medium text-text-primary">{Math.min(endIndex, filteredJobs.length)}</span> of <span className="font-medium text-text-primary">{filteredJobs.length}</span>
          </div>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-1 border border-border px-2.5 py-1 rounded-[6px] text-[13px] text-text-secondary hover:bg-surface-container transition-colors disabled:opacity-40"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              className="flex items-center gap-1 border border-border px-2.5 py-1 rounded-[6px] text-[13px] text-text-secondary hover:bg-surface-container transition-colors disabled:opacity-40"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
