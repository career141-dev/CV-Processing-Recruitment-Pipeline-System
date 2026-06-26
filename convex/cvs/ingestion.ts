import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

export const processInboundCV = internalAction({
  args: {
    messageId: v.string(),
    toNumber: v.string(),
    fromNumber: v.string(),
    originalSenderPhone: v.string(),
    mediaId: v.string(),
    mimeType: v.string(),
    fileName: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    console.log(`[Meta Cloud API Mock] Downloading media ${args.mediaId}...`);
    
    // 1. Download file from Meta (Mocked)
    const mockPdfContent = `Mock CV content for candidate ${args.originalSenderPhone}. Source: WhatsApp.`;
    const fileBlob = new Blob([mockPdfContent], { type: "application/pdf" });
    const fileBuffer = await fileBlob.arrayBuffer();
    
    // 2. Hash file
    const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
    const fileHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // 3. Store in Convex Native Storage securely (Actions can generate upload URLs and POST to them, or we can use the fetch approach)
    // Actually, in an Action in Convex v1, to store a blob we can fetch the upload URL.
    const uploadUrl = await ctx.runMutation(internal.cvs.ingestion.generateUploadUrl);
    const uploadResult = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": fileBlob.type },
      body: fileBlob,
    });
    const { storageId } = await uploadResult.json();

    // 4. Update Database
    await ctx.runMutation(internal.cvs.ingestion.insertCvRecord, {
      toNumber: args.toNumber,
      fromNumber: args.fromNumber,
      originalSenderPhone: args.originalSenderPhone,
      fileName: args.fileName,
      storageId,
      fileHash,
      fileSize: fileBlob.size,
    });
  },
});

export const generateUploadUrl = internalMutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const insertCvRecord = internalMutation({
  args: {
    toNumber: v.string(),
    fromNumber: v.string(),
    originalSenderPhone: v.string(),
    fileName: v.union(v.string(), v.null()),
    storageId: v.id("_storage"),
    fileHash: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    let jobId = null;
    let sourceLevel2 = "Common Number";
    
    const channel = await ctx.db
      .query("jobChannels")
      .withIndex("by_whatsapp", (q) => q.eq("whatsappNumber", args.toNumber))
      .filter((q) => q.eq(q.field("isEnabled"), true))
      .first();

    if (channel) {
      jobId = channel.jobId;
      sourceLevel2 = `Campaign — WhatsApp`;
    }

    const taUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("phone"), args.fromNumber))
      .first();

    const rawSenderDisplay = taUser ? taUser._id : args.fromNumber;

    let candidate = await ctx.db
      .query("candidates")
      .filter((q) => q.eq(q.field("phone"), args.originalSenderPhone))
      .first();

    if (!candidate) {
      const candidateId = await ctx.db.insert("candidates", {
        phone: args.originalSenderPhone,
        firstSourceChannel: "whatsapp",
        firstSeenAt: Date.now(),
        fullName: `WhatsApp Candidate (${args.originalSenderPhone.slice(-4)})`,
        email: "",
        status: "active",
      });
      candidate = await ctx.db.get(candidateId);
    }

    const cvUploadId = await ctx.db.insert("cvUploads", {
      candidateId: candidate!._id,
      storageId: args.storageId,
      fileName: args.fileName || `cv_whatsapp_${Date.now()}.pdf`,
      fileSize: args.fileSize,
      fileType: "application/pdf",
      fileHash: args.fileHash,
      source: "whatsapp",
      campaignLabel: sourceLevel2,
      uploadedBy: taUser ? taUser._id : "system",
      status: "queued",
    });

    await ctx.db.insert("ingestionLog", {
      jobId: jobId || undefined,
      channelType: "whatsapp",
      rawSender: rawSenderDisplay,
      routingStatus: "routed",
      cvFileId: cvUploadId,
      candidateId: candidate!._id,
      processingTimeMs: 0,
      receivedAt: Date.now(),
      candidateName: candidate!.fullName || "Unknown",
      stage: "queued",
    });
  }
});
