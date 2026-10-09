import type { GrantActivationSignatureRequest } from "../../../modules/agent-reporting/api-contract";
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

  it("surfaces the Agent's typed failure and HTTP status", async () => {
    const { client } = recorder([{ status: 404, body: { ok: false, errorCode: "unavailable" } }]);
    await expect(client.draft("draft-1")).rejects.toMatchObject({
      code: "unavailable",
      status: 404,
    });
  });

  it("refuses malformed successful response bodies", async () => {
    const { client } = recorder([
      {
        status: 200,
        body: { ok: true, operation: { operationId: "op", envelope: "not an envelope" } },
      },
    ]);
    const malformed = client.operation("op");
    await expect(malformed).rejects.toBeInstanceOf(CeremonyError);
    await expect(malformed).rejects.toMatchObject({ code: "malformed" });
  });

  it("maps a dropped connection to a retryable network failure without exposing transport text", async () => {
    const client = new CeremonyClient({
      fetch: async () => {
        throw new TypeError("private provider detail");
      },
    });
    await expect(client.draft("draft-1")).rejects.toMatchObject({
      code: "network",
      status: 0,
      message: "Ceremony request failed: network",
    });
  });
  it("validates the signature-free activation wire before sending anything to the Agent", async () => {
    const { calls, client } = recorder([
      { status: 200, body: { ok: true, delegateSignature: "0xff1234" } },
    ]);
    const request: GrantActivationSignatureRequest = {
      attemptId: "at-1",
      permitVersion: 1,
      payloadDigest: `0x${"12".repeat(32)}`,
      userOperation: {
        sender: "0x00000000000000000000000000000000000000a1",
        nonce: "0x0",
        callData: "0x1234",
        callGasLimit: "0x1",
        verificationGasLimit: "0x1",
        preVerificationGas: "0x1",
        maxFeePerGas: "0x1",
        maxPriorityFeePerGas: "0x0",
        paymaster: "0x00000000000000000000000000000000000000a1",
        paymasterVerificationGasLimit: "0x1",
        paymasterPostOpGasLimit: "0x0",
        paymasterData: "0xab",
      },
    };
    const contaminated = {
      ...request,
      userOperation: { ...request.userOperation, signature: "0xdeadbeef" },
    };
    await expect(client.signGrantActivation("g-1", contaminated)).rejects.toThrow();
    expect(calls).toEqual([]);
    await expect(client.signGrantActivation("g-1", request)).resolves.toBe("0xff1234");
    expect(calls[0]?.url).toBe("/api/messaging/execution-grants/g-1/activation/signature");
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual(request);
  });
});
