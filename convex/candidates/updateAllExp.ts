import { mutation } from "../_generated/server";
import { deriveTotalExperienceYears } from "./derivations";

export default mutation({
  handler: async (ctx) => {
    const candidates = await ctx.db.query("candidates").collect();
    let updatedCount = 0;

    for (const candidate of candidates) {
      if (candidate.jobHistory && candidate.jobHistory.length > 0) {
        const correctExp = deriveTotalExperienceYears(candidate.jobHistory, undefined);
        if (correctExp !== undefined && correctExp !== candidate.totalExperienceYears) {
          await ctx.db.patch(candidate._id, { totalExperienceYears: correctExp });
          updatedCount++;
        }
      }
    }
    return { updatedCount };
  }
});
