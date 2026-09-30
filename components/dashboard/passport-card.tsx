import Link from "next/link";
import { BookUser } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/states";
import { DaysLeft } from "@/components/status-badge";
import { formatDisplayDate } from "@/lib/dates";
import { PASSPORT_WARNING_DAYS } from "@/lib/status";
import type { PassportRow } from "@/lib/dashboard";

export function PassportCard({ rows }: { rows: PassportRow[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BookUser className="size-4" aria-hidden />
          </span>
          Passports expiring
        </CardTitle>
        <CardDescription>Next {PASSPORT_WARNING_DAYS} days · information only, no emails.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState message={`No passports expire in the next ${PASSPORT_WARNING_DAYS} days.`} />
        ) : (
          <ul className="space-y-2" data-testid="passport-list">
            {rows.map((p) => (
              <li key={p.employeeId} className="flex items-center justify-between gap-3 rounded-lg border bg-background/40 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link href={`/employees/${p.employeeId}`} className="font-medium underline-offset-4 hover:underline">
                    {p.employeeName}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.companyName} · <span className="font-mono">{p.passportNumber}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <DaysLeft days={p.daysLeft} />
                  <span className="text-[11px] whitespace-nowrap text-muted-foreground">{formatDisplayDate(p.expiryDate)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
