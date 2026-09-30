"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/components/providers/auth-provider";
import { defaultExpiryDate, formatDisplayDate, isIsoDate, renewalIssuedDate, todayIso } from "@/lib/dates";
import { friendlyError } from "@/lib/errors";
import { addAuthorisation, renewAuthorisation, updateAuthorisation } from "@/lib/repos/authorisations";
import { authorisationInputSchema, type Authorisation, type AuthorisationInput, type Employee } from "@/lib/schemas";
import { AUTHORISATION_TYPE_LABELS, type AuthorisationType } from "@/lib/status";

export type AuthorisationDialogMode = "add" | "edit" | "renew";

export interface AuthorisationDialogState {
  mode: AuthorisationDialogMode;
  type: AuthorisationType;
  /** the record being edited or renewed */
  record: Authorisation | null;
}

function initialValues(state: AuthorisationDialogState): AuthorisationInput {
  const { mode, type, record } = state;
  if (mode === "edit" && record) {
    return {
      type,
      referenceNumber: record.referenceNumber,
      issuedDate: record.issuedDate,
      expiryDate: record.expiryDate,
      notes: record.notes,
    };
  }
  const issued = mode === "renew" && record ? renewalIssuedDate(record.expiryDate) : todayIso();
  return { type, referenceNumber: "", issuedDate: issued, expiryDate: defaultExpiryDate(issued), notes: "" };
}

const TITLES: Record<AuthorisationDialogMode, string> = { add: "Add", edit: "Edit", renew: "Renew" };

export function AuthorisationDialog({
  employee,
  state,
  onClose,
}: {
  employee: Employee;
  state: AuthorisationDialogState | null;
  onClose: () => void;
}) {
  const user = useCurrentUser();
  const form = useForm<AuthorisationInput>({
    resolver: zodResolver(authorisationInputSchema),
    defaultValues: state ? initialValues(state) : undefined,
  });

  useEffect(() => {
    if (state) form.reset(initialValues(state));
  }, [state, form]);

  if (!state) return null;
  const label = AUTHORISATION_TYPE_LABELS[state.type];

  async function onSubmit(values: AuthorisationInput) {
    if (!state) return;
    try {
      if (state.mode === "add") await addAuthorisation(employee, values, user.id);
      else if (state.mode === "edit" && state.record) await updateAuthorisation(state.record, values, user.id);
      else if (state.mode === "renew" && state.record) await renewAuthorisation(state.record, values, user.id);
      toast.success(state.mode === "renew" ? `${label} renewed.` : `${label} saved.`);
      onClose();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }

  const busy = form.formState.isSubmitting;

  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {TITLES[state.mode]} {label.toLowerCase()}
          </DialogTitle>
          <DialogDescription>
            {state.mode === "renew" && state.record
              ? `The current ${label.toLowerCase()} (${state.record.referenceNumber}, expires ${formatDisplayDate(state.record.expiryDate)}) will be kept in the history.`
              : `${employee.firstName} ${employee.lastName}`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate id="authorisation-form">
            <FormField
              control={form.control}
              name="referenceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference number</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="issuedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issued date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          const v = e.target.value;
                          if (isIsoDate(v) && !form.getFieldState("expiryDate").isDirty) {
                            form.setValue("expiryDate", defaultExpiryDate(v), { shouldValidate: form.formState.isSubmitted });
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>Defaults to issued + 2 years − 1 day.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="authorisation-form" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {state.mode === "renew" ? "Renew" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
