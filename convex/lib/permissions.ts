import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

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
    throw new Error(`Access denied. Required: ${allowedRoles.join(" | ")}`);
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
