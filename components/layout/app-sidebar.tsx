"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LayoutDashboard, LogOut, Settings2, Users, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { ROLE_LABELS } from "@/lib/schemas";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  admin: boolean;
  badge?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, admin: false, badge: true },
  { href: "/employees", label: "Employees", icon: Users, admin: false },
  { href: "/admin", label: "Admin", icon: Settings2, admin: true },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function initials(name: string | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

/** Sidebar body — rendered fixed on desktop and inside a sheet on mobile. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { profile, isAdmin, signOut } = useAuth();
  const { actionRequiredCount, loading, accessibleCompanies } = usePortalData();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-3 px-5 pt-6 pb-5">
        <BrandMark className="size-9" />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">Permit &amp; Visa</div>
          <div className="text-xs text-sidebar-muted">Migrant workforce portal</div>
        </div>
      </Link>

      <nav className="flex-1 space-y-1 px-3" aria-label="Main">
        <div className="px-3 pt-2 pb-2 text-[11px] font-medium tracking-wider text-sidebar-muted uppercase">Workspace</div>
        {NAV.filter((n) => !n.admin || isAdmin).map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-sidebar-primary" aria-hidden /> : null}
              <n.icon className={cn("size-4", active ? "text-sidebar-primary" : "")} aria-hidden />
              {n.label}
              {n.badge && !loading && actionRequiredCount > 0 ? (
                <span className="ml-auto rounded-full bg-status-critical/90 px-2 py-0.5 text-[11px] font-semibold text-white tabular">
                  {actionRequiredCount}
                </span>
              ) : null}
            </Link>
          );
        })}

        {accessibleCompanies.length > 0 ? (
          <>
            <div className="px-3 pt-6 pb-2 text-[11px] font-medium tracking-wider text-sidebar-muted uppercase">Companies</div>
            <ul className="space-y-1 px-3 text-sm text-sidebar-muted">
              {accessibleCompanies.map((c) => (
                <li key={c.id} className="flex items-center gap-2 truncate">
                  <span className="rounded bg-sidebar-accent px-1.5 py-0.5 font-mono text-[10px] text-sidebar-foreground">{c.code}</span>
                  <span className="truncate">{c.name}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-3">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-sidebar-muted">Theme</span>
          <ThemeToggle tone="sidebar" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                {initials(profile?.displayName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{profile?.displayName}</span>
                <span className="block truncate text-xs text-sidebar-muted">{profile ? ROLE_LABELS[profile.role] : ""}</span>
              </span>
              <ChevronsUpDown className="size-4 text-sidebar-muted" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="truncate text-sm font-medium">{profile?.displayName}</div>
              <div className="truncate text-xs text-muted-foreground">{profile?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut className="size-4" aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
