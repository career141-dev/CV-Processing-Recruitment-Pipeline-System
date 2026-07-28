import { mutation } from "./_generated/server";

export const addDemoCandidate = mutation({
  handler: async (ctx) => {
    // 1. Find the test job
    const jobs = await ctx.db.query("jobs").collect();
    const job = jobs.find(j => j.title.toLowerCase().includes("development tes"));
    if (!job) throw new Error("Job not found");

    // 2. Insert candidate
    const candidateId = await ctx.db.insert("candidates", {
      fullName: "Demo Timeline User",
      email: "demo.timeline@career141.com",
      phone: "+94770000000",
      status: "active",
      overallStatus: "follow_up"
    });

    // 3. Insert application in 'follow_up' stage
    const applicationId = await ctx.db.insert("applications", {
      candidateId,
      jobId: job._id,
      sourceChannel: "whatsapp",
      currentStage: "follow_up",
      candidateName: "Demo Timeline User",
      createdAt: Date.now() - (1000 * 60 * 60 * 48), // 2 days ago
      lastStageChangedAt: Date.now() - (1000 * 60 * 60 * 24),
      isActive: true,
      loopIteration: 1,
      followUpState: {
        lastContactDay: 0,
      }
    });

    // 4. Add some pipelineEvents to simulate history
    await ctx.db.insert("pipelineEvents", {
      applicationId,
      jobId: job._id,
      candidateId,
      eventType: "stage_change",
      fromStage: "new_cvs",
      toStage: "follow_up",
      actorType: "system",
      notes: "Automatically moved to Follow-up stage by Agent 3",
      createdAt: Date.now() - (1000 * 60 * 60 * 24), // 1 day ago
    });

    // 5. Add a communication event
    await ctx.db.insert("communications", {
      candidateId,
      applicationId,
      jobId: job._id,
      direction: "outbound",
      channel: "whatsapp",
      body: "Hi Demo, this is a test message from Agent 3 to follow up on your application.",
      senderAgent: "agent3",
      deliveryStatus: "read",
      status: "read",
      sentAt: Date.now() - (1000 * 60 * 60 * 2), // 2 hours ago
      stoppedSequence: false,
    });
    
    // 6. Add an inbound communication reply
    await ctx.db.insert("communications", {
      candidateId,
      applicationId,
      jobId: job._id,
      direction: "inbound",
      channel: "whatsapp",
      body: "Thanks! I am very interested in this timeline feature.",
      deliveryStatus: "delivered",
      status: "delivered",
      sentAt: Date.now() - (1000 * 60 * 30), // 30 mins ago
      stoppedSequence: true,
    });

    return { candidateId, applicationId };
  }
});
