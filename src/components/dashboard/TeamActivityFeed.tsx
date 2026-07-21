import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { UserCheck, Send, FileText } from 'lucide-react';

export function TeamActivityFeed() {
  const activities = [
    {
      id: 1,
      iconBg: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-400",
      icon: <UserCheck className="w-4 h-4" />,
      text: "Sarah K. moved James Chen → Interviewed",
      time: "2 mins ago",
      isBold: true
    },
    {
      id: 2,
      iconBg: "bg-teal-500/10 text-teal-800 dark:text-teal-400",
      icon: <Send className="w-4 h-4" />,
      text: "Auto follow-up sent to Priya Nair",
      time: "15 mins ago",
      isBold: false
    },
    {
      id: 3,
      iconBg: "bg-purple-500/10 text-purple-800 dark:text-purple-400",
      icon: <FileText className="w-4 h-4" />,
      text: "System parsed 12 new CVs from LinkedIn",
      time: "45 mins ago",
      isBold: true
    }
  ];

  return (
    <Card noPadding className="p-[1px]">
      <CardHeader>
        <span className="text-text-primary text-sm font-bold">Team Activity</span>
      </CardHeader>
      <div className="flex flex-col items-start p-5 gap-4 w-full">
        {activities.length > 0 ? (
          activities.map(activity => (
            <div key={activity.id} className="flex items-start gap-3 w-full">
              <div
                className={`flex shrink-0 items-center justify-center ${activity.iconBg} rounded-full w-8 h-8`}
              >
                {activity.icon}
              </div>
              <div className="flex flex-col flex-1">
                <span className={`text-text-primary text-[13px] leading-tight mb-1 ${activity.isBold ? 'font-bold' : ''}`}>
                  {activity.text}
                </span>
                <span className="text-text-disabled text-xs">{activity.time}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center w-full py-8 text-center bg-surface-container-lowest rounded-md">
            <div className="w-10 h-10 bg-surface-container-low rounded-full flex items-center justify-center mb-3">
              <span className="text-text-secondary text-lg">📭</span>
            </div>
            <span className="text-text-primary font-medium text-[13px]">No recent activity</span>
            <span className="text-text-secondary text-xs mt-1 max-w-[200px]">When your team takes action, it will show up here.</span>
          </div>
        )}
      </div>
    </Card>
  );
}
