"use client";

import type { UseFormReturn } from "react-hook-form";
import { BadgeCheck, Plane } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { defaultExpiryDate, isIsoDate, todayIso } from "@/lib/dates";
import type { EmployeeFormValues, InitialAuthorisation } from "@/lib/schemas";

export function emptyInitialAuthorisation(): InitialAuthorisation {
  const today = todayIso();
  return { enabled: false, referenceNumber: "", issuedDate: today, expiryDate: defaultExpiryDate(today), notes: "" };
}

const META = {
  workPermit: { title: "Work permit", icon: BadgeCheck },
  visa: { title: "Visa", icon: Plane },
} as const;

/** Optional first work permit / visa, entered together with the employee. */
export function AuthorisationFields({
  form,
  name,
}: {
  form: UseFormReturn<EmployeeFormValues>;
  name: "workPermit" | "visa";
}) {
  const { title, icon: Icon } = META[name];
  const enabled = form.watch(`${name}.enabled`);
  const switchId = `${name}-enabled`;

  return (
    <Card data-testid={`new-${name}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          {title}
        </CardTitle>
        <CardDescription>
          {enabled
            ? "Saved together with the employee. The expiry defaults to issued + 2 years − 1 day; change it to match the document."
            : `Optional. Turn on to enter the current ${title.toLowerCase()} now, or add it later from the employee page.`}
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Label htmlFor={switchId} className="text-sm font-normal text-muted-foreground">
            Enter now
          </Label>
          <FormField
            control={form.control}
            name={`${name}.enabled`}
            render={({ field }) => (
              <Switch
                id={switchId}
                checked={field.value}
                onCheckedChange={(v) => {
                  field.onChange(v);
                  if (!v) form.clearErrors(name);
                }}
              />
            )}
          />
        </CardAction>
      </CardHeader>
      {enabled ? (
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name={`${name}.referenceNumber`}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Reference number</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`${name}.issuedDate`}
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
                      if (isIsoDate(v) && !form.getFieldState(`${name}.expiryDate`).isDirty) {
                        form.setValue(`${name}.expiryDate`, defaultExpiryDate(v), { shouldValidate: form.formState.isSubmitted });
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
            name={`${name}.expiryDate`}
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
          <FormField
            control={form.control}
            name={`${name}.notes`}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}
