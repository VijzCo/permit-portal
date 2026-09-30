import { AlertTriangle, CheckCircle2, CircleDashed, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, type Status } from "@/lib/status";

/** Fixed status colours (never themed) + icon + label, so colour never carries meaning alone. */
export const STATUS_META: Record<Status, { icon: LucideIcon; color: string; tint: string; text: string }> = {
  VALID: { icon: CheckCircle2, color: "text-status-good", tint: "bg-status-good/12 ring-status-good/25", text: "Valid" },
  EXPIRING: { icon: AlertTriangle, color: "text-status-warning", tint: "bg-status-warning/15 ring-status-warning/35", text: "Expiring" },
  EXPIRED: { icon: XCircle, color: "text-status-critical", tint: "bg-status-critical/12 ring-status-critical/30", text: "Expired" },
  MISSING: { icon: CircleDashed, color: "text-status-missing", tint: "bg-muted ring-border", text: "Missing" },
};

export const STATUS_VAR: Record<Status, string> = {
  VALID: "var(--status-good)",
  EXPIRING: "var(--status-warning)",
  EXPIRED: "var(--status-critical)",
  MISSING: "var(--status-missing)",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground ring-1 ring-inset",
        meta.tint,
        className,
      )}
      data-status={status}
    >
      <meta.icon className={cn("size-3.5", meta.color)} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Days-left pill: negative = expired (critical), ≤30 = expiring, else neutral. */
export function DaysLeft({ days }: { days: number | null }) {
  if (days === null) return <span className="text-muted-foreground">—</span>;
  const tone =
    days < 0
      ? "bg-status-critical/12 text-foreground ring-status-critical/30"
      : days <= 30
        ? "bg-status-warning/15 text-foreground ring-status-warning/35"
        : "bg-muted text-muted-foreground ring-border";
  const label = days < 0 ? `${-days}d over` : days === 0 ? "today" : `${days}d`;
  return (
    <span className={cn("inline-flex min-w-14 justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular ring-1 ring-inset", tone)}>
      {label}
    </span>
  );
}
