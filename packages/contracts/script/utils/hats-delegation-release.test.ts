import { describe, expect, it } from "vitest";
import {
  buildHatsDelegationPlan,
  hatsDelegationBuilderFiles,
  HATS_DELEGATION,
  DELEGATION_CALLS,
} from "./hats-delegation-release";

const input = () => ({
  artifact: {
    bytecode: { object: "0x60006000" },
    deployedBytecode: {
      object: `0x${"00".repeat(32)}`,
      immutableReferences: { self: [{ start: 0, length: 32 }] },
    },
  },
  sourceCommit: "a".repeat(40),
  safeNonce: 48,
  blockNumber: 523741512,
  blockHash: `0x${"12".repeat(32)}`,
  currentImplementation: "0x3333333333333333333333333333333333333333",
  governanceDelay: 86400,
});

describe("Hats delegation Safe release", () => {
  it("separates CREATE2 deployment, existing governance scheduling and activation", () => {
    const plan = buildHatsDelegationPlan(input());
    expect(plan.calls.map((call) => call.nonce)).toEqual([48, 49, 50]);
    expect(plan.calls.map((call) => call.to)).toEqual([
      HATS_DELEGATION.factory,
      HATS_DELEGATION.manager,
      HATS_DELEGATION.manager,
    ]);
    expect(plan.calls.every((call) => call.value === "0" && call.operation === 0)).toBe(true);
    const schedules = DELEGATION_CALLS.decodeFunctionData("multicall", plan.calls[1].data)[0];
    expect(schedules).toHaveLength(9);
    const schedule = DELEGATION_CALLS.decodeFunctionData("schedule", schedules[0]);
    expect(schedule[0]).toBe(HATS_DELEGATION.module);
    expect(schedule[1]).toBe(plan.upgrade);
    expect(schedule[2]).toBe(0n);
    const upgrade = DELEGATION_CALLS.decodeFunctionData("upgradeToAndCall", schedule[1]);
    expect(upgrade[0]).toBe(plan.implementation);
    expect(DELEGATION_CALLS.decodeFunctionData("configureProtocolAdministration", upgrade[1]).map(String)).toEqual(
      HATS_DELEGATION.roles.map((hat) => BigInt(hat).toString()),
    );
    for (let index = 1; index < schedules.length; index++) {
      const scheduled = DELEGATION_CALLS.decodeFunctionData("schedule", schedules[index]);
      expect(scheduled[0]).toBe(HATS_DELEGATION.hats);
      const operation = DELEGATION_CALLS.parseTransaction({ data: scheduled[1] });
      expect(operation?.args[1]).toBe(HATS_DELEGATION.manager);
    }
  });

  it("keeps the implementation address when a source-only merge preserves production bytecode", () => {
    const a = buildHatsDelegationPlan(input());
    const b = buildHatsDelegationPlan({ ...input(), sourceCommit: "b".repeat(40) });
    expect(a.implementation).toBe(b.implementation);
    expect(a.sourceCommit).not.toBe(b.sourceCommit);
  });

  it("exports single-call Builder files without wallet signatures or multisend dependence", () => {
    const plan = buildHatsDelegationPlan(input());
    const files = hatsDelegationBuilderFiles(plan, 0);
    expect(files.map((file) => file.filename)).toEqual([
      "48-deploy.safe.json",
      "49-schedule.safe.json",
      "50-execute.safe.json",
    ]);
    expect(files.every((file) => file.content.transactions.length === 1)).toBe(true);
    expect(files.every((file) => file.content.chainId === "42161")).toBe(true);
    for (let i = 0; i < files.length; i++) expect(files[i].content.transactions[0].data).toBe(plan.calls[i].data);
  });

  it("rejects invalid or overflowing nonce and unresolved implementation references", () => {
    expect(() => buildHatsDelegationPlan({ ...input(), safeNonce: -1 })).toThrow();
    expect(() => buildHatsDelegationPlan({ ...input(), safeNonce: Number.MAX_SAFE_INTEGER })).toThrow();
    const linked = input();
    Object.assign(linked.artifact.bytecode, { linkReferences: { library: {} } });
    expect(() => buildHatsDelegationPlan(linked)).toThrow("unresolved library links");
    const missing = input();
    missing.artifact.deployedBytecode.immutableReferences =
      {} as typeof missing.artifact.deployedBytecode.immutableReferences;
    expect(() => buildHatsDelegationPlan(missing)).toThrow("self immutable");
  });
});
