import { describe, expect, it, vi } from "vitest";
import type { GardenJoinProofEnvelope } from "../../public-contracts/join-requests";
import {
  gardenJoinRequestErrorMessage,
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
  it("maps stable and local transport failures to locale message descriptors", () => {
    expect(
      gardenJoinRequestErrorMessage(
        new GardenJoinRequestTransportError("Already joined.", 409, "already_member")
      )
    ).toMatchObject({ id: "app.garden.joinRequest.error.alreadyMember" });
    expect(
      gardenJoinRequestErrorMessage(
        new GardenJoinRequestTransportError("The service could not be reached.")
      )
    ).toMatchObject({ id: "app.garden.joinRequest.error.unavailable" });
    expect(gardenJoinRequestErrorMessage(new Error("Raw fallback"))).toMatchObject({
      id: "app.garden.joinRequest.error.generic",
    });
  });

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

  it("rejects insecure non-loopback targets before encoding or sending a proof", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      gardenJoinRequestTransport.create(
        GARDEN,
        { displayName: "Maya", requestedVia: "garden_detail" },
        proof,
        "http://agent.example"
      )
    ).rejects.toMatchObject({
      message: "The garden request service requires a secure HTTPS connection.",
      outcomeUnknown: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows explicit loopback HTTP targets for local development", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ ok: true, request: { id: "request-1", state: "pending" } }, { status: 201 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await gardenJoinRequestTransport.create(
      GARDEN,
      { displayName: "Maya", requestedVia: "garden_detail" },
      proof,
      "http://127.0.0.1:3000"
    );

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reads the server-owned activation state without sending a proof", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true, enabled: false }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(gardenJoinRequestTransport.availability("https://agent.example")).resolves.toEqual(
      { ok: true, enabled: false }
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.example/public/features/garden-join-requests",
      expect.objectContaining({ headers: {} })
    );
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
