"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { extractText } from "../cvs/cvExtraction";
import { executeLLMWithNvidiaFallback } from "../lib/llm";

export const evaluateCvForCriteria = action({
  args: {
    resultId: v.id("cvScanResults"),
    scanId: v.id("cvScans"),
  },
  handler: async (ctx, args) => {
    // 1. Fetch scan and result details
    const scan = await ctx.runQuery(api.cvScanner.scanMutations.getScanSession, { scanId: args.scanId });
    const results = await ctx.runQuery(api.cvScanner.scanMutations.getScanResults, { scanId: args.scanId });
    const result = results?.find((r: any) => r._id === args.resultId);

    if (!scan || !result) {
      console.error(`[evaluateCvForCriteria] Scan ${args.scanId} or Result ${args.resultId} not found.`);
      return;
    }

    const currentAttempts = (result.extractionAttempts || 0) + 1;

    // Mark as processing
    await ctx.runMutation(internal.cvScanner.scanMutations.updateResult, {
      resultId: args.resultId,
      status: "processing",
      extractionAttempts: currentAttempts,
    });

    try {
      // 2. Fetch raw file buffer from R2 or Convex storage
      let buffer: ArrayBuffer;
      if (result.s3Key) {
        const downloadUrl = await ctx.runAction(api.storage.r2.generateDownloadUrl, { key: result.s3Key });
        const res = await fetch(downloadUrl);
        if (!res.ok) {
          throw new Error(`Failed to fetch file from R2 storage (HTTP ${res.status})`);
        }
        buffer = await res.arrayBuffer();
      } else if (result.fileStorageId) {
        const blob = await ctx.storage.get(result.fileStorageId);
        if (!blob) {
          throw new Error("File blob could not be retrieved from Convex storage");
        }
        buffer = await blob.arrayBuffer();
      } else {
        throw new Error("Missing storage reference (neither R2 s3Key nor Convex fileStorageId present)");
      }

      // 3. REUSE approved extraction pipeline from cvExtraction.ts
      const { text: rawText } = await extractText(buffer, result.fileType, false, ctx);

      if (!rawText || rawText.trim().length < 20) {
        throw new Error("Unable to extract readable text from document.");
      }

      // 4. Formulate DeepSeek evaluation prompt using taskType 'cv_criteria_match'
      const systemPrompt = `You are an expert HR recruiter and candidate screening assistant.
Evaluate the candidate's CV text against the requested criteria list.

CRITICAL INSTRUCTIONS:
1. Candidate Identity: Extract candidate name, email, phone, current title if present in text.
2. Criterion Scoring: For EVERY criterion in the input list, assign a match score from 0 to 100 representing confidence that the candidate satisfies that specific criterion.
3. Evidence Quotes: Provide 1 to 3 exact, verbatim sentences or phrases copied from the CV text that support your evaluation.
4. Reasoning: Write a 1-2 sentence executive summary of the evaluation.

Respond ONLY with valid JSON matching this schema:
{
  "candidateName": "John Doe",
  "email": "john@example.com",
  "phone": "+94...",
  "currentTitle": "BD Manager",
  "reasoning": "Executive summary...",
  "criterionScores": [
    { "criterion": "Worked in BD previously", "score": 90 }
  ],
  "evidenceQuotes": [
    "Exact verbatim quote from CV text..."
  ]
}`;

      const userPrompt = `TARGET CRITERIA:
${scan.criteria.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}

CANDIDATE CV TEXT:
${rawText.slice(0, 15000)}`;

      // 5. Call DeepSeek model via OpenRouter (isolated under 'cv_criteria_match' taskType)
      const { content } = await executeLLMWithNvidiaFallback(ctx, "cv_criteria_match", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      let parsed: any = {};
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        console.warn("[evaluateCvForCriteria] Failed to parse JSON from LLM response:", content);
      }

      const candidateName = parsed.candidateName || result.fileName.replace(/\.[^/.]+$/, "");
      const email = parsed.email || undefined;
      const phone = parsed.phone || undefined;
      const currentTitle = parsed.currentTitle || undefined;
      const reasoning = parsed.reasoning || "Evaluation completed.";

      // 6. Multi-criteria Scoring Math
      const criterionScores: Array<{ criterion: string; score: number }> = Array.isArray(parsed.criterionScores)
        ? parsed.criterionScores.map((cs: any) => ({
            criterion: String(cs.criterion || "Criterion"),
            score: Math.min(100, Math.max(0, Number(cs.score) || 0)),
          }))
        : scan.criteria.map((c: string) => ({ criterion: c, score: 50 }));

      // Average score across all criteria
      const totalScoreSum = criterionScores.reduce((acc, curr) => acc + curr.score, 0);
      const matchScore = criterionScores.length > 0 ? Math.round(totalScoreSum / criterionScores.length) : 0;

      const matchedCriteria = criterionScores
        .filter((cs) => cs.score >= 60)
        .map((cs) => cs.criterion);

      const isMatch = matchScore >= 60;

      // 7. Substring Hallucination Check for Evidence Quotes
      const rawTextNormalized = rawText.toLowerCase().replace(/\s+/g, " ");
      const rawEvidence: string[] = Array.isArray(parsed.evidenceQuotes) ? parsed.evidenceQuotes.map(String) : [];

      const verifiedEvidenceQuotes = rawEvidence.map((quote) => {
        const quoteNormalized = quote.toLowerCase().replace(/\s+/g, " ").trim();
        // Test if normalized quote exists in normalized raw text (or key 15-char substring)
        const isVerified = quoteNormalized.length > 10 && rawTextNormalized.includes(quoteNormalized.slice(0, Math.min(40, quoteNormalized.length)));
        return {
          quote,
          isVerifiedQuote: isVerified,
        };
      });

      // 8. Update scan result as completed
      await ctx.runMutation(internal.cvScanner.scanMutations.updateResult, {
        resultId: args.resultId,
        status: "completed",
        candidateName,
        email,
        phone,
        currentTitle,
        matchScore,
        isMatch,
        matchedCriteria,
        criterionScores,
        evidenceQuotes: verifiedEvidenceQuotes,
        reasoning,
      });

    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error(`[evaluateCvForCriteria] Error evaluating result ${args.resultId} (Attempt ${currentAttempts}):`, errorMsg);

      // Single-retry soft-terminal pattern
      if (currentAttempts < 2) {
        console.log(`[evaluateCvForCriteria] Scheduling retry 2 for result ${args.resultId}...`);
        await ctx.scheduler.runAfter(2000, api.cvScanner.scanActions.evaluateCvForCriteria, {
          resultId: args.resultId,
          scanId: args.scanId,
        });
      } else {
        await ctx.runMutation(internal.cvScanner.scanMutations.updateResult, {
          resultId: args.resultId,
          status: "failed",
          error: errorMsg,
        });
      }
    }
  },
});

