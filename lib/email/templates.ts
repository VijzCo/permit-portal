import { formatDisplayDate } from "@/lib/dates";
import {
  AUTHORISATION_TYPE_LABELS,
  URGENCY_BUCKETS,
  URGENCY_LABELS,
  urgencyBucket,
  type AuthorisationType,
  type ThresholdKey,
  type UrgencyBucket,
} from "@/lib/status";

/** One line of a company digest. Pure data — no Firestore types. */
export interface DigestItem {
  authId: string;
  employeeId: string;
  employeeName: string;
  departmentName: string;
  designationName: string;
  type: AuthorisationType;
  referenceNumber: string;
  expiryDate: string;
  daysLeft: number;
  threshold: ThresholdKey;
}

export interface DigestGroup {
  bucket: UrgencyBucket;
  label: string;
  items: DigestItem[];
}

export interface DigestContent {
  subject: string;
  html: string;
  text: string;
}

export interface DigestParams {
  companyName: string;
  today: string;
  baseUrl: string;
  items: DigestItem[];
}

const BUCKET_COLORS: Record<UrgencyBucket, string> = {
  EXPIRED: "#b91c1c",
  D0_7: "#c2410c",
  D8_14: "#b45309",
  D15_30: "#a16207",
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function employeeUrl(baseUrl: string, employeeId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/employees/${encodeURIComponent(employeeId)}`;
}

export function countExpired(items: readonly DigestItem[]): number {
  return items.filter((i) => i.daysLeft < 0).length;
}

/** `[Permit/Visa] 3 expiring, 1 expired — RW Design — 2026-09-28` */
export function digestSubject(companyName: string, items: readonly DigestItem[], today: string): string {
  const expired = countExpired(items);
  const expiring = items.length - expired;
  const parts: string[] = [];
  if (expiring > 0) parts.push(`${expiring} expiring`);
  if (expired > 0) parts.push(`${expired} expired`);
  return `[Permit/Visa] ${parts.join(", ")} — ${companyName} — ${today}`;
}

/** Groups in urgency order (Expired → 0–7d → 8–14d → 15–30d), each sorted by expiry. Empty groups omitted. */
export function groupByUrgency(items: readonly DigestItem[]): DigestGroup[] {
  return URGENCY_BUCKETS.map((bucket) => ({
    bucket,
    label: URGENCY_LABELS[bucket],
    items: items
      .filter((i) => urgencyBucket(i.daysLeft) === bucket)
      .sort((a, b) => (a.expiryDate === b.expiryDate ? a.employeeName.localeCompare(b.employeeName) : a.expiryDate < b.expiryDate ? -1 : 1)),
  })).filter((g) => g.items.length > 0);
}

export function describeDaysLeft(daysLeft: number): string {
  if (daysLeft < -1) return `Expired ${-daysLeft} days ago`;
  if (daysLeft === -1) return "Expired yesterday";
  if (daysLeft === 0) return "Expires today";
  if (daysLeft === 1) return "1 day left";
  return `${daysLeft} days left`;
}

function renderHtml(params: DigestParams, groups: DigestGroup[], subject: string): string {
  const cell = "padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:left;vertical-align:top;";
  const head = `${cell}background:#f9fafb;font-weight:600;color:#374151;`;
  const sections = groups
    .map((g) => {
      const rows = g.items
        .map(
          (i) => `<tr>
<td style="${cell}"><a href="${escapeHtml(employeeUrl(params.baseUrl, i.employeeId))}" style="color:#1d4ed8;">${escapeHtml(i.employeeName)}</a></td>
<td style="${cell}">${escapeHtml(i.departmentName)}</td>
<td style="${cell}">${escapeHtml(i.designationName)}</td>
<td style="${cell}">${escapeHtml(AUTHORISATION_TYPE_LABELS[i.type])}</td>
<td style="${cell}">${escapeHtml(i.referenceNumber)}</td>
<td style="${cell}">${escapeHtml(formatDisplayDate(i.expiryDate))}</td>
<td style="${cell}font-weight:600;color:${BUCKET_COLORS[g.bucket]};">${escapeHtml(describeDaysLeft(i.daysLeft))}</td>
</tr>`,
        )
        .join("\n");
      return `<h3 style="margin:20px 0 8px;font-size:15px;color:${BUCKET_COLORS[g.bucket]};">${escapeHtml(g.label)} (${g.items.length})</h3>
<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;border:1px solid #e5e7eb;">
<thead><tr>
<th style="${head}">Employee</th><th style="${head}">Department</th><th style="${head}">Designation</th><th style="${head}">Type</th><th style="${head}">Reference</th><th style="${head}">Expiry</th><th style="${head}">Status</th>
</tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#ffffff;font-family:Segoe UI,Arial,sans-serif;color:#111827;">
<h2 style="margin:0 0 4px;font-size:18px;">Work permit &amp; visa alerts — ${escapeHtml(params.companyName)}</h2>
<p style="margin:0 0 12px;font-size:13px;color:#6b7280;">${escapeHtml(formatDisplayDate(params.today))} · ${params.items.length} record(s) need attention</p>
${sections}
<p style="margin:24px 0 0;font-size:12px;color:#6b7280;">Sent automatically by the Permit &amp; Visa Portal. Renew a record in the portal to stop further reminders for it.<br>
<a href="${escapeHtml(params.baseUrl)}" style="color:#1d4ed8;">Open the dashboard</a></p>
</body>
</html>`;
}

function renderText(params: DigestParams, groups: DigestGroup[]): string {
  const lines: string[] = [
    `Work permit & visa alerts — ${params.companyName}`,
    `${formatDisplayDate(params.today)} · ${params.items.length} record(s) need attention`,
    "",
  ];
  for (const g of groups) {
    lines.push(`== ${g.label} (${g.items.length}) ==`);
    for (const i of g.items) {
      lines.push(
        `- ${i.employeeName} | ${i.departmentName} | ${i.designationName} | ${AUTHORISATION_TYPE_LABELS[i.type]} ${i.referenceNumber} | expires ${formatDisplayDate(i.expiryDate)} | ${describeDaysLeft(i.daysLeft)}`,
        `  ${employeeUrl(params.baseUrl, i.employeeId)}`,
      );
    }
    lines.push("");
  }
  lines.push("Sent automatically by the Permit & Visa Portal. Renew a record in the portal to stop further reminders for it.");
  lines.push(params.baseUrl);
  return lines.join("\n");
}

export function renderDigest(params: DigestParams): DigestContent {
  const subject = digestSubject(params.companyName, params.items, params.today);
  const groups = groupByUrgency(params.items);
  return { subject, html: renderHtml(params, groups, subject), text: renderText(params, groups) };
}
