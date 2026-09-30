"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActiveBadge, FormDialog } from "@/components/admin/form-dialog";
import { EmptyState } from "@/components/layout/states";
import { PageHeader } from "@/components/layout/page-header";
import { useCurrentUser } from "@/components/providers/auth-provider";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { ALL } from "@/lib/dashboard";
import { friendlyError } from "@/lib/errors";
import { createDepartment, updateDepartment } from "@/lib/repos/departments";
import { departmentInputSchema, type Department, type DepartmentInput } from "@/lib/schemas";

type Editing = { mode: "create"; companyId: string } | { mode: "edit"; department: Department } | null;

function DepartmentDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const user = useCurrentUser();
  const { companies } = usePortalData();
  const form = useForm<DepartmentInput>({
    resolver: zodResolver(departmentInputSchema),
    defaultValues: { name: "", companyId: "", active: true },
  });

  useEffect(() => {
    if (editing?.mode === "edit") {
      const { name, companyId, active } = editing.department;
      form.reset({ name, companyId, active });
    } else if (editing) {
      form.reset({ name: "", companyId: editing.companyId, active: true });
    }
  }, [editing, form]);

  async function onSubmit(values: DepartmentInput) {
    try {
      if (editing?.mode === "edit") await updateDepartment(editing.department, values, user.id);
      else await createDepartment(values, user.id);
      toast.success("Department saved.");
      onClose();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }

  return (
    <FormDialog
      open={editing !== null}
      onClose={onClose}
      title={editing?.mode === "edit" ? "Edit department" : "Add department"}
      description="Existing employees keep the department name they were saved with until they are next edited."
      formId="department-form"
      busy={form.formState.isSubmitting}
    >
      <Form {...form}>
        <form id="department-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="companyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <FormControl>
                  <NativeSelect {...field}>
                    <NativeSelectOption value="">Select company…</NativeSelectOption>
                    {companies.map((c) => (
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                </FormControl>
                <FormLabel className="font-normal">Active</FormLabel>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormDialog>
  );
}

export function DepartmentsAdmin() {
  const { companies, departments } = usePortalData();
  const [companyId, setCompanyId] = useState<string>(ALL);
  const [editing, setEditing] = useState<Editing>(null);
  const companyName = useMemo(() => new Map(companies.map((c) => [c.id, c.name])), [companies]);

  const rows = departments
    .filter((d) => companyId === ALL || d.companyId === companyId)
    .sort((a, b) => (companyName.get(a.companyId) ?? "").localeCompare(companyName.get(b.companyId) ?? "") || a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Departments"
        description="Departments belong to one company."
        actions={
          <Button onClick={() => setEditing({ mode: "create", companyId: companyId === ALL ? "" : companyId })}>
            <Plus className="size-4" aria-hidden />
            Add department
          </Button>
        }
      />
      <Card>
        <CardContent className="space-y-4">
          <div className="grid max-w-xs gap-1.5">
            <Label htmlFor="dept-company" className="text-xs">
              Company
            </Label>
            <NativeSelect id="dept-company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <NativeSelectOption value={ALL}>All companies</NativeSelectOption>
              {companies.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {rows.length === 0 ? (
            <EmptyState message="No departments yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{companyName.get(d.companyId) ?? d.companyId}</TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>
                      <ActiveBadge active={d.active} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ mode: "edit", department: d })}>
                        <Pencil className="size-3.5" aria-hidden />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <DepartmentDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
