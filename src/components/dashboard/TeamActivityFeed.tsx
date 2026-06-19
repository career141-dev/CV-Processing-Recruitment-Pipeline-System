import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';

export function TeamActivityFeed() {
  const activities = [
    {
      id: 1,
      iconBg: "bg-[#1B5E2026]",
      iconUrl: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/4d093c8c-cdbb-4660-939f-6f3503eaac6e",
      text: "Sarah K. moved James Chen → Interviewed",
      time: "2 mins ago",
      isBold: true
    },
    {
      id: 2,
      iconBg: "bg-[#00676326]",
      iconUrl: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/8c36ba61-0587-4268-b880-dce9a3287bdb",
      text: "Auto follow-up sent to Priya Nair",
      time: "15 mins ago",
      isBold: false
    },
    {
      id: 3,
      iconBg: "bg-[#6B1D3D26]",
      iconUrl: "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/de0b9f00-82f3-40d7-9da7-6d8ddad2c10e",
      text: "System parsed 12 new CVs from LinkedIn",
      time: "45 mins ago",
      isBold: true
    }
  ];

  return (
    <Card noPadding className="p-[1px]">
      <CardHeader>
        <span className="text-[#212121] text-sm font-bold">Team Activity</span>
      </CardHeader>
      <div className="flex flex-col items-start p-5 gap-4 w-full">
        {activities.length > 0 ? (
          activities.map(activity => (
            <div key={activity.id} className="flex items-start gap-3 w-full">
              <button
                className={`flex flex-col shrink-0 items-center justify-center ${activity.iconBg} p-2 rounded-full border-0 w-8 h-8`}
                onClick={() => alert('Activity Clicked!')}
              >
                <img
                  src={activity.iconUrl}
                  className="w-3 h-3 object-fill"
                  alt="Icon"
                />
              </button>
              <div className="flex flex-col flex-1">
                <span className={`text-[#212121] text-[13px] leading-tight mb-1 ${activity.isBold ? 'font-bold' : ''}`}>
                  {activity.text}
                </span>
                <span className="text-[#9E9E9E] text-xs">{activity.time}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center w-full py-8 text-center bg-[#FAFAFA] rounded-md">
            <div className="w-10 h-10 bg-[#F4F4EF] rounded-full flex items-center justify-center mb-3">
              <span className="text-[#616161] text-lg">📭</span>
            </div>
            <span className="text-[#212121] font-medium text-[13px]">No recent activity</span>
            <span className="text-[#616161] text-xs mt-1 max-w-[200px]">When your team takes action, it will show up here.</span>
          </div>
        )}
      </div>
    </Card>
  );
}
