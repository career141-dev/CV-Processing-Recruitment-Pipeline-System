import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seedTestJobAndCandidates = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Find an active user in the database to assign as recruiter
    const users = await ctx.db.query("users").collect();
    const activeUser = users.find(u => u.isActive) || users[0];
    if (!activeUser) {
      throw new Error("No users found in database to assign as recruiter. Please register/onboard a user first.");
    }

    // 2. Delete any existing test job with keyword "DEV-TEST" or title "Development Test Job"
    const existingJobs = await ctx.db.query("jobs").collect();
    for (const job of existingJobs) {
      if (job.keyword === "DEV-TEST" || job.title === "Development Test Job") {
        // Also clean up any associated applications/pipelineEvents to prevent orphans
        const apps = await ctx.db.query("applications")
          .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
          .collect();
        for (const app of apps) {
          // Delete events
          const events = await ctx.db.query("pipelineEvents")
            .withIndex("by_application", (q) => q.eq("applicationId", app._id))
            .collect();
          for (const ev of events) {
            await ctx.db.delete(ev._id);
          }
          // Delete communications
          const comms = await ctx.db.query("communications")
            .withIndex("by_applicationId", (q) => q.eq("applicationId", app._id))
            .collect();
          for (const c of comms) {
            await ctx.db.delete(c._id);
          }
          // Delete application
          await ctx.db.delete(app._id);
        }
        
        // Delete job assignments
        const assignments = await ctx.db.query("jobAssignments")
          .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
          .collect();
        for (const ass of assignments) {
          await ctx.db.delete(ass._id);
        }

        // Delete job channels
        const channels = await ctx.db.query("jobChannels")
          .withIndex("by_job", (q) => q.eq("jobId", job._id))
          .collect();
        for (const ch of channels) {
          await ctx.db.delete(ch._id);
        }

        // Delete job
        await ctx.db.delete(job._id);
      }
    }

    // 3. Create dummy candidates for matching tab
    const dummy1Id = await ctx.db.insert("candidates", {
      fullName: "Jane Doe (React Dev)",
      email: "jane.doe@career141-test.com",
      phone: "+94771112222",
      status: "active",
      overallStatus: "new_cvs",
      currentSalary: 150000,
      expectedSalary: 220000,
      noticePeriodDays: 30,
    });

    const dummy2Id = await ctx.db.insert("candidates", {
      fullName: "Alex Smith (Fullstack)",
      email: "alex.smith@career141-test.com",
      phone: "+94773334444",
      status: "active",
      overallStatus: "new_cvs",
      currentSalary: 180000,
      expectedSalary: 255000,
      noticePeriodDays: 45,
    });

    // 4. Create the target test candidate requested: Test Candidate Benchmark
    const targetCandidateId = await ctx.db.insert("candidates", {
      fullName: "Test Candidate Benchmark",
      email: "sivasuthakran.sanjeev@career141-test.com",
      phone: "+94775556666",
      status: "active",
      overallStatus: "new_cvs",
    });

    // 5. Insert the Development Test Job
    const jobId = await ctx.db.insert("jobs", {
      title: "Development Test Job",
      clientName: "Internal",
      clientIndustry: "Technology",
      recruitmentType: "both",
      isConfidential: false,
      jobDescription: "This is an internal development test job for verifying recruitment pipeline and error popup transitions.",
      requiredSkills: ["React", "TypeScript", "Convex", "Next.js"],
      niceToHaveSkills: ["TailwindCSS", "Node.js"],
      seniorityLevel: "mid_level",
      experienceMinYears: 0,
      location: "Remote",
      keyword: "DEV-TEST",
      status: "active",
      primaryRecruiterId: activeUser._id,
      directorId: activeUser._id,
      directorReviewEnabled: true,
      clientReviewEnabled: true,
      esaCheckEnabled: false,
      rejectionLoopAction: "restart_from_new_cvs",
      headhuntingEnabled: false,
      agent3AfterDay7: "mark_unresponsive",
      agent5Trigger: "manual_only",
      agent5CallScript: "default",
      agent5NoAnswerAction: "notify_ta",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reverseMatchStatus: "done",
      reverseMatchedAt: new Date().toISOString(),
      // Seed dummy matches in matching tab
      reverseMatchResults: [
        {
          cvId: dummy1Id,
          overallScore: 88,
          breakdown: { skills: 90, experience: 85, seniority: 90, industry: 80, location: 100 },
          matchedSkills: ["React", "TypeScript"],
          missingSkills: ["Convex"],
          reason: "Candidate has strong frontend background with React and TypeScript, remote location is a perfect fit.",
          candidateName: "Jane Doe (React Dev)",
          candidateRole: "Senior Frontend Engineer",
          candidateExp: 4,
          sourceLevel1: "database",
          sourceLevel2: "internal"
        },
        {
          cvId: dummy2Id,
          overallScore: 75,
          breakdown: { skills: 70, experience: 80, seniority: 70, industry: 75, location: 100 },
          matchedSkills: ["TypeScript", "Next.js"],
          missingSkills: ["React", "Convex"],
          reason: "Good fullstack foundation, lacks dedicated Convex expertise but strong in Next.js.",
          candidateName: "Alex Smith (Fullstack)",
          candidateRole: "Fullstack Developer",
          candidateExp: 3,
          sourceLevel1: "database",
          sourceLevel2: "internal"
        }
      ]
    });

    // 6. Create Job Channel configurations (WA, EM, CP)
    await ctx.db.insert("jobChannels", {
      jobId,
      channelType: "whatsapp",
      isEnabled: true,
      whatsappNumber: "+94770000000",
      cvCountToday: 0,
      cvCountTotal: 0,
      agentStatus: "active",
      createdAt: new Date().toISOString()
    });

    await ctx.db.insert("jobChannels", {
      jobId,
      channelType: "email_campaign",
      isEnabled: true,
      emailInbox: "jobs@career141.com",
      cvCountToday: 0,
      cvCountTotal: 0,
      agentStatus: "active",
      createdAt: new Date().toISOString()
    });

    await ctx.db.insert("jobChannels", {
      jobId,
      channelType: "meta_campaign",
      isEnabled: true,
      metaCampaignId: "camp_123456",
      cvCountToday: 0,
      cvCountTotal: 0,
      agentStatus: "active",
      createdAt: new Date().toISOString()
    });

    // 7. Add target candidate "Test Candidate Benchmark" as an active application in the 'new_cvs' stage for this job
    const applicationId = await ctx.db.insert("applications", {
      candidateId: targetCandidateId,
      jobId,
      sourceChannel: "whatsapp",
      currentStage: "new_cvs",
      candidateName: "Test Candidate Benchmark",
      createdAt: Date.now(),
      lastStageChangedAt: Date.now(),
      isActive: true,
      loopIteration: 1
    });

    // Also add to job assignments so recruiter can access it
    await ctx.db.insert("jobAssignments", {
      jobId,
      userId: activeUser._id,
      assignmentRole: "primary_recruiter",
      assignedBy: activeUser._id,
      assignedAt: new Date().toISOString(),
      isActive: true
    });

    return { jobId, applicationId, candidateId: targetCandidateId };
  }
});

