import { beforeEach, describe, expect, it, vi } from "vitest";
import { readRolesAfterDeparture } from "../../modules/garden/garden-departure-reads";
const reads = vi.hoisted(() => ({ head: vi.fn(), role: vi.fn() }));
vi.mock("@wagmi/core", () => ({
  getPublicClient: () => ({ getBlockNumber: reads.head, readContract: reads.role }),
}));
vi.mock("../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));
const hats = "0x3333333333333333333333333333333333333333" as const;
vi.mock("../../utils/blockchain/garden-hats", () => ({
  fetchHatsModuleAddress: async () => hats,
}));
const garden = "0x1111111111111111111111111111111111111111" as const;
const account = "0x2222222222222222222222222222222222222222" as const;
beforeEach(() => {
  vi.clearAllMocks();
  reads.head.mockResolvedValue(50n);
  reads.role.mockResolvedValue(false);
});
describe("membership after a confirmed departure", () => {
  it("does not trust a node that is behind the departure receipt", async () => {
    reads.head.mockResolvedValue(39n);
    await expect(readRolesAfterDeparture(42161, garden, account, 40n)).resolves.toBeUndefined();
    expect(reads.role).not.toHaveBeenCalled();
  });
  it("pins all six role reads to the same sufficiently new block", async () => {
    await expect(readRolesAfterDeparture(42161, garden, account, 40n)).resolves.toEqual({
      block: 50n,
      complete: true,
      roles: [],
    });
    expect(reads.role).toHaveBeenCalledTimes(6);
    for (const [call] of reads.role.mock.calls)
      expect(call).toMatchObject({ blockNumber: 50n, address: hats, args: [garden, account] });
  });
  it("recognizes a newly granted role as membership", async () => {
    reads.role.mockImplementation(async ({ functionName }) => functionName === "isOperatorOf");
    await expect(readRolesAfterDeparture(42161, garden, account, 40n)).resolves.toEqual({
      block: 50n,
      complete: true,
      roles: ["steward"],
    });
  });
  it("does not infer a regrant from failed role reads", async () => {
    reads.role.mockRejectedValue(new Error("RPC unavailable"));
    await expect(readRolesAfterDeparture(42161, garden, account, 40n)).resolves.toBeUndefined();
  });
});
