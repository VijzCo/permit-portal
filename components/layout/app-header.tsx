"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/layout/app-sidebar";
import { BrandMark } from "@/components/layout/brand-mark";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { formatDisplayDate, todayIso } from "@/lib/dates";

/** Top bar: mobile menu, today's date (Maseru) and the action-required bell. */
export function AppHeader() {
  const { actionRequiredCount, loading, now } = usePortalData();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 lg:px-8">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu className="size-5" aria-hidden />
        </Button>
        <Link href="/" className="flex items-center gap-2 font-semibold lg:hidden">
          <BrandMark className="size-7" />
          <span className="text-sm">Permit &amp; Visa</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
            <CalendarDays className="size-3.5" aria-hidden />
            {formatDisplayDate(todayIso(now))} · Maseru
          </span>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="relative rounded-full"
            aria-label={`${actionRequiredCount} items need action`}
          >
            <Link href="/#action-required">
              <Bell className="size-5" aria-hidden />
              {!loading && actionRequiredCount > 0 ? (
                <span
                  className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-status-critical px-1 text-[11px] leading-5 font-semibold text-white ring-2 ring-background tabular"
                  data-testid="action-badge"
                >
                  {actionRequiredCount > 99 ? "99+" : actionRequiredCount}
                </span>
              ) : null}
            </Link>
          </Button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 p-0 [&>button]:text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
