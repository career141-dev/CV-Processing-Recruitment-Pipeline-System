// convex/users.ts
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireRole } from "../lib/permissions";

// Called from Next.js on every login via useConvexAuth / onAuthStateChange
export const syncCurrentUser = mutation({
  args: { 
    name: v.string(), 
    email: v.string(), 
    avatarUrl: v.optional(v.string()),
    invitedRole: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (existing) {
      // Update login time and name/email if changed
      await ctx.db.patch(existing._id, {
        fullName: args.name,
        email: args.email,
        avatarUrl: args.avatarUrl,
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return existing._id;
    }

    // First login — assign the invited role if it exists, otherwise default to viewer
    const roleToAssign = args.invitedRole || "viewer";
    const isOnboarded = !!args.invitedRole;

    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      clerkUserId: identity.subject,
      fullName: args.name,
      email: args.email,
      avatarUrl: args.avatarUrl,
      role: roleToAssign as any,
      isActive: true,
      isOnboarded: isOnboarded,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

// Admin only — assign role to a user
export const assignRole = mutation({
  args: { targetUserId: v.id("users"), newRole: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, ["admin"]);
    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new Error("Target user not found");
    const fromRole = target.role;

    // Update role and mark as onboarded if they were pending
    await ctx.db.patch(args.targetUserId, {
      role: args.newRole as any,
      isOnboarded: true,
      updatedAt: new Date().toISOString(),
    });

    // Write to audit log
    await ctx.db.insert("roleAuditLog", {
      targetUserId: args.targetUserId,
      changedBy: admin._id,
      fromRole,
      toRole: args.newRole,
      reason: args.reason,
      occurredAt: new Date().toISOString(),
    });
  },
});

export const deactivate = mutation({
  args: { targetUserId: v.id("users"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, ["admin"]);
    
    await ctx.db.patch(args.targetUserId, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    });

    await ctx.db.insert("roleAuditLog", {
      targetUserId: args.targetUserId,
      changedBy: admin._id,
      fromRole: "active",
      toRole: "deactivated",
      reason: args.reason,
      occurredAt: new Date().toISOString(),
    });
  },
});

export const getTeamMembers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map(u => ({
      ...u,
      jobCount: 0 
    }));
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    return user;
  },
});

export const listByRoles = query({
  args: { roles: v.array(v.string()) },
  handler: async (ctx, args) => {
    const userGroups = await Promise.all(
      args.roles.map(role => 
        ctx.db.query("users").withIndex("by_role", q => q.eq("role", role as any)).collect()
      )
    );
    return userGroups.flat();
  },
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  }
});
