import { describe, expect, it, vi } from "vitest";
import {
  createHypercertRepository,
  type HypercertRepositoryDependencies,
} from "../modules/data/hypercerts-repository";
import type { HypercertRecord } from "../types/hypercerts";

const indexedRecord: HypercertRecord = {
  id: "42161-7",
  tokenId: 7n,
  gardenId: "0x2222222222222222222222222222222222222222",
  metadataUri: "bafy-metadata",
  mintedAt: 10,
  mintedBy: "0x1111111111111111111111111111111111111111",
  txHash: "0x01",
  totalUnits: 100n,
  claimedUnits: 0n,
  attestationCount: 1,
  attestationUIDs: ["0xwork"],
  status: "active",
  allowlistEntries: [],
};

function repository(overrides: Partial<HypercertRepositoryDependencies> = {}) {
  const dependencies: HypercertRepositoryDependencies = {
    sdk: { getHypercert: vi.fn().mockResolvedValue(null) },
    indexer: {
      getGardenHypercerts: vi.fn().mockResolvedValue([]),
      getHypercertById: vi.fn().mockResolvedValue(null),
      getHypercertClaims: vi.fn().mockResolvedValue([]),
    },
    eas: {
      getApprovedAttestations: vi.fn().mockResolvedValue([]),
      getAttestationsByUIDs: vi.fn().mockResolvedValue([]),
    },
    documents: { readJson: vi.fn() },
    ...overrides,
  };
  return { dependencies, repository: createHypercertRepository(dependencies) };
}

describe("HypercertRepository", () => {
  it("routes list reads through the injected indexer", async () => {
    const getGardenHypercerts = vi.fn().mockResolvedValue([indexedRecord]);
    const { repository: subject } = repository({
      indexer: {
        getGardenHypercerts,
        getHypercertById: vi.fn().mockResolvedValue(null),
        getHypercertClaims: vi.fn().mockResolvedValue([]),
      },
    });

    await expect(subject.getGardenHypercerts(indexedRecord.gardenId, 42161)).resolves.toEqual([
      indexedRecord,
    ]);
    expect(getGardenHypercerts).toHaveBeenCalledWith(
      indexedRecord.gardenId,
      42161,
      undefined,
      undefined
    );
  });

  it("falls back from an indexer miss to the injected SDK", async () => {
    const getHypercert = vi.fn().mockResolvedValue({
      id: "42161-8",
      tokenId: 8n,
      title: "SDK result",
    });
    const { repository: subject } = repository({ sdk: { getHypercert } });

    await expect(subject.getHypercertById("42161-8")).resolves.toMatchObject({
      id: "42161-8",
      tokenId: 8n,
      title: "SDK result",
      status: "active",
    });
    expect(getHypercert).toHaveBeenCalledWith("42161-8");
  });

  it("hydrates through SDK and document ports with SDK precedence", async () => {
    const getHypercert = vi.fn().mockResolvedValue({ title: "Canonical SDK title" });
    const readJson = vi.fn().mockResolvedValue({
      name: "Document title",
      description: "Document description",
    });
    const { repository: subject } = repository({
      sdk: { getHypercert },
      documents: { readJson },
    });

    await expect(
      subject.hydrateHypercertMetadata("42161-7", "bafy-metadata", 42161)
    ).resolves.toMatchObject({
      title: "Canonical SDK title",
      description: "Document description",
    });
    expect(readJson).toHaveBeenCalledWith("bafy-metadata");
  });

  it("routes attestation reads through the injected EAS port", async () => {
    const getAttestationsByUIDs = vi.fn().mockResolvedValue([]);
    const { repository: subject } = repository({
      eas: {
        getApprovedAttestations: vi.fn().mockResolvedValue([]),
        getAttestationsByUIDs,
      },
    });

    await subject.getAttestationsByUIDs(["0xwork"]);
    expect(getAttestationsByUIDs).toHaveBeenCalledWith(["0xwork"]);
  });
});
