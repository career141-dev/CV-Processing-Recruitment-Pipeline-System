"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import ExcelJS from "exceljs";

const SHORTLIST_COLUMNS = [
  { header: "NO", key: "no", width: 8 },
  { header: "NAME", key: "name", width: 28 },
  { header: "NOTES", key: "notes", width: 56 },
  { header: "NOTICE", key: "notice", width: 16 },
  { header: "CURRENT COMPANY", key: "currentCompany", width: 28 },
  { header: "CURRENT DESIGNATION", key: "currentDesignation", width: 30 },
  { header: "CURRENT REMUNERATION", key: "currentRemuneration", width: 22 },
  { header: "EXPECTED REMUNERATION", key: "expectedRemuneration", width: 28 },
];

/**
 * Generates an Excel workbook buffer and provides URLs to open in Microsoft 365.
 */
export const exportShortlistForMs365 = action({
  args: {
    jobId: v.id("jobs"),
    selectedApplicationIds: v.optional(v.array(v.id("applications"))),
    mode: v.optional(v.union(v.literal("auto"), v.literal("office_online"), v.literal("sharepoint"))),
  },
  handler: async (ctx, args) => {
    // 1. Fetch job and candidate data using internal query
    const spreadsheetData: any = await ctx.runQuery(
      internal.integrations.exportHelper.getShortlistForExport,
      {
        jobId: args.jobId,
        selectedApplicationIds: args.selectedApplicationIds,
      }
    );

    if (!spreadsheetData || !spreadsheetData.job) {
      throw new Error("Job not found");
    }

    const job = spreadsheetData.job;
    const candidates = spreadsheetData.candidates || [];
    const cleanJobTitle = (job.title || "Job").replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStamp = new Date().toISOString().split("T")[0];
    const fileName = `${cleanJobTitle}_Shortlist_${dateStamp}.xlsx`;

    // 2. Build workbook with ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Career141 Platform";
    workbook.created = new Date();

    const safeSheetTitle = (job.title || "TA Shortlist")
      .replace(/[:\\/?*\[\]]/g, " ")
      .trim()
      .toUpperCase()
      .slice(0, 31) || "SHORTLIST";
    const worksheet = workbook.addWorksheet(safeSheetTitle);

    // Set columns
    worksheet.columns = SHORTLIST_COLUMNS.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width,
    }));

    // Style Header Row (Row 1)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Calibri" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E4620" }, // Forest Green (#1E4620)
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FF0F2B13" } },
        bottom: { style: "medium", color: { argb: "FF0F2B13" } },
        left: { style: "thin", color: { argb: "FF275E2B" } },
        right: { style: "thin", color: { argb: "FF275E2B" } },
      };
    });

    // Add Candidate Rows
    candidates.forEach((cand: any, idx: number) => {
      const row = worksheet.addRow({
        no: cand.no ?? idx + 1,
        name: cand.name || cand.candidateName || "Candidate",
        notes: cand.notes || "",
        notice: cand.notice || "—",
        currentCompany: cand.currentCompany || "—",
        currentDesignation: cand.currentDesignation || cand.role || "—",
        currentRemuneration: cand.currentRemuneration || "—",
        expectedRemuneration: cand.expectedRemuneration || "—",
      });

      row.eachCell((cell, colNumber) => {
        cell.font = { size: 10, color: { argb: "FF1E293B" }, name: "Calibri" };

        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };

        if (colNumber === 1) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else if (colNumber === 2) {
          cell.font = { bold: true, size: 10, color: { argb: "FF0F172A" }, name: "Calibri" };
          cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        } else if (colNumber === 3) {
          cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
        } else if (colNumber === 4) {
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        } else {
          cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    // 3. Option B: Check if SharePoint upload is requested and credentials exist
    const tenantId = process.env.MS_GRAPH_TENANT_ID || process.env.MS_TENANT_ID;
    const clientId = process.env.MS_GRAPH_CLIENT_ID || process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET || process.env.MS_CLIENT_SECRET;
    const requestedSharePoint = args.mode === "sharepoint" || (args.mode === "auto" && Boolean(tenantId && clientId && clientSecret));

    if (requestedSharePoint && tenantId && clientId && clientSecret) {
      try {
        console.log("[MS 365 Export] Attempting upload to SharePoint Online via Graph...");
        const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const params = new URLSearchParams();
        params.append("client_id", clientId);
        params.append("client_secret", clientSecret);
        params.append("scope", "https://graph.microsoft.com/.default");
        params.append("grant_type", "client_credentials");

        const tokenRes = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params,
        });

        if (tokenRes.ok) {
          const { access_token } = await tokenRes.json();
          // Upload to root of TalentAcquisition site documents
          const uploadUrl = `https://graph.microsoft.com/v1.0/sites/root/drive/root:/Shortlists/${fileName}:/content`;
          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${access_token}`,
              "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
            body: Buffer.from(buffer),
          });

          if (uploadRes.ok) {
            const fileItem = await uploadRes.json();
            console.log(`[MS 365 Export] Uploaded to SharePoint! WebUrl: ${fileItem.webUrl}`);
            return {
              mode: "sharepoint" as const,
              webUrl: fileItem.webUrl,
              filename: fileName,
              candidateCount: candidates.length,
            };
          } else {
            console.warn(`[MS 365 Export] Graph upload returned ${uploadRes.status}, falling back to Office Online Viewer.`);
          }
        }
      } catch (err: any) {
        console.warn(`[MS 365 Export] SharePoint upload error: ${err.message}, falling back to Office Online Viewer.`);
      }
    }

    // 4. Option A: Store in Convex Storage & open with Microsoft Office Online Viewer
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const storageId = await ctx.storage.store(blob);
    const fileUrl = await ctx.storage.getUrl(storageId);

    if (!fileUrl) {
      throw new Error("Failed to generate storage URL for spreadsheet");
    }

    // Official Microsoft Office for the Web viewer URL
    const officeOnlineUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;

    return {
      mode: "office_online" as const,
      webUrl: officeOnlineUrl,
      downloadUrl: fileUrl,
      filename: fileName,
      candidateCount: candidates.length,
    };
  },
});
