// TEST-QUALITY: allow-small-test-file - no other file covers the funder row; these two cases pin its one detail for a funder in one asset and in several, where the leaderboard has no single yield.
import { describe, expect, it, vi } from "vitest";
import type { FunderLeaderboardEntry } from "@green-goods/shared/types/vaults";
import { renderWithProviders, screen } from "@/__tests__/test-utils";
import { FunderRow } from "@/components/Vault/FunderRow";

// The row's name and photo come from lookups this test does not need: nobody here has either.
vi.mock("@green-goods/shared/hooks/profile/useProfileAvatar", async (importOriginal) => ({
  ...(await importOriginal()),
  useResolvedProfileAvatar: () => ({ avatarUri: null, isLoading: false }),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));

const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

function funder(assets: string[]): FunderLeaderboardEntry {
  const assetTotals = assets.map((asset) => ({
    chainId: 42161,
    asset: asset as FunderLeaderboardEntry["address"],
    totalYieldGenerated: 2_000_000_000_000_000_000n,
    totalNetDeposited: 10_000_000_000_000_000_000n,
    totalCurrentValue: 12_000_000_000_000_000_000n,
  }));
  return {
    address: "0x1111111111111111111111111111111111111111",
    // The leaderboard adds yields only within one asset; across several it has none.
    totalYieldGenerated: assets.length === 1 ? assetTotals[0].totalYieldGenerated : 0n,
    totalNetDeposited: 0n,
    totalCurrentValue: 0n,
    gardenCount: 3,
    gardenAddresses: [],
    positions: [],
    assetTotals,
  };
}

describe("FunderRow", () => {
  it("counts a one-asset funder's yield", () => {
    renderWithProviders(<FunderRow funder={funder([DAI])} />);
    expect(screen.getByText(/^\+2(\.0+)? total yield$/)).toBeInTheDocument();
  });

  it("counts the gardens of a funder in several assets, never a zero yield", () => {
    renderWithProviders(<FunderRow funder={funder([DAI, WETH])} />);
    expect(screen.getByText("3 gardens supported")).toBeInTheDocument();
    expect(screen.queryByText(/total yield/)).not.toBeInTheDocument();
  });
});
