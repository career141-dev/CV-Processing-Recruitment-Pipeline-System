import { mutation } from "./_generated/server";

export const makeAdmin = mutation({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let count = 0;
    for (const u of users) {
      await ctx.db.patch(u._id, { role: "admin", isOnboarded: true });
      count++;
    }
    return count;
  }
});
