"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel.d.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function workableUrl(subdomain: string, path: string) {
  return `https://${subdomain}.workable.com/spi/v3${path}`;
}

type WorkableCandidateDetail = {
  candidate: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    resume_url?: string;
    resume?: { url?: string; file_url?: string };
    attachments?: Array<{ url?: string; file_url?: string; type?: string; name?: string }>;
  };
};

function extractResumeUrl(detail: WorkableCandidateDetail["candidate"]): string | undefined {
  if (detail.resume_url) return detail.resume_url;
  if (detail.resume?.url) return detail.resume.url;
  if (detail.resume?.file_url) return detail.resume.file_url;
  const typedAttachment = detail.attachments?.find(
    (a) => a.type === "resume" || a.type === "cv"
  );
  if (typedAttachment?.url) return typedAttachment.url;
  if (typedAttachment?.file_url) return typedAttachment.file_url;
  const namedAttachment = detail.attachments?.find((a) => {
    const name = (a.name ?? "").toLowerCase();
    return name.includes("cv") || name.includes("resume");
  });
  if (namedAttachment?.url) return namedAttachment.url;
  if (namedAttachment?.file_url) return namedAttachment.file_url;
  const anyAttachment = detail.attachments?.find((a) => a.url ?? a.file_url);
  if (anyAttachment?.url) return anyAttachment.url;
  if (anyAttachment?.file_url) return anyAttachment.file_url;
  return undefined;
}

type WorkableCandidatesPage = {
  candidates: Array<{ id: string; name: string }>;
  paging?: { next?: string };
};

async function fetchPage(
  subdomain: string,
  apiKey: string,
  nextUrl?: string
): Promise<WorkableCandidatesPage> {
  const url = nextUrl ?? workableUrl(subdomain, "/candidates?limit=20");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (res.status === 429) throw new Error("RATE_LIMIT_429");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Workable API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<WorkableCandidatesPage>;
}

async function fetchCandidateDetail(
  subdomain: string,
  apiKey: string,
  candidateId: string
): Promise<{ resumeUrl?: string; name: string; email?: string; phone?: string }> {
  await new Promise((r) => setTimeout(r, 700));
  const url = workableUrl(subdomain, `/candidates/${candidateId}`);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (res.status === 429) throw new Error("RATE_LIMIT_429");
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const data = (await res.json()) as WorkableCandidateDetail;
  return {
    name: data.candidate.name,
    email: data.candidate.email,
    phone: data.candidate.phone,
    resumeUrl: extractResumeUrl(data.candidate),
  };
}

function detectFileType(url: string, contentType: string): string {
  const normalizedUrl = url.toLowerCase();
  const ext =
    normalizedUrl.match(/\.(pdf|docx?|rtf|txt)$/)?.[1] ?? "";

  if (ext === "pdf" || contentType.includes("pdf")) return "pdf";
  if (ext === "docx" || ext === "doc" || contentType.includes("word") || contentType.includes("docx")) return "docx";
  if (ext === "rtf") return "rtf";
  if (ext === "txt") return "txt";

  return "pdf";
}

