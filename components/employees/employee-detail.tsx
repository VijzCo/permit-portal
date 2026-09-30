"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthorisationCard } from "@/components/authorisations/authorisation-card";
import {
  AuthorisationDialog,
  type AuthorisationDialogMode,
  type AuthorisationDialogState,
} from "@/components/authorisations/authorisation-dialog";
import { HistoryTimeline } from "@/components/authorisations/history-timeline";
import { ErrorState, LoadingState } from "@/components/layout/states";
import { useCurrentUser } from "@/components/providers/auth-provider";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { employeeStatuses, fullName } from "@/lib/dashboard";
import { daysUntil, formatDisplayDate } from "@/lib/dates";
import { friendlyError } from "@/lib/errors";
import { subscribeEmployeeAuthorisations } from "@/lib/repos/authorisations";
import { setEmployeeActive, subscribeEmployee } from "@/lib/repos/employees";
import type { Authorisation, Employee } from "@/lib/schemas";
import { AUTHORISATION_TYPES, PASSPORT_WARNING_DAYS, type AuthorisationType } from "@/lib/status";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export function EmployeeDetail({ id }: { id: string }) {
  const user = useCurrentUser();
  const { now } = usePortalData();
  const [employee, setEmployee] = useState<Employee | null | undefined>(undefined);
  const [records, setRecords] = useState<Authorisation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<AuthorisationDialogState | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => subscribeEmployee(id, setEmployee, (err) => setError(friendlyError(err))), [id]);

  const companyId = employee?.companyId;
  useEffect(() => {
    if (!companyId) return;
    return subscribeEmployeeAuthorisations({ id, companyId }, setRecords, (err) => setError(friendlyError(err)));
  }, [id, companyId]);

  const statuses = useMemo(() => {
    if (!employee || !records) return null;
    return employeeStatuses([employee], records, now).get(employee.id) ?? null;
  }, [employee, records, now]);

  if (error) return <ErrorState title="Cannot open employee" message={`${error} The employee may not exist or may belong to a company you can't access.`} />;
  if (employee === undefined || (employee && records === null)) return <LoadingState />;
  if (employee === null) return <ErrorState title="Not found" message="This employee does not exist." />;

  const passportDays = employee.passport.expiryDate ? daysUntil(employee.passport.expiryDate, now) : null;

  function open(type: AuthorisationType, mode: AuthorisationDialogMode) {
    const record = statuses?.[type].auth ?? null;
    setDialog({ type, mode, record });
  }

  async function toggleActive(next: boolean) {
    if (!employee) return;
    setToggling(true);
    try {
      await setEmployeeActive(employee, next, user.id);
      toast.success(next ? "Employee reactivated." : "Employee deactivated.");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/employees" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="size-3.5" aria-hidden />
          Employees
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 text-lg font-semibold text-primary ring-1 ring-primary/20" aria-hidden>
              {(employee.firstName[0] ?? "") + (employee.lastName[0] ?? "")}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{fullName(employee)}</h1>
                {employee.active ? null : <Badge variant="secondary">Inactive</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {employee.designationName} · {employee.departmentName} · {employee.companyName}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/employees/${employee.id}/edit`}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Link>
            </Button>
            {employee.active ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={toggling}>
                    <Power className="size-4" aria-hidden />
                    Deactivate
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deactivate {fullName(employee)}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Inactive employees are hidden from the dashboard and receive no expiry alerts. Their records and history are kept and
                      you can reactivate them later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void toggleActive(false)}>Deactivate</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button variant="outline" onClick={() => void toggleActive(true)} disabled={toggling}>
                <Power className="size-4" aria-hidden />
                Reactivate
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Email">{employee.email || "—"}</Field>
            <Field label="Company">{employee.companyName}</Field>
            <Field label="Department">{employee.departmentName}</Field>
            <Field label="Designation">{employee.designationName}</Field>
            <Field label="Passport number">
              <span className="font-mono text-xs">{employee.passport.number}</span>
            </Field>
            <Field label="Nationality">{employee.passport.nationality}</Field>
            <Field label="Passport issued">{formatDisplayDate(employee.passport.issueDate)}</Field>
            <Field label="Passport expires">
              {formatDisplayDate(employee.passport.expiryDate)}
              {passportDays !== null && passportDays <= PASSPORT_WARNING_DAYS ? (
                <span className="ml-2 text-xs text-destructive">
                  {passportDays < 0 ? `expired ${-passportDays}d ago` : `${passportDays}d left`}
                </span>
              ) : null}
            </Field>
          </dl>
        </CardContent>
      </Card>

      {statuses ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {AUTHORISATION_TYPES.map((type) => (
            <AuthorisationCard
              key={type}
              type={type}
              status={statuses[type]}
              disabled={!employee.active}
              onAction={(mode) => open(type, mode)}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {AUTHORISATION_TYPES.map((type) => (
          <HistoryTimeline key={type} type={type} records={(records ?? []).filter((r) => r.type === type)} />
        ))}
      </div>

      <AuthorisationDialog employee={employee} state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
