import { mutation } from "./_generated/server";

export const resetErroredCVs = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("cvUploads").collect();
    let count = 0;
    for (const upload of all) {
      if (upload.status === "processed" && upload.errorMessage && upload.errorMessage.includes("pdf-parse")) {
        await ctx.db.patch(upload._id, { status: "failed" });
        count++;
      }
      if (upload.status === "processing") {
        await ctx.db.patch(upload._id, { status: "failed", errorMessage: "Stuck in processing" });
        count++;
      }
    }
    return count;
  }
});
