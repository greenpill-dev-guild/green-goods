import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIndexerQuery = vi.fn();

vi.mock("../../../modules/data/graphql-client", () => ({
  greenGoodsIndexer: {
    query: (...args: unknown[]) => mockIndexerQuery(...args),
  },
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  getGreenWillBadgeDefinitions,
  getGreenWillBadgesByOwner,
  getGreenWillRecentGrants,
} from "../../../modules/data/greenwill";
import { logger } from "../../../modules/app/logger";

const TEST_CHAIN_ID = 42161;
const TEST_OWNER = "0xABcDEFabcdefABCDEFabcdefAbcdefABcDefABCD" as Address;
const TEST_ISSUER = "0x1111111111111111111111111111111111111111" as Address;
const TEST_LOCK = "0x2222222222222222222222222222222222222222" as Address;
const TEST_VALIDATOR = "0x3333333333333333333333333333333333333333" as Address;
const TEST_TX_HASH =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const GENESIS_BADGE_ID =
  "0x5caeb56e5079d78d65e7255ef2250acddb4eaeff124f4dbd0d41fd52e6d7f3d8" as const;

describe("modules/data/greenwill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps badge definitions from the indexer response", async () => {
    mockIndexerQuery.mockResolvedValueOnce({
      data: {
        GreenWillBadgeDefinition: [
          {
            id: "42161:genesis",
            chainId: TEST_CHAIN_ID,
            badgeId: GENESIS_BADGE_ID,
            slug: "genesis",
            metadataURI: "ipfs://genesis",
            validator: TEST_VALIDATOR.toUpperCase(),
            authorizedIssuer: TEST_ISSUER.toUpperCase(),
            unlockLock: TEST_LOCK.toUpperCase(),
            claimable: true,
            active: true,
            holderCount: 7,
            grantCount: "9",
            updatedAt: 1710000000,
          },
        ],
      },
    });

    const result = await getGreenWillBadgeDefinitions(TEST_CHAIN_ID);

    expect(mockIndexerQuery).toHaveBeenCalledWith(
      expect.stringContaining("GreenWillBadgeDefinition"),
      { chainId: TEST_CHAIN_ID },
      "getGreenWillBadgeDefinitions"
    );
    expect(result).toEqual([
      {
        id: "42161:genesis",
        chainId: TEST_CHAIN_ID,
        badgeId: GENESIS_BADGE_ID,
        slug: "genesis",
        metadataURI: "ipfs://genesis",
        validator: TEST_VALIDATOR.toLowerCase(),
        authorizedIssuer: TEST_ISSUER.toLowerCase(),
        unlockLock: TEST_LOCK.toLowerCase(),
        claimable: true,
        active: true,
        holderCount: 7,
        grantCount: 9,
        updatedAt: 1710000000,
      },
    ]);
  });

  it("maps badge ownership for a specific owner", async () => {
    mockIndexerQuery.mockResolvedValueOnce({
      data: {
        GreenWillBadgeOwnership: [
          {
            id: "42161:genesis:owner",
            chainId: TEST_CHAIN_ID,
            badgeId: GENESIS_BADGE_ID,
            owner: TEST_OWNER,
            sourceRef:
              "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            issuer: TEST_ISSUER.toUpperCase(),
            unlockTokenId: "1",
            issuedAt: 1710000010,
            definitionId: "42161:genesis",
            lastGrantId: "grant-1",
          },
        ],
      },
    });

    const result = await getGreenWillBadgesByOwner(TEST_OWNER, TEST_CHAIN_ID);

    expect(mockIndexerQuery).toHaveBeenCalledWith(
      expect.stringContaining("GreenWillBadgeOwnership"),
      { chainId: TEST_CHAIN_ID, owner: TEST_OWNER.toLowerCase() },
      "getGreenWillBadgesByOwner"
    );
    expect(result).toEqual([
      {
        id: "42161:genesis:owner",
        chainId: TEST_CHAIN_ID,
        badgeId: GENESIS_BADGE_ID,
        owner: TEST_OWNER.toLowerCase(),
        sourceRef:
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        issuer: TEST_ISSUER.toLowerCase(),
        unlockTokenId: 1n,
        issuedAt: 1710000010,
        definitionId: "42161:genesis",
        lastGrantId: "grant-1",
      },
    ]);
  });

  it("maps recent grants from the indexer response", async () => {
    mockIndexerQuery.mockResolvedValueOnce({
      data: {
        GreenWillBadgeGrant: [
          {
            id: "grant-1",
            chainId: TEST_CHAIN_ID,
            badgeId: GENESIS_BADGE_ID,
            owner: TEST_OWNER.toUpperCase(),
            sourceRef:
              "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            issuer: TEST_ISSUER.toUpperCase(),
            unlockTokenId: "1",
            txHash: TEST_TX_HASH,
            timestamp: 1710000020,
          },
        ],
      },
    });

    const result = await getGreenWillRecentGrants(TEST_CHAIN_ID, 5);

    expect(mockIndexerQuery).toHaveBeenCalledWith(
      expect.stringContaining("GreenWillBadgeGrant"),
      { chainId: TEST_CHAIN_ID, limit: 5 },
      "getGreenWillRecentGrants"
    );
    expect(result).toEqual([
      {
        id: "grant-1",
        chainId: TEST_CHAIN_ID,
        badgeId: GENESIS_BADGE_ID,
        owner: TEST_OWNER.toLowerCase(),
        sourceRef:
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        issuer: TEST_ISSUER.toLowerCase(),
        unlockTokenId: 1n,
        txHash: TEST_TX_HASH,
        timestamp: 1710000020,
      },
    ]);
  });

  it("throws a descriptive error when the indexer query fails", async () => {
    mockIndexerQuery.mockResolvedValueOnce({
      error: new Error("indexer offline"),
    });

    await expect(getGreenWillBadgeDefinitions(TEST_CHAIN_ID)).rejects.toThrow(
      "Failed to load GreenWill badge definitions: indexer offline"
    );
    expect(logger.error).toHaveBeenCalledWith(
      "[getGreenWillBadgeDefinitions] Indexer query failed",
      expect.objectContaining({ chainId: TEST_CHAIN_ID, error: "indexer offline" })
    );
  });
});