export const seedSanjeevToProduction = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Find or create Development Test Job
    let job = await ctx.db.query("jobs").filter(q => q.eq(q.field("keyword"), "DEV-TEST")).first();
    let jobId = job?._id;

    if (!jobId) {
      const activeUser = (await ctx.db.query("users").first()) || { _id: "n17ffg4ab5ds4crkhrkrgsgp8189987d" as any };
      jobId = await ctx.db.insert("jobs", {
        title: "Development Test Job",
        clientName: "Internal",
        clientIndustry: "Technology",
        recruitmentType: "both",
        isConfidential: false,
        jobDescription: "Internal development test job for recruitment pipeline verification.",
        requiredSkills: ["React", "TypeScript", "Convex", "Next.js"],
        niceToHaveSkills: ["TailwindCSS", "Node.js"],
        seniorityLevel: "mid_level",
        experienceMinYears: 0,
        location: "Remote",
        keyword: "DEV-TEST",
        status: "active",
        primaryRecruiterId: activeUser._id,
        directorId: activeUser._id,
        directorReviewEnabled: true,
        clientReviewEnabled: true,
        esaCheckEnabled: false,
        rejectionLoopAction: "restart_from_new_cvs",
        headhuntingEnabled: false,
        agent3AfterDay7: "mark_unresponsive",
        agent5Trigger: "manual_only",
        agent5CallScript: "default",
        agent5NoAnswerAction: "notify_ta",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        outreachWhatsAppNumber: "+94742197476",
        enableWhatsAppFollowUp: true,
        enableEmailFollowUp: true,
        maxFollowUpAttempts: 3,
        maxFollowUpDays: 3,
        customFollowUpQuestions: ["Do you have experience with Next.js and Convex?"],
      });
    }

    // 2. Find or create Candidate Sivasuthakaran Sanjeev
    let cand = await ctx.db.query("candidates").filter(q => q.eq(q.field("email"), "sanjaysanjeev2000@gmail.com")).first();
    let candidateId = cand?._id;

    if (!candidateId) {
      candidateId = await ctx.db.insert("candidates", {
        fullName: "Sivasuthakaran Sanjeev",
        email: "sanjaysanjeev2000@gmail.com",
        phone: "+94753883167",
        status: "active",
        overallStatus: "new_cvs",
        currentEmployer: "Career141",
        currentJobTitle: "Full-Stack Developer & AI Integration Engineer",
        currentTitle: "Full-Stack Developer & AI Integration Engineer",
        location: "Colombo, Sri Lanka",
        totalExperienceYears: 3,
        yearsOfExperience: 3,
        skills: ["Next.js", "React", "Node.js", "TypeScript", "Convex", "AWS", "Python", "Full-Stack", "Docker", "TailwindCSS"],
        summary: "Driven Full-Stack Developer and AI Integration Engineer delivering production-grade systems across web, mobile, cloud, and AI domains.",
        jobHistory: [
          {
            title: "Web Developer Intern",
            company: "Career141",
            startDate: "2025",
            endDate: "Present",
            description: "Architected a 13-stage AI-powered CV recruitment pipeline with 8 autonomous agents processing 115,000+ candidate profiles."
          },
          {
            title: "Mobile Application Development Trainee",
            company: "Softwareplus Pvt Ltd",
            startDate: "2024",
            endDate: "2024",
            description: "Developed Android (Java/Kotlin) features for ERP, LMS, and inventory management systems."
          }
        ],
        education: [
          {
            degree: "BIT (Hons) in Networking & Mobile Computing",
            institution: "Horizon Campus",
            field: "Networking & Mobile Computing",
            year: 2026
          }
        ],
        isParsed: true,
      });
    }

    // 3. Clear existing applications for Sanjeev under this job to prevent duplicates
    const existingApps = await ctx.db.query("applications")
      .withIndex("by_jobId", q => q.eq("jobId", jobId!))
      .filter(q => q.eq(q.field("candidateId"), candidateId!))
      .collect();

    for (const app of existingApps) {
      await ctx.db.delete(app._id);
    }

    // 4. Create fresh application in 'new_cvs' stage
    const applicationId = await ctx.db.insert("applications", {
      candidateId: candidateId!,
      jobId: jobId!,
      sourceChannel: "manual_upload",
      currentStage: "new_cvs",
      candidateName: "Sivasuthakaran Sanjeev",
      candidateEmail: "sanjaysanjeev2000@gmail.com",
      candidatePhone: "+94753883167",
      candidateTitle: "Full-Stack Developer & AI Integration Engineer",
      candidateExperience: 3,
      aiMatchScore: 95,
      aiMatchExplanation: "Candidate is a Full-Stack Developer & AI Integration Engineer matching all required skills for Development Test Job.",
      createdAt: Date.now(),
      lastStageChangedAt: Date.now(),
      isActive: true,
      loopIteration: 1,
      followUpAttemptCount: 0,
      followUpCvReceived: true,
      followUpCurrentSalary: false,
      followUpExpectedSalary: false,
      followUpNoticePeriod: false,
      stageHistory: [
        {
          stage: "new_cvs",
          enteredAt: new Date().toISOString(),
          changedBy: "system",
        }
      ]
    });

    console.log(`[Production Seed] Successfully seeded Sivasuthakaran Sanjeev in New CVs stage on production under job ${jobId}`);
    return { success: true, jobId, candidateId, applicationId };
  }
});










