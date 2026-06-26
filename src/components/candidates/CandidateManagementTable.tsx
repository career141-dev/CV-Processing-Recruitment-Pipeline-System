import React from 'react';
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { format } from "date-fns";
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';

function getSourceVariant(source?: string | null): "success" | "warning" | "error" | "info" | "default" {
  switch (source?.toLowerCase()) {
    case "linkedin": return "success";
    case "whatsapp": return "warning";
    case "email": return "info";
    case "headhunting": return "error";
    default: return "default";
  }
}

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
    <div className="flex flex-col flex-1 w-full p-6">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Candidate</th>
                <th className="px-6 py-4">Current Role</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Experience</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Added On</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentItems.length === 0 && status === "Exhausted" ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    No candidates found.
                  </td>
                </tr>
              ) : (
                currentItems.map((candidate) => (
                  <tr key={candidate._id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-container/10 flex items-center justify-center text-primary-container font-bold text-xs shrink-0">
                          {candidate.fullName?.charAt(0) || "?"}
                        </div>
                        <div>
                          <div className="text-gray-900 font-semibold">{candidate.fullName || "Unknown"}</div>
                          <div className="text-gray-500 text-xs truncate max-w-[150px]">{candidate.email || candidate.phone || "No contact"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">{candidate.currentTitle || "-"}</div>
                      <div className="text-gray-500 text-xs">{candidate.currentEmployer || ""}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{candidate.location || "-"}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {candidate.totalExperienceYears != null ? `${candidate.totalExperienceYears} yrs` : candidate.yearsOfExperience ? `${candidate.yearsOfExperience} yrs` : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={getSourceVariant(candidate.sourceChannel)}>
                        {(candidate.sourceChannel || "Manual").toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {format(new Date(candidate._creationTime), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="outline"
                        className="h-8 text-xs px-3 py-1 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm"
                        onClick={() => router.push(`/dashboard/candidates/${candidate._id}`)}
                      >
                        View Profile
                      </Button>
                    </td>
                  </tr>
                ))
              )}
              {status === "LoadingMore" && (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium text-gray-900">{Math.min(startIndex + 1, results.length)}</span> to <span className="font-medium text-gray-900">{Math.min(endIndex, results.length)}</span> candidates (Page {currentPage})
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-8 text-xs py-1 px-3 border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
              onClick={handlePrev}
              disabled={!canGoPrev}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            <Button
              variant="outline"
              className="h-8 text-xs py-1 px-3 border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
              onClick={handleNext}
              disabled={!canGoNext || (status === "LoadingMore")}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
