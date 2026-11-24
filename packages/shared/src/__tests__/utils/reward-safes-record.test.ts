// TEST-QUALITY: allow-small-test-file - it swaps the reward Safe record for a fixture with vi.mock, which would replace the real record that contracts.test.ts checks.
import { getAddress } from "viem";
import { describe, expect, it, vi } from "vitest";

const G1 = "0x1111111111111111111111111111111111111111";
const S1 = "0x1212121212121212121212121212121212121212";
const SHARED_SAFE = "0x2323232323232323232323232323232323232323";
const TWICE = "0x6666666666666666666666666666666666666666";
/** A garden address whose EIP-55 checksum mixes upper and lower case. */
const CHECKSUMMED = "0xabCDeF0123456789AbcdEf0123456789aBCDEF01";

vi.mock("@green-goods/contracts/deployments/42161-reward-safes.json", () => ({
  default: {
    schemaVersion: 1,
    chainId: 42161,
    safes: [
      { tokenId: 1, garden: G1, safe: S1 },
      {
        tokenId: 2,
        garden: "0x2222222222222222222222222222222222222222",
        safe: "0x0000000000000000000000000000000000000000",
      },
      { tokenId: 3, garden: "0x3333333333333333333333333333333333333333", safe: "0x1234" },
      { tokenId: 4, garden: "0x4444444444444444444444444444444444444444", safe: SHARED_SAFE },
      { tokenId: 5, garden: "0x5555555555555555555555555555555555555555", safe: SHARED_SAFE },
      { tokenId: 6, garden: TWICE, safe: "0x3434343434343434343434343434343434343434" },
      { tokenId: 6, garden: TWICE, safe: "0x4545454545454545454545454545454545454545" },
      {
        tokenId: 7,
        garden: "0x7777777777777777777777777777777777777777",
        safe: "0x7777777777777777777777777777777777777777",
      },
      {
        tokenId: 8,
        garden: "0x8888888888888888888888888888888888888888",
        safe: "0xcccccccccccccccccccccccccccccccccccccccc",
      },
      // A garden typed twice, once without its checksum: neither copy pays.
      { tokenId: 9, garden: CHECKSUMMED, safe: "0x9999999999999999999999999999999999999999" },
      {
        tokenId: 9,
        garden: CHECKSUMMED.toLowerCase(),
        safe: "0x9090909090909090909090909090909090909090",
      },
    ],
  },
}));

const { getGardenRewardSafe } = await import("../../utils/blockchain/contracts");

describe("a garden's reward Safe, read from the chain's record", () => {
  it("names the recorded Safe, checksummed, whatever the case of the garden asked for", () => {
    expect(getGardenRewardSafe(42161, G1)).toBe(getAddress(S1));
    expect(getGardenRewardSafe(42161, G1.toUpperCase().replace("0X", "0x") as `0x${string}`)).toBe(
      getAddress(S1)
    );
  });

  it("pays from nowhere when an entry can't be read exactly", () => {
    // A zero, malformed or unchecksummed Safe, a Safe two gardens share, a garden named twice, or a
    // garden as its own Safe.
    for (const garden of [
      "0x2222222222222222222222222222222222222222",
      "0x3333333333333333333333333333333333333333",
      "0x4444444444444444444444444444444444444444",
      "0x5555555555555555555555555555555555555555",
      TWICE,
      "0x7777777777777777777777777777777777777777",
      "0x8888888888888888888888888888888888888888",
      CHECKSUMMED,
    ] as const) {
      expect(getGardenRewardSafe(42161, garden)).toBeNull();
    }
    expect(getGardenRewardSafe(42161, null)).toBeNull();
    // Another chain has no record, so no garden there has a Safe.
    expect(getGardenRewardSafe(42220, G1)).toBeNull();
  });
});
