"use client";

import { Pencil, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_VAR, StatusBadge } from "@/components/status-badge";
import { formatDisplayDate } from "@/lib/dates";
import { AUTHORISATION_TYPE_LABELS, type AuthorisationType } from "@/lib/status";
import type { TypeStatus } from "@/lib/dashboard";
import type { AuthorisationDialogMode } from "@/components/authorisations/authorisation-dialog";

function describe(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return `Expired ${-days} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export function AuthorisationCard({
  type,
  status,
  disabled,
  readOnly = false,
  onAction,
}: {
  type: AuthorisationType;
  status: TypeStatus;
  disabled: boolean;
  /** Viewers: show the record, no actions. */
  readOnly?: boolean;
  onAction: (mode: AuthorisationDialogMode) => void;
}) {
  const label = AUTHORISATION_TYPE_LABELS[type];
  const auth = status.auth;
  return (
    <Card data-testid={`card-${type}`} className="relative overflow-hidden">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: STATUS_VAR[status.status] }} aria-hidden />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {label}
          <StatusBadge status={status.status} />
        </CardTitle>
        <CardDescription>{auth ? describe(status.daysLeft) : `No current ${label.toLowerCase()} on record.`}</CardDescription>
        {readOnly ? null : (
        <CardAction className="flex gap-2">
          {auth ? (
            <>
              <Button size="sm" variant="outline" onClick={() => onAction("edit")} disabled={disabled}>
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </Button>
              <Button size="sm" onClick={() => onAction("renew")} disabled={disabled}>
                <RefreshCw className="size-3.5" aria-hidden />
                Renew
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => onAction("add")} disabled={disabled}>
              <Plus className="size-3.5" aria-hidden />
              Add {label.toLowerCase()}
            </Button>
          )}
        </CardAction>
        )}
      </CardHeader>
      {auth ? (
        <CardContent>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Reference</dt>
              <dd className="font-mono text-xs">{auth.referenceNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Issued</dt>
              <dd>{formatDisplayDate(auth.issuedDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Expires</dt>
              <dd className="font-medium">{formatDisplayDate(auth.expiryDate)}</dd>
            </div>
            {auth.notes ? (
              <div className="col-span-3">
                <dt className="text-xs text-muted-foreground">Notes</dt>
                <dd className="whitespace-pre-wrap">{auth.notes}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      ) : null}
    </Card>
  );
}
