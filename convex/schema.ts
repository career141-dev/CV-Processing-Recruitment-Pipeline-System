import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  cvUploads: defineTable({
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.float64(),
    fileType: v.string(),
    fileHash: v.optional(v.string()),
    source: v.optional(v.string()),
    campaignLabel: v.optional(v.string()),
    assignToJob: v.optional(v.string()),
    uploadedBy: v.string(),
    status: v.string(),
  })
    .index("by_uploadedBy", ["uploadedBy"])
    .index("by_status", ["status"])
    .index("by_fileHash", ["fileHash"]),

  candidates: defineTable({
    status: v.optional(v.string()),
    isArchivedLocally: v.optional(v.boolean()),
    fullName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    currentTitle: v.optional(v.string()),
    currentEmployer: v.optional(v.string()),
    seniorityLevel: v.optional(v.string()),
    yearsOfExperience: v.optional(v.float64()),
    industries: v.optional(v.array(v.string())),
    expectedSalary: v.optional(v.string()),
    noticePeriod: v.optional(v.string()),
    employmentStatus: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    education: v.optional(
      v.array(
        v.object({
          degree: v.optional(v.string()),
          institution: v.optional(v.string()),
          year: v.optional(v.float64()),
          field: v.optional(v.string()),
        })
      )
    ),
    certifications: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    workableCandidateId: v.optional(v.string()),
    sourceChannel: v.optional(v.string()),
    fileHash: v.optional(v.string()),
    summary: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_phone", ["phone"])
    .index("by_status", ["status"])
    .index("by_workableCandidateId", ["workableCandidateId"])
    .index("by_fullName", ["fullName"]),

  documents: defineTable({
    fileHash: v.optional(v.string()),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.float64()),
    fileType: v.optional(v.string()),
    rawText: v.optional(v.string()),
    status: v.optional(v.string()),
    storageId: v.optional(v.string()),
    uploadedBy: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    candidateName: v.optional(v.string()),
    currentTitle: v.optional(v.string()),
    email: v.optional(v.string()),
    industry: v.optional(v.string()),
    isStructured: v.optional(v.boolean()),
    languages: v.optional(v.array(v.string())),
    location: v.optional(v.string()),
    phone: v.optional(v.string()),
    sector: v.optional(v.string()),
    seniority: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    summary: v.optional(v.string()),
    yearsOfExperience: v.optional(v.float64()),
    workableCandidateId: v.optional(v.string()),
  })
    .index("by_fileHash", ["fileHash"])
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_uploadedBy", ["uploadedBy"]),
});
