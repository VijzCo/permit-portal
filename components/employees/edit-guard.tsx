"use client";

import type { ReactNode } from "react";
import { ErrorState } from "@/components/layout/states";
import { useAuth } from "@/components/providers/auth-provider";

/** Blocks create/edit pages for read-only (viewer) accounts. Rules deny the writes anyway. */
export function EditGuard({ children }: { children: ReactNode }) {
  const { canEdit } = useAuth();
  if (!canEdit) {
    return <ErrorState title="View only" message="Your account can view records but not add or change them. Ask an admin if you need edit access." />;
  }
  return <>{children}</>;
}
