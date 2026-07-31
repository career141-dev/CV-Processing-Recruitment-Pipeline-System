import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function useCurrentUser() {
  return useQuery(api.users.users.getCurrentUser);
}

export function useRole() {
  const user = useCurrentUser();
  const role = user?.role ?? null;

  return {
    role,
    isOnboarded: user?.isOnboarded ?? false,
    isActive: user?.isActive ?? false,
    isAdmin: role === "admin",
    isTAManager: role === "ta_manager",
    isSeniorTA: role === "senior_ta",
    isRecruiter: role === "recruiter",
    isDirector: role === "director",
    isClient: role === "client",
    isViewer: role === "viewer",
    isTestTA: role === "test_ta",
    hasFullAccess: ["admin", "ta_manager", "senior_ta"].includes(role ?? ""),
    canCreateJob: ["admin", "ta_manager", "senior_ta", "test_ta"].includes(role ?? ""),
    canManageUsers: role === "admin",
    canViewAnalytics: ["admin", "ta_manager", "senior_ta"].includes(role ?? ""),
  };
}

export function useJobAccess(jobId: Id<"jobs"> | undefined) {
  const assignment = useQuery(api.jobs.jobs.getMyAssignment, jobId ? { jobId } : "skip");
  const { role, isAdmin, isTAManager } = useRole();
  return {
    canViewPipeline: isAdmin || isTAManager || !!assignment,
    canShortlist: isAdmin || isTAManager || ["primary_recruiter", "supporting_recruiter"].includes(assignment?.assignmentRole ?? ""),
    canDirectorReview: isAdmin || assignment?.assignmentRole === "director",
    canClientReview: role === "client" && assignment?.assignmentRole === "client_contact",
    isPrimaryRecruiter: assignment?.assignmentRole === "primary_recruiter",
  };
}
