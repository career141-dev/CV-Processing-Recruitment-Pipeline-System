"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { getGraphToken } from "../lib/graphClient";

/**
 * Base64url-encodes a SharePoint sharing URL so Microsoft Graph can resolve it:
 * https://learn.microsoft.com/en-us/graph/api/shares-get?view=graph-rest-1.0
 */
function encodeSharePointUrl(webUrl: string): string {
  const base64 = Buffer.from(webUrl).toString("base64");
  return "u!" + base64.replace(/=/g, "").replace(/\//g, "_").replace(/\+/g, "-");
}

/**
 * Helper to fetch with Bearer token and parse JSON with clear error messages
 */
async function graphFetch(url: string, token: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { rawText: text };
  }

  if (!res.ok) {
    const msg = data?.error?.message || `Graph HTTP ${res.status}: ${res.statusText}`;
    throw new Error(`[SharePoint Excel API] ${msg} (${url})`);
  }

  return data;
}

export interface SyncShortlistResult {
  success: boolean;
  rowsAdded: number;
  totalCandidates?: number;
  fileWebUrl?: string;
  message: string;
  requiresConfig?: boolean;
}

/**
 * Main Action: Sync Shortlisted Candidates directly into the SharePoint Excel Workbook
 * via Microsoft Graph Excel Workbook API.
 */
