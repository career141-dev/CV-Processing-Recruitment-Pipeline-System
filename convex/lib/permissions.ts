import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Roles that have unrestricted, global access to all data and pages.
 * test_ta and other limited roles are intentionally excluded.
 * Add new roles here as the system evolves.
 */
export const FULL_ACCESS_ROLES = ["admin", "ta_manager", "senior_ta", "test_ta"] as const;

// Fetch the current authenticated user and validate they are active
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user) throw new Error("User not found in database");
  if (!user.isActive) throw new Error("Account deactivated");
  if (!user.isOnboarded) throw new Error("Pending role assignment — contact Admin");

  return user;
}

// Require one of the provided roles
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  allowedRoles: string[]
) {
  const user = await requireUser(ctx);
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`[403] Access denied. Your role (${user.role}) does not have permission to execute this feature. Required role: ${allowedRoles.join(" | ")}`);
  }
  return user;
}

/**
 * Require full-access role (admin, ta_manager, senior_ta).
 * Call this at the top of any query that touches global data
 * (all candidates, all CVs, analytics, etc.).
 * test_ta users receive a 403-equivalent error.
 */
export async function requireFullAccess(ctx: QueryCtx | MutationCtx) {
  const user = await requireUser(ctx);
  if (!(FULL_ACCESS_ROLES as readonly string[]).includes(user.role)) {
    throw new Error(
      `[403] Access denied. Your role (${user.role}) does not have permission to access global data. Contact your administrator.`
    );
  }
  return user;
}

// Require that user is assigned to this job with one of the provided assignment roles
export async function requireJobAssignment(
  ctx: QueryCtx | MutationCtx,
  jobId: Id<"jobs">,
  requiredAssignmentRoles: string[]
) {
  const user = await requireUser(ctx);

  // Admins and TA Managers bypass job-level assignment checks
  if (["admin", "ta_manager"].includes(user.role)) return user;

  const assignment = await ctx.db
    .query("jobAssignments")
    .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
    .filter((q) =>
      q.and(
        q.eq(q.field("userId"), user._id),
        q.eq(q.field("isActive"), true),
        q.or(...requiredAssignmentRoles.map(r => q.eq(q.field("assignmentRole"), r)))
      )
    )
    .unique();

  if (!assignment) {
    throw new Error("You are not assigned to this job with the required role");
  }
  return user;
}
