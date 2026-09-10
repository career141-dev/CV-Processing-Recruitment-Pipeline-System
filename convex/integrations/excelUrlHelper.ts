/**
 * Helper to normalize SharePoint / OneDrive Excel links into:
 * 1. Embed URLs for direct interactive iframe rendering in Career141
 * 2. Microsoft Graph sharing tokens ("u!{base64url}") for backend Graph API access
 */

export function normalizeExcelShareUrl(rawUrl: string): {
  cleanUrl: string;
  embedUrl: string;
  sharingToken: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("Excel URL is required");
  }

  // Strip query parameters like "?e=..." or "?download=1" to get the clean canonical resource URL
  let cleanUrl = trimmed;
  const questionIdx = trimmed.indexOf("?");
  if (questionIdx !== -1) {
    cleanUrl = trimmed.substring(0, questionIdx);
  }

  // Construct the interactive embed URL
  // "action=embedview&wdboview=1" tells Excel Online to render in interactive iframe view
  // "action=edit" opens the full web editor
  const embedUrl = `${cleanUrl}?action=embedview&wdboview=1`;

  // Microsoft Graph sharing token: "u!" + base64url(cleanUrl) without padding
  // Ref: https://learn.microsoft.com/en-us/graph/api/shares-get?view=graph-rest-1.0
  const base64Value =
    typeof Buffer !== "undefined"
      ? Buffer.from(cleanUrl, "utf-8").toString("base64")
      : btoa(unescape(encodeURIComponent(cleanUrl)));

  const sharingToken =
    "u!" +
    base64Value
      .replace(/=/g, "")
      .replace(/\//g, "_")
      .replace(/\+/g, "-");

  return {
    cleanUrl,
    embedUrl,
    sharingToken,
  };
}
