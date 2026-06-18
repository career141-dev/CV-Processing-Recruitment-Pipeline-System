"use client";

import React from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const { user } = useUser();
  const userName = user?.fullName || user?.firstName || 'User';
  const imageUrl = user?.imageUrl || "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/136f03a3-c845-4fb7-9a5f-2145eae26c62";
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true;
    if (path !== '/dashboard' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="flex flex-col shrink-0 items-center bg-white pb-3 w-64 border-r border-gray-200 min-h-[calc(100vh-25px)]">
      <div className="flex items-center py-4 border-b border-solid border-b-[#E0E0E0] w-full">
        <button
          className="flex flex-col shrink-0 items-center bg-[#1B5E20] text-left py-[5px] px-[11px] ml-5 mr-3 rounded-md border-0"
          onClick={() => alert('Pressed!')}
        >
          <span className="text-white text-sm font-bold">R</span>
        </button>
        <span className="text-[#1B5E20] text-base font-bold mr-[67px]">
          RecruitIntel
        </span>
      </div>
      <div className="flex items-center bg-[#F4F4EF] py-3 mb-2 border-b border-solid border-b-[#E0E0E0] w-full">
        <button
          className="flex flex-col shrink-0 items-start bg-[#E8E8E3] text-left p-[1px] ml-4 mr-3 rounded-[9999px] border border-solid border-[#E0E0E0]"
          onClick={() => alert('Pressed!')}
        >
          <img
            src={imageUrl}
            className="w-[34px] h-[34px] rounded-[9999px] object-fill"
            alt="Profile"
          />
        </button>
        <div className="flex flex-col shrink-0 items-center mr-[42px]">
          <div className="flex flex-col items-start pr-[50px]">
            <span className="text-[#212121] text-[13px] font-bold">
              {userName}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col w-full px-3 flex-1">
        <Link href="/dashboard" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer ${isActive('/dashboard') ? 'bg-[#F2F5EC]' : 'hover:bg-gray-50'}`}>
          <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/2e237686-7e42-4318-b27c-67f032dda781"
            className="w-[13px] h-[13px] ml-[15px] mr-2.5 rounded-md object-fill"
            alt="Icon"
          />
          <span className={`${isActive('/dashboard') ? 'text-[#1B5E20]' : 'text-[#616161]'} text-[13px]`}>Dashboard</span>
        </Link>
        <Link href="/dashboard/candidates" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer ${isActive('/dashboard/candidates') ? 'bg-[#F2F5EC]' : 'hover:bg-gray-50'}`}>
          <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/eb765b0c-1e4a-4c97-a669-2ce53e634e5f"
            className="w-4 h-3 ml-3 mr-2.5 rounded-md object-fill"
            alt="Icon"
          />
          <span className={`${isActive('/dashboard/candidates') ? 'text-[#1B5E20]' : 'text-[#616161]'} text-[13px]`}>Candidates Search</span>
        </Link>
        <div className="flex items-center py-2 mb-1 rounded-md w-full hover:bg-gray-50 cursor-pointer">
          <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/50445283-38ea-4280-8f33-bae7606ab833"
            className="w-[15px] h-3.5 ml-3 mr-2.5 rounded-md object-fill"
            alt="Icon"
          />
          <span className="text-[#616161] text-[13px]">Jobs</span>
        </div>
        <div className="flex items-center py-2 mb-1 rounded-md w-full hover:bg-gray-50 cursor-pointer">
          <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/4ae910a7-cc1a-4d20-986d-913731b588b1"
            className="w-[13px] h-[13px] ml-3 mr-2.5 rounded-md object-fill"
            alt="Icon"
          />
          <span className="text-[#616161] text-[13px]">Analytics</span>
        </div>
        <Link href="/dashboard/upload-cvs" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer ${isActive('/dashboard/upload-cvs') ? 'bg-[#F2F5EC]' : 'hover:bg-gray-50'}`}>
          <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/3fd22544-454e-4551-a68f-382674cf37f5"
            className="w-3 h-[15px] ml-3 mr-2.5 rounded-md object-fill"
            alt="Icon"
          />
          <span className={`${isActive('/dashboard/upload-cvs') ? 'text-[#1B5E20]' : 'text-[#616161]'} text-[13px]`}>Upload CVs</span>
        </Link>
        
        <div className="flex flex-col items-start py-3 mb-1 w-full mt-auto">
          <div className="bg-[#E0E0E0] w-full h-[1px] mb-3"></div>
          <span className="text-[#9E9E9E] text-[11px] font-bold px-3">ADMIN</span>
        </div>
        
        <div className="flex items-center py-2 mb-1 rounded-md w-full hover:bg-gray-50 cursor-pointer">
          <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/b26844a7-dfe7-4bb9-85c8-6906ecf47b7c"
            className="w-[15px] h-3 ml-3 mr-2.5 rounded-md object-fill"
            alt="Icon"
          />
          <span className="text-[#616161] text-[13px]">Ingestion Monitor</span>
        </div>
        <div className="flex items-center py-2 mb-1 rounded-md w-full hover:bg-gray-50 cursor-pointer">
          <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/bce8719e-6857-4354-809d-6acfa05d49ec"
            className="w-3.5 h-3 ml-3 mr-2.5 rounded-md object-fill"
            alt="Icon"
          />
          <span className="text-[#616161] text-[13px]">Team Management</span>
        </div>
        <div className="flex items-center py-2 mb-4 rounded-md w-full hover:bg-gray-50 cursor-pointer">
          <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/4a80f667-4e3b-403d-beed-b2edef01bf6a"
            className="w-[15px] h-[15px] ml-3 mr-2.5 rounded-md object-fill"
            alt="Icon"
          />
          <span className="text-[#616161] text-[13px]">Settings</span>
        </div>
        
        <div className="flex items-center py-1.5 mb-1 rounded-md w-full hover:bg-gray-50 cursor-pointer">
          <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/88feb487-b199-4ae1-82d7-bdc2e272aef5"
            className="w-[13px] h-[13px] ml-3 mr-2.5 rounded-md object-fill"
            alt="Icon"
          />
          <span className="text-[#9E9E9E] text-xs">Help & Docs</span>
        </div>
        <div className="flex items-center py-1.5 rounded-md w-full hover:bg-gray-50 cursor-pointer">
          <img
            src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/537b3d45-5ba9-45f7-b612-708094f03d9c"
            className="w-3 h-3 ml-3 mr-2.5 rounded-md object-fill"
            alt="Icon"
          />
          <span className="text-[#9E9E9E] text-xs">Log out</span>
        </div>
      </div>
    </div>
  );
}
