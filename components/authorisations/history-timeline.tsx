import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/states";
import { compareIsoDates, formatDisplayDate } from "@/lib/dates";
import type { Authorisation } from "@/lib/schemas";
import { AUTHORISATION_TYPE_LABELS, type AuthorisationType } from "@/lib/status";
import { cn } from "@/lib/utils";

export function HistoryTimeline({ type, records }: { type: AuthorisationType; records: Authorisation[] }) {
  const sorted = [...records].sort(
    (a, b) => Number(b.isCurrent) - Number(a.isCurrent) || compareIsoDates(b.issuedDate, a.issuedDate),
  );
  const label = AUTHORISATION_TYPE_LABELS[type];
  return (
    <Card data-testid={`history-${type}`}>
      <CardHeader>
        <CardTitle className="text-base">{label} history</CardTitle>
        <CardDescription>Every issuance, newest first. Renewals never delete old records.</CardDescription>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState message={`No ${label.toLowerCase()} records yet.`} />
        ) : (
          <ol className="relative ml-2 border-l pl-5">
            {sorted.map((r) => (
              <li key={r.id} className="mb-5 last:mb-0">
                <span
                  className={cn(
                    "absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-background",
                    r.isCurrent ? "bg-primary" : "bg-muted-foreground/40",
                  )}
                  aria-hidden
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{r.referenceNumber}</span>
                  {r.isCurrent ? <Badge>Current</Badge> : <Badge variant="secondary">Superseded</Badge>}
                </div>
                <div className="mt-0.5 text-sm">
                  {formatDisplayDate(r.issuedDate)} → {formatDisplayDate(r.expiryDate)}
                </div>
                {r.notes ? <p className="mt-0.5 text-xs whitespace-pre-wrap text-muted-foreground">{r.notes}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
