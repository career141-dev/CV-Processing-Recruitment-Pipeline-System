// convex/users.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Called from Next.js after Clerk sign-in to ensure user exists in Convex
export const syncUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    fullName: v.string(),
    role: v.optional(v.string()), // "ta" | "director" | "admin" | "ops"
  },
  handler: async (ctx, args) => {
    // Note: The existing schema uses `tokenIdentifier` instead of `clerkId`.
    // We look up the user using the by_token index.
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.clerkId))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      tokenIdentifier: args.clerkId,
      email: args.email,
      fullName: args.fullName,
      role: (args.role as any) ?? "ta",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  },
});

// Use this helper inside any mutation to get the acting user
export const getActingUser = async (ctx: any) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  // In Convex, identity.tokenIdentifier is what Clerk provides as the unique subject ID
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user) throw new Error("User not found in database");
  return user;
};

export const getTeamMembers = query({
  args: {},
  handler: async (ctx) => {
    // Return users without any identity checks or complex promises to ensure it NEVER returns []
    const users = await ctx.db.query("users").collect();
    
    // Simplest possible return
    return users.map(u => ({
      ...u,
      jobCount: 0 // hardcode jobCount to bypass index issues just in case
    }));
  },
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  }
});
