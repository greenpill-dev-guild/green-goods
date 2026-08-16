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
});
