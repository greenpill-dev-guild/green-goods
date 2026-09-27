import {
  buildReportingProofMessage,
  type ReportingProofFields,
} from "@green-goods/shared/modules/agent-reporting";
import type { Hono } from "hono";
import { createHash } from "node:crypto";
import type { PrivateKeyAccount } from "viem/accounts";
import type { EvidenceUploader } from "../../../services/reporting/uploader";

/**
 * A browser at the canonical origin talking to the ceremony API without the Vercel proxy: it keeps
 * host-only cookies, sends the exact Origin, and carries CSRF tokens only in memory, as the real
 * ceremony page must. Signatures come from real viem accounts, so EOA proofs are genuine.
 */
export class TestBrowser {
  readonly cookies = new Map<string, string>();
  csrf: string | null = null;
  challengeId: string | null = null;

  constructor(
    private readonly app: Hono,
    readonly origin = "https://greengoods.test"
  ) {}

  async request<T = Record<string, unknown>>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      bootstrap?: boolean;
      origin?: string | null;
      csrf?: string | null;
    } = {}
  ): Promise<{ status: number; body: T; headers: Headers }> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const origin = options.origin === undefined ? this.origin : options.origin;
    if (origin) headers.origin = origin;
    const csrf = options.csrf === undefined ? this.csrf : options.csrf;
    if (csrf) headers["x-gg-csrf"] = csrf;
    if (options.bootstrap) headers["x-gg-bootstrap"] = "1";
    if (this.cookies.size)
      headers.cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    const response = await this.app.request(path, {
      method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair, ...attributes] = cookie.split(";");
      const [name, value = ""] = (pair ?? "").split("=");
      if (!name) continue;
      const expired = attributes.some((attribute) => /max-age=0/i.test(attribute.trim()));
      if (expired || value === "") this.cookies.delete(name.trim());
      else this.cookies.set(name.trim(), value);
    }
    const text = await response.text();
    return {
      status: response.status,
      body: (text ? JSON.parse(text) : {}) as T,
      headers: response.headers,
    };
  }

  /** Opens a chat link: the page itself is inert; the explicit bootstrap POST starts a challenge. */
  async open(url: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const requestId = url.split("/").at(-1) ?? "";
    const result = await this.request("POST", "/messaging/challenges", {
      body: { requestId },
      bootstrap: true,
    });
    if (result.status === 201) {
      this.csrf = result.body.csrfToken as string;
      this.challengeId = result.body.challengeId as string;
    }
    return result;
  }

  async prove(account: PrivateKeyAccount, fields?: Partial<ReportingProofFields>) {
    const current = await this.request<{ proof: ReportingProofFields }>(
      "GET",
      `/messaging/challenges/${this.challengeId}`
    );
    const message = buildReportingProofMessage(
      { ...current.body.proof, ...fields },
      account.address
    );
    const signature = await account.signMessage({ message });
    return this.request("POST", `/messaging/challenges/${this.challengeId}/proof`, {
      body: { account: account.address, signature },
    });
  }

  /** Submits a proof from a smart account whose signature the harness verifier accepts. */
  async proveAs(account: `0x${string}`, signature: `0x${string}`) {
    return this.request("POST", `/messaging/challenges/${this.challengeId}/proof`, {
      body: { account, signature },
    });
  }

  async access() {
    const result = await this.request("POST", "/messaging/access", {
      body: { challengeId: this.challengeId },
    });
    if (result.status === 200) this.csrf = result.body.csrfToken as string;
    return result;
  }
}

/** Content-addressed stand-in for Pinata: identical bytes always yield the same identifier. */
export class FixtureUploader implements EvidenceUploader {
  readonly uploads: Array<{ name: string; mime: string; bytes: Uint8Array; cid: string }> = [];
  failures = 0;

  async upload(input: { bytes: Uint8Array; name: string; mime: string }): Promise<{ cid: string }> {
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error("upload unavailable");
    }
    const cid = `bafkrei${createHash("sha256").update(input.bytes).digest("hex").slice(0, 52)}`;
    this.uploads.push({ ...input, cid });
    return { cid };
  }
}
