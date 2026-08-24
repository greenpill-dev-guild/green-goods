/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as contractErrors from "../../utils/errors/contract-errors";
import type { EASConfig } from "../../config/blockchain";
import {
  clearSimulationCache,
  createSimulationCache,
  simulateApprovalSubmission,
  simulateWorkSubmission,
} from "../../modules/work/simulate";
import type { Address } from "../../types/domain";
import { createMockWorkApprovalDraft, createMockWorkDraft } from "../test-utils/mock-factories";

const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const ACCOUNT = "0x2222222222222222222222222222222222222222" as Address;
const WORK_UID = `0x${"33".repeat(32)}`;
const EAS_CONFIG = {
  EAS: { address: "0x4444444444444444444444444444444444444444" },
  WORK: { uid: `0x${"55".repeat(32)}`, schema: "" },
  WORK_APPROVAL: { uid: `0x${"66".repeat(32)}`, schema: "" },
  ASSESSMENT: { uid: `0x${"00".repeat(32)}`, schema: "" },
  ASSESSMENT_V3: { uid: `0x${"00".repeat(32)}`, schema: "" },
  SCHEMA_REGISTRY: { address: "0x7777777777777777777777777777777777777777" },
} satisfies EASConfig;

function workParams(actionUID = 7) {
  return {
    draft: createMockWorkDraft({ title: "", actionUID }),
    gardenAddress: GARDEN,
    actionUID,
    actionTitle: "Plant trees",
    chainId: 11155111,
    images: [] as File[],
    accountAddress: ACCOUNT,
  };
}

function approvalParams() {
  return {
    draft: createMockWorkApprovalDraft({ workUID: WORK_UID }),
    gardenAddress: GARDEN,
    chainId: 11155111,
    accountAddress: ACCOUNT,
  };
}

function simulationHarness(options: { now?: () => number; maxSize?: number } = {}) {
  const simulateContract = vi.fn().mockResolvedValue({});
  const now = options.now ?? (() => 1_000);
  const cache = createSimulationCache({ now, ttlMs: 60_000, maxSize: options.maxSize ?? 50 });
  return {
    simulateContract,
    cache,
    deps: {
      now,
      cache,
      easConfig: EAS_CONFIG,
      getPublicClient: () => ({ simulateContract }),
    },
  };
}

