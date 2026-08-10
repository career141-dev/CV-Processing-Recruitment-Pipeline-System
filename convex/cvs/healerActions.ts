"use node";

import { internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";

const HEALER_MODEL_TAG = "llama31-70b-healer";

/**
 * 24/7 Background Healer Worker — Runs every 2 minutes.
 * Claims strictly 1 unextracted CV upload using fast B-tree index (by_status: "uploaded"),
 * processes extraction, and updates candidate status.
 */
export const healNextUnparsedCandidate = internalAction({
  args: {},
  handler: async (ctx): Promise<{ healed: boolean; cvUploadId?: string }> => {
    // 1. Claim 1 unextracted record via fast B-tree index
    const target = await ctx.runMutation(internal.cvs.healer.claimNextUnparsedRecord, {});
    if (!target) {
      return { healed: false };
    }

    console.log(`[Healer 24/7] Claimed CV upload ${target.cvUploadId} (${target.fileName}) for extraction sweep...`);

    try {
      // Process full AI extraction using processCvExtraction pipeline
      await ctx.runAction(api.cvs.cvExtraction.processCvExtraction, {
        cvUploadId: target.cvUploadId as any,
        storageId: target.storageId,
        s3Key: target.s3Key || undefined,
        storageProvider: target.storageProvider || "r2",
        fileType: target.fileType,
        sourceChannel: target.source,
        uploadedBy: target.uploadedBy,
      });

      console.log(`[Healer 24/7] Successfully extracted & healed CV upload ${target.cvUploadId}`);
      return { healed: true, cvUploadId: target.cvUploadId };
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error(`[Healer 24/7] Failed to process CV upload ${target.cvUploadId}:`, errorMsg);
      
      await ctx.runMutation(internal.cvs.healer.releaseFailedClaim, {
        cvUploadId: target.cvUploadId as any,
        errorMessage: errorMsg,
      });
      return { healed: false };
    }
  },
});
