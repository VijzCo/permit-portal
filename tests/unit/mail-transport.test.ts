import { describe, expect, it, vi } from "vitest";
import { GraphTransport } from "@/lib/email/graph";
import { buildMime } from "@/lib/email/mime";
import { parseTransportKind, type MailMessage } from "@/lib/email/transport";

const MESSAGE: MailMessage = {
  from: "hr-alerts@example.com",
  to: ["hr@example.com"],
  bcc: ["admin@example.com"],
  subject: "[Permit/Visa] 1 expiring — RW Design — 2026-09-30",
  html: "<p>Hello <b>HR</b></p>",
  text: "Hello HR",
};

describe("buildMime", () => {
  it("builds multipart/alternative with text, html and Bcc", async () => {
    const mime = (await buildMime(MESSAGE)).toString("utf8");
    expect(mime).toMatch(/Content-Type: multipart\/alternative/i);
    expect(mime).toMatch(/Content-Type: text\/plain/i);
    expect(mime).toMatch(/Content-Type: text\/html/i);
    expect(mime).toMatch(/^Bcc: admin@example.com/im);
    expect(mime).toMatch(/^To: hr@example.com/im);
  });
});

describe("GraphTransport", () => {
  it("posts base64 MIME to /users/{from}/sendMail with a bearer token", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    const transport = new GraphTransport(async () => "tok", fetchImpl);
    await transport.send(MESSAGE);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.microsoft.com/v1.0/users/hr-alerts%40example.com/sendMail");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("text/plain");
    const decoded = Buffer.from(String(init.body), "base64").toString("utf8");
    expect(decoded).toMatch(/multipart\/alternative/i);
  });
  it("throws with Graph's error detail on failure", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":{"code":"ErrorAccessDenied"}}', { status: 403 }));
    const transport = new GraphTransport(async () => "tok", fetchImpl);
    await expect(transport.send(MESSAGE)).rejects.toThrow(/403.*ErrorAccessDenied/);
  });
});

describe("parseTransportKind", () => {
  it("defaults to graph and validates", () => {
    expect(parseTransportKind(undefined)).toBe("graph");
    expect(parseTransportKind("SMTP")).toBe("smtp");
    expect(() => parseTransportKind("sendgrid")).toThrow();
  });
});
