"use client";

import React, { useState } from 'react';
import { UserButton } from '@clerk/nextjs';

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <div className="flex justify-between items-center self-stretch bg-white py-3 px-6 border-b border-solid border-b-[#E0E0E0] mb-5 relative z-50">
      <span className="text-[#212121] text-[13px] font-bold">
        {title}
      </span>
      <div className="flex shrink-0 items-center gap-4">
        <img
          src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/86a2166d-e331-49b2-a4ba-bd8d81a0c5d6"
          className="w-[13px] h-[13px] object-fill cursor-pointer"
          alt="Search"
        />
        <div className="relative">
          <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/db5f0e62-0f4b-42cd-97cb-d06d811456cc"
            className="w-3 h-[15px] object-fill cursor-pointer"
            alt="Notifications"
            onClick={() => setShowNotifications(!showNotifications)}
          />
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-white border border-[#E0E0E0] rounded-md shadow-lg overflow-hidden z-50">
              <div className="bg-[#FAFAFA] border-b border-[#E0E0E0] px-4 py-3 flex justify-between items-center">
                <span className="text-[#212121] text-[13px] font-bold">Notifications</span>
                <span className="text-[#1B5E20] text-xs font-medium cursor-pointer hover:underline">Mark all as read</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <div className="px-4 py-3 border-b border-[#E0E0E0] hover:bg-gray-50 cursor-pointer">
                  <span className="block text-[#212121] text-[13px] font-medium mb-1">New Candidate Match</span>
                  <span className="block text-[#616161] text-xs">Priya Nair matched with Fullstack Engineer role.</span>
                  <span className="block text-[#9E9E9E] text-[10px] mt-1">2 hours ago</span>
                </div>
                <div className="px-4 py-3 border-b border-[#E0E0E0] hover:bg-gray-50 cursor-pointer">
                  <span className="block text-[#212121] text-[13px] font-medium mb-1">Interview Scheduled</span>
                  <span className="block text-[#616161] text-xs">James Chen's final round is set for tomorrow at 10 AM.</span>
                  <span className="block text-[#9E9E9E] text-[10px] mt-1">5 hours ago</span>
                </div>
                <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer">
                  <span className="block text-[#212121] text-[13px] font-medium mb-1">System Update</span>
                  <span className="block text-[#616161] text-xs">CV parsing model has been updated for better accuracy.</span>
                  <span className="block text-[#9E9E9E] text-[10px] mt-1">1 day ago</span>
                </div>
              </div>
              <div className="bg-[#FAFAFA] border-t border-[#E0E0E0] px-4 py-2 text-center cursor-pointer hover:bg-gray-100">
                <span className="text-[#1B5E20] text-xs font-medium">View all notifications</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col shrink-0 items-start cursor-pointer">
          <UserButton showName />
        </div>
      </div>
    </div>
  );
}
