"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActiveBadge, FormDialog } from "@/components/admin/form-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { useCurrentUser } from "@/components/providers/auth-provider";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { friendlyError } from "@/lib/errors";
import { createCompany, updateCompany } from "@/lib/repos/companies";
import { companyInputSchema, type Company, type CompanyInput } from "@/lib/schemas";

type Editing = { mode: "create" } | { mode: "edit"; company: Company } | null;

function CompanyDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const user = useCurrentUser();
  const form = useForm<CompanyInput>({
    resolver: zodResolver(companyInputSchema),
    defaultValues: { name: "", code: "", active: true },
  });

  useEffect(() => {
    if (editing?.mode === "edit") {
      form.reset({ name: editing.company.name, code: editing.company.code, active: editing.company.active });
    } else if (editing) {
      form.reset({ name: "", code: "", active: true });
    }
  }, [editing, form]);

  async function onSubmit(values: CompanyInput) {
    try {
      if (editing?.mode === "edit") await updateCompany(editing.company, values, user.id);
      else await createCompany(values, user.id);
      toast.success("Company saved.");
      onClose();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }

  return (
    <FormDialog
      open={editing !== null}
      onClose={onClose}
      title={editing?.mode === "edit" ? "Edit company" : "Add company"}
      formId="company-form"
      busy={form.formState.isSubmitting}
    >
      <Form {...form}>
        <form id="company-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl>
                  <Input {...field} disabled={editing?.mode === "edit"} className="uppercase" />
                </FormControl>
                <FormDescription>2–10 letters or digits. Used as the ID and cannot be changed later.</FormDescription>
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

export function CompaniesAdmin() {
  const { companies } = usePortalData();
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Companies"
        actions={
          <Button onClick={() => setEditing({ mode: "create" })}>
            <Plus className="size-4" aria-hidden />
            Add company
          </Button>
        }
      />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.code}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>
                    <ActiveBadge active={c.active} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ mode: "edit", company: c })}>
                      <Pencil className="size-3.5" aria-hidden />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <CompanyDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
