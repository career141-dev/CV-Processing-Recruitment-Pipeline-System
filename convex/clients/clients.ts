import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("clients")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
  },
});

export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const trimmed = args.name.trim();
    if (!trimmed) return null;
    return await ctx.db
      .query("clients")
      .withIndex("by_name", (q) => q.eq("name", trimmed))
      .first();
  },
});

export const createClient = mutation({
  args: {
    name: v.string(),
    industry: v.string(),
    contactPerson: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    website: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Client name cannot be empty");
    }

    // Check if client already exists (exact name match)
    const existing = await ctx.db
      .query("clients")
      .withIndex("by_name", (q) => q.eq("name", trimmedName))
      .first();

    if (existing) {
      // Update existing client with any newly provided details
      await ctx.db.patch(existing._id, {
        industry: args.industry.trim() || existing.industry,
        contactPerson: args.contactPerson?.trim() || existing.contactPerson,
        contactEmail: args.contactEmail?.trim() || existing.contactEmail,
        contactPhone: args.contactPhone?.trim() || existing.contactPhone,
        website: args.website?.trim() || existing.website,
        notes: args.notes?.trim() || existing.notes,
      });
      return { clientId: existing._id, isNew: false };
    }

    // Create new client record
    const clientId = await ctx.db.insert("clients", {
      name: trimmedName,
      industry: args.industry.trim() || "Other",
      contactPerson: args.contactPerson?.trim() || undefined,
      contactEmail: args.contactEmail?.trim() || undefined,
      contactPhone: args.contactPhone?.trim() || undefined,
      website: args.website?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      createdAt: Date.now(),
    });

    return { clientId, isNew: true };
  },
});

export const updateClient = mutation({
  args: {
    id: v.id("clients"),
    name: v.optional(v.string()),
    industry: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    website: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleanUpdates: Record<string, any> = {};

    if (updates.name !== undefined) cleanUpdates.name = updates.name.trim();
    if (updates.industry !== undefined) cleanUpdates.industry = updates.industry.trim();
    if (updates.contactPerson !== undefined) cleanUpdates.contactPerson = updates.contactPerson.trim();
    if (updates.contactEmail !== undefined) cleanUpdates.contactEmail = updates.contactEmail.trim();
    if (updates.contactPhone !== undefined) cleanUpdates.contactPhone = updates.contactPhone.trim();
    if (updates.website !== undefined) cleanUpdates.website = updates.website.trim();
    if (updates.notes !== undefined) cleanUpdates.notes = updates.notes.trim();

    await ctx.db.patch(id, cleanUpdates);
    return true;
  },
});
