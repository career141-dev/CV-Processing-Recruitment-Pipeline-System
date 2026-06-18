import React from 'react';
import { UserButton } from '@clerk/nextjs';

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <div className="flex justify-between items-center self-stretch bg-white py-3 px-6 border-b border-solid border-b-[#E0E0E0] mb-5">
      <span className="text-[#212121] text-[13px] font-bold">
        {title}
      </span>
      <div className="flex shrink-0 items-center gap-4">
        <img
          src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/86a2166d-e331-49b2-a4ba-bd8d81a0c5d6"
          className="w-[13px] h-[13px] object-fill cursor-pointer"
          alt="Search"
        />
        <img
          src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/db5f0e62-0f4b-42cd-97cb-d06d811456cc"
          className="w-3 h-[15px] object-fill cursor-pointer"
          alt="Notifications"
        />
        <div className="flex flex-col shrink-0 items-start cursor-pointer">
          <UserButton showName />
        </div>
      </div>
    </div>
  );
}
