"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type Role = "admin" | "ta_manager" | "senior_ta" | "recruiter" | "director" | "client" | "viewer" | "ta" | "ops";

export function usePermissions() {
  const { user: clerkUser, isLoaded } = useUser();
  
  // Get the synced user record from Convex to determine the actual system role
  const users = useQuery(api.users.users.getAllUsers);
  
  // Find current user safely
  const currentUser = users?.find((u) => u.clerkUserId === clerkUser?.id || u.tokenIdentifier === clerkUser?.id);
  const role: Role = (currentUser?.role as Role) || "viewer";

  // Define RBAC Matrix based on guide
  const permissions = {
    // Job Management
    canCreateJob: ["admin", "ta_manager", "senior_ta"].includes(role),
    canEditJobAny: ["admin", "ta_manager"].includes(role),
    canConfigureChannels: ["admin", "ta_manager", "senior_ta"].includes(role),
    canConfigureAiAgents: ["admin", "ta_manager", "senior_ta"].includes(role),
    canPublishJob: ["admin", "ta_manager", "senior_ta"].includes(role),
    canDeleteJob: ["admin"].includes(role),
    canAssignRecruiters: ["admin", "ta_manager", "senior_ta"].includes(role),
    canAssignDirector: ["admin", "ta_manager", "senior_ta"].includes(role),
    canAssignClient: ["admin", "ta_manager", "senior_ta"].includes(role),
    canRegenerateKeyword: ["admin", "ta_manager", "senior_ta"].includes(role),
    canDownloadAssets: ["admin", "ta_manager", "senior_ta", "recruiter", "ta"].includes(role),

    // Candidate & Pipeline
    canUploadCvManual: ["admin", "ta_manager", "senior_ta", "recruiter", "ta"].includes(role),
    canEditCandidateProfile: ["admin", "ta_manager", "senior_ta", "ta"].includes(role),
    canViewAiMatchScore: ["admin", "ta_manager", "senior_ta", "recruiter", "ta"].includes(role),
    
    // Stages
    canActStage1NewCvs: ["admin", "ta_manager", "senior_ta", "recruiter", "ta"].includes(role),
    canActStage2TaShortlist: ["admin", "ta_manager", "senior_ta", "recruiter", "ta"].includes(role),
    canActStage3AiCall: ["admin", "ta_manager", "senior_ta"].includes(role),
    canActStage4SecondShortlist: ["admin", "ta_manager", "senior_ta", "recruiter", "ta"].includes(role),
    canActStage5DirectorReview: ["admin", "ta_manager", "director"].includes(role),
    canActStage6ClientReview: ["admin", "client"].includes(role),
    canActStage7Interview: ["admin", "ta_manager", "senior_ta", "ta"].includes(role),
    canActStage8Offer: ["admin", "ta_manager", "senior_ta", "ta"].includes(role),
    canActStage9MarkPlaced: ["admin", "ta_manager", "senior_ta", "ta"].includes(role),

    // Advanced Actions
    canDeleteCandidate: ["admin"].includes(role),
    canRunAiSemanticSearch: ["admin", "ta_manager", "senior_ta", "recruiter", "ta"].includes(role),
    canTriggerHeadhunting: ["admin", "ta_manager", "senior_ta"].includes(role),

    // Team & User Management
    canViewAllUsers: ["admin", "ta_manager"].includes(role),
    canManageUsers: ["admin"].includes(role),
    canManageTeams: ["admin", "ta_manager"].includes(role),
    canViewTeamRoster: ["admin", "ta_manager", "senior_ta", "recruiter", "ta"].includes(role),
    canInviteExternalClient: ["admin", "ta_manager", "senior_ta"].includes(role),

    // System Settings
    canManageSystemSettings: ["admin"].includes(role),
    canManageWorkable: ["admin", "ta_manager"].includes(role),
    canViewSystemHealth: ["admin", "ta_manager"].includes(role),
  };

  return {
    isLoaded: isLoaded && users !== undefined,
    role,
    currentUser,
    ...permissions
  };
}
