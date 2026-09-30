"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { friendlyError } from "@/lib/errors";

const schema = z.object({ email: z.string().trim().email("Enter a valid email address") });
type Values = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit(values: Values) {
    setError(null);
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), values.email);
      setSent(true);
    } catch (err) {
      const message = friendlyError(err);
      // Don't reveal whether an account exists.
      if (message.includes("Incorrect email")) setSent(true);
      else setError(message);
    }
  }

  return (
    <Card className="border-0 bg-transparent shadow-none ring-0 sm:border sm:bg-card sm:shadow-xl sm:shadow-black/5 dark:sm:shadow-black/30">
      <CardHeader>
        <CardTitle className="text-xl">Reset password</CardTitle>
        <CardDescription>We&apos;ll email you a link to choose a new password.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <div className="flex items-start gap-3 rounded-md border bg-muted/50 p-3 text-sm" role="status">
            <MailCheck className="mt-0.5 size-4 text-success" aria-hidden />
            If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Send reset link
              </Button>
            </form>
          </Form>
        )}
        <Link href="/login" className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
