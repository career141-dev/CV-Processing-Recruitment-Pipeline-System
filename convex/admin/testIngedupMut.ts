import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

export default mutation({
  args: {
    file1StorageId: v.id("_storage"),
    file2StorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    console.log("=== Testing CV Ingestion, Deduplication, and Updated CV Mapping (Mutation) ===");

    // 1. Resolve an active job
    const activeJobs = await ctx.db.query("jobs").filter(q => q.eq(q.field("status"), "active")).collect();
    if (activeJobs.length === 0) {
      throw new Error("No active jobs found to run tests. Please make sure there is at least one active job.");
    }
    const job = activeJobs[0];
    console.log(`Using Job: ${job.title} (${job._id})`);

    // Clean up any existing candidate with test details
    const testEmail = "testing.ingestion.mapping@example.com";
    const testPhone = "+94701234567";
    const existing = await ctx.db.query("candidates")
      .filter(q => q.or(q.eq(q.field("email"), testEmail), q.eq(q.field("phone"), testPhone)))
      .collect();
    for (const c of existing) {
      console.log(`Cleaning up existing candidate: ${c._id}`);
      // Cascade delete to avoid foreign key issues
      const apps = await ctx.db.query("applications")
        .withIndex("by_candidateId", (q: any) => q.eq("candidateId", c._id))
        .collect();
      for (const app of apps) await ctx.db.delete(app._id);
      await ctx.db.delete(c._id);
    }

    // --- TEST 1: New CV Ingestion ---
    console.log("\n[TEST 1] Ingesting New CV...");
    const file1Hash = "mock_hash_1111111111111111111111111111111111111111111111111111111111111111";
    const ingest1 = await ctx.db.insert("cvUploads", {
      storageId: args.file1StorageId,
      fileName: "cv_v1.pdf",
      fileType: "application/pdf",
      fileSize: 1000,
      fileHash: file1Hash,
      source: "whatsapp",
      status: "pending",
      assignToJob: job._id,
      uploadedBy: "system",
    });

    console.log(`Ingested CV 1: ${ingest1}`);

    // Call createCandidate (Pass 1 - pre-parse placeholder)
    const initialCandidateId = await ctx.db.insert("candidates", {
      sourceChannel: "whatsapp",
      fileHash: file1Hash,
      cvUploadId: ingest1,
      status: "new",
    });
    console.log(`Placeholder Candidate Created: ${initialCandidateId}`);

    // Call createCandidate (Pass 2 - post-parse matched)
    const finalCandidateId = await ctx.db.insert("candidates", {
      fullName: "Test Candidate",
      email: testEmail,
      phone: testPhone,
      isParsed: true,
      fileHash: file1Hash,
      cvUploadId: ingest1,
      status: "new",
    });
    console.log(`Post-Parse Matched Candidate Created: ${finalCandidateId}`);

    // Point CV upload to final candidate
    await ctx.db.patch(ingest1, { candidateId: finalCandidateId, status: "processed" });

    // --- TEST 2: Duplicate File Ingestion ---
    console.log("\n[TEST 2] Verifying Duplicate File Detection...");
    const existingFile = await ctx.db.query("cvUploads")
      .withIndex("by_fileHash", (q) => q.eq("fileHash", file1Hash))
      .first();

    if (existingFile) {
      console.log(`✅ Duplicate check succeeded! File hash ${file1Hash} detected already in cvUploads: ${existingFile._id}`);
    } else {
      console.log("❌ Duplicate check failed! File hash was not found.");
    }

    // --- TEST 3: Ingesting Updated CV (Same Candidate, New Info) ---
    console.log("\n[TEST 3] Ingesting Updated CV...");
    const file2Hash = "mock_hash_2222222222222222222222222222222222222222222222222222222222222222";

    // Ingest updated CV
    const ingest2 = await ctx.db.insert("cvUploads", {
      storageId: args.file2StorageId,
      fileName: "cv_v2_updated.pdf",
      fileType: "application/pdf",
      fileSize: 1200,
      fileHash: file2Hash,
      source: "whatsapp",
      status: "pending",
      assignToJob: job._id,
      uploadedBy: "system",
    });

    // Create placeholder candidate (Pass 1)
    const placeholder2Id = await ctx.db.insert("candidates", {
      sourceChannel: "whatsapp",
      fileHash: file2Hash,
      cvUploadId: ingest2,
      status: "new",
    });
    console.log(`Created placeholder candidate for updated CV: ${placeholder2Id}`);

    // Deduplication step (Pass 2):
    // Simulate createCandidate matching by email
    let finalCandidate2Id: Id<"candidates"> | null = null;
    const existingCandidate = await ctx.db.query("candidates")
      .filter(q => q.eq(q.field("email"), testEmail))
      .first();

    if (existingCandidate) {
      console.log(`Deduplication matched existing candidate: ${existingCandidate._id}`);
      finalCandidate2Id = existingCandidate._id;
      // Patch existing candidate profile with new cvUploadId
      await ctx.db.patch(existingCandidate._id, {
        cvUploadId: ingest2,
        fileHash: file2Hash,
      });
    }

    const resolvedCandidateId = finalCandidate2Id || placeholder2Id;

    // If final candidate is different from placeholder (it matches existing), delete placeholder
    if (finalCandidate2Id && finalCandidate2Id !== placeholder2Id) {
      console.log(`✅ Merged into existing candidate. Deleting placeholder: ${placeholder2Id}`);
      await ctx.db.delete(placeholder2Id);
    }

    // Point CV upload to resolved candidate
    await ctx.db.patch(ingest2, { candidateId: resolvedCandidateId, status: "processed" });

    // Verify correct mapping
    const finalCandidateRecord = await ctx.db.get(finalCandidate2Id!);
    const finalCvRecord = await ctx.db.get(ingest2);

    console.log("\n--- Verification ---");
    if (finalCandidateRecord?.cvUploadId === ingest2) {
      console.log("✅ Candidate profile correctly linked to the updated CV (ingest2)!");
    } else {
      console.log("❌ Candidate profile is not linked to updated CV.");
    }

    if (finalCvRecord?.candidateId === finalCandidate2Id) {
      console.log("✅ CV upload record correctly points to candidate profile!");
    } else {
      console.log("❌ CV upload record does not point to candidate.");
    }

    const placeholderCheck = await ctx.db.get(placeholder2Id);
    if (!placeholderCheck) {
      console.log("✅ Placeholder candidate record successfully deleted/cleaned up!");
    } else {
      console.log("❌ Placeholder candidate was not deleted.");
    }

    // Clean up test data
    console.log("\nCleaning up test runs...");
    await ctx.db.delete(ingest1);
    await ctx.db.delete(ingest2);
    await ctx.db.delete(finalCandidateId);

    console.log("\n=== Test script mutation complete ===");
    return { success: true };
  },
});
