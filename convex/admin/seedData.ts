import { mutation } from "../_generated/server";

export const seedLocalDevData = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Create Clients
    const client1Id = await ctx.db.insert("clients", {
      name: "ABC Technologies",
      industry: "Technology",
      contactPerson: "John Doe",
      contactEmail: "john@abctech.com",
      contactPhone: "+94 77 123 4567",
      website: "https://abctech.example.com",
      notes: "Primary engineering partner",
      createdAt: Date.now(),
    });

    const client2Id = await ctx.db.insert("clients", {
      name: "Global Finance Ltd",
      industry: "Finance",
      contactPerson: "Sarah Smith",
      contactEmail: "sarah@globalfinance.com",
      contactPhone: "+94 71 987 6543",
      website: "https://globalfinance.example.com",
      notes: "Key enterprise financial client",
      createdAt: Date.now(),
    });

    // 2. Create Openings under ABC Technologies
    const opening1Id = await ctx.db.insert("openings", {
      title: "Software Engineering Hiring",
      description: "Recruitment campaign for backend, frontend, and fullstack roles",
      clientId: client1Id,
      clientName: "ABC Technologies",
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const opening2Id = await ctx.db.insert("openings", {
      title: "QA & DevOps Hiring",
      description: "Quality assurance and cloud infrastructure requisition",
      clientId: client1Id,
      clientName: "ABC Technologies",
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create Opening under Global Finance Ltd
    const opening3Id = await ctx.db.insert("openings", {
      title: "Finance & Analytics Recruitment",
      description: "Hiring financial analysts and data specialists",
      clientId: client2Id,
      clientName: "Global Finance Ltd",
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Find default user or creator
    const defaultUser = await ctx.db.query("users").first();
    const primaryRecruiterId = defaultUser ? defaultUser._id : ("users_default" as any);

    // 3. Create Jobs under Openings
    const job1Id = await ctx.db.insert("jobs", {
      title: "Software Engineer",
      openingId: opening1Id,
      clientName: "ABC Technologies",
      clientIndustry: "Technology",
      recruitmentType: "both",
      isConfidential: false,
      jobDescription: "Developing scalable cloud web applications",
      requiredSkills: ["React", "TypeScript", "Node.js"],
      seniorityLevel: "mid_level",
      experienceMinYears: 2,
      experienceMaxYears: 5,
      location: "Colombo",
      salaryMin: 250000,
      salaryMax: 400000,
      salaryCurrency: "LKR",
      keyword: "SWE202601",
      status: "active",
      primaryRecruiterId,
      directorReviewEnabled: false,
      clientReviewEnabled: false,
      esaCheckEnabled: false,
      rejectionLoopAction: "restart_from_new_cvs",
      headhuntingEnabled: false,
      agent3AfterDay7: "mark_unresponsive",
      agent5Trigger: "manual_only",
      agent5CallScript: "default",
      agent5NoAnswerAction: "notify_ta",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const job2Id = await ctx.db.insert("jobs", {
      title: "Full Stack Developer",
      openingId: opening1Id,
      clientName: "ABC Technologies",
      clientIndustry: "Technology",
      recruitmentType: "both",
      isConfidential: false,
      jobDescription: "Full stack engineering across React & Convex",
      requiredSkills: ["React", "Convex", "Next.js", "TailwindCSS"],
      seniorityLevel: "senior_executive",
      experienceMinYears: 4,
      experienceMaxYears: 8,
      location: "Remote",
      salaryMin: 450000,
      salaryMax: 650000,
      salaryCurrency: "LKR",
      keyword: "FSD202602",
      status: "active",
      primaryRecruiterId,
      directorReviewEnabled: false,
      clientReviewEnabled: false,
      esaCheckEnabled: false,
      rejectionLoopAction: "restart_from_new_cvs",
      headhuntingEnabled: false,
      agent3AfterDay7: "mark_unresponsive",
      agent5Trigger: "manual_only",
      agent5CallScript: "default",
      agent5NoAnswerAction: "notify_ta",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const job3Id = await ctx.db.insert("jobs", {
      title: "Automation QA Engineer",
      openingId: opening2Id,
      clientName: "ABC Technologies",
      clientIndustry: "Technology",
      recruitmentType: "job_posting",
      isConfidential: false,
      jobDescription: "Test automation with Playwright and Cypress",
      requiredSkills: ["Playwright", "TypeScript", "Cypress"],
      seniorityLevel: "mid_level",
      experienceMinYears: 3,
      location: "Colombo",
      salaryMin: 300000,
      salaryMax: 450000,
      salaryCurrency: "LKR",
      keyword: "QA202603",
      status: "active",
      primaryRecruiterId,
      directorReviewEnabled: false,
      clientReviewEnabled: false,
      esaCheckEnabled: false,
      rejectionLoopAction: "restart_from_new_cvs",
      headhuntingEnabled: false,
      agent3AfterDay7: "mark_unresponsive",
      agent5Trigger: "manual_only",
      agent5CallScript: "default",
      agent5NoAnswerAction: "notify_ta",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const job4Id = await ctx.db.insert("jobs", {
      title: "Financial Analyst",
      openingId: opening3Id,
      clientName: "Global Finance Ltd",
      clientIndustry: "Finance",
      recruitmentType: "headhunting",
      isConfidential: false,
      jobDescription: "Financial modeling and risk management analysis",
      requiredSkills: ["Financial Modeling", "Excel", "SQL"],
      seniorityLevel: "mid_level",
      experienceMinYears: 3,
      location: "Colombo",
      salaryMin: 350000,
      salaryMax: 500000,
      salaryCurrency: "LKR",
      keyword: "FIN202604",
      status: "active",
      primaryRecruiterId,
      directorReviewEnabled: false,
      clientReviewEnabled: false,
      esaCheckEnabled: false,
      rejectionLoopAction: "restart_from_new_cvs",
      headhuntingEnabled: false,
      agent3AfterDay7: "mark_unresponsive",
      agent5Trigger: "manual_only",
      agent5CallScript: "default",
      agent5NoAnswerAction: "notify_ta",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return {
      clientsCreated: 2,
      openingsCreated: 3,
      jobsCreated: 4,
    };
  },
});
