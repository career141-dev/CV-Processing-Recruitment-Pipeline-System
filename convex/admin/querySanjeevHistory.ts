import { query } from "../_generated/server";

export default query({
  handler: async (ctx) => {
    const candidate = await ctx.db.query("candidates")
      .filter(q => q.eq(q.field("email"), "sanjaysanjeev2000@gmail.com"))
      .first();

    return { 
      jobHistory: candidate?.jobHistory,
      totalExperienceYears: candidate?.totalExperienceYears,
      id: candidate?._id
    };
  }
});
