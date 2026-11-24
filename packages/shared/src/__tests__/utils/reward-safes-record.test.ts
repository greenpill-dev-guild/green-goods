// TEST-QUALITY: allow-small-test-file - it swaps the reward Safe record for a fixture with vi.mock, which would replace the real record that contracts.test.ts checks.
import { describe, expect, it, vi } from "vitest";

/** Digits-only addresses are their own EIP-55 checksum. */
const at = (digit: string) => `0x${digit.repeat(40)}` as `0x${string}`;
const pair = (a: string, b: string) => `0x${`${a}${b}`.repeat(20)}` as `0x${string}`;
/** A garden address whose EIP-55 checksum mixes upper and lower case. */
const CHECKSUMMED = "0xabCDeF0123456789AbcdEf0123456789aBCDEF01";
const HAT = "2480315916136414910793610061883055838099552405006172335048825126256640";

vi.mock("@green-goods/contracts/deployments/42161-reward-safes.json", () => {
  const digits = (digit: string) => `0x${digit.repeat(40)}`;
  const twin = (a: string, b: string) => `0x${`${a}${b}`.repeat(20)}`;
  const hat = "2480315916136414910793610061883055838099552405006172335048825126256640";
  const entry = (tokenId: number, garden: string, safe: string, gate: string, signerHat = hat) => ({
    tokenId,
    garden,
    safe,
    gate,
    signerHat,
  });
  const mixed = "0xabCDeF0123456789AbcdEf0123456789aBCDEF01";
  return {
    default: {
      schemaVersion: 2,
      chainId: 42161,
      safes: [
        entry(1, digits("1"), twin("1", "2"), twin("1", "3")),
        // A zero Safe, a malformed gate, an unchecksummed Safe.
        entry(2, digits("2"), "0x0000000000000000000000000000000000000000", twin("2", "3")),
        entry(3, digits("3"), twin("3", "2"), "0x1234"),
        entry(4, digits("4"), "0xcccccccccccccccccccccccccccccccccccccccc", twin("4", "3")),
        // A Safe two gardens share, and a gate that is another entry's Safe.
        entry(5, digits("5"), twin("5", "2"), twin("5", "3")),
        entry(6, digits("6"), twin("5", "2"), twin("6", "3")),
        entry(7, digits("7"), twin("7", "2"), twin("8", "2")),
        entry(8, digits("8"), twin("8", "2"), twin("8", "3")),
        // A garden typed twice, once without its checksum.
        entry(9, mixed, digits("9"), twin("9", "3")),
        entry(9, mixed.toLowerCase(), twin("9", "0"), twin("9", "4")),
        // A signer hat that isn't a positive whole number.
        entry(10, twin("0", "1"), twin("0", "2"), twin("0", "3"), "0"),
        entry(11, twin("0", "4"), twin("0", "5"), twin("0", "6"), "-1"),
      ],
    },
  };
});

const { getGardenRewardSafe } = await import("../../utils/blockchain/contracts");

describe("a garden's reward Safe, read from the chain's record", () => {
  it("names the recorded Safe, gate and steward hat, and nothing on another chain", () => {
    expect(getGardenRewardSafe(42161, at("1"))).toEqual({
      safe: pair("1", "2"),
      gate: pair("1", "3"),
      signerHat: BigInt(HAT),
    });
    expect(getGardenRewardSafe(42161, null)).toBeNull();
    expect(getGardenRewardSafe(42220, at("1"))).toBeNull();
  });

  it("pays from nowhere when an entry can't be read exactly", () => {
    for (const garden of [
      at("2"),
      at("3"),
      at("4"),
      at("5"),
      at("6"),
      at("7"),
      at("8"),
      CHECKSUMMED,
      pair("0", "1"),
      pair("0", "4"),
    ] as const) {
      expect(getGardenRewardSafe(42161, garden as `0x${string}`)).toBeNull();
    }
  });
});
