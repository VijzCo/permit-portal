"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarContent } from "@/components/layout/app-sidebar";
import { ErrorState, LoadingState } from "@/components/layout/states";
import { useAuth } from "@/components/providers/auth-provider";
import { PortalDataProvider, usePortalData } from "@/components/providers/portal-data-provider";

function Blocked({ title, message }: { title: string; message: string }) {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <ShieldAlert className="mb-2 size-8 text-destructive" aria-hidden />
          <CardTitle>{title}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void signOut()} variant="outline" className="w-full">
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DataGate({ children }: { children: ReactNode }) {
  const { loading, error } = usePortalData();
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block" aria-label="Sidebar">
        <SidebarContent />
      </aside>
      <div className="page-glow min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          {error ? (
            <div className="mb-4">
              <ErrorState message={error} />
            </div>
          ) : null}
          {loading && !error ? <LoadingState /> : children}
        </main>
      </div>
    </div>
  );
}

/** Protected layout: signed-in, profile present and active. */
export function AppShell({ children }: { children: ReactNode }) {
  const { status, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "signed-out") {
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
    }
  }, [status, pathname, router]);

  if (status === "loading" || status === "signed-out") return <LoadingState label="Checking your session…" />;
  if (status === "error") {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState title="Cannot load your account" message={error ?? "Unknown error"} />
      </div>
    );
  }
  if (status === "no-profile") {
    return <Blocked title="Account not set up" message="Your sign-in works, but no portal profile exists for it. Ask an administrator to add you." />;
  }
  if (status === "inactive") {
    return <Blocked title="Account inactive" message="Your portal access has been deactivated. Contact an administrator if you need access." />;
  }

  return (
    <PortalDataProvider>
      <DataGate>{children}</DataGate>
    </PortalDataProvider>
  );
}
