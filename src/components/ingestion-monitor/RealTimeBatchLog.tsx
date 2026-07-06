"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export default function RealTimeBatchLog({ batchId }: { batchId: Id<"ingestionBatches"> }) {
  const batch = useQuery(api.cvs.batches.getBatch, { batchId });
  const logs = useQuery(api.cvs.batches.getBatchLogs, { batchId });
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!batch) return;
    if (batch.status === "completed" || batch.status === "failed") {
      setElapsed(batch.completedAt ? Math.floor((batch.completedAt - batch.startedAt) / 1000) : 0);
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - batch.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [batch]);

  if (!batch || !logs) {
    return <div className="p-4 border rounded shadow-sm animate-pulse h-64 bg-gray-50">Loading Batch Info...</div>;
  }

  const processedCount = batch.completedCount + batch.failedCount;
  const progressPercent = batch.totalCount > 0 ? Math.round((processedCount / batch.totalCount) * 100) : 0;

  return (
    <div className="p-6 border border-gray-200 rounded-xl shadow-sm bg-white mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Real-Time Ingestion ({batch.sourceChannel})</h3>
        <span className={`px-3 py-1 text-sm font-medium rounded-full ${
          batch.status === "completed" ? "bg-green-100 text-green-700" :
          batch.status === "failed" ? "bg-red-100 text-red-700" :
          "bg-blue-100 text-blue-700"
        }`}>
          {batch.status === "in_progress" ? "Processing..." : batch.status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6 text-center">
        <div className="p-3 bg-gray-50 rounded-lg border">
          <p className="text-sm text-gray-500 font-medium">Total</p>
          <p className="text-2xl font-bold">{batch.totalCount}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border">
          <p className="text-sm text-gray-500 font-medium">Completed</p>
          <p className="text-2xl font-bold text-green-600">{batch.completedCount}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border">
          <p className="text-sm text-gray-500 font-medium">Failed</p>
          <p className="text-2xl font-bold text-red-600">{batch.failedCount}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border">
          <p className="text-sm text-gray-500 font-medium">Elapsed</p>
          <p className="text-2xl font-bold text-blue-600">{elapsed}s</p>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3 mb-6 overflow-hidden">
        <div 
          className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Candidate / File</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Stage</th>
              <th className="px-6 py-3 text-right font-medium text-gray-500">Time</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3 font-medium text-gray-900 truncate max-w-[200px]">
                  {log.candidateName || log.rawSender || "Unknown"}
                </td>
                <td className="px-6 py-3">
                  <StageBadge stage={log.stage || "queued"} />
                  {log.errorMessage && <p className="text-xs text-red-500 mt-1 truncate max-w-xs">{log.errorMessage}</p>}
                </td>
                <td className="px-6 py-3 text-right text-gray-500">
                  {log.processingTimeMs ? `${(log.processingTimeMs / 1000).toFixed(1)}s` : "-"}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                  No logs available yet...
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
      case "parsing": return "bg-purple-100 text-purple-700 animate-pulse";
      case "ai_extraction": return "bg-blue-100 text-blue-700 animate-pulse";
      case "indexing": return "bg-yellow-100 text-yellow-700";
      case "completed": return "bg-green-100 text-green-700";
      case "failed": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full flex w-fit items-center gap-1.5 ${getStageStyles()}`}>
      {stage === "parsing" || stage === "ai_extraction" ? (
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="3" stroke="currentColor" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : stage === "completed" ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      ) : null}
      {stage.replace("_", " ").toUpperCase()}
    </span>
  );
}
