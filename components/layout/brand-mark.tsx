import { cn } from "@/lib/utils";

/** App logo: document with a check, teal gradient tile. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8 shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="brand-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0e7490" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#brand-g)" />
      <path d="M22 16h14l10 10v22a2 2 0 0 1-2 2H22a2 2 0 0 1-2-2V18a2 2 0 0 1 2-2z" fill="#fff" opacity=".95" />
      <path d="M36 16v8a2 2 0 0 0 2 2h8" fill="#ccfbf1" />
      <path d="M26 38l5 5 9-11" fill="none" stroke="#0e7490" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
