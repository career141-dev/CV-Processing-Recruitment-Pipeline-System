import { internalAction, internalMutation } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import { adjustGlobalStat } from "../stats/statsHelper";

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
    console.log(`[Meta Cloud API] Downloading media ${args.mediaId}...`);

    // ── 1. Fetch real media binary from Meta Graph API ─────────────────────
    const WHATSAPP_TOKEN = process.env.WHATSAPP_CLOUD_API_TOKEN;
    if (!WHATSAPP_TOKEN) {
      console.error("[WhatsApp Ingestion] WHATSAPP_CLOUD_API_TOKEN env var is not set. Aborting.");
      return;
    }

    // Step 1a: Resolve media URL from media ID
    const mediaMetaResp = await fetch(
      `https://graph.facebook.com/v19.0/${args.mediaId}`,
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
    if (!mediaMetaResp.ok) {
      console.error(
        `[WhatsApp Ingestion] Failed to get media URL for ${args.mediaId}: ${mediaMetaResp.status} ${mediaMetaResp.statusText}`
      );
      return;
    }
    const mediaMeta = await mediaMetaResp.json() as { url?: string };
    if (!mediaMeta.url) {
      console.error(`[WhatsApp Ingestion] Meta response missing 'url' field for media ${args.mediaId}`);
      return;
    }

    // Step 1b: Download the actual file binary
    const fileResp = await fetch(mediaMeta.url, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    });
    if (!fileResp.ok) {
      console.error(
        `[WhatsApp Ingestion] Failed to download media binary: ${fileResp.status} ${fileResp.statusText}`
      );
      return;
    }
    const fileBuffer = await fileResp.arrayBuffer();
    const mimeType = args.mimeType || fileResp.headers.get("content-type") || "application/pdf";

    // 2. Hash file
    const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
    const fileHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // 3. Store in Cloudflare R2
    const base64Data = Buffer.from(fileBuffer).toString("base64");
    const s3Key = await ctx.runAction(internal.storage.r2.uploadBufferToR2, {
      fileName: args.fileName || `whatsapp_${args.originalSenderPhone}.pdf`,
      contentType: mimeType,
      base64Data,
    });

    // 4. Update Database
    await ctx.runMutation(internal.cvs.ingestion.insertCvRecord, {
      toNumber: args.toNumber,
      fromNumber: args.fromNumber,
      originalSenderPhone: args.originalSenderPhone,
      fileName: args.fileName,
      s3Key,
      storageProvider: "r2",
      fileHash,
      fileSize: fileBuffer.byteLength,
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
    storageId: v.optional(v.id("_storage")),
    s3Key: v.optional(v.string()),
    storageProvider: v.optional(v.string()),
    fileHash: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    // SHA-256 duplicate check (exact file)
    const existingFile = await ctx.db.query("cvUploads")
      .withIndex("by_fileHash", (q) => q.eq("fileHash", args.fileHash))
      .first();

    if (existingFile) {
      console.log(`[cvs/ingestion:insertCvRecord] Duplicate file detected: ${args.fileHash}. Skipping ingestion.`);
      
      const taUser = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", args.fromNumber))
        .first();

      const rawSenderDisplay = taUser ? taUser._id : args.fromNumber;

      const session = await ctx.db
        .query("whatsappSessions")
        .withIndex("by_phone", (q) => q.eq("phone", args.originalSenderPhone))
        .first();

      let resolvedJobId = null;
      if (session) {
        resolvedJobId = session.jobId;
        await ctx.db.delete(session._id);
      } else {
        const channel = await ctx.db
          .query("jobChannels")
          .withIndex("by_whatsapp", (q) => q.eq("whatsappNumber", args.toNumber))
          .filter((q) => q.eq(q.field("isEnabled"), true))
          .first();
        if (channel) {
          resolvedJobId = channel.jobId;
        }
      }

      await ctx.db.insert("ingestionLog", {
        jobId: resolvedJobId || undefined,
        channelType: "whatsapp",
        rawSender: rawSenderDisplay,
        routingStatus: "duplicate_file",
        cvFileId: existingFile._id,
        receivedAt: Date.now(),
        stage: "failed",
      } as any);

      return { success: false, reason: "duplicate_file", existingFileId: existingFile._id };
    }

    let jobId = null;
    let sourceLevel2 = "Common Number";
    
    // Check if there is an active session for the candidate phone
    const session = await ctx.db
      .query("whatsappSessions")
      .withIndex("by_phone", (q) => q.eq("phone", args.originalSenderPhone))
      .first();

    if (session) {
      jobId = session.jobId;
      sourceLevel2 = `Campaign — WhatsApp (${session.keyword})`;
      await ctx.db.delete(session._id);
    } else {
      const channel = await ctx.db
        .query("jobChannels")
        .withIndex("by_whatsapp", (q) => q.eq("whatsappNumber", args.toNumber))
        .filter((q) => q.eq(q.field("isEnabled"), true))
        .first();

      if (channel) {
        jobId = channel.jobId;
        sourceLevel2 = `Campaign — WhatsApp`;
      }
    }

    const taUser = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.fromNumber))
      .first();

    const rawSenderDisplay = taUser ? taUser._id : args.fromNumber;

    let candidate = await ctx.db
      .query("candidates")
      .withIndex("by_phone", (q) => q.eq("phone", args.originalSenderPhone))
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
      await adjustGlobalStat(ctx, "new_candidate");
    }

    const cvUploadId = await ctx.db.insert("cvUploads", {
      candidateId: candidate!._id,
      storageId: args.storageId,
      s3Key: args.s3Key,
      storageProvider: args.storageProvider,
      fileName: args.fileName || `cv_whatsapp_${Date.now()}.pdf`,
      fileSize: args.fileSize,
      fileType: "application/pdf",
      fileHash: args.fileHash,
      source: "whatsapp",
      campaignLabel: sourceLevel2,
      uploadedBy: taUser ? taUser._id : "system",
      status: "queued",
    });
    
    await adjustGlobalStat(ctx, "new_cv_upload", 1, { sourceChannel: "whatsapp" });

    const logId = await ctx.db.insert("ingestionLog", {
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

    // 8. Check Channel Toggles for Pausing
    const configRow = await ctx.db.query("appSettings").withIndex("by_key", q => q.eq("key", "system")).first();
    const toggles = configRow?.channel_toggles;
    
    if (toggles?.whatsappIngestion === false) {
      await ctx.db.patch(cvUploadId, { status: "paused" });
      await ctx.db.patch(logId, { stage: "paused" });
      console.log(`[insertCvRecord] WhatsApp is paused. CV ${cvUploadId} queued for later.`);
    } else {
      await ctx.scheduler.runAfter(0, api.cvs.cvExtraction.processCvExtraction, {
        cvUploadId,
        storageId: args.storageId,
        s3Key: args.s3Key,
        storageProvider: args.storageProvider,
        fileType: "application/pdf",
        uploadedBy: taUser ? taUser._id : "system",
        sourceChannel: "whatsapp",
        skipLLM: false,
      });
    }
  }
});

