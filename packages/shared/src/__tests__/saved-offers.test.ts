import { describe, expect, it, vi } from "vitest";
import {
  buildSavedOffersSessionMessage,
  canonicalSavedOfferPayload,
  createSavedOffersApi,
  createSavedOffersSessionApi,
  savedOfferPersistenceAfterFailure,
  validateSavedOfferPayload,
  validateSavedOffersSessionRequest,
  type SavedOfferPayloadV1,
} from "../public-contracts/saved-offers";

const OWNER = "0x1234567890abcdef1234567890abcdef12345678";
const OFFER: SavedOfferPayloadV1 = {
  schemaVersion: 1,
  savedOfferId: "0191f2a0-1d5e-7c41-8f45-5ee9120ec012",
  title: "Build a rain garden",
  description: "Design and help install one neighborhood rain garden.",
  commitmentKind: "DomainImpact",
  unitLabel: "gardens",
  targetUnits: "1",
  claimMode: "ApprovalGated",
  domainTags: ["water", "soil"],
  requirements: [{ actionId: "12", requiredCount: 1 }],
  seriesLinks: [
    {
      chainId: 42161,
      moduleAddress: "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a",
      poolId: "9",
      commitmentSeriesId: "10",
    },
  ],
};

describe("saved offer shared protocol", () => {
  it("validates and round-trips the exact module-scoped series tuple", () => {
    expect(validateSavedOfferPayload(OFFER)).toEqual({ ok: true, value: OFFER });
    expect(canonicalSavedOfferPayload(OFFER)).toBe(JSON.stringify(OFFER));
  });

  it("rejects normalized duplicates, excess requirements, and excess full-tuple links", () => {
    expect(validateSavedOfferPayload({ ...OFFER, domainTags: ["Water", "water"] }).ok).toBe(false);
    expect(
      validateSavedOfferPayload({
        ...OFFER,
        requirements: Array.from({ length: 41 }, (_, index) => ({
          actionId: String(index + 1),
          requiredCount: 1,
        })),
      }).ok
    ).toBe(false);
    expect(
      validateSavedOfferPayload({
        ...OFFER,
        seriesLinks: Array.from({ length: 33 }, (_, index) => ({
          ...OFFER.seriesLinks[0],
          commitmentSeriesId: String(index + 1),
        })),
      }).ok
    ).toBe(false);
  });

  it.each([
    ["unknown payload fields", { ...OFFER, extra: true }],
    ["schema version drift", { ...OFFER, schemaVersion: 2 }],
    ["non-canonical UUIDs", { ...OFFER, savedOfferId: "not-a-uuid" }],
    ["empty titles", { ...OFFER, title: "" }],
    ["untrimmed descriptions", { ...OFFER, description: " trailing " }],
    ["unknown commitment kinds", { ...OFFER, commitmentKind: "Other" }],
    ["empty unit labels", { ...OFFER, unitLabel: "" }],
    ["non-canonical uint text", { ...OFFER, targetUnits: "01" }],
    ["uint256 overflow", { ...OFFER, targetUnits: (1n << 256n).toString() }],
    ["unknown claim modes", { ...OFFER, claimMode: "Private" }],
    ["non-array domain tags", { ...OFFER, domainTags: "water" }],
    ["empty domain tags", { ...OFFER, domainTags: [""] }],
    ["non-array requirements", { ...OFFER, requirements: null }],
    [
      "extra requirement fields",
      { ...OFFER, requirements: [{ actionId: "1", requiredCount: 1, extra: true }] },
    ],
    ["zero requirement counts", { ...OFFER, requirements: [{ actionId: "1", requiredCount: 0 }] }],
    [
      "non-canonical requirement notes",
      { ...OFFER, requirements: [{ actionId: "1", requiredCount: 1, note: " note " }] },
    ],
    ["non-array series links", { ...OFFER, seriesLinks: null }],
    [
      "mixed-case module addresses",
      {
        ...OFFER,
        seriesLinks: [
          { ...OFFER.seriesLinks[0], moduleAddress: "0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a" },
        ],
      },
    ],
    [
      "non-positive chain ids",
      { ...OFFER, seriesLinks: [{ ...OFFER.seriesLinks[0], chainId: 0 }] },
    ],
    [
      "duplicate series identities",
      { ...OFFER, seriesLinks: [OFFER.seriesLinks[0], OFFER.seriesLinks[0]] },
    ],
  ])("rejects %s at the shared API boundary", (_label, candidate) => {
    expect(validateSavedOfferPayload(candidate)).toMatchObject({
      ok: false,
      error: { errorCode: "invalid_request" },
    });
  });

  it("builds a deterministic owner-bound session message", () => {
    expect(
      buildSavedOffersSessionMessage({
        version: 1,
        chainId: 42161,
        owner: OWNER,
        nonce: "abc123",
        audience: "agent.greengoods.app",
        issuedAt: 1_753_777_600,
      })
    ).toContain(
      "Green Goods Saved Offers Session\nVersion: 1\nChain ID: 42161\nOwner: 0x1234567890abcdef1234567890abcdef12345678"
    );
  });

  it("rejects odd-length signature and counterfactual calldata hex", () => {
    const base = {
      chainId: 42161,
      owner: OWNER,
      nonce: "abc123",
      issuedAt: 1_753_777_600,
      signature: "0x1234",
    };
    expect(validateSavedOffersSessionRequest({ ...base, signature: "0x123" }).ok).toBe(false);
    expect(
      validateSavedOffersSessionRequest({
        ...base,
        factory: OWNER,
        factoryData: "0x123",
      }).ok
    ).toBe(false);
  });

  it("uses owner-scoped bearer calls and never claims Saved after an unavailable response", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, records: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, errorCode: "provider_unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        })
      );
    const api = createSavedOffersApi({
      baseUrl: "https://agent.example",
      token: "secret",
      fetch: fetcher,
    });
    await expect(api.list()).resolves.toEqual([]);
    await expect(api.put(OFFER.savedOfferId, OFFER, 0)).rejects.toMatchObject({
      errorCode: "provider_unavailable",
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://agent.example/public/saved-offers");
    expect((fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>).authorization).toBe(
      "Bearer secret"
    );
    expect(
      savedOfferPersistenceAfterFailure({ online: true, errorCode: "provider_unavailable" })
    ).toBe("SAVE_FAILED");
    expect(savedOfferPersistenceAfterFailure({ online: false })).toBe("OFFLINE_LOCAL");
  });

  it("validates writes before transport and maps abort and non-JSON HTTP failures", async () => {
    const neverCalled = vi.fn<typeof fetch>();
    const validatingApi = createSavedOffersApi({
      baseUrl: "https://agent.example",
      token: "secret",
      fetch: neverCalled,
    });
    await expect(
      validatingApi.put(OFFER.savedOfferId, { ...OFFER, title: " invalid " }, 0)
    ).rejects.toMatchObject({ errorCode: "invalid_request" });
    expect(neverCalled).not.toHaveBeenCalled();

    const aborted = createSavedOffersApi({
      baseUrl: "https://agent.example",
      token: "secret",
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new DOMException("aborted", "AbortError")),
    });
    await expect(aborted.list()).rejects.toMatchObject({ errorCode: "provider_unavailable" });

    const unauthenticated = createSavedOffersApi({
      baseUrl: "https://agent.example",
      token: "expired",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("not json", { status: 401 })),
    });
    await expect(unauthenticated.get(OFFER.savedOfferId)).rejects.toMatchObject({
      errorCode: "authentication_required",
    });
  });

  it("preserves structured conflicts and encodes record identity and version bodies", async () => {
    const record = {
      savedOfferId: OFFER.savedOfferId,
      payload: OFFER,
      version: 2,
      updatedAt: "2026-08-16T00:00:00.000Z",
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, record }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, record }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, version: 3 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            errorCode: "version_conflict",
            message: "stale version",
            currentVersion: 3,
          }),
          { status: 409, headers: { "content-type": "application/json" } }
        )
      );
    const api = createSavedOffersApi({
      baseUrl: "https://agent.example/",
      token: "secret",
      fetch: fetcher,
    });

    await expect(api.get("offer/with spaces")).resolves.toEqual(record);
    await expect(api.put(OFFER.savedOfferId, OFFER, 1)).resolves.toEqual(record);
    await expect(api.delete(OFFER.savedOfferId, 2)).resolves.toBe(3);
    await expect(api.delete(OFFER.savedOfferId, 2)).rejects.toMatchObject({
      errorCode: "version_conflict",
      currentVersion: 3,
    });

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://agent.example/public/saved-offers/offer%2Fwith%20spaces"
    );
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ payload: OFFER, expectedVersion: 1 }),
    });
    expect(fetcher.mock.calls[2]?.[1]).toMatchObject({
      method: "DELETE",
      body: JSON.stringify({ expectedVersion: 2 }),
    });
  });

  it("uses the canonical challenge and session routes without putting an owner in read URLs", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, nonce: "abc123", audience: "agent.example", expiresAt: 2 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, token: "f".repeat(64), expiresAt: 3 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    const api = createSavedOffersSessionApi({ baseUrl: "https://agent.example/", fetch: fetcher });
    await api.challenge({ chainId: 42161, owner: OWNER });
    await api.createSession({
      chainId: 42161,
      owner: OWNER,
      nonce: "abc123",
      issuedAt: 1,
      signature: "0x1234",
    });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://agent.example/public/saved-offers/session/challenge",
      "https://agent.example/public/saved-offers/session",
    ]);
  });

  it("rejects malformed challenge and session requests before transport", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const api = createSavedOffersSessionApi({ baseUrl: "https://agent.example", fetch: fetcher });

    await expect(api.challenge({ chainId: 0, owner: OWNER })).rejects.toMatchObject({
      errorCode: "invalid_request",
    });
    await expect(
      api.createSession({
        chainId: 42161,
        owner: OWNER,
        nonce: "short",
        issuedAt: 1,
        signature: "0x1234",
      })
    ).rejects.toMatchObject({ errorCode: "invalid_request" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("strips long trailing-slash inputs in linear time for both API clients", async () => {
    const baseUrl = `https://agent.example${"/".repeat(50_000)}`;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, records: [], nonce: "abc123", expiresAt: 2 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await createSavedOffersApi({ baseUrl, token: "secret", fetch: fetcher }).list();
    await createSavedOffersSessionApi({ baseUrl, fetch: fetcher }).challenge({
      chainId: 42161,
      owner: OWNER,
    });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://agent.example/public/saved-offers",
      "https://agent.example/public/saved-offers/session/challenge",
    ]);
  });
});
