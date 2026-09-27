import { describe, expect, it } from "vitest";
import { CeremonyClient, CeremonyError } from "../../../modules/agent-reporting/ceremony-client";

/** The browser client's request discipline and its refusal of malformed responses. */
const proof = {
  purpose: "publish_work",
  challengeId: "ch-1",
  browserNonce: "nonce",
  origin: "https://greengoods.app",
  chainId: 42161,
  providerRealm: "whatsapp:1",
  source: "binding-1",
  resourceDigest: "0xabc",
  identityEpoch: 1,
  issuedAt: "2026-09-27T09:00:00.000Z",
  expiresAt: "2026-09-27T09:10:00.000Z",
};

function recorder(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchStub = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(next.body), { status: next.status });
  }) as unknown as typeof fetch;
  return { calls, client: new CeremonyClient({ fetch: fetchStub }) };
}

describe("ceremony client", () => {
  it("bootstraps only on an explicit open and carries CSRF on later mutations", async () => {
    const { calls, client } = recorder([
      {
        status: 201,
        body: {
          ok: true,
          challengeId: "ch-1",
          csrfToken: "csrf-1",
          state: "issued",
          purpose: "publish_work",
          channelLabel: "WhatsApp",
          proof,
        },
      },
      {
        status: 200,
        body: {
          ok: true,
          challengeId: "ch-1",
          state: "paired",
          purpose: "publish_work",
          channelLabel: "WhatsApp",
          proof,
        },
      },
    ]);
    await client.openChallenge("locator-1234567890");
    await client.submitProof("ch-1", {
      account: "0x00000000000000000000000000000000000000a1",
      signature: "0x1234",
    });
    const [open, submit] = calls;
    expect(open?.url).toBe("/api/messaging/challenges");
    expect((open?.init.headers as Record<string, string>)["x-gg-bootstrap"]).toBe("1");
    expect(open?.init.credentials).toBe("same-origin");
    expect((submit?.init.headers as Record<string, string>)["x-gg-bootstrap"]).toBeUndefined();
    expect((submit?.init.headers as Record<string, string>)["x-gg-csrf"]).toBe("csrf-1");
  });

  it("surfaces typed failures and refuses malformed bodies", async () => {
    const { client } = recorder([
      { status: 404, body: { ok: false, errorCode: "unavailable" } },
      {
        status: 200,
        body: { ok: true, operation: { operationId: "op", envelope: "not an envelope" } },
      },
    ]);
    await expect(client.draft("draft-1")).rejects.toMatchObject({
      code: "unavailable",
      status: 404,
    });
    const malformed = client.operation("op");
    await expect(malformed).rejects.toBeInstanceOf(CeremonyError);
    await expect(malformed).rejects.toMatchObject({ code: "malformed" });
  });
});
