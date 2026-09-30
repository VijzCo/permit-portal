"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActiveBadge, FormDialog } from "@/components/admin/form-dialog";
import { EmptyState } from "@/components/layout/states";
import { PageHeader } from "@/components/layout/page-header";
import { useCurrentUser } from "@/components/providers/auth-provider";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { friendlyError } from "@/lib/errors";
import { createDesignation, updateDesignation } from "@/lib/repos/designations";
import { designationInputSchema, type Designation, type DesignationInput } from "@/lib/schemas";

type Editing = { mode: "create" } | { mode: "edit"; designation: Designation } | null;

function DesignationDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const user = useCurrentUser();
  const form = useForm<DesignationInput>({
    resolver: zodResolver(designationInputSchema),
    defaultValues: { name: "", active: true },
  });

  useEffect(() => {
    if (editing?.mode === "edit") form.reset({ name: editing.designation.name, active: editing.designation.active });
    else if (editing) form.reset({ name: "", active: true });
  }, [editing, form]);

  async function onSubmit(values: DesignationInput) {
    try {
      if (editing?.mode === "edit") await updateDesignation(editing.designation, values, user.id);
      else await createDesignation(values, user.id);
      toast.success("Designation saved.");
      onClose();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }

  return (
    <FormDialog
      open={editing !== null}
      onClose={onClose}
      title={editing?.mode === "edit" ? "Edit designation" : "Add designation"}
      description="Designations are shared by all companies."
      formId="designation-form"
      busy={form.formState.isSubmitting}
    >
      <Form {...form}>
        <form id="designation-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
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

export function DesignationsAdmin() {
  const { designations } = usePortalData();
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Designations"
        actions={
          <Button onClick={() => setEditing({ mode: "create" })}>
            <Plus className="size-4" aria-hidden />
            Add designation
          </Button>
        }
      />
      <Card>
        <CardContent>
          {designations.length === 0 ? (
            <EmptyState message="No designations yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {designations.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>
                      <ActiveBadge active={d.active} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ mode: "edit", designation: d })}>
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
      <DesignationDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
