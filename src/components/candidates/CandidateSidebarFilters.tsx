import React from 'react';
import { Button } from '@/components/ui/Button';

export function CandidateSidebarFilters() {
  return (
    <div className="flex flex-col shrink-0 items-start bg-white pt-[13px] mr-[21px] w-[200px]">
      <div className="flex items-center mb-[17px] ml-5 gap-3">
        <button className="flex flex-col shrink-0 items-center bg-[#1B5E20] text-left py-[5px] px-[11px] rounded-md border-0"
          onClick={() => alert('Pressed!')}>
          <span className="text-white text-sm font-bold">R</span>
        </button>
        <span className="text-[#1B5E20] text-base font-bold">RecruitIntel</span>
      </div>
      <div className="flex items-center bg-[#F4F4EF] py-3 pl-[19px] pr-[110px] w-full mb-6 gap-3 border-r-2 border-solid border-r-[#1B5E20]">
        <img
          src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/t5q3a73c_expires_30_days.png" 
          className="w-[15px] h-3.5 object-fill"
          alt="search"
        />
        <span className="text-[#1B5E20] text-[13px] font-bold">Search</span>
      </div>
      
      <div className="flex flex-col items-start ml-5 w-full">
        {/* Role */}
        <div className="flex flex-col items-start mb-6 gap-3 w-full pr-4">
          <span className="text-[#616161] text-[11px] font-bold">ROLE</span>
          <div className="flex flex-col items-start gap-2 w-full">
            <label className="flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="mr-2" />
              <span className="text-[#212121] text-[13px]">Senior</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input type="checkbox" className="mr-2" />
              <span className="text-[#212121] text-[13px]">Lead</span>
            </label>
          </div>
          <div className="w-full h-[1px] bg-gray-200 mt-3"></div>
        </div>
        
        {/* Experience */}
        <div className="flex flex-col items-start mb-6 gap-3 w-full pr-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-[#616161] text-[11px] font-bold">EXPERIENCE</span>
            <span className="text-[#006E1C] text-xs font-bold">3 – 8 years</span>
          </div>
          <div className="w-full pb-1.5 relative mt-2">
            <div className="bg-[#E0E0E0] w-full h-1 rounded-sm absolute top-1.5"></div>
            <div className="bg-[#1B5E20] w-1/2 h-1 rounded-sm absolute top-1.5 left-1/4"></div>
            <div className="bg-[#1B5E20] w-4 h-4 rounded-full absolute top-0 left-1/4 -ml-2 cursor-pointer shadow"></div>
            <div className="bg-[#1B5E20] w-4 h-4 rounded-full absolute top-0 left-3/4 -ml-2 cursor-pointer shadow"></div>
          </div>
          <div className="w-full h-[1px] bg-gray-200 mt-3"></div>
        </div>
        
        {/* Location */}
        <div className="flex flex-col items-start mb-6 gap-3 w-full pr-4">
          <span className="text-[#616161] text-[11px] font-bold">LOCATION</span>
          <div className="flex items-center bg-white py-[11px] px-[15px] gap-2.5 rounded-md border border-solid border-[#E0E0E0] w-full">
            <img
              src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/7porn968_expires_30_days.png" 
              className="w-3 h-[15px] object-fill"
              alt="location"
            />
            <input type="text" placeholder="Remote, New York..." className="border-none outline-none text-[13px] w-full" />
          </div>
          <div className="w-full h-[1px] bg-gray-200 mt-3"></div>
        </div>
        
        {/* Education */}
        <div className="flex flex-col items-start mb-6 gap-3 w-full pr-4">
          <span className="text-[#616161] text-[11px] font-bold">EDUCATION</span>
          <div className="flex flex-col items-start gap-2 w-full">
            <label className="flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="mr-2" />
              <span className="text-[#212121] text-[13px]">Bachelor</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input type="checkbox" className="mr-2" />
              <span className="text-[#212121] text-[13px]">Masters</span>
            </label>
          </div>
          <div className="w-full h-[1px] bg-gray-200 mt-3"></div>
        </div>
        
        {/* Source */}
        <div className="flex flex-col items-start pb-6 mb-4 gap-3 w-full pr-4">
          <span className="text-[#616161] text-[11px] font-bold">SOURCE</span>
          <div className="flex flex-col items-start gap-2 w-full">
            <label className="flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="mr-2" />
              <span className="text-[#212121] text-[13px]">LinkedIn</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input type="checkbox" className="mr-2" />
              <span className="text-[#212121] text-[13px]">WhatsApp</span>
            </label>
          </div>
        </div>
        
        {/* Custom Filters */}
        <div className="flex flex-col items-start mb-3 w-full pr-4">
          <span className="text-[#616161] text-[11px] font-bold mb-3">CUSTOM FILTERS</span>
          <div className="flex items-center mb-3 gap-2 w-full">
            <input
              type="text"
              placeholder="Add custom..."
              className="flex-1 text-gray-500 bg-white text-xs py-[7px] px-[13px] rounded-md border border-solid border-[#E0E0E0]"
            />
            <Button variant="primary" size="sm" onClick={() => alert('Pressed!')}>Add</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => alert('Pressed!')}>PCI-DSS</Button>
            <Button variant="outline" size="sm" onClick={() => alert('Pressed!')}>Big 4 experience</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
