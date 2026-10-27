"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, type Control, type FieldValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActiveBadge, FormDialog } from "@/components/admin/form-dialog";
import { ErrorState, LoadingState } from "@/components/layout/states";
import { PageHeader } from "@/components/layout/page-header";
import { useCurrentUser } from "@/components/providers/auth-provider";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { friendlyError } from "@/lib/errors";
import { createUser, sendPasswordReset, subscribeUsers, updateUser } from "@/lib/repos/users";
import {
  createUserSchema,
  userInputSchema,
  ROLE_LABELS,
  type AppUser,
  type CreateUserInput,
  type UserInput,
} from "@/lib/schemas";

/** Role select + company checkboxes, shared by both dialogs. */
function RoleAndCompanies<T extends FieldValues>({ control, role, lockRole }: { control: Control<T>; role: string; lockRole: boolean }) {
  const { companies } = usePortalData();
  return (
    <>
      <FormField
        control={control}
        name={"role" as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <FormControl>
              <NativeSelect {...field} disabled={lockRole}>
                <NativeSelectOption value="hr">HR — view and edit selected companies</NativeSelectOption>
                <NativeSelectOption value="viewer">Viewer — view selected companies only</NativeSelectOption>
                <NativeSelectOption value="admin">Admin — everything</NativeSelectOption>
              </NativeSelect>
            </FormControl>
            {lockRole ? <FormDescription>You can&apos;t change your own role.</FormDescription> : null}
            <FormMessage />
          </FormItem>
        )}
      />
      {role !== "admin" ? (
        <FormField
          control={control}
          name={"companyIds" as Path<T>}
          render={({ field }) => {
            const value: string[] = Array.isArray(field.value) ? (field.value as string[]) : [];
            return (
              <FormItem>
                <FormLabel>Companies</FormLabel>
                <div className="space-y-2 rounded-md border p-3">
                  {companies.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={value.includes(c.id)}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true ? [...value, c.id] : value.filter((id) => id !== c.id))
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      ) : null}
    </>
  );
}

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const admin = useCurrentUser();
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: "", displayName: "", role: "hr", companyIds: [], active: true, temporaryPassword: "" },
  });
  const role = form.watch("role");

  useEffect(() => {
    if (open) form.reset({ email: "", displayName: "", role: "hr", companyIds: [], active: true, temporaryPassword: "" });
  }, [open, form]);

  async function onSubmit(values: CreateUserInput) {
    const { temporaryPassword, ...profile } = values;
    try {
      await createUser(profile, temporaryPassword, admin.id);
      toast.success(`${profile.displayName} can now sign in with the temporary password.`);
      onClose();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Invite user"
      description="Creates the sign-in account with a temporary password. Share it privately; the user should then use “Forgot password?” to choose their own."
      formId="invite-form"
      busy={form.formState.isSubmitting}
      submitLabel="Create user"
    >
      <Form {...form}>
        <form id="invite-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="displayName"
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="temporaryPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temporary password</FormLabel>
                <FormControl>
                  <Input type="text" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <RoleAndCompanies control={form.control} role={role} lockRole={false} />
        </form>
      </Form>
    </FormDialog>
  );
}

function EditUserDialog({ user, onClose }: { user: AppUser | null; onClose: () => void }) {
  const admin = useCurrentUser();
  const form = useForm<UserInput>({
    resolver: zodResolver(userInputSchema),
    defaultValues: { email: "", displayName: "", role: "hr", companyIds: [], active: true },
  });
  const role = form.watch("role");
  const isSelf = user?.id === admin.id;

  useEffect(() => {
    if (user) {
      form.reset({ email: user.email, displayName: user.displayName, role: user.role, companyIds: user.companyIds, active: user.active });
    }
  }, [user, form]);

  async function onSubmit(values: UserInput) {
    if (!user) return;
    try {
      await updateUser(user, values, admin.id);
      toast.success("User updated.");
      onClose();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }

  return (
    <FormDialog open={user !== null} onClose={onClose} title="Edit user" description={user?.email} formId="edit-user-form" busy={form.formState.isSubmitting}>
      <Form {...form}>
        <form id="edit-user-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="displayName"
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
          <RoleAndCompanies control={form.control} role={role} lockRole={isSelf} />
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Checkbox checked={field.value} disabled={isSelf} onCheckedChange={(v) => field.onChange(v === true)} />
                </FormControl>
                <FormLabel className="font-normal">Active (inactive users are blocked at sign-in)</FormLabel>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormDialog>
  );
}

export function UsersAdmin() {
  const { companies } = usePortalData();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const companyName = useMemo(() => new Map(companies.map((c) => [c.id, c.code])), [companies]);

  useEffect(() => subscribeUsers(setUsers, (err) => setError(friendlyError(err))), []);

  async function reset(u: AppUser) {
    try {
      await sendPasswordReset(u.email);
      toast.success(`Password reset email sent to ${u.email}.`);
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Admins manage everything. HR users view and edit their companies. Viewers can only look at their companies."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" aria-hidden />
            Invite user
          </Button>
        }
      />
      {error ? <ErrorState message={error} /> : null}
      {users === null && !error ? <LoadingState /> : null}
      {users ? (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Companies</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-56" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.displayName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : u.role === "viewer" ? "outline" : "secondary"}>{ROLE_LABELS[u.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.role === "admin" ? "All" : u.companyIds.map((id) => companyName.get(id) ?? id).join(", ")}
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={u.active} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => void reset(u)}>
                        <KeyRound className="size-3.5" aria-hidden />
                        Reset
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
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
      ) : null}
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <EditUserDialog user={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
