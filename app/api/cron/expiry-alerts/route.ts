import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { candidateLogIds, planDigests, type PlannedDigest } from "@/lib/email/alerts";
import { appBaseUrl, createMailTransport, mailFrom } from "@/lib/email/config";
import { existingLogIds, isActiveAdminUid, loadAlertData, recordSent } from "@/lib/email/load";
import { verifyIdTokenUid } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function bearer(req: NextRequest): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Real runs: Vercel Cron with `Authorization: Bearer ${CRON_SECRET}`.
 * Dry runs (`?dryRun=1`): CRON_SECRET, or an active admin's Firebase ID token
 * (the "Send test digest" button).
 */
async function authorise(req: NextRequest, dryRun: boolean): Promise<boolean> {
  const token = bearer(req);
  if (!token) return false;
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && safeEqual(token, secret)) return true;
  if (!dryRun) return false;
  const uid = await verifyIdTokenUid(token);
  return uid !== null && (await isActiveAdminUid(uid));
}

function summarise(d: PlannedDigest) {
  return {
    companyId: d.companyId,
    companyName: d.companyName,
    to: d.to,
    bcc: d.bcc,
    subject: d.content.subject,
    itemCount: d.items.length,
    items: d.items,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  if (!(await authorise(req, dryRun))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const data = await loadAlertData();
    const sentLogIds = await existingLogIds(candidateLogIds(data.authorisations, now));
    const plan = planDigests({ ...data, now, baseUrl: appBaseUrl(), sentLogIds });

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        today: plan.today,
        from: process.env.MAIL_FROM ?? null,
        digests: plan.digests.map((d) => ({ ...summarise(d), html: d.content.html, text: d.content.text })),
        skipped: plan.skipped,
      });
    }

    const from = mailFrom();
    const transport = plan.digests.length > 0 ? createMailTransport() : null;
    const sent: ReturnType<typeof summarise>[] = [];
    const failed: { companyId: string; companyName: string; error: string }[] = [];

    for (const digest of plan.digests) {
      try {
        await transport?.send({
          from,
          to: digest.to,
          bcc: digest.bcc,
          subject: digest.content.subject,
          html: digest.content.html,
          text: digest.content.text,
        });
        await recordSent(digest);
        sent.push(summarise(digest));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[expiry-alerts] ${digest.companyId}: ${message}`);
        failed.push({ companyId: digest.companyId, companyName: digest.companyName, error: message });
      }
    }

    return NextResponse.json(
      { dryRun: false, today: plan.today, transport: transport?.name ?? null, sent, failed, skipped: plan.skipped },
      { status: failed.length > 0 ? 500 : 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[expiry-alerts] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