export const syncShortlistToSharePointExcel = action({
  args: {
    jobId: v.id("jobs"),
    applicationIds: v.optional(v.array(v.id("applications"))),
    customFileUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SyncShortlistResult> => {
    // 1. Fetch candidate shortlist data from Convex helper query
    const data: { job: any; candidates: any[] } = await ctx.runQuery(
      (internal as any).integrations.sharepointExcelHelper.getShortlistForExcelSync,
      {
        jobId: args.jobId,
        applicationIds: args.applicationIds,
      }
    );

    if (!data.candidates || data.candidates.length === 0) {
      return {
        success: false,
        rowsAdded: 0,
        message: "No shortlisted candidates found to sync.",
      };
    }

    // 2. Resolve SharePoint Excel target URL or File ID
    const targetUrl =
      args.customFileUrl?.trim() ||
      data.job.sharepointExcelUrl?.trim() ||
      process.env.SHAREPOINT_DEFAULT_EXCEL_URL ||
      process.env.SHAREPOINT_EXCEL_FILE_URL;

    if (!targetUrl && !data.job.sharepointExcelFileId) {
      return {
        success: false,
        rowsAdded: 0,
        requiresConfig: true,
        message:
          "Please configure the SharePoint Excel file URL for this job (or set SHAREPOINT_DEFAULT_EXCEL_URL in environment).",
      };
    }

    // 3. Acquire Graph Token
    let token: string;
    try {
      token = await getGraphToken();
    } catch (err: any) {
      return {
        success: false,
        rowsAdded: 0,
        message: `Microsoft Graph authentication failed: ${err.message}`,
      };
    }

    // 4. Resolve Drive Item via Graph API
    let driveItemBaseUrl: string;
    let fileWebUrl: string = targetUrl || "";
    let driveItemId: string = data.job.sharepointExcelFileId || "";

    try {
      if (targetUrl) {
        // Resolve sharing URL via /shares/u!{encodedUrl}/driveItem
        const shareId = encodeSharePointUrl(targetUrl);
        const item = await graphFetch(
          `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`,
          token
        );
        driveItemId = item.id;
        fileWebUrl = item.webUrl || targetUrl;
        const driveId = item.parentReference?.driveId;
        if (driveId) {
          driveItemBaseUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${driveItemId}`;
        } else {
          driveItemBaseUrl = `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`;
        }
      } else {
        throw new Error("No target SharePoint Excel file specified.");
      }

      // 5. Connect to Excel Workbook Engine
      const workbookUrl = `${driveItemBaseUrl}/workbook`;

      // Check if tables exist in the workbook
      const tablesRes = await graphFetch(`${workbookUrl}/tables`, token);
      const tables: any[] = tablesRes.value || [];

      let rowsAddedCount = 0;
      const syncedAppIds: string[] = [];

      if (tables.length > 0) {
        // Approach A: Structured Excel Table exists
        const table = tables[0];
        const tableName = table.name || table.id;

        // Query existing table rows to avoid duplicates
        const existingRowsRes = await graphFetch(
          `${workbookUrl}/tables/${tableName}/rows`,
          token
        );
        const existingRows: any[] = existingRowsRes.value || [];
        const existingEmails = new Set<string>();

        for (const r of existingRows) {
          if (Array.isArray(r.values?.[0])) {
            const rowVals = r.values[0];
            for (const val of rowVals) {
              if (typeof val === "string" && val.includes("@")) {
                existingEmails.add(val.toLowerCase().trim());
              }
            }
          }
        }

        // Filter candidates that are not already in the table
        const newCandidateRows = [];
        for (let i = 0; i < data.candidates.length; i++) {
          const c = data.candidates[i];
          const name = (c.candidateName || "").toLowerCase().trim();
          const email = (c.email || "").toLowerCase().trim();
          if ((!existingEmails.has(email) && !existingEmails.has(name)) || email === "n/a" || !email) {
            newCandidateRows.push([
              c.no ?? (existingRows.length + newCandidateRows.length + 1),
              c.candidateName,
              c.notes || "",
              c.notice || "—",
              c.currentCompany || "—",
              c.currentDesignation || c.role || "—",
              c.currentRemuneration || "—",
              c.expectedRemuneration || "—",
            ]);
            syncedAppIds.push(c.applicationId);
          } else {
            // Already present, count as synced
            syncedAppIds.push(c.applicationId);
          }
        }

        if (newCandidateRows.length > 0) {
          await graphFetch(`${workbookUrl}/tables/${tableName}/rows/add`, token, {
            method: "POST",
            body: JSON.stringify({
              index: null, // appends at the end
              values: newCandidateRows,
            }),
          });
          rowsAddedCount = newCandidateRows.length;
        }
      } else {
        // Approach B: Raw Worksheet (no Table defined)
        const sheetsRes = await graphFetch(`${workbookUrl}/worksheets`, token);
        const sheets: any[] = sheetsRes.value || [];
        if (sheets.length === 0) {
          throw new Error("No worksheets found in the Excel file.");
        }

        // Intelligently select target worksheet
        const jobTitleClean = (data.job.title || "").toLowerCase().trim();
        const clientNameClean = (data.job.clientName || "").toLowerCase().trim();
        const excludedNames = ["guidelines", "behavioral support records", "draft"];

        // 1. Try to find sheet matching Job Title or Client Name
        let targetSheet = sheets.find((s: any) => {
          const name = (s.name || "").toLowerCase().trim();
          if (excludedNames.includes(name)) return false;
          return (
            (jobTitleClean && name.includes(jobTitleClean)) ||
            (jobTitleClean && jobTitleClean.includes(name)) ||
            (clientNameClean && name.includes(clientNameClean))
          );
        });

        // 2. Try to find "Master Sheet"
        if (!targetSheet) {
          targetSheet = sheets.find((s: any) =>
            (s.name || "").toLowerCase().includes("master sheet")
          );
        }

        // 3. Fallback to first non-administrative sheet
        if (!targetSheet) {
          targetSheet =
            sheets.find((s: any) => {
              const name = (s.name || "").toLowerCase().trim();
              return !excludedNames.includes(name);
            }) || sheets[0];
        }

        const sheetId = encodeURIComponent(targetSheet.id || targetSheet.name);

        // Get used range to find last row and inspect headers
        let startRow = 1;
        let existingEmails = new Set<string>();
        try {
          const usedRange = await graphFetch(
            `${workbookUrl}/worksheets/${sheetId}/usedRange`,
            token
          );
          if (usedRange && usedRange.rowCount) {
            startRow = usedRange.rowCount + 1;
            // Scan usedRange values for existing candidate emails or names
            if (Array.isArray(usedRange.values)) {
              for (const row of usedRange.values) {
                if (Array.isArray(row)) {
                  for (const cell of row) {
                    if (typeof cell === "string") {
                      if (cell.includes("@")) existingEmails.add(cell.toLowerCase().trim());
                    }
                  }
                }
              }
            }
          }
        } catch {
          startRow = 1;
        }

        const rowsToWrite: any[][] = [];

        // If sheet is completely empty, insert header row first
        if (startRow === 1) {
          rowsToWrite.push([
            "NO",
            "NAME",
            "NOTES",
            "NOTICE",
            "CURRENT COMPANY",
            "CURRENT DESIGNATION",
            "CURRENT REMUNERATION",
            "EXPECTED REMUNERATION",
          ]);
        }

        for (let i = 0; i < data.candidates.length; i++) {
          const c = data.candidates[i];
          const name = (c.candidateName || "").toLowerCase().trim();
          const email = (c.email || "").toLowerCase().trim();
          if ((!existingEmails.has(email) && !existingEmails.has(name)) || email === "n/a" || !email) {
            rowsToWrite.push([
              c.no ?? (startRow === 1 ? rowsToWrite.length : startRow - 1 + rowsToWrite.length),
              c.candidateName,
              c.notes || "",
              c.notice || "—",
              c.currentCompany || "—",
              c.currentDesignation || c.role || "—",
              c.currentRemuneration || "—",
              c.expectedRemuneration || "—",
            ]);
            syncedAppIds.push(c.applicationId);
          } else {
            syncedAppIds.push(c.applicationId);
          }
        }

        if (rowsToWrite.length > 0) {
          const endRow = startRow + rowsToWrite.length - 1;
          const rangeAddress = `A${startRow}:H${endRow}`;

          await graphFetch(
            `${workbookUrl}/worksheets/${sheetId}/range(address='${rangeAddress}')`,
            token,
            {
              method: "PATCH",
              body: JSON.stringify({
                values: rowsToWrite,
              }),
            }
          );
          rowsAddedCount = rowsToWrite.length - (startRow === 1 ? 1 : 0);
        }
      }

      // 6. Record sync timestamp in Convex
      await ctx.runMutation(
        (internal as any).integrations.sharepointExcelHelper.recordSharepointSyncSuccess,
        {
          jobId: args.jobId,
          applicationIds: syncedAppIds as any,
          sharepointExcelUrl: fileWebUrl,
          sharepointExcelFileId: driveItemId,
        }
      );

      return {
        success: true,
        rowsAdded: rowsAddedCount,
        totalCandidates: data.candidates.length,
        fileWebUrl,
        message:
          rowsAddedCount > 0
            ? `Successfully synced ${rowsAddedCount} candidate(s) to SharePoint Excel.`
            : "All selected candidates are already up-to-date in SharePoint Excel.",
      };
    } catch (err: any) {
      console.error("[SharePoint Excel Sync Error]", err);
      return {
        success: false,
        rowsAdded: 0,
        fileWebUrl,
        message: `Sync to SharePoint Excel failed: ${err.message}`,
      };
    }
  },
});
