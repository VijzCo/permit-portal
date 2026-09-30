"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ErrorState } from "@/components/layout/states";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/companies", label: "Companies" },
  { href: "/admin/departments", label: "Departments" },
  { href: "/admin/designations", label: "Designations" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/alerts", label: "Alerts" },
];

export function AdminGuard({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const pathname = usePathname();

  if (!isAdmin) {
    return <ErrorState title="Admins only" message="You need the admin role to open this page." />;
  }

  return (
    <div className="space-y-6">
      <nav className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border bg-muted/50 p-1" aria-label="Admin">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              pathname.startsWith(t.href)
                ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
