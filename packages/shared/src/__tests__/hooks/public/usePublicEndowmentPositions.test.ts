import { describe, expect, it } from "vitest";

import {
  buildPublicEndowmentPortfolio,
  type PublicEndowmentInput,
} from "../../../hooks/public/usePublicEndowmentPositions";

const SOLAR_GARDEN = "0x1111111111111111111111111111111111111111" as const;
const COMPOST_GARDEN = "0x2222222222222222222222222222222222222222" as const;
const UNKNOWN_GARDEN = "0x3333333333333333333333333333333333333333" as const;
const DAI = "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1" as const;
const WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1" as const;

function buildInput(overrides: Partial<PublicEndowmentInput> = {}): PublicEndowmentInput {
  return {
    deposits: [],
    gardens: [
      {
        id: SOLAR_GARDEN,
        address: SOLAR_GARDEN,
        name: "Solar Community Garden",
        slug: "solar-community-garden",
        location: "Austin, TX",
        bannerImage: "",
        description: "",
        lastActivityAt: 1700000000,
        actionCount: 0,
        contributorCount: 0,
        operators: [],
        evaluators: [],
      },
      {
        id: COMPOST_GARDEN,
        address: COMPOST_GARDEN,
        name: "Urban Composting Hub",
        slug: "urban-composting-hub",
        location: "Portland, OR",
        bannerImage: "",
        description: "",
        lastActivityAt: 1700000000,
        actionCount: 0,
        contributorCount: 0,
        operators: [],
        evaluators: [],
      },
    ],
    vaults: [
      {
        id: "solar-dai",
        chainId: 42161,
        garden: SOLAR_GARDEN,
        asset: DAI,
        vaultAddress: "0x4444444444444444444444444444444444444444",
        totalDeposited: 10_000000000000000000n,
        totalWithdrawn: 0n,
        totalHarvestCount: 0,
        donationAddress: null,
        depositorCount: 3,
        paused: false,
        createdAt: 1700000000,
      },
      {
        id: "compost-weth",
        chainId: 42161,
        garden: COMPOST_GARDEN,
        asset: WETH,
        vaultAddress: "0x5555555555555555555555555555555555555555",
        totalDeposited: 5_000000000000000000n,
        totalWithdrawn: 0n,
        totalHarvestCount: 0,
        donationAddress: null,
        depositorCount: 2,
        paused: false,
        createdAt: 1700000000,
      },
    ],
    ...overrides,
  };
}

describe("buildPublicEndowmentPortfolio", () => {
  it("returns an empty portfolio when there are no active positions", () => {
    const portfolio = buildPublicEndowmentPortfolio(buildInput());

    expect(portfolio.hasPositions).toBe(false);
    expect(portfolio.positions).toEqual([]);
    expect(portfolio.gardenGroups).toEqual([]);
    expect(portfolio.assetTotals).toEqual([]);
    expect(portfolio.gardenCount).toBe(0);
  });

  it("composes one position with Garden and vault metadata", () => {
    const portfolio = buildPublicEndowmentPortfolio(
      buildInput({
        deposits: [
          {
            id: "deposit-1",
            chainId: 42161,
            garden: SOLAR_GARDEN,
            asset: DAI,
            vaultAddress: "0x4444444444444444444444444444444444444444",
            depositor: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            shares: 8_000000000000000000n,
            totalDeposited: 10_000000000000000000n,
            totalWithdrawn: 2_000000000000000000n,
          },
        ],
      })
    );

    expect(portfolio.hasPositions).toBe(true);
    expect(portfolio.gardenCount).toBe(1);
    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.positions[0]).toMatchObject({
      id: "deposit-1",
      gardenAddress: SOLAR_GARDEN,
      gardenName: "Solar Community Garden",
      gardenLocation: "Austin, TX",
      asset: DAI,
      assetSymbol: "DAI",
      decimals: 18,
      hasGardenMetadata: true,
      hasVaultMetadata: true,
      totalEndowed: 10_000000000000000000n,
      netEndowed: 8_000000000000000000n,
      shares: 8_000000000000000000n,
    });
    expect(portfolio.assetTotals).toEqual([
      expect.objectContaining({
        asset: DAI,
        assetSymbol: "DAI",
        totalEndowed: 10_000000000000000000n,
        netEndowed: 8_000000000000000000n,
        positionCount: 1,
      }),
    ]);
  });

  it("groups multi-Garden positions by Garden and asset", () => {
    const portfolio = buildPublicEndowmentPortfolio(
      buildInput({
        deposits: [
          {
            id: "deposit-1",
            chainId: 42161,
            garden: SOLAR_GARDEN,
            asset: DAI,
            vaultAddress: "0x4444444444444444444444444444444444444444",
            depositor: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            shares: 8_000000000000000000n,
            totalDeposited: 10_000000000000000000n,
            totalWithdrawn: 2_000000000000000000n,
          },
          {
            id: "deposit-2",
            chainId: 42161,
            garden: COMPOST_GARDEN,
            asset: WETH,
            vaultAddress: "0x5555555555555555555555555555555555555555",
            depositor: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            shares: 4_000000000000000000n,
            totalDeposited: 5_000000000000000000n,
            totalWithdrawn: 1_000000000000000000n,
          },
        ],
      })
    );

    expect(portfolio.gardenGroups.map((group) => group.gardenName)).toEqual([
      "Solar Community Garden",
      "Urban Composting Hub",
    ]);
    expect(portfolio.assetTotals.map((total) => [total.assetSymbol, total.totalEndowed])).toEqual([
      ["DAI", 10_000000000000000000n],
      ["WETH", 5_000000000000000000n],
    ]);
  });

  it("keeps positions visible when Garden or vault metadata is missing", () => {
    const portfolio = buildPublicEndowmentPortfolio(
      buildInput({
        deposits: [
          {
            id: "deposit-missing",
            chainId: 42161,
            garden: UNKNOWN_GARDEN,
            asset: DAI,
            vaultAddress: "0x6666666666666666666666666666666666666666",
            depositor: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            shares: 3_000000000000000000n,
            totalDeposited: 3_000000000000000000n,
            totalWithdrawn: 0n,
          },
        ],
      })
    );

    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.positions[0]).toMatchObject({
      gardenAddress: UNKNOWN_GARDEN,
      gardenName: "Garden 0x3333…3333",
      gardenLocation: "",
      assetSymbol: "DAI",
      hasGardenMetadata: false,
      hasVaultMetadata: false,
    });
  });
});
