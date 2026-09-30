import "server-only";

import { GraphTransport, msalTokenProvider } from "@/lib/email/graph";
import { SmtpTransport } from "@/lib/email/smtp";
import { parseTransportKind, type MailTransport } from "@/lib/email/transport";

function required(names: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const v = process.env[name]?.trim();
    if (v) values[name] = v;
    else missing.push(name);
  }
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
  return values;
}

export function mailFrom(): string {
  return required(["MAIL_FROM"]).MAIL_FROM ?? "";
}

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

/** Transport chosen by MAIL_TRANSPORT (graph by default). */
export function createMailTransport(): MailTransport {
  const kind = parseTransportKind(process.env.MAIL_TRANSPORT);
  if (kind === "smtp") {
    const env = required(["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]);
    const port = Number(env.SMTP_PORT);
    if (!Number.isInteger(port) || port <= 0) throw new Error("SMTP_PORT must be a port number.");
    return new SmtpTransport({ host: env.SMTP_HOST ?? "", port, user: env.SMTP_USER ?? "", pass: env.SMTP_PASS ?? "" });
  }
  const env = required(["GRAPH_TENANT_ID", "GRAPH_CLIENT_ID", "GRAPH_CLIENT_SECRET"]);
  return new GraphTransport(
    msalTokenProvider({
      tenantId: env.GRAPH_TENANT_ID ?? "",
      clientId: env.GRAPH_CLIENT_ID ?? "",
      clientSecret: env.GRAPH_CLIENT_SECRET ?? "",
    }),
  );
}
