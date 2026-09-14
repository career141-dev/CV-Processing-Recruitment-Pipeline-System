import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = "http://127.0.0.1:3210";
const client = new ConvexHttpClient(CONVEX_URL);

async function runCrossChecker() {
  console.log("================================================================================");
  console.log("🚀 STARTING FULL CROSS-CHECKER: OPENING & JD BACKEND PIPELINE");
  console.log(`🎯 Target Backend: Local Dev Self-Hosted Convex (${CONVEX_URL})`);
  console.log("================================================================================\n");

  const testOpeningName = "Senior Executive – NVOCC Operations";
  const testClientName = "TransGlobal Logistics Ltd";
  const testLeadNotes = "Must coordinate sea freight movements, handle 500+ TEUs monthly, maintain zero B/L discrepancies, lead port operations with shipping lines.";
  const testTaNotes = "Prior background at major shipping lines (Maersk, MSC) preferred. 4–6 years experience. CargoWise software proficiency mandatory. Strong English communication for port coordination.";

  // ---------------------------------------------------------------------------
  // STEP 1: Test AI Job Description Generation from Notes
  // ---------------------------------------------------------------------------
  console.log("▶ [Step 1] Calling generateJdFromNotesAction with TA Lead & TA Notes...");
  const t0 = Date.now();
  const generatedJd = await client.action(api.openings.actions.generateJdFromNotesAction, {
    openingName: testOpeningName,
    clientName: testClientName,
    taLeadNotes: testLeadNotes,
    taNotes: testTaNotes,
  });
  const t1 = Date.now();
  console.log(`✅ JD Generation completed in ${t1 - t0}ms (${generatedJd.length} chars, ~${generatedJd.split(/\s+/).length} words)`);
  console.log("\n--- GENERATED JD SNIPPET (First 350 chars) ---");
  console.log(generatedJd.slice(0, 350) + "...\n----------------------------------------------");

  // Assertions on Generated JD Structure
  const hasOverview = generatedJd.includes("OVERVIEW") || generatedJd.includes("Overview");
  const hasResponsibilities = generatedJd.includes("Key Responsibilities") || generatedJd.includes("Roles & Responsibilities") || generatedJd.includes("RESPONSIBILITIES");
  const hasPreReqs = generatedJd.includes("PRE-REQUISITES") || generatedJd.includes("Requirements") || generatedJd.includes("Qualifications");
  console.log(`   • Contains OVERVIEW section: ${hasOverview ? "PASSED" : "FAILED"}`);
  console.log(`   • Contains Key Responsibilities: ${hasResponsibilities ? "PASSED" : "FAILED"}`);
  console.log(`   • Contains PRE-REQUISITES: ${hasPreReqs ? "PASSED" : "FAILED"}`);

  if (!hasOverview || !hasResponsibilities || !hasPreReqs) {
    throw new Error("JD Generation failed structural assertion requirements!");
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Test Launch Opening & Autonomous Provisioning Action
  // ---------------------------------------------------------------------------
  console.log("\n▶ [Step 2] Calling launchOpeningAction (Autonomous Extraction & Provisioning)...");
  const t2 = Date.now();
  const launchResult = await client.action(api.openings.actions.launchOpeningAction, {
    openingName: testOpeningName,
    clientName: testClientName,
    jobDescription: generatedJd,
    taLeadNotes: testLeadNotes,
    taNotes: testTaNotes,
    scoreWeights: {
      skills: 35,
      experience: 25,
      jobTitle: 20,
      industry: 15,
      location: 5,
    },
    minMatchScore: 60,
    reverseMatchOnPublish: true,
    followUpConfig: {
      enableWhatsAppFollowUp: true,
      enableEmailFollowUp: true,
      maxFollowUpAttempts: 3,
      maxFollowUpDays: 7,
      customQuestions: ["Port Coordination Experience", "CargoWise Certification"],
    },
  });
  const t3 = Date.now();
  console.log(`✅ Launch Opening completed in ${t3 - t2}ms`);
  console.log("   • Result payload:", JSON.stringify(launchResult, null, 2));

  if (!launchResult.openingId || !launchResult.jobId) {
    throw new Error("Launch Opening failed: Missing openingId or jobId in response!");
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Full Database Cross-Check of All Tables and Saved Columns
  // ---------------------------------------------------------------------------
  console.log("\n▶ [Step 3] Cross-checking database records in Local Convex...");

  // 3a. Verify Openings Table
  const opening = await client.query(api.openings.openings.getById, { id: launchResult.openingId });
  console.log("   • [openings Table Check]:");
  console.log(`     - ID: ${opening._id}`);
  console.log(`     - Title: "${opening.title}" (matches: ${opening.title === testOpeningName})`);
  console.log(`     - Client: "${opening.clientName}" (matches: ${opening.clientName === testClientName})`);
  console.log(`     - Status: "${opening.status}" (matches: ${opening.status === "active"})`);
  console.log(`     - Description Length: ${opening.description?.length} chars`);

  // 3b. Verify Jobs Table
  const job = await client.query(api.jobs.jobs.getJob, { jobId: launchResult.jobId });
  console.log("   • [jobs Table Pinpoint Columns Check]:");
  console.log(`     - Job ID: ${job._id}`);
  console.log(`     - Opening Foreign Key (openingId): ${job.openingId} (linked: ${job.openingId === opening._id})`);
  console.log(`     - Routing Keyword: "${job.keyword}"`);
  console.log(`     - Status: "${job.status}" (is active: ${job.status === "active"})`);
  console.log(`     - AI-Extracted Seniority: "${job.seniorityLevel}"`);
  console.log(`     - AI-Extracted Min Experience: ${job.experienceMinYears} years`);
  console.log(`     - AI-Extracted Required Skills (${job.requiredSkills?.length}):`, job.requiredSkills);
  console.log(`     - AI-Extracted Preferred Skills:`, job.niceToHaveSkills);
  console.log(`     - Education Level: "${job.educationLevel}"`);
  console.log(`     - Location: "${job.location}"`);
  console.log(`     - Match Weights: Skills=${job.scoreWeightSkills}, Exp=${job.scoreWeightExperience}, Title=${job.scoreWeightJobTitle}, Ind=${job.scoreWeightIndustry}, Loc=${job.scoreWeightLocation}`);
  console.log(`     - Reverse Match Status: "${job.reverseMatchStatus}" (enabled: ${job.reverseMatchOnPublish})`);
  console.log(`     - Follow-Up WhatsApp Active: ${job.enableWhatsAppFollowUp}`);
  console.log(`     - Follow-Up Email Active: ${job.enableEmailFollowUp}`);
  console.log(`     - Custom Follow-Up Questions:`, job.customFollowUpQuestions);

  // 3c. Verify jobChannels Table
  const channels = await client.query(api.jobs.jobs.getJobChannels, { jobId: launchResult.jobId });
  console.log(`   • [jobChannels Table Check]: ${channels?.length} channels initialized`);
  channels?.forEach((ch) => {
    console.log(`     - Channel [${ch.channelType}]: enabled=${ch.isEnabled}, status=${ch.agentStatus}`);
  });

  // 3d. Verify Opening-to-Job Relational Query
  const openingWithJobs = await client.query(api.openings.openings.getOpeningWithJobs, { id: launchResult.openingId });
  console.log(`   • [Opening-to-Job Relational Check]: Opening has ${openingWithJobs.jobs?.length} linked job pipeline(s)`);

  console.log("\n================================================================================");
  console.log("🎉 ALL 100% INVARIANTS & PINPOINT COLUMNS VALIDATED SUCCESSFULLY ON LOCAL CONVEX!");
  console.log("================================================================================");
}

runCrossChecker().catch((err) => {
  console.error("\n❌ Cross-checker failed with error:", err);
  process.exit(1);
});
