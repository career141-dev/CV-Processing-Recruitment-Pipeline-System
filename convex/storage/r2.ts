import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";

// Helper to initialize S3 client for Cloudflare R2
export function getS3Client() {
  return new S3Client({
    region: "auto", // R2 uses 'auto'
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Action to generate a pre-signed URL for uploading a CV from the frontend.
 */
export const generateUploadUrl = action({
  args: {
    fileName: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    const s3 = getS3Client();
    // Clean filename and create a unique key
    const safeName = args.fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const date = new Date();
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const key = `cvs/${yearMonth}/${Date.now()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: args.contentType,
    });

    // Generate URL that expires in 1 hour
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return { url, key };
  },
});

/**
 * Action to generate a pre-signed URL for downloading/viewing a CV.
 */
export const generateDownloadUrl = action({
  args: { 
    key: v.string(),
    downloadFilename: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const s3 = getS3Client();
    
    // Support setting Content-Disposition for proper filename download
    const params: any = {
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: args.key,
    };
    
    if (args.downloadFilename) {
      params.ResponseContentDisposition = `attachment; filename="${args.downloadFilename}"`;
    }

    const command = new GetObjectCommand(params);
    // URL valid for 1 hour
    return await getSignedUrl(s3, command, { expiresIn: 3600 });
  },
});

/**
 * Internal action used by backend (like WhatsApp webhook) to upload a buffer to R2
 * since we can't do this inside a mutation.
 */
export const uploadBufferToR2 = internalAction({
  args: {
    fileName: v.string(),
    contentType: v.string(),
    base64Data: v.string(), // We send base64 over action args
  },
  handler: async (ctx, args) => {
    const s3 = getS3Client();
    const safeName = args.fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const date = new Date();
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const key = `cvs/${yearMonth}/${Date.now()}-${safeName}`;
    const binaryString = atob(args.base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: args.contentType,
      Body: bytes,
    });

    let attempts = 0;
    while (attempts < 3) {
      try {
        attempts++;
        await s3.send(command);
        return key;
      } catch (err: any) {
        if (attempts >= 3) throw err;
        console.warn(`[R2 Upload] Cloudflare R2 connection flicker (attempt ${attempts}/3), retrying in ${attempts * 1000}ms...`, err?.message || err);
        await new Promise((r) => setTimeout(r, attempts * 1000));
      }
    }
    return key;
  },
});

export const uploadLogoToR2 = action({
  args: {
    key: v.string(),
    contentType: v.string(),
    base64Data: v.string(),
  },
  handler: async (ctx, args) => {
    const s3 = getS3Client();
    const binaryString = atob(args.base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: args.key,
      ContentType: args.contentType,
      Body: bytes,
    });

    await s3.send(command);
    console.log(`[R2 Logo Upload] Successfully uploaded ${args.key} to R2 bucket ${process.env.R2_BUCKET_NAME}`);
    return args.key;
  },
});

/**
 * Uploads extracted CV raw text to Cloudflare R2 object storage.
 * Saves memory by not storing multi-page string blobs in Convex SQLite/RAM.
 */
export const uploadCvRawTextToR2 = internalAction({
  args: {
    candidateId: v.string(),
    cvUploadId: v.string(),
    rawText: v.string(),
  },
  handler: async (ctx, args) => {
    const s3 = getS3Client();
    const key = `cv-rawtext/${args.candidateId}/${args.cvUploadId}.txt`;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(args.rawText);

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: "text/plain; charset=utf-8",
      Body: bytes,
    });

    let attempts = 0;
    while (attempts < 3) {
      try {
        attempts++;
        await s3.send(command);
        return key;
      } catch (err: any) {
        if (attempts >= 3) throw err;
        console.warn(`[R2 RawText Upload] Flicker on key ${key} (attempt ${attempts}/3), retrying in ${attempts * 1000}ms...`, err?.message || err);
        await new Promise((r) => setTimeout(r, attempts * 1000));
      }
    }
    return key;
  },
});

/**
 * Fetches raw CV text from Cloudflare R2 object storage by rawTextKey.
 */
export const getResumeRawText = action({
  args: {
    rawTextKey: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    try {
      const s3 = getS3Client();
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: args.rawTextKey,
      });

      const response = await s3.send(command);
      if (!response.Body) return null;

      // Convert body stream to string
      const str = await response.Body.transformToString("utf-8");
      return str;
    } catch (err: any) {
      console.warn(`[getResumeRawText] Failed to fetch R2 raw text for key ${args.rawTextKey}:`, err?.message || err);
      return null;
    }
  },
});

