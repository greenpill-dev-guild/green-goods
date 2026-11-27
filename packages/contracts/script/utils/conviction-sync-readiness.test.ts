import { AbiCoder } from "ethers";
import { describe, expect, it } from "vitest";
import {
  configuredGardenAccount,
  convictionSyncCalls,
  isUnmintedGardenToken,
  requireConvictionSyncReady,
  type GardenSyncState,
} from "./conviction-sync-readiness";

const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
const hats = addr(7);
const safe = addr(8);
function garden(): GardenSyncState {
  return {
    garden: addr(1),
    community: addr(2),
    powerRegistry: addr(3),
    registeredStrategies: [addr(4), addr(5)],
    pools: [4, 5].map((n) => ({
      address: addr(n),
      community: addr(2),
      powerRegistry: addr(3),
      council: safe,
      authorized: false,
    })),
  };
}

describe("conviction sync launch readiness", () => {
  it("plans only missing authorizations and requires the executed readback", () => {
    const state = garden();
    expect(convictionSyncCalls(state, hats, safe)).toHaveLength(2);
    state.pools[0].authorized = true;
    expect(convictionSyncCalls(state, hats, safe).map((call) => call.to.toLowerCase())).toEqual([addr(5)]);
    expect(() => requireConvictionSyncReady(state, hats, safe)).toThrow("pending");
    state.pools[1].authorized = true;
    expect(() => requireConvictionSyncReady(state, hats, safe)).not.toThrow();
  });

  it("rejects wrong garden wiring even if both pools report authorization", () => {
    for (const field of ["community", "powerRegistry", "council"] as const) {
      const state = garden();
      state.pools.forEach((pool) => {
        pool.authorized = true;
      });
      state.pools[1][field] = addr(99);
      expect(() => requireConvictionSyncReady(state, hats, safe)).toThrow();
    }
  });

  it("rejects duplicate, incomplete and incorrectly registered strategies", () => {
    const duplicate = garden();
    duplicate.pools[1].address = duplicate.pools[0].address;
    expect(() => convictionSyncCalls(duplicate, hats, safe)).toThrow("duplicate");
    const missing = garden();
    missing.pools.pop();
    expect(() => convictionSyncCalls(missing, hats, safe)).toThrow("two signal pools");
    const mismatch = garden();
    mismatch.registeredStrategies[1] = addr(99);
    expect(() => convictionSyncCalls(mismatch, hats, safe)).toThrow("Hats strategies");
  });

  it("does not authorize pools for a partially initialized garden", () => {
    for (const field of ["garden", "community", "powerRegistry"] as const) {
      const state = garden();
      state[field] = addr(0);
      expect(() => convictionSyncCalls(state, hats, safe)).toThrow("missing");
    }
  });

  it("takes the one garden account the Hats module configured", () => {
    const legacy = { account: addr(10), configured: false };
    const upgradeable = { account: addr(11), configured: true };
    expect(configuredGardenAccount(18, [legacy, upgradeable]).toLowerCase()).toBe(addr(11));
    expect(() => configuredGardenAccount(18, [legacy])).toThrow("garden token 18");
    expect(() => configuredGardenAccount(18, [{ ...legacy, configured: true }, upgradeable])).toThrow("exactly one");
  });

  it("ends garden discovery only on the token's own refusal of an unminted id", () => {
    const reason = (text: string) => `0x08c379a0${AbiCoder.defaultAbiCoder().encode(["string"], [text]).slice(2)}`;
    expect(isUnmintedGardenToken({ code: "CALL_EXCEPTION", data: reason("ERC721: invalid token ID") })).toBe(true);
    expect(isUnmintedGardenToken({ code: "CALL_EXCEPTION", data: `0x7e273289${"0".repeat(63)}1` })).toBe(true);
    // ethers raises CALL_EXCEPTION without revert data when the node cannot serve the proof block.
    expect(isUnmintedGardenToken({ code: "CALL_EXCEPTION", data: null })).toBe(false);
    expect(isUnmintedGardenToken({ code: "CALL_EXCEPTION", data: reason("paused") })).toBe(false);
    expect(isUnmintedGardenToken({ code: "CALL_EXCEPTION", data: "0x08c379a0" })).toBe(false);
    expect(isUnmintedGardenToken(new Error("rate limited"))).toBe(false);
  });
});
