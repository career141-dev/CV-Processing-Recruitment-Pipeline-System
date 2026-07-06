"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function ChannelRealTimeLog({ channelType }: { channelType: string }) {
  const logs = useQuery(api.stats.stats.getRecentChannelLogs, { channelType });

  if (logs === undefined) {
    return (
      <div className="mt-2 bg-surface-container-low p-4 rounded-md border border-border animate-pulse h-32 flex items-center justify-center text-text-secondary text-sm">
        Loading real-time logs...
      </div>
    );
  }

  return (
    <div className="mt-2 bg-surface-container-low p-3 rounded-md border border-border">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold text-text-primary">
          Recent {channelType} Activity
        </span>
        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
          Last 20 items
        </span>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background max-h-64 overflow-y-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Candidate / Phone</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Stage</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log: any) => (
              <tr key={log._id} className="hover:bg-surface-container-low transition-colors">
                <td className="px-3 py-2 font-medium text-text-primary text-[13px] truncate max-w-[150px]">
                  {log.candidateName || log.rawSender || "Unknown"}
                </td>
                <td className="px-3 py-2">
                  <StageBadge stage={log.stage || "queued"} />
                  {log.errorMessage && <p className="text-[11px] text-[#D32F2F] mt-1 truncate max-w-[150px]">{log.errorMessage}</p>}
                </td>
                <td className="px-3 py-2 text-right text-text-secondary text-[12px] whitespace-nowrap">
                  {new Date(log.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-text-secondary text-[13px]">
                  No recent activity for this channel.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const getStageStyles = () => {
    switch (stage) {
      case "queued": return "bg-gray-100 text-gray-600";
      case "parsing": return "bg-[#F3E5F5] text-[#7B1FA2] animate-pulse";
      case "ai_extraction": return "bg-[#E3F2FD] text-[#1976D2] animate-pulse";
      case "indexing": return "bg-[#FFF8E1] text-[#FFA000]";
      case "completed": return "bg-[#E8F5E9] text-[#388E3C]";
      case "failed": return "bg-[#FFEBEE] text-[#D32F2F]";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-sm flex w-fit items-center gap-1 uppercase tracking-wider ${getStageStyles()}`}>
      {stage === "parsing" || stage === "ai_extraction" ? (
        <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="3" stroke="currentColor" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : stage === "completed" ? (
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      ) : null}
      {stage.replace("_", " ")}
    </span>
  );
}
