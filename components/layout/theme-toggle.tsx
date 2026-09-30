"use client";

import { useEffect, useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

/** Segmented light / dark / system switch. `tone="sidebar"` for the dark sidebar. */
export function ThemeToggle({ tone = "default", className }: { tone?: "default" | "sidebar"; className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? (theme ?? "system") : "system";

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg p-0.5",
        tone === "sidebar" ? "bg-sidebar-accent/70" : "border bg-muted/60",
        className,
      )}
    >
      {OPTIONS.map((o) => {
        const active = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => setTheme(o.value)}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              tone === "sidebar"
                ? active
                  ? "bg-sidebar text-sidebar-primary shadow-sm"
                  : "text-sidebar-muted hover:text-sidebar-foreground"
                : active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            <o.icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
