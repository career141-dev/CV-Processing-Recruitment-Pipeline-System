"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getGraphToken } from "../lib/graphClient";
import { normalizeExcelShareUrl } from "./excelUrlHelper";
import ExcelJS from "exceljs";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// Standard column headers for the master tracking sheet
const STANDARD_HEADERS = [
  "Date Shortlisted",
  "Candidate Name",
  "Current Role / Title",
  "Email",
  "Phone",
  "Experience (Years)",
  "AI Match Score",
  "Status",
  "Shortlisted By",
  "Notes",
];

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Resolve SharePoint / OneDrive link via Graph API
// ─────────────────────────────────────────────────────────────────────────────
export const resolveMasterSheet = internalAction({
  args: {
    jobId: v.id("jobs"),
    excelMasterSheetUrl: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const { sharingToken } = normalizeExcelShareUrl(args.excelMasterSheetUrl);
      const token = await getGraphToken();

      console.log(`[Excel Sync] Resolving sharing token for Job ${args.jobId}...`);
      const res = await fetch(`${GRAPH_BASE}/shares/${sharingToken}/driveItem`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(
          `[Excel Sync] Graph resolution returned ${res.status}: ${errorText}`
        );
        // Link is still usable for the iframe embedview even if app-only Graph resolution encounters tenant policy
        await ctx.runMutation(
          internal.integrations.excelMutations.updateMasterSheetDriveDetails,
          {
            jobId: args.jobId,
            syncStatus: "idle",
            error: res.status === 403 ? "Graph permissions required for background sync" : undefined,
          }
        );
        return { success: false, status: res.status };
      }

      const item = await res.json();
      console.log(`[Excel Sync] Successfully resolved DriveItem: ${item.name} (${item.id})`);

      await ctx.runMutation(
        internal.integrations.excelMutations.updateMasterSheetDriveDetails,
        {
          jobId: args.jobId,
          driveId: item.parentReference?.driveId,
          itemId: item.id,
          name: item.name,
          syncStatus: "synced",
        }
      );

      return { success: true, name: item.name, id: item.id };
    } catch (err: any) {
      console.error(`[Excel Sync] Error resolving master sheet:`, err.message);
      await ctx.runMutation(
        internal.integrations.excelMutations.updateMasterSheetDriveDetails,
        {
          jobId: args.jobId,
          syncStatus: "error",
          error: err.message,
        }
      );
      return { success: false, error: err.message };
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Download workbook, append candidate row(s), and upload back
// ─────────────────────────────────────────────────────────────────────────────
async function appendCandidatesToGraphWorkbook(
  token: string,
  driveId: string,
  itemId: string,
  candidates: Array<{
    applicationId: string;
    candidateName: string;
    candidateEmail: string;
    candidatePhone: string;
    role: string;
    experience: number;
    aiMatchScore: number | null;
    currentStage: string;
    shortlistedAt: number;
    recruiterName: string;
    notes: string;
  }>
) {
  // 1. Download existing .xlsx content from Graph
  const downloadUrl = `${GRAPH_BASE}/drives/${driveId}/items/${itemId}/content`;
  console.log(`[Excel Sync] Downloading workbook content from: ${downloadUrl}`);

  const downloadRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!downloadRes.ok) {
    const errorText = await downloadRes.text();
    throw new Error(`Failed to download workbook (${downloadRes.status}): ${errorText}`);
  }

  const arrayBuffer = await downloadRes.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  // 2. Load workbook with ExcelJS
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as any);

  const worksheet = workbook.worksheets[0] || workbook.addWorksheet("Shortlisted Candidates");

  // 3. Inspect or create headers
  let headerRow = worksheet.getRow(1);
  const existingHeaders: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    existingHeaders[colNumber] = String(cell.value || "").trim().toLowerCase();
  });

  // If worksheet is brand new or empty, initialize standard headers
  if (existingHeaders.filter(Boolean).length === 0) {
    STANDARD_HEADERS.forEach((headerText, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = headerText;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" }, // Slate dark header
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    headerRow.height = 28;
    headerRow.commit();
  }

  // Find column indices for standard fields (case-insensitive)
  const findCol = (terms: string[]) => {
    for (let c = 1; c <= worksheet.columnCount + 10; c++) {
      const val = String(worksheet.getRow(1).getCell(c).value || "").toLowerCase();
      if (terms.some((t) => val.includes(t))) return c;
    }
    return null;
  };

  const colDate = findCol(["date", "shortlisted"]) ?? 1;
  const colName = findCol(["name", "candidate"]) ?? 2;
  const colRole = findCol(["role", "title", "designation", "position"]) ?? 3;
  const colEmail = findCol(["email"]) ?? 4;
  const colPhone = findCol(["phone", "contact", "mobile"]) ?? 5;
  const colExp = findCol(["exp", "experience", "years"]) ?? 6;
  const colScore = findCol(["score", "match"]) ?? 7;
  const colStatus = findCol(["status", "stage"]) ?? 8;
  const colRecruiter = findCol(["by", "ta", "recruiter"]) ?? 9;
  const colNotes = findCol(["note", "comment", "feedback"]) ?? 10;

  // 4. Append / Update candidates (with deduplication by email or phone)
  let updatedCount = 0;
  let addedCount = 0;

  for (const cand of candidates) {
    const emailToMatch = cand.candidateEmail.toLowerCase().trim();
    const phoneToMatch = cand.candidatePhone.replace(/[^0-9]/g, "");
    const nameToMatch = cand.candidateName.toLowerCase().trim();

    let targetRowIndex: number | null = null;

    // Search for existing row
    for (let r = 2; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const rowEmail = String(row.getCell(colEmail).value || "").toLowerCase().trim();
      const rowPhone = String(row.getCell(colPhone).value || "").replace(/[^0-9]/g, "");
      const rowName = String(row.getCell(colName).value || "").toLowerCase().trim();

      if (
        (emailToMatch && rowEmail === emailToMatch) ||
        (phoneToMatch && rowPhone === phoneToMatch) ||
        (nameToMatch && rowName === nameToMatch)
      ) {
        targetRowIndex = r;
        break;
      }
    }

    const isNew = targetRowIndex === null;
    const row = isNew ? worksheet.addRow({}) : worksheet.getRow(targetRowIndex!);

    const formattedDate = new Date(cand.shortlistedAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    row.getCell(colDate).value = formattedDate;
    row.getCell(colName).value = cand.candidateName;
    row.getCell(colRole).value = cand.role;
    row.getCell(colEmail).value = cand.candidateEmail;
    row.getCell(colPhone).value = cand.candidatePhone;
    row.getCell(colExp).value = cand.experience ? `${cand.experience} yrs` : "-";
    row.getCell(colScore).value = cand.aiMatchScore ? `${cand.aiMatchScore}%` : "-";
    row.getCell(colStatus).value = "TA Shortlist";
    row.getCell(colRecruiter).value = cand.recruiterName;
    if (cand.notes && !row.getCell(colNotes).value) {
      row.getCell(colNotes).value = cand.notes;
    }

    row.commit();

    if (isNew) addedCount++;
    else updatedCount++;
  }

  // Adjust column widths automatically if needed
  worksheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = cell.value ? String(cell.value).length : 0;
      if (length > maxLength) maxLength = Math.min(length + 2, 40);
    });
    column.width = maxLength;
  });

  // 5. Write modified workbook to buffer
  const updatedBuffer = await workbook.xlsx.writeBuffer();

  // 6. Upload back to OneDrive / SharePoint
  console.log(`[Excel Sync] Uploading updated workbook (${updatedBuffer.byteLength} bytes)...`);
  const uploadRes = await fetch(downloadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    body: updatedBuffer,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`Failed to upload updated workbook (${uploadRes.status}): ${errorText}`);
  }

  console.log(
    `[Excel Sync] Successfully updated master sheet: ${addedCount} added, ${updatedCount} updated.`
  );
  return { addedCount, updatedCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Auto-sync single shortlisted candidate to master sheet
// ─────────────────────────────────────────────────────────────────────────────
export const syncCandidateToMasterSheet = internalAction({
  args: {
    jobId: v.id("jobs"),
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    try {
      // 1. Fetch job to see if master sheet is configured
      const masterDetails: any = await ctx.runQuery(
        internal.integrations.excelMutations.getInternalJobMasterSheetDetails,
        { jobId: args.jobId }
      );

      if (!masterDetails?.excelMasterSheetUrl) {
        // No master sheet configured for this job — skip gracefully
        return;
      }

      // 2. Fetch candidate details
      const cand: any = await ctx.runQuery(
        internal.integrations.excelMutations.getCandidateForExcelSync,
        { applicationId: args.applicationId }
      );

      if (!cand) {
        console.warn(`[Excel Sync] Application ${args.applicationId} not found.`);
        return;
      }

      // If driveId & itemId are not yet resolved, try resolving them first
      const token = await getGraphToken();
      let driveId = masterDetails.excelMasterSheetDriveId;
      let itemId = masterDetails.excelMasterSheetItemId;

      if (!driveId || !itemId) {
        const { sharingToken } = normalizeExcelShareUrl(masterDetails.excelMasterSheetUrl);
        const res = await fetch(`${GRAPH_BASE}/shares/${sharingToken}/driveItem`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (res.ok) {
          const item = await res.json();
          driveId = item.parentReference?.driveId;
          itemId = item.id;
          await ctx.runMutation(
            internal.integrations.excelMutations.updateMasterSheetDriveDetails,
            {
              jobId: args.jobId,
              driveId,
              itemId,
              name: item.name,
              syncStatus: "synced",
            }
          );
        } else {
          console.warn(`[Excel Sync] Could not resolve driveItem for sync: ${res.status}`);
          return;
        }
      }

      // 3. Append to workbook
      await ctx.runMutation(internal.integrations.excelMutations.setExcelSyncStatus, {
        jobId: args.jobId,
        status: "syncing",
      });

      await appendCandidatesToGraphWorkbook(token, driveId, itemId, [cand]);

      await ctx.runMutation(internal.integrations.excelMutations.setExcelSyncStatus, {
        jobId: args.jobId,
        status: "synced",
      });

      await ctx.runMutation(
        internal.integrations.excelMutations.markApplicationExcelSynced,
        { applicationId: args.applicationId }
      );
    } catch (err: any) {
      console.error(`[Excel Sync] Failed to sync candidate to master sheet:`, err.message);
      await ctx.runMutation(internal.integrations.excelMutations.setExcelSyncStatus, {
        jobId: args.jobId,
        status: "error",
        error: err.message,
      });
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Manual "Sync All Shortlisted Now" batch action
// ─────────────────────────────────────────────────────────────────────────────
export const syncAllShortlistedForJob = internalAction({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    try {
      const masterDetails: any = await ctx.runQuery(
        internal.integrations.excelMutations.getInternalJobMasterSheetDetails,
        { jobId: args.jobId }
      );

      if (!masterDetails?.excelMasterSheetUrl) {
        throw new Error("No master sheet connected for this job.");
      }

      const token = await getGraphToken();
      let driveId = masterDetails.excelMasterSheetDriveId;
      let itemId = masterDetails.excelMasterSheetItemId;

      if (!driveId || !itemId) {
        const { sharingToken } = normalizeExcelShareUrl(masterDetails.excelMasterSheetUrl);
        const res = await fetch(`${GRAPH_BASE}/shares/${sharingToken}/driveItem`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (!res.ok) {
          throw new Error(`Could not access file via Microsoft Graph (${res.status}). Verify sharing link.`);
        }
        const item = await res.json();
        driveId = item.parentReference?.driveId;
        itemId = item.id;
        await ctx.runMutation(
          internal.integrations.excelMutations.updateMasterSheetDriveDetails,
          {
            jobId: args.jobId,
            driveId,
            itemId,
            name: item.name,
            syncStatus: "synced",
          }
        );
      }

      const candidates: any[] = await ctx.runQuery(
        internal.integrations.excelMutations.getShortlistedCandidatesForJob,
        { jobId: args.jobId }
      );

      if (candidates.length === 0) {
        return { success: true, message: "No shortlisted candidates to sync yet." };
      }

      await ctx.runMutation(internal.integrations.excelMutations.setExcelSyncStatus, {
        jobId: args.jobId,
        status: "syncing",
      });

      const { addedCount, updatedCount } = await appendCandidatesToGraphWorkbook(
        token,
        driveId,
        itemId,
        candidates
      );

      await ctx.runMutation(internal.integrations.excelMutations.setExcelSyncStatus, {
        jobId: args.jobId,
        status: "synced",
      });

      for (const cand of candidates) {
        await ctx.runMutation(
          internal.integrations.excelMutations.markApplicationExcelSynced,
          { applicationId: cand.applicationId }
        );
      }

      return {
        success: true,
        message: `Synced ${candidates.length} candidates (${addedCount} new, ${updatedCount} updated)`,
      };
    } catch (err: any) {
      console.error(`[Excel Sync] Batch sync failed:`, err.message);
      await ctx.runMutation(internal.integrations.excelMutations.setExcelSyncStatus, {
        jobId: args.jobId,
        status: "error",
        error: err.message,
      });
      throw err;
    }
  },
});
