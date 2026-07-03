import React from 'react';
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

const SOURCE_COLORS: Record<string, string> = {
  linkedin: "bg-[#0A66C2] text-white",
  whatsapp: "bg-[#25D366] text-white",
  email_campaign: "bg-orange-400 text-white",
  headhunting: "bg-purple-500 text-white",
  manual_upload: "bg-surface-container text-text-secondary",
  workable: "bg-sky-500 text-white",
};

const STAGE_LABELS: Record<string, string> = {
  new_cvs: "New CVs",
  matched_candidates: "TA Shortlisted",
  ta_shortlist: "TA Shortlisted",
  shortlisted: "TA Shortlisted",
  follow_up: "Follow-up",
  second_shortlist: "Second Shortlist",
  director_shortlist: "Director Shortlist",
  client_review: "Client Review",
  interview: "Interview",
  offer: "Offer",
  placed: "Placed",
  rejected: "Rejected",
  active: "Active",
  not_available: "Not Available",
  merged: "Merged"
};

const STATUS_COLORS: Record<string, string> = {
  new_cvs: "bg-blue-50 text-blue-700 border-blue-200",
  shortlisted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ta_shortlist: "bg-emerald-50 text-emerald-700 border-emerald-200",
  matched_candidates: "bg-emerald-50 text-emerald-700 border-emerald-200",
  follow_up: "bg-amber-50 text-amber-700 border-amber-200",
  second_shortlist: "bg-teal-50 text-teal-700 border-teal-200",
  director_shortlist: "bg-purple-50 text-purple-700 border-purple-200",
  client_review: "bg-pink-50 text-pink-700 border-pink-200",
  interview: "bg-cyan-50 text-cyan-700 border-cyan-200",
  offer: "bg-violet-50 text-violet-700 border-violet-200",
  placed: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  active: "bg-green-50 text-green-700 border-green-200",
  not_available: "bg-gray-50 text-gray-700 border-gray-200",
  merged: "bg-slate-50 text-slate-700 border-slate-200",
};

export function CandidateManagementTable() {
  const router = useRouter();
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = React.useState(1);

  const { results, status, loadMore } = usePaginatedQuery(
    api.candidates.listCandidatesPaginated,
    {},
    { initialNumItems: itemsPerPage }
  );

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = results.slice(startIndex, endIndex);
  
  const totalPages = Math.ceil(results.length / itemsPerPage);
  const hasMoreLocalPages = currentPage < totalPages;
  const canGoNext = hasMoreLocalPages || status === "CanLoadMore";
  const canGoPrev = currentPage > 1;

  const handleNext = () => {
    if (hasMoreLocalPages) {
      setCurrentPage((p) => p + 1);
    } else if (status === "CanLoadMore") {
      loadMore(itemsPerPage);
      setCurrentPage((p) => p + 1);
    }
  };

  const handlePrev = () => {
    if (canGoPrev) {
      setCurrentPage((p) => p - 1);
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full px-6 pb-6">
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-bright text-[12px] text-text-secondary uppercase font-semibold tracking-wider">
                <th className="px-6 py-4">Candidate</th>
                <th className="px-6 py-4">Current Role</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Experience</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Added On</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-[13px] text-text-primary">
              {currentItems.length === 0 && status === "Exhausted" ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-text-disabled">
                    No candidates found.
                  </td>
                </tr>
              ) : (
                currentItems.map((candidate) => (
                  <tr key={candidate._id} className="hover:bg-surface-bright transition-colors group">
                    <td className="px-6 py-4 font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-bold text-xs shrink-0">
                          {candidate.fullName?.charAt(0) || "?"}
                        </div>
                        <div>
                          <div className="text-text-primary font-semibold">{candidate.fullName || "Unknown"}</div>
                          <div className="text-text-secondary text-xs truncate max-w-[150px]">{candidate.email || candidate.phone || "No contact"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-text-primary">{(candidate as any).currentTitle || (candidate as any).currentJobTitle || "—"}</div>
                      <div className="text-text-secondary text-xs">{(candidate as any).currentEmployer || ""}</div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{candidate.location || "—"}</td>
                    <td className="px-6 py-4 text-text-secondary">
                      {(candidate as any).totalExperienceYears != null
                        ? `${(candidate as any).totalExperienceYears} yrs`
                        : (candidate as any).yearsOfExperience
                        ? `${(candidate as any).yearsOfExperience} yrs`
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const src = ((candidate as any).firstSourceChannel || (candidate as any).sourceChannel || "manual_upload").toLowerCase();
                        const color = SOURCE_COLORS[src] ?? "bg-surface-container text-text-secondary";
                        return (
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${color}`}>
                            {src.replace(/_/g, " ")}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const statusKey = candidate.overallStatus || candidate.status || "new_cvs";
                        const label = STAGE_LABELS[statusKey] || statusKey;
                        const color = STATUS_COLORS[statusKey] ?? "bg-surface-container text-text-secondary border-border";
                        return (
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${color}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {format(new Date(candidate._creationTime), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="border border-border text-text-secondary px-3 py-1.5 rounded-[8px] text-[12px] font-medium hover:bg-surface-container transition-colors"
                        onClick={() => router.push(`/dashboard/candidates/${candidate._id}`)}
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {status === "LoadingMore" && (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-text-disabled text-sm">
                    Loading...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface-bright">
          <div className="text-[13px] text-text-secondary">
            Showing <span className="font-medium text-text-primary">{Math.min(startIndex + 1, results.length)}</span> to <span className="font-medium text-text-primary">{Math.min(endIndex, results.length)}</span> candidates
          </div>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-1 border border-border px-3 py-1.5 rounded-[8px] text-[13px] text-text-secondary hover:bg-surface-container transition-colors disabled:opacity-40"
              onClick={handlePrev}
              disabled={!canGoPrev}
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              className="flex items-center gap-1 border border-border px-3 py-1.5 rounded-[8px] text-[13px] text-text-secondary hover:bg-surface-container transition-colors disabled:opacity-40"
              onClick={handleNext}
              disabled={!canGoNext || status === "LoadingMore"}
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
