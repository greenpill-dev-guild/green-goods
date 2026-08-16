import { describe, expect, it } from "vitest";
import { buildDeterministicRelayPlan, parseArguments } from "./garden-account-relay";

const gardens = Array.from({ length: 18 }, (_, index) => `0x${(index + 1).toString(16).padStart(40, "0")}`);
const safes = Array.from({ length: 18 }, (_, index) => `0x${(index + 101).toString(16).padStart(40, "0")}`);

function fixture() {
  return {
    routerCreationCode: "0x6001600055",
    routerRuntimeCode: "0x60016000",
    relayCreationCode: "0x6002600055",
    relayRuntimeCode: "0x60026000",
    gardens,
    safes,
    sourceNonce: 7,
    celoNonce: 11,
    sourceFinalizedBlock: 494724924,
    sourceFinalizedBlockHash: `0x${"11".repeat(32)}`,
    celoFinalizedBlock: 74938820,
    celoFinalizedBlockHash: `0x${"22".repeat(32)}`,
    generatedAt: "2026-08-15T00:00:00.000Z",
  };
}

describe("GardenAccount relay release plan", () => {
  it("accepts only inert planning and verification commands", () => {
    expect(parseArguments(["plan"]).command).toBe("plan");
    expect(parseArguments(["verify"]).command).toBe("verify");
    expect(() => parseArguments(["deploy", "--broadcast"])).toThrow(/plan\|verify/);
    expect(() => parseArguments(["plan", "--broadcast"])).toThrow(/requires a value/);
  });

  it("derives one deterministic four-step cross-chain plan", () => {
    const plan = buildDeterministicRelayPlan(fixture());
    expect(plan.gardenCount).toBe(18);
    expect(plan.authorityEnabled).toBe(false);
    expect(plan.valueAuthorityGranted).toBe(false);
    expect(plan.transactions.map((transaction) => transaction.kind)).toEqual([
      "DEPLOY_SOURCE_ROUTER",
      "DEPLOY_CELO_RELAY",
      "BIND_DESTINATION_RELAY",
      "TRUST_CELO_RELAY",
    ]);
    expect(plan.transactions.map((transaction) => transaction.nonce)).toEqual([7, 11, 8, 12]);
    expect(plan.transactions.map((transaction) => transaction.prerequisiteReceipt)).toEqual([
      null,
      "step-1",
      "step-2",
      "step-3",
    ]);
    expect(plan.transactions.every((transaction) => transaction.value === "0")).toBe(true);
  });

  it("rejects duplicate or incomplete Garden/Safe bindings", () => {
    expect(() => buildDeterministicRelayPlan({ ...fixture(), gardens: gardens.slice(0, 17) })).toThrow(/18 unique/);
    expect(() => buildDeterministicRelayPlan({ ...fixture(), safes: safes.map(() => safes[0]) })).toThrow(/18 unique/);
  });
});
