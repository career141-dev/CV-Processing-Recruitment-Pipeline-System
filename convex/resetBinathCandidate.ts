import { mutation } from "./_generated/server";

export const resetBinathCandidate = mutation({
  args: {},
  handler: async (ctx) => {
    const appId = "js784aa6tn4ra4gqgd97qzw41h8bh22b" as any;
    const candidateId = "j97ds9f5bcfvrxrv746j05vv0h8bg4p9" as any;

    await ctx.db.patch(appId, {
      currentStage: "new_cvs",
      candidateName: "Binath Test Candidate",
      candidateEmail: "hdbinath@gmail.com",
      candidatePhone: "+94742625552",
      followUpEnteredAt: undefined,
      followUpState: undefined,
      followUpCvReceived: false,
      followUpCurrentSalary: false,
      followUpExpectedSalary: false,
      followUpNoticePeriod: false,
      lastStageChangedAt: Date.now(),
      isActive: true,
    });

    await ctx.db.patch(candidateId, {
      fullName: "Binath Test Candidate",
      email: "hdbinath@gmail.com",
      phone: "+94742625552",
      currentSalary: undefined,
      expectedSalary: undefined,
      noticePeriodDays: undefined,
      cvUploadId: undefined,
    });

    return { success: true };
  },
});
