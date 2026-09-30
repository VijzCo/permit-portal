/** Transport-agnostic outgoing message. */
export interface MailMessage {
  from: string;
  to: string[];
  bcc: string[];
  subject: string;
  html: string;
  text: string;
}

export interface MailTransport {
  readonly name: "graph" | "smtp";
  send(message: MailMessage): Promise<void>;
}

export type MailTransportKind = MailTransport["name"];

export function parseTransportKind(value: string | undefined): MailTransportKind {
  const v = (value ?? "graph").trim().toLowerCase();
  if (v === "graph" || v === "smtp") return v;
  throw new Error(`MAIL_TRANSPORT must be "graph" or "smtp" (got "${value}").`);
}