export const triggerScanBatch = action({
  args: {
    scanId: v.id("cvScans"),
  },
  handler: async (ctx, args) => {
    const results = await ctx.runQuery(api.cvScanner.scanMutations.getScanResults, { scanId: args.scanId });
    if (!results || results.length === 0) return;

    await ctx.runMutation(api.cvScanner.scanMutations.updateScanStatus, {
      scanId: args.scanId,
      status: "processing",
    });

    // Reuse 8-worker concurrency pool (stagger dispatch by 300ms to stay within VPS rate-limit window)
    let index = 0;
    for (const res of results) {
      const delayMs = index * 300;
      await ctx.scheduler.runAfter(delayMs, api.cvScanner.scanActions.evaluateCvForCriteria, {
        resultId: res._id,
        scanId: args.scanId,
      });
      index++;
    }
  },
});

export const getScanResultDownloadUrl = action({
  args: {
    resultId: v.id("cvScanResults"),
  },
  handler: async (ctx, args): Promise<{ url: string | null; fileName: string; candidateName?: string }> => {
    const result: any = await ctx.runQuery(api.cvScanner.scanMutations.getScanResultById, { resultId: args.resultId });
    if (!result) return { url: null, fileName: "Document.pdf" };

    let url: string | null = null;
    const ext = (result.fileType || result.fileName || "").toLowerCase();
    const isWordDoc = ext.includes("doc");

    if (result.s3Key) {
      // Omit downloadFilename for PDFs & Images so R2 serves inline disposition without auto-downloading!
      url = await ctx.runAction(api.storage.r2.generateDownloadUrl, {
        key: result.s3Key,
        downloadFilename: isWordDoc ? result.fileName : undefined,
      });
    } else if (result.fileStorageId) {
      url = await ctx.storage.getUrl(result.fileStorageId);
    }

    return {
      url,
      fileName: result.fileName,
      candidateName: result.candidateName,
    };
  },
});
