import Link from "next/link";
import { PartyPopper } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DaysLeft, StatusBadge } from "@/components/status-badge";
import { formatDisplayDate } from "@/lib/dates";
import { AUTHORISATION_TYPE_LABELS } from "@/lib/status";
import type { ActionRow } from "@/lib/dashboard";

function Initials({ name }: { name: string }) {
  const parts = name.split(/\s+/);
  const text = ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary" aria-hidden>
      {text}
    </span>
  );
}

export function ActionRequiredTable({ rows }: { rows: ActionRow[] }) {
  const expired = rows.filter((r) => r.status === "EXPIRED").length;
  return (
    <Card id="action-required" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Action required
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular">{rows.length}</span>
        </CardTitle>
        <CardDescription>Current work permits and visas expiring within 30 days or already expired, soonest first.</CardDescription>
        {expired > 0 ? (
          <CardAction>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-critical/12 px-2.5 py-1 text-xs font-medium ring-1 ring-status-critical/30 ring-inset">
              <span className="size-1.5 rounded-full bg-status-critical" aria-hidden />
              {expired} expired
            </span>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
            <PartyPopper className="size-8 text-primary" aria-hidden />
            <p className="text-sm font-medium">All clear</p>
            <p className="text-sm text-muted-foreground">Every current record is valid for more than 30 days.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <Table data-testid="action-table">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Employee</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Days left</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.authId}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <Initials name={r.employeeName} />
                        <div className="min-w-0">
                          <Link href={`/employees/${r.employeeId}`} className="font-medium underline-offset-4 hover:underline">
                            {r.employeeName}
                          </Link>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]" title={r.companyName}>
                        {r.companyCode}
                      </span>
                    </TableCell>
                    <TableCell>{r.departmentName}</TableCell>
                    <TableCell className="text-muted-foreground">{r.designationName}</TableCell>
                    <TableCell>{AUTHORISATION_TYPE_LABELS[r.type]}</TableCell>
                    <TableCell className="font-mono text-xs">{r.referenceNumber}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDisplayDate(r.expiryDate)}</TableCell>
                    <TableCell className="text-right">
                      <DaysLeft days={r.daysLeft} />
                    </TableCell>
                    <TableCell className="pr-4">
                      <StatusBadge status={r.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
