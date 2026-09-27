/**
 * garden-role-reads Tests
 *
 * Grant decisions must use exact hat membership (the HatsModule `is*Of` views,
 * the test `grantRole` itself uses), never the garden account's permission
 * views: those count a steward as a gardener, so a guard built on them would
 * skip re-granting a revoked gardener hat.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadContract = vi.fn();
vi.mock("@wagmi/core", () => ({
  readContract: (_config: unknown, args: unknown) => mockReadContract(args),
}));

vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

const mockFetchHatsModuleAddress = vi.fn();
vi.mock("../../../utils/blockchain/garden-hats", () => ({
  fetchHatsModuleAddress: (...args: unknown[]) => mockFetchHatsModuleAddress(...args),
}));

import {
  readGardenMembership,
  readGardenRoleHat,
} from "../../../utils/blockchain/garden-role-reads";

const GARDEN = "0x1111111111111111111111111111111111111111";
const ACCOUNT = "0x2222222222222222222222222222222222222222";
const HATS_MODULE = "0x3333333333333333333333333333333333333333";
const CHAIN_ID = 42161;

describe("utils/blockchain/garden-role-reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadContract.mockResolvedValue(false);
    mockFetchHatsModuleAddress.mockResolvedValue(HATS_MODULE);
  });

  it("reads the exact hat from the garden's HatsModule, not the garden account", async () => {
    mockReadContract.mockResolvedValue(true);

    await expect(readGardenRoleHat(GARDEN, ACCOUNT, "gardener", CHAIN_ID)).resolves.toBe(true);

    expect(mockFetchHatsModuleAddress).toHaveBeenCalledWith(GARDEN, CHAIN_ID);
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: HATS_MODULE,
        functionName: "isGardenerOf",
        args: [GARDEN, ACCOUNT],
        chainId: CHAIN_ID,
      })
    );
  });

  it("uses the operator wire name every deployed module has for stewards", async () => {
    await readGardenRoleHat(GARDEN, ACCOUNT, "steward", CHAIN_ID, HATS_MODULE);

    // A module address the caller already has is not fetched again.
    expect(mockFetchHatsModuleAddress).not.toHaveBeenCalled();
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: HATS_MODULE, functionName: "isOperatorOf" })
    );
  });

  it("throws, rather than answering no, when the garden has no HatsModule", async () => {
    mockFetchHatsModuleAddress.mockResolvedValue(undefined);

    await expect(readGardenRoleHat(GARDEN, ACCOUNT, "gardener", CHAIN_ID)).rejects.toThrow(
      /Hats module is not configured/
    );
    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("counts any of the six roles as membership, and a failed read as unknown, not no", async () => {
    // GuardLib.isGardenMember accepts every hat, community and funder included.
    const communityOnly = vi.fn(
      async (_garden: string, _account: string, role: string) => role === "community"
    );
    await expect(readGardenMembership(GARDEN, ACCOUNT, CHAIN_ID, communityOnly)).resolves.toBe(
      true
    );
    expect(communityOnly).toHaveBeenCalledTimes(6);

    const none = vi.fn(async () => false);
    await expect(readGardenMembership(GARDEN, ACCOUNT, CHAIN_ID, none)).resolves.toBe(false);

    const failedFunderRead = vi.fn(async (_garden: string, _account: string, role: string) => {
      if (role === "funder") throw new Error("rpc unavailable");
      return false;
    });
    await expect(
      readGardenMembership(GARDEN, ACCOUNT, CHAIN_ID, failedFunderRead)
    ).resolves.toBeNull();

    // One yes is enough, whatever else failed.
    const failedButGardener = vi.fn(async (_garden: string, _account: string, role: string) => {
      if (role === "funder") throw new Error("rpc unavailable");
      return role === "gardener";
    });
    await expect(readGardenMembership(GARDEN, ACCOUNT, CHAIN_ID, failedButGardener)).resolves.toBe(
      true
    );
  });
});