async function downloadResume(
  resumeUrl: string
): Promise<{ buffer: ArrayBuffer; contentType: string; fileType: string } | null> {
  try {
    const res = await fetch(resumeUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "application/pdf";
    const fileType = detectFileType(resumeUrl, contentType);
    return { buffer: await res.arrayBuffer(), contentType, fileType };
  } catch {
    return null;
  }
}

// ─── Test connection ──────────────────────────────────────────────────────────

export const testConnection = action({
  args: { subdomain: v.string(), apiKey: v.string() },
  handler: async (_ctx, args): Promise<{ ok: boolean; error?: string }> => {
    try {
      await fetchPage(args.subdomain, args.apiKey);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  },
});

// ─── Start bulk import ────────────────────────────────────────────────────────

export const startBulkImport = action({
  args: { subdomain: v.string(), apiKey: v.string(), userId: v.string() },
  handler: async (ctx, args): Promise<{ importId: string }> => {
    const lastJob: any = await ctx.runQuery(internal.integrations.workable.getLatestImportJob as any, {});
    const nextUrl = lastJob && lastJob.userId === args.userId ? lastJob.lastCursor : undefined;

    const importId = await ctx.runMutation(internal.integrations.workable.createImportJob, {
      userId: args.userId,
      totalCandidates: 0,
      subdomain: args.subdomain,
      apiKey: args.apiKey,
    });

    ctx.scheduler.runAfter(0, internal.integrations.workableActions.runImportBatch, {
      importId,
      subdomain: args.subdomain,
      apiKey: args.apiKey,
      userId: args.userId,
      nextUrl: nextUrl,
      imported: 0,
      skipped: 0,
      deduplicated: 0,
      failed: 0,
    });

    return { importId };
  },
});

// ─── Get latest import status ─────────────────────────────────────────────────

export const getLatestImportStatus = action({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const job: any = await ctx.runQuery(internal.integrations.workable.getLatestImportJob as any, {});
    if (!job || job.userId !== args.userId) return null;
    return { ...job, deduplicated: job.deduplicated ?? 0 };
  },
});

export const getImportStatus = action({
  args: { importId: v.id("workableImports") },
  handler: async (ctx, args): Promise<any> => {
    const job: any = await ctx.runQuery(internal.integrations.workable.getImportJob as any, { importId: args.importId });
    if (!job) return null;
    return { ...job, deduplicated: job.deduplicated ?? 0 };
  },
});

// ─── Retry a failed import ────────────────────────────────────────────────────

export const retryImport = action({
  args: {
    importId: v.id("workableImports"),
    subdomain: v.optional(v.string()),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const job: any = await ctx.runQuery(internal.integrations.workable.getImportJob as any, { importId: args.importId });
    if (!job) throw new ConvexError({ message: "Import job not found", code: "NOT_FOUND" });

    const subdomain = args.subdomain ?? job.subdomain;
    const apiKey = args.apiKey ?? job.apiKey;
    if (!subdomain || !apiKey) {
      throw new ConvexError({ message: "Please enter your Workable subdomain and API key.", code: "BAD_REQUEST" });
    }

    await ctx.runMutation(internal.integrations.workable.updateImportJob, {
      importId: args.importId,
      status: "running",
      errorMessage: "",
      subdomain,
      apiKey,
    });

    ctx.scheduler.runAfter(0, internal.integrations.workableActions.runImportBatch, {
      importId: args.importId,
      subdomain,
      apiKey,
      userId: job.userId,
      nextUrl: job.lastCursor ?? undefined,
      imported: job.imported,
      skipped: job.skipped,
      deduplicated: job.deduplicated ?? 0,
      failed: job.failed,
    });
  },
});

// ─── Retry skipped (no CV) candidates from the beginning ─────────────────────

export const retrySkipped = action({
  args: {
    importId: v.id("workableImports"),
    subdomain: v.optional(v.string()),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const job: any = await ctx.runQuery(internal.integrations.workable.getImportJob as any, { importId: args.importId });
    if (!job) throw new ConvexError({ message: "Import job not found", code: "NOT_FOUND" });

    const subdomain = args.subdomain ?? job.subdomain;
    const apiKey = args.apiKey ?? job.apiKey;
    if (!subdomain || !apiKey) {
      throw new ConvexError({ message: "Please enter your Workable subdomain and API key.", code: "BAD_REQUEST" });
    }

    await ctx.runMutation(internal.integrations.workable.updateImportJob, {
      importId: args.importId,
      status: "running",
      errorMessage: "",
      skipped: 0,
      failed: 0,
      subdomain,
      apiKey,
    });

    ctx.scheduler.runAfter(0, internal.integrations.workableActions.runImportBatch, {
      importId: args.importId,
      subdomain,
      apiKey,
      userId: job.userId,
      nextUrl: undefined, 
      imported: job.imported,
      skipped: 0,
      deduplicated: job.deduplicated ?? 0,
      failed: 0,
    });
  },
});

// ─── Stop a running import ────────────────────────────────────────────────────

export const stopImport = action({
  args: { importId: v.id("workableImports") },
  handler: async (ctx, args): Promise<void> => {
    await ctx.runMutation(internal.integrations.workable.updateImportJob, {
      importId: args.importId,
      status: "stopped",
      errorMessage: "Import stopped by user.",
    });
  },
});

// ─── Core import batch runner ─────────────────────────────────────────────────

const MAX_IMPORT = 10; // Limit per import run

export const runImportBatch = internalAction({
  args: {
    importId: v.id("workableImports"),
    subdomain: v.string(),
    apiKey: v.string(),
    userId: v.string(),
    nextUrl: v.optional(v.string()),
    imported: v.number(),
    skipped: v.number(),
    deduplicated: v.number(),
    failed: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    let imported = args.imported;
    let skipped = args.skipped;
    let deduplicated = args.deduplicated;
    let failed = args.failed;

    if (imported >= MAX_IMPORT) {
      await ctx.runMutation(internal.integrations.workable.updateImportJob, {
        importId: args.importId,
        status: "done",
      });
      return;
    }

    const currentJob: any = await ctx.runQuery(internal.integrations.workable.getImportJob as any, { importId: args.importId });
    if (!currentJob || currentJob.status === "stopped" || currentJob.status === "done") return;

    let page: WorkableCandidatesPage;
    try {
      page = await fetchPage(args.subdomain, args.apiKey, args.nextUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "fetch failed";
      if (msg === "RATE_LIMIT_429") {
        await ctx.runMutation(internal.integrations.workable.updateImportJob, {
          importId: args.importId,
          imported,
          skipped,
          deduplicated,
          failed,
          lastCursor: args.nextUrl ?? undefined,
        });
        ctx.scheduler.runAfter(90000, internal.integrations.workableActions.runImportBatch, {
          ...args,
          imported,
          skipped,
          deduplicated,
          failed,
        });
        return;
      }
      await ctx.runMutation(internal.integrations.workable.updateImportJob, {
        importId: args.importId,
        status: "error",
        errorMessage: msg,
        imported,
        skipped,
        deduplicated,
        failed,
      });
      return;
    }

    if (page.candidates.length > 0) {
      const job: any = await ctx.runQuery(internal.integrations.workable.getImportJob as any, { importId: args.importId });
      if (job) {
        await ctx.runMutation(internal.integrations.workable.updateImportJob, {
          importId: args.importId,
          totalCandidates: (job.totalCandidates ?? 0) + page.candidates.length,
        });
      }
    }

    for (const candidate of page.candidates) {
      try {
        const existing: any = await ctx.runQuery(internal.integrations.workable.findCandidateByWorkableId as any, {
          workableCandidateId: candidate.id,
        });
        if (existing) {
          deduplicated++;
          continue;
        }

        let detail: { resumeUrl?: string; name: string; email?: string; phone?: string };
        try {
          detail = await fetchCandidateDetail(args.subdomain, args.apiKey, candidate.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (msg === "RATE_LIMIT_429") {
            await ctx.runMutation(internal.integrations.workable.updateImportJob, {
              importId: args.importId,
              imported,
              skipped,
              deduplicated,
              failed,
              lastCursor: args.nextUrl ?? undefined,
            });
            ctx.scheduler.runAfter(90000, internal.integrations.workableActions.runImportBatch, {
              ...args,
              imported,
              skipped,
              deduplicated,
              failed,
            });
            return;
          }
          if (msg.startsWith("HTTP_")) {
            await ctx.runMutation(internal.integrations.workable.updateImportJob, {
              importId: args.importId,
              errorMessage: `API error fetching candidate ${candidate.id}: ${msg}`,
            });
          }
          failed++;
          continue;
        }

        if (!detail.resumeUrl) {
          skipped++;
          continue;
        }

        const downloaded = await downloadResume(detail.resumeUrl);
        if (!downloaded) {
          failed++;
          continue;
        }

        const uploadUrl = await ctx.storage.generateUploadUrl();
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": downloaded.contentType },
          body: downloaded.buffer,
        });
        if (!uploadRes.ok) {
          failed++;
          continue;
        }

        const { storageId } = (await uploadRes.json()) as { storageId: Id<"_storage"> };
        const fileName = `${detail.name || candidate.id}.${downloaded.fileType}`;

        const cvUploadId = await ctx.runMutation(internal.integrations.workable.insertCvUpload, {
          storageId,
          fileName,
          fileType: downloaded.fileType,
          fileSize: downloaded.buffer.byteLength,
          userId: args.userId,
        });

        ctx.scheduler.runAfter(imported * 2000, api.cvs.cvExtraction.processCvExtraction, {
          storageId,
          fileType: downloaded.fileType,
          sourceChannel: "Workable",
          uploadedBy: args.userId,
          cvUploadId,
          workableCandidateId: candidate.id,
          skipLLM: true,
          preExtractedData: {
            fullName: detail.name || candidate.name,
            email: detail.email,
            phone: detail.phone,
          },
        });

        imported++;

        if (imported >= MAX_IMPORT) break;
      } catch {
        failed++;
      }
    }

    await ctx.runMutation(internal.integrations.workable.updateImportJob, {
      importId: args.importId,
      imported,
      skipped,
      deduplicated,
      failed,
      lastCursor: page.paging?.next ?? undefined,
    });

    if (imported >= MAX_IMPORT) {
      await ctx.runMutation(internal.integrations.workable.updateImportJob, {
        importId: args.importId,
        status: "done",
      });
    } else if (page.paging?.next) {
      ctx.scheduler.runAfter(500, internal.integrations.workableActions.runImportBatch, {
        importId: args.importId,
        subdomain: args.subdomain,
        apiKey: args.apiKey,
        userId: args.userId,
        nextUrl: page.paging.next,
        imported,
        skipped,
        deduplicated,
        failed,
      });
    } else {
      await ctx.runMutation(internal.integrations.workable.updateImportJob, {
        importId: args.importId,
        status: "done",
      });
    }
  },
});
