import { v } from "convex/values";
import { query, mutation } from "../_generated/server";

export const getRefereesByCandidate = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("referees")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", args.candidateId))
      .collect();
  },
});

export const saveExtractedReferees = mutation({
  args: {
    candidateId: v.id("candidates"),
    referees: v.array(
      v.object({
        name: v.string(),
        designation: v.optional(v.string()),
        company: v.optional(v.string()),
        contactNo: v.optional(v.string()),
        email: v.optional(v.string()),
        relationship: v.optional(v.string()),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Delete existing referees for this candidate to allow re-parsing idempotency
    const existing = await ctx.db
      .query("referees")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", args.candidateId))
      .collect();

    for (const ref of existing) {
      await ctx.db.delete(ref._id);
    }

    const insertedIds = [];
    const now = new Date().toISOString();

    for (const ref of args.referees) {
      if (!ref.name || ref.name.trim().length === 0) continue;
      const id = await ctx.db.insert("referees", {
        candidateId: args.candidateId,
        name: ref.name.trim(),
        designation: ref.designation || undefined,
        company: ref.company || undefined,
        contactNo: ref.contactNo || undefined,
        email: ref.email || undefined,
        relationship: ref.relationship || undefined,
        notes: ref.notes || undefined,
        createdAt: now,
      });
      insertedIds.push(id);
    }

    return insertedIds;
  },
});

export const addReferee = mutation({
  args: {
    candidateId: v.id("candidates"),
    name: v.string(),
    designation: v.optional(v.string()),
    company: v.optional(v.string()),
    contactNo: v.optional(v.string()),
    email: v.optional(v.string()),
    relationship: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("referees", {
      candidateId: args.candidateId,
      name: args.name.trim(),
      designation: args.designation || undefined,
      company: args.company || undefined,
      contactNo: args.contactNo || undefined,
      email: args.email || undefined,
      relationship: args.relationship || undefined,
      notes: args.notes || undefined,
      createdAt: new Date().toISOString(),
    });
  },
});

export const deleteReferee = mutation({
  args: { id: v.id("referees") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
