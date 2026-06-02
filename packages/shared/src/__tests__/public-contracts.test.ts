import { describe, expect, it } from "vitest";
import {
  buildPublicFundingAvailabilityKey,
  createProviderProofRegistry,
  createPublicImpactSlice,
  derivePublicGardenSlug,
  PUBLIC_FUNDING_AVAILABILITY_REASON_SEMANTICS,
  resolveFundGardenReference,
  type Address,
} from "../public-contracts";

const gardenA = "0x1111111111111111111111111111111111111111" as Address;
const gardenB = "0x2222222222222222222222222222222222222222" as Address;
const token = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;

const baseAvailabilityInput = {
  gardenKey: gardenA,
  destinationType: "cookieJar" as const,
  destinationAddress: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" as Address,
  fundingIntent: "donate" as const,
  paymentMethod: "card" as const,
  chainId: 11155111,
  token,
  provider: "thirdweb" as const,
};

describe("@green-goods/shared/public-contracts", () => {
  it("builds the canonical normalized availabilityKey v1", () => {
    expect(buildPublicFundingAvailabilityKey(baseAvailabilityInput)).toBe(
      `v1:${gardenA}:cookieJar:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:donate:card:11155111:${token}:thirdweb`
    );
  });

  it("adds route scope to availabilityKey only when a source route is explicit", () => {
    expect(
      buildPublicFundingAvailabilityKey({
        ...baseAvailabilityInput,
        destinationType: "vault",
        fundingIntent: "endow",
        sourceRoute: "/vaults",
      })
    ).toBe(
      `v2:/vaults:${gardenA}:vault:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:endow:card:11155111:${token}:thirdweb`
    );
  });

  it("keeps amount min/max failures out of base availability reason codes", () => {
    expect(Object.keys(PUBLIC_FUNDING_AVAILABILITY_REASON_SEMANTICS)).not.toContain(
      "amount_below_min"
    );
    expect(Object.keys(PUBLIC_FUNDING_AVAILABILITY_REASON_SEMANTICS)).not.toContain(
      "amount_above_max"
    );
  });

  it("keeps absent provider proof hidden by default", () => {
    const registry = createProviderProofRegistry();
    const availability = registry.resolve(baseAvailabilityInput);
    expect(availability.state).toBe("hidden");
    expect(availability.reasonCode).toBe("proof_pending");
  });

  it("requires proofReference before exposing an exact card rail as live", () => {
    expect(() =>
      createProviderProofRegistry([{ ...baseAvailabilityInput, state: "live" }])
    ).toThrow(/proofReference/);

    const registry = createProviderProofRegistry([
      {
        ...baseAvailabilityInput,
        state: "live",
        proofReference: "spike:cookie-jar-donate-sepolia-2026-04-27",
      },
    ]);

    expect(registry.resolve(baseAvailabilityInput).state).toBe("live");
    expect(
      registry.resolve({
        ...baseAvailabilityInput,
        destinationAddress: gardenB,
      }).state
    ).toBe("hidden");
  });

  it("keeps Card Donate proof from unlocking Card Endow", () => {
    const registry = createProviderProofRegistry([
      {
        ...baseAvailabilityInput,
        state: "live",
        proofReference: "spike:cookie-jar-donate-sepolia-2026-04-27",
      },
    ]);

    expect(registry.resolve(baseAvailabilityInput).state).toBe("live");
    expect(
      registry.resolve({
        ...baseAvailabilityInput,
        destinationType: "vault",
        fundingIntent: "endow",
      }).state
    ).toBe("hidden");
  });

  it("keeps /fund and /vaults provider proofs route-local when sourceRoute is explicit", () => {
    const registry = createProviderProofRegistry([
      {
        ...baseAvailabilityInput,
        destinationType: "vault",
        fundingIntent: "endow",
        sourceRoute: "/fund",
        state: "live",
        proofReference: "spike:fund-vault-endow-sepolia-2026-06-02",
      },
    ]);

    expect(
      registry.resolve({
        ...baseAvailabilityInput,
        destinationType: "vault",
        fundingIntent: "endow",
        sourceRoute: "/fund",
      }).state
    ).toBe("live");
    expect(
      registry.resolve({
        ...baseAvailabilityInput,
        destinationType: "vault",
        fundingIntent: "endow",
        sourceRoute: "/vaults",
      }).state
    ).toBe("hidden");
  });

  it("derives slugs with punctuation normalization and address fallback", () => {
    expect(derivePublicGardenSlug("Solar, Community Garden!", gardenA)).toBe(
      "solar-community-garden"
    );
    expect(derivePublicGardenSlug("", gardenA)).toBe(gardenA);
  });

  it("resolves /fund?garden by exact id/address before unique slug", () => {
    const gardens = [
      { id: "garden-alpha", address: gardenA, name: "Duplicate Name" },
      { id: "duplicate-name", address: gardenB, name: "Different Name" },
    ];

    const exact = resolveFundGardenReference("duplicate-name", gardens);
    expect(exact.status).toBe("matched");
    if (exact.status === "matched") {
      expect(exact.matchType).toBe("exact");
      expect(exact.garden.id).toBe("duplicate-name");
    }
  });

  it("falls back on stale references and slug collisions", () => {
    const gardens = [
      { id: "garden-alpha", address: gardenA, name: "Same Name" },
      { id: "garden-beta", address: gardenB, name: "Same Name" },
    ];

    expect(resolveFundGardenReference("missing-garden", gardens)).toMatchObject({
      status: "fallback",
      reason: "not_found",
    });
    expect(resolveFundGardenReference("same-name", gardens)).toMatchObject({
      status: "fallback",
      reason: "ambiguous_slug",
    });
  });

  it("slices /impact records by deterministic garden and evidence caps", () => {
    const gardens = Array.from({ length: 55 }, (_, index) => ({
      id: `garden-${index.toString().padStart(2, "0")}`,
      name: `Garden ${index}`,
      latestActivityAt: 1_000 - index,
    }));
    const records = Array.from({ length: 120 }, (_, index) => ({
      id: `assessment:${index.toString().padStart(3, "0")}`,
      kind: "assessment" as const,
      gardenId: `garden-${(index % 55).toString().padStart(2, "0")}`,
      gardenName: "Garden",
      title: "Assessment",
      sourceAvailable: true,
      createdAt: 2_000 - index,
    }));

    const slice = createPublicImpactSlice({ gardens, records });
    expect(slice.records).toHaveLength(12);
    expect(slice.totalFetchedRecords).toBe(100);
    expect(slice.partialData).toBe(true);
    expect(slice.sourceLimitReached).toBe(true);
  });

  it("preserves the kind discriminator across the slice and respects createdAt order", () => {
    const gardens = [{ id: "garden-mix", name: "Mixed", latestActivityAt: 9_000 }];
    const records = [
      {
        id: "work:1",
        kind: "work" as const,
        gardenId: "garden-mix",
        gardenName: "Mixed",
        title: "Planted hedge",
        media: ["ipfs://photo.jpg"],
        sourceAvailable: true,
        createdAt: 8_000,
      },
      {
        id: "assessment:1",
        kind: "assessment" as const,
        gardenId: "garden-mix",
        gardenName: "Mixed",
        title: "Spring plan",
        sourceAvailable: true,
        createdAt: 9_000,
      },
      {
        id: "certificate:1",
        kind: "certificate" as const,
        gardenId: "garden-mix",
        gardenName: "Mixed",
        title: "Vol. 01 Certificate",
        media: ["ipfs://cert.png"],
        hypercertId: "1",
        sourceAvailable: true,
        createdAt: 7_500,
      },
    ];

    const slice = createPublicImpactSlice({ gardens, records });
    // The slice sorts by `createdAt desc`, so the order is by timestamp
    // (assessment 9000 > work 8000 > certificate 7500) regardless of kind.
    const kinds = slice.records.map((record) => record.kind);
    expect(kinds).toEqual(["assessment", "work", "certificate"]);
    expect(slice.records[1]?.media).toEqual(["ipfs://photo.jpg"]);
    expect(slice.records[2]?.hypercertId).toBe("1");
  });
});
