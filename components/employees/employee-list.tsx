"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/layout/states";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { ALL, employeeStatuses, fullName, type TypeStatus } from "@/lib/dashboard";
import { formatDisplayDate } from "@/lib/dates";
import { STATUS_LABELS, STATUSES, type Status } from "@/lib/status";

const PAGE_SIZE = 20;

function isStatus(v: string): v is Status {
  return (STATUSES as readonly string[]).includes(v);
}

function StatusCell({ s }: { s: TypeStatus | undefined }) {
  if (!s) return null;
  return (
    <div className="flex flex-col items-start gap-0.5">
      <StatusBadge status={s.status} />
      {s.auth ? <span className="text-xs text-muted-foreground">{formatDisplayDate(s.auth.expiryDate)}</span> : null}
    </div>
  );
}

export function EmployeeList() {
  const { employees, currentAuths, accessibleCompanies, departments, designations, now } = usePortalData();
  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState<string>(ALL);
  const [departmentId, setDepartmentId] = useState<string>(ALL);
  const [designationId, setDesignationId] = useState<string>(ALL);
  const [status, setStatus] = useState<Status | typeof ALL>(ALL);
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(0);

  const statuses = useMemo(() => employeeStatuses(employees, currentAuths, now), [employees, currentAuths, now]);

  const departmentOptions = useMemo(
    () =>
      departments
        .filter((d) => (companyId === ALL ? accessibleCompanies.some((c) => c.id === d.companyId) : d.companyId === companyId))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [departments, companyId, accessibleCompanies],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees
      .filter((e) => showInactive || e.active)
      .filter((e) => companyId === ALL || e.companyId === companyId)
      .filter((e) => departmentId === ALL || e.departmentId === departmentId)
      .filter((e) => designationId === ALL || e.designationId === designationId)
      .filter((e) => !q || e.searchText.includes(q) || fullName(e).toLowerCase().includes(q))
      .filter((e) => {
        if (status === ALL) return true;
        const s = statuses.get(e.id);
        return s?.WORK_PERMIT.status === status || s?.VISA.status === status;
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  }, [employees, showInactive, companyId, departmentId, designationId, search, status, statuses]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const resetPage = () => setPage(0);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Workforce"
        title="Employees"
        description="Migrant employees and the status of their work permits and visas."
        actions={
          <Button asChild>
            <Link href="/employees/new">
              <Plus className="size-4" aria-hidden />
              Add employee
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="grid gap-1.5 lg:col-span-2">
            <Label htmlFor="emp-search" className="text-xs">
              Search
            </Label>
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="emp-search"
                placeholder="Name or email"
                className="pl-8"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="emp-company" className="text-xs">
              Company
            </Label>
            <NativeSelect
              id="emp-company"
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setDepartmentId(ALL);
                resetPage();
              }}
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
            <Label htmlFor="emp-department" className="text-xs">
              Department
            </Label>
            <NativeSelect
              id="emp-department"
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                resetPage();
              }}
            >
              <NativeSelectOption value={ALL}>All departments</NativeSelectOption>
              {departmentOptions.map((d) => (
                <NativeSelectOption key={d.id} value={d.id}>
                  {companyId === ALL ? `${d.name} (${d.companyId})` : d.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="emp-designation" className="text-xs">
              Designation
            </Label>
            <NativeSelect
              id="emp-designation"
              value={designationId}
              onChange={(e) => {
                setDesignationId(e.target.value);
                resetPage();
              }}
            >
              <NativeSelectOption value={ALL}>All designations</NativeSelectOption>
              {designations.map((d) => (
                <NativeSelectOption key={d.id} value={d.id}>
                  {d.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="emp-status" className="text-xs">
              Permit / visa status
            </Label>
            <NativeSelect
              id="emp-status"
              value={status}
              onChange={(e) => {
                const v = e.target.value;
                setStatus(isStatus(v) ? v : ALL);
                resetPage();
              }}
            >
              <NativeSelectOption value={ALL}>Any status</NativeSelectOption>
              {STATUSES.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {STATUS_LABELS[s]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex items-center gap-2 lg:col-span-6">
            <Switch
              id="emp-inactive"
              checked={showInactive}
              onCheckedChange={(v) => {
                setShowInactive(v);
                resetPage();
              }}
            />
            <Label htmlFor="emp-inactive" className="text-sm font-normal">
              Show inactive employees
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState message="No employees match these filters." />
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border">
              <Table data-testid="employee-table">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Work permit</TableHead>
                    <TableHead>Visa</TableHead>
                    <TableHead>Passport expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((e) => {
                    const s = statuses.get(e.id);
                    return (
                      <TableRow key={e.id} className={e.active ? undefined : "opacity-60"}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary" aria-hidden>
                              {(e.firstName[0] ?? "") + (e.lastName[0] ?? "")}
                            </span>
                            <div className="min-w-0">
                              <Link href={`/employees/${e.id}`} className="font-medium underline-offset-4 hover:underline">
                                {fullName(e)}
                              </Link>
                              <div className="truncate text-xs text-muted-foreground">
                                {e.email || "—"}
                                {e.active ? "" : " · inactive"}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{e.companyName}</TableCell>
                        <TableCell>{e.departmentName}</TableCell>
                        <TableCell>{e.designationName}</TableCell>
                        <TableCell>
                          <StatusCell s={s?.WORK_PERMIT} />
                        </TableCell>
                        <TableCell>
                          <StatusCell s={s?.VISA} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDisplayDate(e.passport.expiryDate)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of{" "}
                  {filtered.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
                    Previous
                  </Button>
                  <span>
                    Page {currentPage + 1} of {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
