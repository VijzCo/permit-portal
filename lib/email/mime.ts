import MailComposer from "nodemailer/lib/mail-composer";
import type { MailMessage } from "@/lib/email/transport";

/**
 * Builds an RFC 5322 multipart/alternative message (plain text + HTML).
 * Bcc is kept in the headers because Microsoft Graph reads recipients from them.
 */
export async function buildMime(message: MailMessage): Promise<Buffer> {
  const composer = new MailComposer({
    from: message.from,
    to: message.to,
    bcc: message.bcc.length > 0 ? message.bcc : undefined,
    subject: message.subject,
    text: message.text,
    html: message.html,
    textEncoding: "base64",
  });
  const node = composer.compile();
  node.keepBcc = true;
  return node.build();
}
