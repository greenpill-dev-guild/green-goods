import type { Hex } from "viem";
import { describe, expect, it } from "vitest";

import { implementationMatchesPin } from "../modules/commitment-pooling/proxy-implementation-pin";
import type { Address } from "../types/domain";

const IMPLEMENTATION = "0xAbCdEf0123456789aBcDeF0123456789abCDef01" as Address;
const CODE_HASH: Hex = `0x${"ab".repeat(32)}`;
const PIN = { address: IMPLEMENTATION, runtimeCodeHash: CODE_HASH };
/** The slot as a node returns it: the implementation left-padded to 32 bytes, in lower case. */
const SLOT: Hex = `0x${"0".repeat(24)}${IMPLEMENTATION.slice(2).toLowerCase()}`;

describe("an upgradeable proxy's reviewed implementation", () => {
  it("matches when the slot names the pinned implementation and its code hashes to the pin, in any case", () => {
    expect(implementationMatchesPin(SLOT, CODE_HASH, PIN)).toBe(true);
    expect(
      implementationMatchesPin(
        SLOT.toUpperCase().replace("0X", "0x") as Hex,
        CODE_HASH.toUpperCase() as Hex,
        PIN
      )
    ).toBe(true);
  });

  it("does not match another implementation or another code hash", () => {
    expect(implementationMatchesPin(`0x${"0".repeat(24)}${"e".repeat(40)}`, CODE_HASH, PIN)).toBe(
      false
    );
    expect(implementationMatchesPin(SLOT, `0x${"cd".repeat(32)}`, PIN)).toBe(false);
  });

  it("never matches an implementation with no code", () => {
    expect(implementationMatchesPin(SLOT, null, PIN)).toBe(false);
  });

  it("never matches a slot that holds anything but a left-padded address", () => {
    const high: Hex = `0x${"1".repeat(24)}${SLOT.slice(26)}`;
    const short: Hex = `0x${IMPLEMENTATION.slice(2)}`;
    for (const slot of [high, short, "0x" as Hex]) {
      expect(implementationMatchesPin(slot, CODE_HASH, PIN)).toBe(false);
    }
  });
});
