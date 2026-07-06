"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function PipelineActivityTable({ jobFilter = 'All Jobs' }: { jobFilter?: string }) {
  const [activeTab, setActiveTab] = useState('All Jobs');
  
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
      arrowIcon: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/4bcb42b0-c2ac-4b8f-98da-45b3b425c9f4"
    };
  }) : [];
  


  const pipelineJobs = jobFilter === 'Active Jobs' 
    ? allPipelineJobs.filter(job => job.status === 'Active' || job.status === 'Urgent')
    : jobFilter === 'My Jobs'
    ? allPipelineJobs.filter(job => job.assigned === 'Shambra')
    : allPipelineJobs;

  const filteredJobs = pipelineJobs.filter(job => activeTab === 'All Jobs' || job.status === activeTab);

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
              onClick={() => setActiveTab(tab)}
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
            {filteredJobs.map(job => (
              <tr key={job.id} className="border-b border-border hover:bg-surface-container-high transition-colors">
                <td className="py-4 px-5 text-text-primary text-[13px] whitespace-pre-line">{job.title}</td>
                <td className="py-4 px-5 text-text-secondary text-[13px]">{job.client}</td>
                <td className="py-4 px-5">
                  <span className={`${job.sourceColor} text-[11px] py-1 px-2 rounded`}>{job.source}</span>
                </td>
                <td className="py-4 px-5 text-center">
                  {job.newCvs === 'snippet' ? (
                    <img src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/6f202aa5-05d4-4816-b136-62145e63e63f" className="w-12 h-auto object-cover mx-auto" alt="CV Snippet" />
                  ) : (
                    <span className="text-text-primary text-[13px] font-medium">{job.newCvs}</span>
                  )}
                </td>
                <td className="py-4 px-5 text-text-secondary text-[13px] whitespace-pre-line">{job.stage}</td>
                <td className="py-4 px-5 text-text-secondary text-[13px]">{job.assigned}</td>
                <td className="py-4 px-5 text-center">
                  <Link href={`/dashboard/jobs/${job.id}`} className="flex items-center justify-center text-primary-container text-[13px] hover:underline mx-auto no-underline cursor-pointer">
                    View
                    <img src={job.arrowIcon} className="w-[9px] h-[9px] ml-1 object-fill" alt="Arrow" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
