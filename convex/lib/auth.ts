// convex/lib/auth.ts
import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

export type UserRole = "admin" | "director" | "ta" | "ops";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  fullName: string;
}

/** Call this at the top of every mutation and query that needs auth. */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<AuthenticatedUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("UNAUTHENTICATED: Must be logged in");
  }

  // Look up user record in our users table
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();

  if (!user || !user.isActive) {
    throw new Error("FORBIDDEN: User account not found or inactive");
  }

  return {
    userId: user._id,
    email: user.email,
    role: user.role as UserRole,
    fullName: user.fullName,
  };
}

/** Require a specific role or throw. */
export function requireRole(
  user: AuthenticatedUser,
  allowedRoles: UserRole[]
): void {
  if (!allowedRoles.includes(user.role)) {
    throw new Error(
      `FORBIDDEN: Requires role ${allowedRoles.join(" or ")}, got ${user.role}`
    );
  }
}
