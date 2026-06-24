import { mutation } from "./_generated/server";

export const stopAllImports = mutation(async (ctx) => {
  const activeJobs = await ctx.db
    .query("workableImports")
    .filter((q) => q.eq(q.field("status"), "running"))
    .collect();
    
  let count = 0;
  for (const job of activeJobs) {
    await ctx.db.patch(job._id, { 
      status: "stopped", 
      errorMessage: "Stopped by admin" 
    });
    count++;
  }
  return count;
});
