"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/layout/states";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { formatDisplayDate } from "@/lib/dates";
import { friendlyError } from "@/lib/errors";

interface DryRunDigest {
  companyId: string;
  companyName: string;
  to: string[];
  bcc: string[];
  subject: string;
  itemCount: number;
  html: string;
}

interface DryRunResponse {
  dryRun: true;
  today: string;
  from: string | null;
  digests: DryRunDigest[];
  skipped: { companyId: string; companyName: string; reason: string; itemCount: number }[];
}

function isDryRunResponse(v: unknown): v is DryRunResponse {
  return typeof v === "object" && v !== null && (v as DryRunResponse).dryRun === true && Array.isArray((v as DryRunResponse).digests);
}

export function TestDigest() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DryRunResponse | null>(null);

  async function run() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/cron/expiry-alerts?dryRun=1", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body: unknown = await res.json();
      if (!res.ok || !isDryRunResponse(body)) {
        const message = typeof body === "object" && body !== null && "error" in body ? String((body as { error: unknown }).error) : `HTTP ${res.status}`;
        throw new Error(message);
      }
      setResult(body);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Administration"
        title="Expiry alerts"
        description="The daily job runs at 06:00 Maseru and emails one digest per company for thresholds 30, 14, 7 and 0 days, then weekly while expired. A test digest is a dry run: it shows what would be sent now and sends nothing."
        actions={
          <Button onClick={() => void run()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            Send test digest
          </Button>
        }
      />
      {error ? <ErrorState title="Dry run failed" message={error} /> : null}
      {result ? (
        <>
          <p className="text-sm text-muted-foreground">
            Dry run for {formatDisplayDate(result.today)} · sender {result.from ?? "(MAIL_FROM not set)"} ·{" "}
            {result.digests.length} digest(s)
          </p>
          {result.digests.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState message="No alerts are due right now (or they were already sent today)." />
              </CardContent>
            </Card>
          ) : null}
          {result.digests.map((d) => (
            <Card key={d.companyId} data-testid={`digest-${d.companyId}`}>
              <CardHeader>
                <CardTitle className="text-base">{d.subject}</CardTitle>
                <CardDescription className="space-y-0.5">
                  <span className="block">To: {d.to.join(", ")}</span>
                  {d.bcc.length > 0 ? <span className="block">Bcc: {d.bcc.join(", ")}</span> : null}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <iframe
                  title={`Preview for ${d.companyName}`}
                  srcDoc={d.html}
                  sandbox=""
                  className="h-96 w-full rounded-md border bg-white"
                />
              </CardContent>
            </Card>
          ))}
          {result.skipped.map((s) => (
            <div key={s.companyId} className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">Skipped</Badge>
              {s.companyName}: {s.reason} ({s.itemCount} item(s))
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
