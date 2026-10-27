"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState, LoadingState } from "@/components/layout/states";
import { EMPTY_EMPLOYEE, EmployeeForm } from "@/components/employees/employee-form";
import { emptyInitialAuthorisation } from "@/components/employees/authorisation-fields";
import { useCurrentUser } from "@/components/providers/auth-provider";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { friendlyError } from "@/lib/errors";
import { createEmployee, subscribeEmployee, updateEmployee, type InitialAuthorisationInput } from "@/lib/repos/employees";
import { employeeFullName, splitEmployeeForm, type Employee, type EmployeeFormValues } from "@/lib/schemas";

export function EmployeeCreate() {
  const router = useRouter();
  const user = useCurrentUser();
  const { accessibleCompanies } = usePortalData();
  const onlyCompany = accessibleCompanies.length === 1 ? accessibleCompanies[0]?.id ?? "" : "";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Workforce"
        title="Add employee"
        description="Enter the employee, their passport and, optionally, their current work permit and visa. All of it is saved together."
      />
      <EmployeeForm
        withAuthorisations
        defaultValues={{
          ...EMPTY_EMPLOYEE,
          companyId: onlyCompany,
          workPermit: emptyInitialAuthorisation(),
          visa: emptyInitialAuthorisation(),
        }}
        submitLabel="Create employee"
        onCancel={() => router.push("/employees")}
        onSubmit={async (values, names) => {
          const { employee, workPermit, visa } = splitEmployeeForm(values);
          const initial: InitialAuthorisationInput[] = [];
          if (workPermit) initial.push({ type: "WORK_PERMIT", ...pick(workPermit) });
          if (visa) initial.push({ type: "VISA", ...pick(visa) });
          try {
            const id = await createEmployee(employee, names, user.id, initial);
            toast.success(`${employeeFullName(employee)} added${initial.length ? ` with ${initial.length === 2 ? "work permit and visa" : initial[0]?.type === "VISA" ? "visa" : "work permit"}` : ""}.`);
            router.push(`/employees/${id}`);
          } catch (err) {
            toast.error(friendlyError(err));
          }
        }}
      />
    </div>
  );
}

function pick(a: { referenceNumber: string; issuedDate: string; expiryDate: string; notes: string }) {
  return { referenceNumber: a.referenceNumber, issuedDate: a.issuedDate, expiryDate: a.expiryDate, notes: a.notes };
}

function toInput(e: Employee): EmployeeFormValues {
  return {
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    companyId: e.companyId,
    departmentId: e.departmentId,
    designationId: e.designationId,
    passport: { ...e.passport },
    active: e.active,
    workPermit: emptyInitialAuthorisation(),
    visa: emptyInitialAuthorisation(),
  };
}

export function EmployeeEdit({ id }: { id: string }) {
  const router = useRouter();
  const user = useCurrentUser();
  const [employee, setEmployee] = useState<Employee | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeEmployee(id, setEmployee, (err) => {
        setError(friendlyError(err));
      }),
    [id],
  );

  if (error) return <ErrorState title="Cannot open employee" message={`${error} The employee may not exist or may belong to a company you can't access.`} />;
  if (employee === undefined) return <LoadingState />;
  if (employee === null) return <ErrorState title="Not found" message="This employee does not exist." />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Edit ${employeeFullName(employee)}`}
        description={
          <Link href={`/employees/${employee.id}`} className="underline-offset-4 hover:underline">
            Back to profile
          </Link>
        }
      />
      <EmployeeForm
        key={employee.updatedAt ?? "new"}
        defaultValues={toInput(employee)}
        submitLabel="Save changes"
        onCancel={() => router.push(`/employees/${employee.id}`)}
        onSubmit={async (values, names) => {
          try {
            await updateEmployee(employee, splitEmployeeForm(values).employee, names, user.id);
            toast.success("Employee updated.");
            router.push(`/employees/${employee.id}`);
          } catch (err) {
            toast.error(friendlyError(err));
          }
        }}
      />
    </div>
  );
}
