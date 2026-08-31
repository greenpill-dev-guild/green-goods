/**
 * viem encodes a named tuple by looking each ABI component name up on the
 * object it is handed, so an allocation key that drifts from the deployed
 * `AllocationBps` member name does not fail to compile — it fails at the
 * wallet, and only when a steward opens a cycle.
 *
 * The 2026-08 Steward rename renamed this struct's `operator` member to
 * `steward` on both sides of the wire: `openCycle` could no longer encode,
 * and `allocationOf` read every steward share back as 0. These assertions
 * pin both directions to the shipped ABI so the next rename fails here
 * instead of on-chain.
 */

import ICommitmentPoolingModuleABI from "@green-goods/contracts/abis/ICommitmentPoolingModule.json";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_ALLOCATION_BPS,
  DEFAULT_RECOGNITION_POLICY_BPS,
} from "../modules/commitment-pooling/pool-lifecycle";

interface AbiParameter {
  name?: string;
  type?: string;
  components?: AbiParameter[];
}
interface AbiEntry {
  name?: string;
  type?: string;
  inputs?: AbiParameter[];
}

function openCycleInput(name: string): AbiParameter {
  const openCycle = (ICommitmentPoolingModuleABI as AbiEntry[]).find(
    (entry) => entry.type === "function" && entry.name === "openCycle"
  );
  if (!openCycle) throw new Error("openCycle is missing from ICommitmentPoolingModule.json");
  const input = openCycle.inputs?.find((candidate) => candidate.name === name);
  if (!input?.components) throw new Error(`openCycle has no tuple input named ${name}`);
  return input;
}

function componentNames(name: string): string[] {
  return (openCycleInput(name).components ?? []).map((component) => component.name ?? "");
}

describe("commitment allocation ABI parity", () => {
  it("keys the allocation struct exactly as the deployed tuple names it", () => {
    expect(Object.keys(DEFAULT_ALLOCATION_BPS).sort()).toEqual(componentNames("allocation").sort());
  });

  it("keeps the steward class under its on-chain `operator` name", () => {
    // The rename that broke this left the deployed member untouched; the
    // display label is the only place the word "Steward" belongs.
    expect(componentNames("allocation")).toContain("operator");
    expect(Object.keys(DEFAULT_ALLOCATION_BPS)).toContain("operator");
    expect(Object.keys(DEFAULT_ALLOCATION_BPS)).not.toContain("steward");
  });

  it("keys the recognition policy exactly as the deployed tuple names it", () => {
    expect(Object.keys(DEFAULT_RECOGNITION_POLICY_BPS).sort()).toEqual(
      componentNames("recognitionPolicy").sort()
    );
  });
});
