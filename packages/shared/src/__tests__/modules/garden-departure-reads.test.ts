import { beforeEach, describe, expect, it, vi } from "vitest";
import { readMembershipAfterDeparture } from "../../modules/garden/garden-departure-reads";
const reads = vi.hoisted(() => ({ head: vi.fn(), role: vi.fn() }));
vi.mock("@wagmi/core", () => ({
  getPublicClient: () => ({ getBlockNumber: reads.head, readContract: reads.role }),
}));
vi.mock("../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));
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
    await expect(readMembershipAfterDeparture(42161, garden, account, 40n)).resolves.toBe(false);
    expect(reads.role).not.toHaveBeenCalled();
  });
  it("pins all six role reads to the same sufficiently new block", async () => {
    await expect(readMembershipAfterDeparture(42161, garden, account, 40n)).resolves.toBe(false);
    expect(reads.role).toHaveBeenCalledTimes(6);
    for (const [call] of reads.role.mock.calls)
      expect(call).toMatchObject({ blockNumber: 50n, address: garden, args: [account] });
  });
  it("recognizes a newly granted role as membership", async () => {
    reads.role.mockResolvedValueOnce(true);
    await expect(readMembershipAfterDeparture(42161, garden, account, 40n)).resolves.toBe(true);
  });
  it("does not infer a regrant from failed role reads", async () => {
    reads.role.mockRejectedValue(new Error("RPC unavailable"));
    await expect(readMembershipAfterDeparture(42161, garden, account, 40n)).resolves.toBe(false);
  });
});
