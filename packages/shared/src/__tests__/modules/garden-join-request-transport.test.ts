import { describe, expect, it, vi } from "vitest";
import type { GardenJoinProofEnvelope } from "../../public-contracts/join-requests";
import {
  GardenJoinRequestTransportError,
  gardenJoinRequestTransport,
} from "../../modules/garden-join-requests";

const GARDEN = "0x1111111111111111111111111111111111111111" as const;
const proof: GardenJoinProofEnvelope = {
  version: 1,
  chainId: 42161,
  gardenAddress: GARDEN,
  accountAddress: "0x2222222222222222222222222222222222222222",
  action: "create",
  nonce: `0x${"11".repeat(32)}`,
  issuedAt: 1,
  expiresAt: 2,
  signature: "0x1234",
};

describe("garden join request transport", () => {
  it("sends a signed create request to the garden-scoped route", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, request: { id: "request-1", state: "pending" } }), {
          status: 201,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    await gardenJoinRequestTransport.create(
      GARDEN,
      { displayName: "Maya", requestedVia: "garden_detail" },
      proof,
      "https://agent.example"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `https://agent.example/public/gardens/${GARDEN}/join-requests`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^GG-JoinProof /),
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("preserves safe API errors for persistent UI feedback", async () => {
    const expectedError = {
      message: "Already joined.",
      status: 409,
      errorCode: "already_member",
      outcomeUnknown: false,
    } satisfies Partial<GardenJoinRequestTransportError>;

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ ok: false, errorCode: "already_member", message: "Already joined." }),
            { status: 409, headers: { "content-type": "application/json" } }
          )
      )
    );

    await expect(
      gardenJoinRequestTransport.create(
        GARDEN,
        { displayName: "Maya", requestedVia: "garden_detail" },
        proof,
        "https://agent.example"
      )
    ).rejects.toMatchObject(expectedError);
  });

  it("keeps the timeout active while the response body is being read", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return {
          ok: true,
          status: 200,
          json: () =>
            new Promise((_resolve, reject) =>
              requestSignal?.addEventListener("abort", () => reject(new Error("aborted")))
            ),
        } as Response;
      })
    );

    const pending = gardenJoinRequestTransport.mine(GARDEN, proof, "https://agent.example");
    const rejection = expect(pending).rejects.toMatchObject({
      message: "The garden request service could not be reached.",
      outcomeUnknown: false,
    });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(requestSignal?.aborted).toBe(true);
    await rejection;
    vi.useRealTimers();
  });
});
