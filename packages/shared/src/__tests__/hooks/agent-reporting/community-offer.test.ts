/**
 * Who the link page invites to the Community Garden. The rule is about that garden alone: it is
 * open to join and the chain does not count the account as a gardener there yet. What other
 * gardens the account is in does not matter.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const COMMUNITY = "0x00000000000000000000000000000000000000c9";
const ACCOUNT = "0x00000000000000000000000000000000000000a1";
const OFFER = { address: COMMUNITY, name: "Community Garden", chainId: 42161 };

const mocks = vi.hoisted(() => ({
  getGarden: vi.fn(),
  readContract: vi.fn(),
}));

vi.mock("@wagmi/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@wagmi/core")>()),
  readContract: mocks.readContract,
}));
vi.mock("../../../config/appkit", () => ({ getWagmiConfig: () => ({ mocked: true }) }));
vi.mock("../../../config/blockchain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/blockchain")>()),
  getDefaultChain: () => ({ chainId: 42161, rootGarden: { address: COMMUNITY, tokenId: 1 } }),
}));
vi.mock("../../../modules/data/indexer-garden", () => ({ getGarden: mocks.getGarden }));

const { readCommunityOffer } = await import("../../../hooks/agent-reporting/community-offer");

describe("the Community Garden invitation", () => {
  beforeEach(() => {
    mocks.getGarden.mockReset().mockResolvedValue({ name: "Community Garden", openJoining: true });
    mocks.readContract.mockReset().mockResolvedValue(false);
  });

  it("is offered to an account the chain does not count as a gardener there", async () => {
    await expect(readCommunityOffer(ACCOUNT)).resolves.toEqual(OFFER);
    // The garden is read on its own, so it is found however many newer gardens exist.
    expect(mocks.getGarden).toHaveBeenCalledWith(COMMUNITY);
    expect(mocks.readContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ address: COMMUNITY, functionName: "isGardener", args: [ACCOUNT] })
    );
  });

  it("is not offered to an account that is already a gardener there", async () => {
    mocks.readContract.mockResolvedValue(true);
    await expect(readCommunityOffer(ACCOUNT)).resolves.toBeNull();
  });

  it("is not offered when the garden is closed to joining or has no record", async () => {
    mocks.getGarden.mockResolvedValue({ name: "Community Garden", openJoining: false });
    await expect(readCommunityOffer(ACCOUNT)).resolves.toBeNull();
    mocks.getGarden.mockResolvedValue(null);
    await expect(readCommunityOffer(ACCOUNT)).resolves.toBeNull();
    expect(mocks.readContract).not.toHaveBeenCalled();
  });

  it("is not offered when either read fails, so linking is never held up", async () => {
    mocks.getGarden.mockRejectedValue(new Error("indexer unavailable"));
    await expect(readCommunityOffer(ACCOUNT)).resolves.toBeNull();
    mocks.getGarden.mockResolvedValue({ name: "Community Garden", openJoining: true });
    mocks.readContract.mockRejectedValue(new Error("rpc unavailable"));
    await expect(readCommunityOffer(ACCOUNT)).resolves.toBeNull();
  });
});