describe("work simulation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearSimulationCache();
  });

  it("provides useful defaults for a standalone cache", () => {
    const cache = createSimulationCache();
    cache.record("cached");
    expect(cache.hasValid("cached")).toBe(true);
    cache.clear();
    expect(cache.hasValid("cached")).toBe(false);

    const zeroCapacity = createSimulationCache({ maxSize: 0 });
    zeroCapacity.record("still-recorded");
    expect(zeroCapacity.hasValid("still-recorded")).toBe(true);
  });

  it("simulates work against the injected EAS config and caches a success", async () => {
    const harness = simulationHarness();

    await simulateWorkSubmission(workParams(), harness.deps);
    await simulateWorkSubmission(workParams(), harness.deps);

    expect(harness.simulateContract).toHaveBeenCalledOnce();
    expect(harness.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: EAS_CONFIG.EAS.address,
        functionName: "attest",
        account: ACCOUNT,
      })
    );
  });

  it("returns without caching when no public client is available", async () => {
    const harness = simulationHarness();
    const deps = { ...harness.deps, getPublicClient: () => undefined };

    await simulateWorkSubmission(workParams(), deps);
    await simulateWorkSubmission(workParams(), harness.deps);

    expect(harness.simulateContract).toHaveBeenCalledOnce();
  });

  it("uses the module defaults when no dependency object is supplied", async () => {
    await expect(simulateWorkSubmission(workParams())).rejects.toThrow(
      "getWagmiConfig() called before AppKit initialization"
    );
  });

  it("uses the default clock, cache, and EAS config with an injected client", async () => {
    const simulateContract = vi.fn().mockResolvedValue({});
    const deps = { getPublicClient: () => ({ simulateContract }) };

    await simulateWorkSubmission(workParams(9), deps);
    await simulateWorkSubmission(workParams(9), deps);

    expect(simulateContract).toHaveBeenCalledOnce();
  });

  it("expires cached simulations using the injected clock", async () => {
    let timestamp = 1_000;
    const harness = simulationHarness({ now: () => timestamp });

    await simulateWorkSubmission(workParams(), harness.deps);
    timestamp += 60_001;
    await simulateWorkSubmission(workParams(), harness.deps);

    expect(harness.simulateContract).toHaveBeenCalledTimes(2);
  });

  it("evicts the oldest cache entry at the configured capacity", async () => {
    const harness = simulationHarness({ maxSize: 1 });

    await simulateWorkSubmission(workParams(1), harness.deps);
    await simulateWorkSubmission(workParams(2), harness.deps);
    await simulateWorkSubmission(workParams(1), harness.deps);

    expect(harness.simulateContract).toHaveBeenCalledTimes(3);
  });

  it("simulates and caches approvals independently from work", async () => {
    const harness = simulationHarness();

    await simulateApprovalSubmission(approvalParams(), harness.deps);
    await simulateApprovalSubmission(approvalParams(), harness.deps);
    await simulateWorkSubmission(workParams(), harness.deps);

    expect(harness.simulateContract).toHaveBeenCalledTimes(2);
    expect(harness.simulateContract.mock.calls[0][0]).toEqual(
      expect.objectContaining({ address: EAS_CONFIG.EAS.address, account: ACCOUNT })
    );
  });

  it.each([
    ["work", "execution reverted", "Transaction would fail. Make sure you're a member"],
    [
      "work",
      { message: "rpc failure", cause: { reason: "garden paused" } },
      "Transaction check failed: garden paused",
    ],
    ["approval", "execution reverted", "[ExecutionReverted] Transaction would fail"],
    [
      "approval",
      { message: "rpc failure", cause: { reason: "cycle closed" } },
      "Approval check failed: cycle closed",
    ],
  ])("maps %s simulation failures without leaking provider errors", async (kind, failure, message) => {
    const harness = simulationHarness();
    harness.simulateContract.mockRejectedValueOnce(failure);

    const promise =
      kind === "work"
        ? simulateWorkSubmission(workParams(), harness.deps)
        : simulateApprovalSubmission(approvalParams(), harness.deps);

    await expect(promise).rejects.toThrow(message);
  });

  it("does not cache failed simulations", async () => {
    const harness = simulationHarness();
    harness.simulateContract.mockRejectedValueOnce(new Error("execution reverted"));

    await expect(simulateWorkSubmission(workParams(), harness.deps)).rejects.toThrow();
    await simulateWorkSubmission(workParams(), harness.deps);

    expect(harness.simulateContract).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["work", { message: "not a gardener" }, "You're not a member of this garden"],
    ["work", { message: "reverted" }, "Transaction would fail"],
    ["work", {}, "Transaction check failed: Unknown simulation error"],
    ["approval", { message: "not authorized" }, "You're not authorized to approve work"],
    ["approval", { message: "reverted" }, "Transaction would fail"],
    ["approval", {}, "Approval check failed: Unknown simulation error"],
  ])("maps the %s fallback for %o", async (kind, failure, expected) => {
    vi.spyOn(contractErrors, "parseContractError").mockReturnValue({
      raw: "",
      name: "UnknownError",
      message: "",
      isKnown: false,
      recoverable: false,
    });
    const harness = simulationHarness();
    harness.simulateContract.mockRejectedValueOnce(failure);

    const promise =
      kind === "work"
        ? simulateWorkSubmission(workParams(), harness.deps)
        : simulateApprovalSubmission(approvalParams(), harness.deps);

    await expect(promise).rejects.toThrow(expected);
  });

  it("formats a known contract error that has no follow-up action", async () => {
    vi.spyOn(contractErrors, "parseContractError").mockReturnValue({
      raw: "0xdeadbeef",
      name: "KnownFailure",
      message: "Known failure",
      isKnown: true,
      recoverable: false,
    });
    const harness = simulationHarness();
    harness.simulateContract.mockRejectedValueOnce(new Error("opaque"));

    await expect(simulateWorkSubmission(workParams(), harness.deps)).rejects.toThrow(
      "[KnownFailure] Known failure"
    );
  });
});
