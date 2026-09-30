"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState } from "@/components/layout/states";
import { PageHeader } from "@/components/layout/page-header";
import { friendlyError } from "@/lib/errors";
import { subscribeAuditLog } from "@/lib/repos/audit";
import { subscribeUsers } from "@/lib/repos/users";
import { AUDIT_ENTITIES, type AppUser, type AuditEntity, type AuditLogEntry } from "@/lib/schemas";

const LIMIT = 200;

function isEntity(v: string): v is AuditEntity {
  return (AUDIT_ENTITIES as readonly string[]).includes(v);
}

function formatAt(iso: string | null): string {
  if (!iso) return "pending…";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Maseru",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function Changes({ entry }: { entry: AuditLogEntry }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground">View</summary>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div>
          <div className="mb-1 font-medium">Before</div>
          <pre className="max-h-64 overflow-auto rounded bg-muted p-2">{JSON.stringify(entry.before, null, 2)}</pre>
        </div>
        <div>
          <div className="mb-1 font-medium">After</div>
          <pre className="max-h-64 overflow-auto rounded bg-muted p-2">{JSON.stringify(entry.after, null, 2)}</pre>
        </div>
      </div>
    </details>
  );
}

export function AuditLogView() {
  const [entity, setEntity] = useState<AuditEntity | "all">("all");
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEntries(null);
    return subscribeAuditLog({ entity, limit: LIMIT }, setEntries, (err) => setError(friendlyError(err)));
  }, [entity]);

  useEffect(() => subscribeUsers(setUsers, () => undefined), []);

  const userName = useMemo(() => new Map(users.map((u) => [u.id, u.displayName])), [users]);

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Audit log" description={`The latest ${LIMIT} changes. Entries cannot be edited or deleted.`} />
      <Card>
        <CardContent className="space-y-4">
          <div className="grid max-w-xs gap-1.5">
            <Label htmlFor="audit-entity" className="text-xs">
              Entity
            </Label>
            <NativeSelect
              id="audit-entity"
              value={entity}
              onChange={(e) => {
                const v = e.target.value;
                setEntity(isEntity(v) ? v : "all");
              }}
            >
              <NativeSelectOption value="all">All entities</NativeSelectOption>
              {AUDIT_ENTITIES.map((e) => (
                <NativeSelectOption key={e} value={e}>
                  {e}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {error ? <ErrorState message={error} /> : null}
          {entries === null && !error ? <LoadingState /> : null}
          {entries && entries.length === 0 ? <EmptyState message="No entries." /> : null}
          {entries && entries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id} className="align-top">
                    <TableCell className="whitespace-nowrap">{formatAt(e.at)}</TableCell>
                    <TableCell>{userName.get(e.uid) ?? e.uid}</TableCell>
                    <TableCell>{e.entity}</TableCell>
                    <TableCell>
                      <Badge variant={e.action === "create" ? "default" : "secondary"}>{e.action}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.entityId}</TableCell>
                    <TableCell className="min-w-64">
                      <Changes entry={e} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
