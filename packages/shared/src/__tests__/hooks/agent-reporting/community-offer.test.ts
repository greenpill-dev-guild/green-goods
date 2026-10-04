/**
 * Who the link page invites to the Community Garden: an account the chain would let join it now.
 * What other gardens the account is in does not matter, and the indexer only names the garden.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const COMMUNITY = "0x00000000000000000000000000000000000000c9";
const ACCOUNT = "0x00000000000000000000000000000000000000a1";
const OFFER = { address: COMMUNITY, name: "Community Garden", chainId: 42161 };

const mocks = vi.hoisted(() => ({
  getGarden: vi.fn(),
  simulateJoinGarden: vi.fn(),
}));

vi.mock("../../../config/blockchain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/blockchain")>()),
  getDefaultChain: () => ({ chainId: 42161, rootGarden: { address: COMMUNITY, tokenId: 1 } }),
}));
vi.mock("../../../modules/data/indexer-garden", () => ({ getGarden: mocks.getGarden }));
vi.mock("../../../utils/blockchain/simulation", () => ({
  simulateJoinGarden: mocks.simulateJoinGarden,
}));

const { readCommunityOffer } = await import("../../../hooks/agent-reporting/community-offer");

describe("the Community Garden invitation", () => {
  beforeEach(() => {
    mocks.getGarden.mockReset().mockResolvedValue({ name: "Community Garden" });
    mocks.simulateJoinGarden.mockReset().mockResolvedValue({ success: true });
  });

  it("is offered to an account whose join the chain would accept", async () => {
    await expect(readCommunityOffer(ACCOUNT)).resolves.toEqual(OFFER);
    // The garden is read on its own, so it is found however many newer gardens exist.
    expect(mocks.getGarden).toHaveBeenCalledWith(COMMUNITY);
    expect(mocks.simulateJoinGarden).toHaveBeenCalledWith(COMMUNITY, ACCOUNT, undefined, 42161);
  });

  it("is not offered when the chain would refuse the join: closed, full or already in", async () => {
    mocks.simulateJoinGarden.mockResolvedValue({ success: false });
    await expect(readCommunityOffer(ACCOUNT)).resolves.toBeNull();
  });

  it("is not offered when the indexer has no record to name the garden by", async () => {
    mocks.getGarden.mockResolvedValue(null);
    await expect(readCommunityOffer(ACCOUNT)).resolves.toBeNull();
  });

  it("is not offered when a read fails, so linking is never held up", async () => {
    mocks.getGarden.mockRejectedValue(new Error("indexer unavailable"));
    await expect(readCommunityOffer(ACCOUNT)).resolves.toBeNull();
  });
});
