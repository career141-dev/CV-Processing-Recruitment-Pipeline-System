import { query } from "../_generated/server";

export default query({
  handler: async (ctx) => {
    const logs = await ctx.db.query("ingestionLog").order("desc").take(5);
    const cvs = await ctx.db.query("cvUploads").order("desc").take(5);
    const cands = await ctx.db.query("candidates").order("desc").take(5);
    const apps = await ctx.db.query("applications").order("desc").take(5);
    
    return { logs, cvs, cands, apps };
  }
});
