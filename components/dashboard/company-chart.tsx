"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_VAR } from "@/components/status-badge";
import type { CompanyBreakdown } from "@/lib/dashboard";
import { STATUS_LABELS, STATUSES } from "@/lib/status";

/**
 * Grouped bars in the fixed status colours. Warning is below 3:1 on the light
 * surface, so the chart always has a legend, per-bar tooltips and a table view.
 */
export function CompanyChart({ data }: { data: CompanyBreakdown[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const chartData = data.map((d) => ({ ...d, label: d.companyName }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>By company</CardTitle>
        <CardDescription>Current records of active employees.</CardDescription>
        <CardAction>
          <div className="inline-flex rounded-lg border bg-muted/60 p-0.5">
            <Button size="sm" variant={view === "chart" ? "secondary" : "ghost"} className="h-7 px-2" onClick={() => setView("chart")} aria-pressed={view === "chart"}>
              <BarChart3 className="size-3.5" aria-hidden />
              <span className="sr-only sm:not-sr-only">Chart</span>
            </Button>
            <Button size="sm" variant={view === "table" ? "secondary" : "ghost"} className="h-7 px-2" onClick={() => setView("table")} aria-pressed={view === "table"}>
              <Table2 className="size-3.5" aria-hidden />
              <span className="sr-only sm:not-sr-only">Table</span>
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {view === "chart" ? (
          <>
          <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
            {STATUSES.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: STATUS_VAR[s] }} aria-hidden />
                {STATUS_LABELS[s]}
              </li>
            ))}
          </ul>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                  contentStyle={{
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.35)",
                  }}
                  labelStyle={{ color: "var(--popover-foreground)", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "var(--popover-foreground)", padding: 0 }}
                />
                {STATUSES.map((s) => (
                  <Bar key={s} dataKey={s} name={STATUS_LABELS[s]} fill={STATUS_VAR[s]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          </>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                {STATUSES.map((s) => (
                  <TableHead key={s} className="text-right">
                    {STATUS_LABELS[s]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.companyId}>
                  <TableCell className="font-medium">{d.companyName}</TableCell>
                  {STATUSES.map((s) => (
                    <TableCell key={s} className="text-right tabular">
                      {d[s]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
