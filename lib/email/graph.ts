import { ConfidentialClientApplication } from "@azure/msal-node";
import { buildMime } from "@/lib/email/mime";
import type { MailMessage, MailTransport } from "@/lib/email/transport";

export interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export type TokenProvider = () => Promise<string>;
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

/** App-only (client credentials) token via MSAL. MSAL caches tokens until expiry. */
export function msalTokenProvider(config: GraphConfig): TokenProvider {
  const client = new ConfidentialClientApplication({
    auth: {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
  });
  return async () => {
    const result = await client.acquireTokenByClientCredential({ scopes: [GRAPH_SCOPE] });
    if (!result?.accessToken) {
      throw new Error("Microsoft Graph: no access token returned.");
    }
    return result.accessToken;
  };
}

/**
 * Sends through Microsoft Graph `POST /users/{sender}/sendMail` using a MIME
 * payload, so the message carries both HTML and a plain-text alternative.
 * Needs the application permission Mail.Send (ideally limited to the shared
 * mailbox with an Exchange application access policy).
 */
export class GraphTransport implements MailTransport {
  readonly name = "graph" as const;

  constructor(
    private readonly getToken: TokenProvider,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  async send(message: MailMessage): Promise<void> {
    const token = await this.getToken();
    const mime = await buildMime(message);
    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(message.from)}/sendMail`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: mime.toString("base64"),
    });
    if (res.status !== 202) {
      const detail = (await res.text()).slice(0, 500);
      throw new Error(`Microsoft Graph sendMail failed (${res.status}): ${detail}`);
    }
  }
}
