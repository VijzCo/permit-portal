"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader } from "@/components/layout/page-header";
import { ActionRequiredTable } from "@/components/dashboard/action-required-table";
import { CompanyChart } from "@/components/dashboard/company-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { PassportCard } from "@/components/dashboard/passport-card";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { useCurrentUser } from "@/components/providers/auth-provider";
import { ALL, buildDashboard, type DashboardFilters } from "@/lib/dashboard";
import { formatDisplayDate, todayIso } from "@/lib/dates";
import { AUTHORISATION_TYPE_LABELS, AUTHORISATION_TYPES, type AuthorisationType } from "@/lib/status";

function isTypeFilter(v: string): v is AuthorisationType | typeof ALL {
  return v === ALL || (AUTHORISATION_TYPES as readonly string[]).includes(v);
}

export function Dashboard() {
  const { accessibleCompanies, employees, currentAuths, now } = usePortalData();
  const user = useCurrentUser();
  const [filters, setFilters] = useState<DashboardFilters>({ companyId: ALL, type: ALL });
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Maseru" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user.displayName.split(/\s+/)[0] ?? "";

  const data = useMemo(
    () => buildDashboard({ employees, auths: currentAuths, companies: accessibleCompanies, filters, now }),
    [employees, currentAuths, accessibleCompanies, filters, now],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title={`${greeting}, ${firstName}`}
        description={`Work permit and visa status as of ${formatDisplayDate(todayIso(now))} (Africa/Maseru).`}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="filter-company" className="text-xs">
                Company
              </Label>
              <NativeSelect
                id="filter-company"
                className="min-w-48"
                value={filters.companyId}
                onChange={(e) => setFilters((f) => ({ ...f, companyId: e.target.value }))}
              >
                <NativeSelectOption value={ALL}>All companies</NativeSelectOption>
                {accessibleCompanies.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="filter-type" className="text-xs">
                Type
              </Label>
              <NativeSelect
                id="filter-type"
                className="min-w-40"
                value={filters.type}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isTypeFilter(v)) setFilters((f) => ({ ...f, type: v }));
                }}
              >
                <NativeSelectOption value={ALL}>All types</NativeSelectOption>
                {AUTHORISATION_TYPES.map((t) => (
                  <NativeSelectOption key={t} value={t}>
                    {AUTHORISATION_TYPE_LABELS[t]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
        }
      />
      <KpiCards kpis={data.kpis} />
      <ActionRequiredTable rows={data.actionRows} />
      <div className="grid items-stretch gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CompanyChart data={data.byCompany} />
        </div>
        <PassportCard rows={data.passports} />
      </div>
    </div>
  );
}
