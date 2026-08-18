import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { keccak256, toUtf8Bytes } from "ethers";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertNextRelayBoundary,
  buildDeterministicRelayPlan,
  loadRelayCheckpoint,
  parseArguments,
} from "./garden-account-relay";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function checkpointFixture(completed: number, planBody = '{"kind":"relay"}'): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "relay-checkpoint-"));
  temporaryDirectories.push(directory);
  const planPath = path.join(directory, "garden-account-relay.json");
  fs.writeFileSync(planPath, planBody);
  if (completed > 0) {
    fs.writeFileSync(
      path.join(directory, "garden-account-relay.checkpoint.json"),
      JSON.stringify({
        schemaVersion: 1,
        planHash: keccak256(toUtf8Bytes(planBody)),
        completed: Array.from({ length: completed }, (_, index) => ({
          step: index + 1,
          kind: "BOUNDARY",
          chainId: 42161,
          transactionHash: `0x${String(index + 1)
            .repeat(64)
            .slice(0, 64)}`,
          blockNumber: 100 + index,
        })),
      }),
    );
  }
  return planPath;
}

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
  it("keeps planning and verification inert and fails closed on unknown commands", () => {
    expect(parseArguments(["plan"]).command).toBe("plan");
    expect(parseArguments(["verify"]).command).toBe("verify");
    expect(parseArguments(["plan"]).broadcast).toBe(false);
    expect(() => parseArguments(["enable"])).toThrow(/plan\|verify\|deploy/);
    expect(() => parseArguments(["plan", "--broadcast"])).toThrow(/does not accept --broadcast/);
    expect(() => parseArguments(["verify", "--step", "1"])).toThrow(/does not accept --step/);
  });

  it("binds every broadcast boundary to one step and its prior receipt", () => {
    const receipt = `0x${"ab".repeat(32)}`;
    expect(parseArguments(["deploy", "--broadcast", "--step", "1"])).toMatchObject({
      command: "deploy",
      broadcast: true,
      step: 1,
    });
    expect(parseArguments(["deploy", "--broadcast", "--step", "4", "--receipt", receipt]).receipt).toBe(receipt);

    expect(() => parseArguments(["deploy", "--step", "1"])).toThrow(/requires --broadcast/);
    expect(() => parseArguments(["deploy", "--broadcast"])).toThrow(/one explicit --step boundary/);
    // A resumed lane recovers the prior receipt from its checkpoint, so the flag is not required
    // at parse time; the binding itself is enforced when the boundary executes.
    expect(parseArguments(["deploy", "--broadcast", "--step", "2"]).receipt).toBeUndefined();
    expect(() => parseArguments(["deploy", "--broadcast", "--step", "1", "--receipt", receipt])).toThrow(
      /no prerequisite receipt/,
    );
    expect(() => parseArguments(["deploy", "--broadcast", "--step", "5", "--receipt", receipt])).toThrow(
      /--step must be between 1 and 4/,
    );
    expect(() => parseArguments(["deploy", "--broadcast", "--step", "0"])).toThrow(/--step must be between 1 and 4/);
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

describe("relay boundary checkpointing", () => {
  it("resumes at the first uncheckpointed boundary and refuses to replay or skip", () => {
    expect(assertNextRelayBoundary(1, 0)).toBe(1);
    expect(assertNextRelayBoundary(3, 2)).toBe(3);
    // Replaying a mined boundary and jumping over an unmined one both fail closed.
    expect(() => assertNextRelayBoundary(2, 2)).toThrow(/next uncheckpointed boundary 3/);
    expect(() => assertNextRelayBoundary(4, 2)).toThrow(/next uncheckpointed boundary 3/);
    expect(() => assertNextRelayBoundary(1, 4)).toThrow(/next uncheckpointed boundary 5/);
  });

  it("reads a contiguous checkpoint and binds it to the exact reviewed plan", () => {
    expect(loadRelayCheckpoint(checkpointFixture(0)).completed).toEqual([]);

    const resumed = loadRelayCheckpoint(checkpointFixture(2));
    expect(resumed.completed.map((entry) => entry.step)).toEqual([1, 2]);

    // Regenerating the plan after a mined boundary must stop the lane, not silently resume.
    const planPath = checkpointFixture(2);
    fs.writeFileSync(planPath, '{"kind":"relay","regenerated":true}');
    expect(() => loadRelayCheckpoint(planPath)).toThrow(/does not belong to the exact reviewed relay plan/);
  });

  it("rejects a checkpoint whose boundaries are not a contiguous prefix", () => {
    const planPath = checkpointFixture(2);
    const checkpointPath = planPath.replace(/\.json$/u, ".checkpoint.json");
    const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
    checkpoint.completed[1].step = 3;
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint));
    expect(() => loadRelayCheckpoint(planPath)).toThrow(/contiguous boundary prefix/);
  });
});
