import type { Address } from "@green-goods/shared/types/domain";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/__tests__/test-utils";

// The card looks up ENS names for its two addresses, which these cases are not about.
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));

import { GardenMetadata, getOpenSeaUrl } from "@/components/Garden/GardenMetadata";

const GARDEN_ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN_TOKEN = "0x2222222222222222222222222222222222222222" as Address;
const ARBITRUM_ITEM_URL = `https://opensea.io/item/arbitrum/${GARDEN_TOKEN}/12`;

describe("getOpenSeaUrl", () => {
  it.each([
    [42161, ARBITRUM_ITEM_URL],
    [1, `https://opensea.io/item/ethereum/${GARDEN_TOKEN}/12`],
  ])("links chain %i to the item page on the main OpenSea site", (chainId, url) => {
    expect(getOpenSeaUrl(chainId, GARDEN_TOKEN, 12n)).toBe(url);
  });

  it.each([
    ["Sepolia, a testnet", 11155111],
    ["Celo, which OpenSea does not list", 42220],
    ["a chain the app does not support", 10],
  ])("gives no link for %s", (_chain, chainId) => {
    expect(getOpenSeaUrl(chainId, GARDEN_TOKEN, 12n)).toBeNull();
  });
});

describe("GardenMetadata external links", () => {
  function renderMetadata(chainId: number) {
    return renderWithProviders(
      <GardenMetadata
        gardenId={GARDEN_ACCOUNT}
        tokenAddress={GARDEN_TOKEN}
        tokenId={12n}
        chainId={chainId}
      />
    );
  }

  it("links an Arbitrum garden to its token on OpenSea", () => {
    renderMetadata(42161);

    expect(screen.getByRole("link", { name: "OpenSea" })).toHaveAttribute(
      "href",
      ARBITRUM_ITEM_URL
    );
  });

  it("leaves OpenSea out for a Sepolia garden and keeps the explorer link", () => {
    renderMetadata(11155111);

    expect(screen.queryByRole("link", { name: "OpenSea" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Token Contract" })).toBeInTheDocument();
  });

  it("drops the External Links heading on a chain with no explorer and no OpenSea page", () => {
    renderMetadata(31337);

    expect(screen.queryByText("External Links")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
