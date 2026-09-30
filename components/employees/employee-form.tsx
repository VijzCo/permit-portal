"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { employeeInputSchema, type EmployeeInput } from "@/lib/schemas";
import type { EmployeeNames } from "@/lib/repos/employees";

export const EMPTY_EMPLOYEE: EmployeeInput = {
  firstName: "",
  lastName: "",
  email: "",
  companyId: "",
  departmentId: "",
  designationId: "",
  passport: { number: "", nationality: "", issueDate: "", expiryDate: "" },
  active: true,
};

export function EmployeeForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  defaultValues: EmployeeInput;
  submitLabel: string;
  onSubmit: (values: EmployeeInput, names: EmployeeNames) => Promise<void>;
  onCancel: () => void;
}) {
  const { accessibleCompanies, departments, designations } = usePortalData();
  const form = useForm<EmployeeInput>({ resolver: zodResolver(employeeInputSchema), defaultValues });
  const companyId = form.watch("companyId");
  const currentDepartmentId = defaultValues.departmentId;
  const currentDesignationId = defaultValues.designationId;

  const companyOptions = useMemo(
    () => accessibleCompanies.filter((c) => c.active || c.id === defaultValues.companyId),
    [accessibleCompanies, defaultValues.companyId],
  );
  const departmentOptions = useMemo(
    () =>
      departments
        .filter((d) => d.companyId === companyId && (d.active || d.id === currentDepartmentId))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [departments, companyId, currentDepartmentId],
  );
  const designationOptions = useMemo(
    () => designations.filter((d) => d.active || d.id === currentDesignationId),
    [designations, currentDesignationId],
  );

  async function submit(values: EmployeeInput) {
    const names: EmployeeNames = {
      companyName: accessibleCompanies.find((c) => c.id === values.companyId)?.name ?? "",
      departmentName: departments.find((d) => d.id === values.departmentId)?.name ?? "",
      designationName: designations.find((d) => d.id === values.designationId)?.name ?? "",
    };
    await onSubmit(values, names);
  }

  const busy = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Employee</CardTitle>
            <CardDescription>Personal details and placement.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <FormControl>
                    <NativeSelect
                      {...field}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        form.setValue("departmentId", "", { shouldValidate: form.formState.isSubmitted });
                      }}
                    >
                      <NativeSelectOption value="">Select company…</NativeSelectOption>
                      {companyOptions.map((c) => (
                        <NativeSelectOption key={c.id} value={c.id}>
                          {c.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <FormControl>
                    <NativeSelect {...field} disabled={!companyId}>
                      <NativeSelectOption value="">{companyId ? "Select department…" : "Select a company first"}</NativeSelectOption>
                      {departmentOptions.map((d) => (
                        <NativeSelectOption key={d.id} value={d.id}>
                          {d.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="designationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Designation</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      <NativeSelectOption value="">Select designation…</NativeSelectOption>
                      {designationOptions.map((d) => (
                        <NativeSelectOption key={d.id} value={d.id}>
                          {d.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Passport</CardTitle>
            <CardDescription>Expiry must be after the issue date.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="passport.number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passport number</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passport.nationality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nationality</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passport.issueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passport.expiryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