export const resumePausedUploads = internalMutation({
  args: {
    channel: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("email_campaign"))
  },
  handler: async (ctx, args) => {
    const pausedUploads = await ctx.db.query("cvUploads")
      .withIndex("by_status", q => q.eq("status", "paused"))
      .filter(q => q.eq(q.field("source"), args.channel))
      .collect();

    let resumedCount = 0;
    for (const upload of pausedUploads) {
      if (!upload.storageId) continue;
      
      await ctx.db.patch(upload._id, { status: "queued" });
      
      // Update ingestionLog if exists
      const log = await ctx.db.query("ingestionLog")
        .withIndex("by_cvFileId", q => q.eq("cvFileId", upload._id))
        .first();
      if (log) {
        await ctx.db.patch(log._id, { stage: "queued" });
      }

      await ctx.scheduler.runAfter(0, api.cvs.cvExtraction.processCvExtraction, {
        cvUploadId: upload._id,
        storageId: upload.storageId,
        s3Key: upload.s3Key,
        storageProvider: upload.storageProvider,
        fileType: upload.fileType || "application/pdf",
        uploadedBy: upload.uploadedBy || "system",
        sourceChannel: upload.source || "unknown",
        skipLLM: false,
        logId: log?._id,
      });
      resumedCount++;
    }
    
    return { success: true, resumedCount };
  }
});
