import type { ReactNode } from "react";
import { BellRing, History, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const FEATURES = [
  { icon: BellRing, title: "Alerts before it's too late", text: "HR gets a digest at 30, 14, 7 and 0 days — then weekly until renewed." },
  { icon: History, title: "Full renewal history", text: "Every permit and visa issuance is kept. Nothing is overwritten." },
  { icon: ShieldCheck, title: "Company-scoped access", text: "HR teams see only their own company. Every change is audited." },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="bg-grid pointer-events-none absolute inset-0 text-sidebar-foreground opacity-40" aria-hidden />
        <div
          className="pointer-events-none absolute -top-40 -right-40 size-[36rem] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.13 185 / 0.55), transparent 65%)" }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3 p-10">
          <BrandMark className="size-10" />
          <div className="leading-tight">
            <div className="font-semibold">Permit &amp; Visa Portal</div>
            <div className="text-xs text-sidebar-muted">Migrant workforce compliance</div>
          </div>
        </div>
        <div className="relative mt-auto space-y-8 p-10">
          <h2 className="max-w-md text-3xl leading-tight font-semibold tracking-tight">
            Never miss a work permit or visa expiry again.
          </h2>
          <ul className="max-w-md space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-primary ring-1 ring-sidebar-border">
                  <f.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <div className="text-sm font-medium">{f.title}</div>
                  <div className="text-sm text-sidebar-muted">{f.text}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-sidebar-border pt-6 text-xs text-sidebar-muted">
            DutyFreeSourcing Inc. · RW Design · Quantum Apparel — Maseru, Lesotho
          </p>
        </div>
      </aside>

      <main className="page-glow relative flex flex-col items-center justify-center px-4 py-12">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="mb-8 flex items-center gap-2 font-semibold lg:hidden">
          <BrandMark className="size-9" />
          Permit &amp; Visa Portal
        </div>
        <div className="w-full max-w-sm">{children}</div>
        <p className="mt-8 text-center text-xs text-muted-foreground lg:hidden">
          DutyFreeSourcing Inc. · RW Design · Quantum Apparel
        </p>
      </main>
    </div>
  );
}
