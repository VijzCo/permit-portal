import { BadgeCheck, Plane } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { STATUS_META, STATUS_VAR } from "@/components/status-badge";
import { AUTHORISATION_TYPE_LABELS, STATUSES, type AuthorisationType } from "@/lib/status";
import type { StatusCounts } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const TILE_LABEL = { VALID: "Valid", EXPIRING: "Expiring ≤30d", EXPIRED: "Expired", MISSING: "Missing" } as const;
const TYPE_ICON = { WORK_PERMIT: BadgeCheck, VISA: Plane } as const;

/** Share-of-total bar: one segment per status with 2px gaps; legend is the tiles below. */
function DistributionBar({ counts, total }: { counts: StatusCounts; total: number }) {
  if (total === 0) return <div className="h-2 rounded-full bg-muted" />;
  return (
    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={STATUSES.map((s) => `${TILE_LABEL[s]} ${counts[s]}`).join(", ")}>
      {STATUSES.filter((s) => counts[s] > 0).map((s) => (
        <div key={s} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(counts[s] / total) * 100}%`, background: STATUS_VAR[s] }} title={`${TILE_LABEL[s]}: ${counts[s]}`} />
      ))}
    </div>
  );
}

export function KpiCards({ kpis }: { kpis: { type: AuthorisationType; counts: StatusCounts }[] }) {
  return (
    <div className={cn("grid gap-4", kpis.length > 1 && "xl:grid-cols-2")}>
      {kpis.map((kpi) => {
        const total = STATUSES.reduce((n, s) => n + kpi.counts[s], 0);
        const attention = kpi.counts.EXPIRING + kpi.counts.EXPIRED;
        const Icon = TYPE_ICON[kpi.type];
        return (
          <Card key={kpi.type} data-testid={`kpi-${kpi.type}`} className="gap-4 py-5">
            <CardContent className="space-y-4 px-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold">{AUTHORISATION_TYPE_LABELS[kpi.type]}s</h2>
                  <p className="text-xs text-muted-foreground">
                    {total} active employee{total === 1 ? "" : "s"} · {attention} need{attention === 1 ? "s" : ""} action
                  </p>
                </div>
              </div>
              <DistributionBar counts={kpi.counts} total={total} />
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {STATUSES.map((s) => {
                  const meta = STATUS_META[s];
                  const pct = total ? Math.round((kpi.counts[s] / total) * 100) : 0;
                  return (
                    <div key={s} className="rounded-xl border bg-background/40 px-3 py-2.5">
                      <dt className="flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
                        <meta.icon className={cn("size-3.5 shrink-0", meta.color)} aria-hidden />
                        {TILE_LABEL[s]}
                      </dt>
                      <dd className="mt-1.5 flex items-baseline gap-1.5">
                        <span className="text-2xl font-semibold tracking-tight tabular" data-testid={`kpi-${kpi.type}-${s}`}>
                          {kpi.counts[s]}
                        </span>
                        <span className="text-xs text-muted-foreground tabular">{pct}%</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
