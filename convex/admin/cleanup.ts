import { query, mutation } from "../_generated/server";
import { v } from "convex/values";

export const getJobs = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").collect();
    return jobs.map(j => ({ _id: j._id, title: j.title, company: j.clientName, status: j.status }));
  }
});

export const deleteDummyJobs = mutation({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").collect();
    const dummyTitles = ["wewe", "qwqwqw", "asdfas"];
    const dummyJobs = jobs.filter(j => dummyTitles.includes(j.title.toLowerCase().trim()));
    
    for (const job of dummyJobs) {
      await ctx.db.delete(job._id);
    }
    
    return dummyJobs.length;
  }
});
