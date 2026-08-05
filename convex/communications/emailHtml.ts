// Shared structured rich HTML email builder for the Career141 follow-up system (Agent 3).
// Pure helper module (no Convex runtime directive) so it can be imported from actions,
// mutations, and helper files alike.

export interface StructuredEmailContent {
  candidateName: string;
  jobTitle: string;
  /** Main intro / body paragraph(s). Newlines are converted to <br/>. */
  prelude?: string;
  /** AI-generated answer shown in a highlighted question-answer callout box. */
  aiAnswer?: string | null;
  /** Details successfully recorded from the candidate's reply (e.g. "Current Salary: 40000"). */
  recordedDetails?: string[];
  /** Remaining missing items that are still required to progress the application. */
  remainingMissing?: string[];
  senderEmail?: string;
}

function escHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function para(value: string, style: string): string {
  return `<p style="${style}">${escHtml(value).replace(/\n/g, "<br/>")}</p>`;
}

/**
 * Builds a brand-consistent, richly formatted HTML email for the Career141
 * follow-up system. Used for both the initial Day 0 outreach email and
 * immediate thread replies to candidate emails.
 */
export function buildStructuredEmailHtml(opts: StructuredEmailContent): string {
  const {
    candidateName,
    jobTitle,
    prelude,
    aiAnswer,
    recordedDetails,
    remainingMissing,
    senderEmail = process.env.MS_SENDER_EMAIL || process.env.OUTBOUND_EMAIL_SENDER || "job@career141.com",
  } = opts;

  const preludeHtml = prelude
    ? para(prelude, "margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;")
    : "";

  const aiAnswerCard = aiAnswer
    ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
              <tr>
                <td style="background-color:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #2563eb;border-radius:8px;padding:14px 16px;">
                  <p style="margin:0 0 6px;color:#1d4ed8;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">Your Question Answered</p>
                  ${para(aiAnswer, "margin:0;color:#1e293b;font-size:14px;line-height:1.6;")}
                </td>
              </tr>
            </table>`
    : "";

  const recordedCard = recordedDetails && recordedDetails.length > 0
    ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
              <tr>
                <td style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:8px;padding:14px 16px;">
                  <p style="margin:0 0 6px;color:#15803d;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">Details Recorded</p>
                  ${recordedDetails.map((d) => para(d, "margin:2px 0;color:#1e293b;font-size:14px;line-height:1.5;")).join("")}
                </td>
              </tr>
            </table>`
    : "";

  const remainingCard = remainingMissing && remainingMissing.length > 0
    ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
              <tr>
                <td style="background-color:#fefce8;border:1px solid #fde68a;border-left:4px solid #ca8a04;border-radius:8px;padding:14px 16px;">
                  <p style="margin:0 0 6px;color:#a16207;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">Still Required To Progress Your Application</p>
                  <ul style="margin:0 0 8px;padding-left:18px;color:#1e293b;font-size:14px;line-height:1.7;">
                    ${remainingMissing.map((m) => `<li>${escHtml(m)}</li>`).join("")}
                  </ul>
                  <p style="margin:0;color:#475569;font-size:13px;line-height:1.5;">Please reply to this email with the above details at your earliest convenience.</p>
                </td>
              </tr>
            </table>`
    : "";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background-color:#ffffff;">
          <tr>
            <td style="background-color:#0f172a;padding:28px 32px;">
              <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Career141 Recruitment</p>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">Application Update &mdash; ${escHtml(jobTitle)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;color:#0f172a;font-size:16px;font-weight:600;">Hi ${escHtml(candidateName)},</p>
              ${preludeHtml}
              ${aiAnswerCard}
              ${recordedCard}
              ${remainingCard}
              <p style="margin:16px 0 0;color:#334155;font-size:14px;line-height:1.6;">Please feel free to reply to this email if you have any questions.</p>
              <p style="margin:16px 0 0;color:#0f172a;font-size:14px;line-height:1.6;font-weight:600;">Best regards,<br/>Talent Acquisition Team<br/>Career141</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:13px;">${escHtml(senderEmail)}</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f1f5f9;padding:16px 32px;color:#94a3b8;font-size:12px;line-height:1.5;border-top:1px solid #e2e8f0;">
              This is an automated message from Career141 Recruitment regarding your application for ${escHtml(jobTitle)}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
