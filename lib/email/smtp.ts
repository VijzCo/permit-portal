import nodemailer from "nodemailer";
import type { MailMessage, MailTransport } from "@/lib/email/transport";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

/**
 * Optional fallback (MAIL_TRANSPORT=smtp). Do not use it with Microsoft 365
 * basic auth, which Microsoft disables by default from end of Dec 2026.
 */
export class SmtpTransport implements MailTransport {
  readonly name = "smtp" as const;
  private readonly transporter: nodemailer.Transporter;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      requireTLS: config.port !== 465,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: message.from,
      to: message.to,
      bcc: message.bcc.length > 0 ? message.bcc : undefined,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
