import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { queryKeys } from "../config/query-keys";
import { getOntologyChainMaturity } from "../ontology/query";
import {
  deriveCommitmentState,
  getCommitmentClaimRequestId,
  getCommitmentContributorId,
  getCommitmentCycleId,
  getCommitmentEventId,
  getCommitmentExchangeId,
  getCommitmentId,
  getCommitmentPoolId,
  getCommitmentSeriesCycleSummaryId,
  getCommitmentSeriesId,
  getCommitmentUnitSummaryId,
  getNeedCommitmentIndexId,
  getPoolMemberHistoryId,
  parseHypercertBundle,
  selectClaimPreflight,
  selectCommitmentReadiness,
  selectCommitmentPoolingAvailability,
  selectConfirmationEligibility,
  selectContributorRemoval,
  selectDeclaredValueSummaries,
  selectSeenCommitments,
  selectHypercertCycleEligibility,
  selectPoolClosureEligibility,
  selectPromiseKeptRate,
  selectRequirementProgress,
  type CommitmentReadModel,
} from "../modules/commitment-pooling";

const ACCOUNT = "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD";

describe("commitment pooling identity", () => {
  it("preserves chain-scoped pooling IDs without changing Garden identity", () => {
    expect(getCommitmentPoolId(42161, 9n)).toBe("42161-9");
    expect(getCommitmentCycleId(42161, 10n)).toBe("42161-10");
    expect(getCommitmentId(42161, 11n)).toBe("42161-11");
    expect(getCommitmentSeriesId(42161, 12n)).toBe("42161-12");
    expect(getCommitmentSeriesCycleSummaryId(42161, 12n, 10n)).toBe("42161-12-10");
    expect(getCommitmentContributorId(42161, 11n, ACCOUNT)).toBe(
      "42161-11-0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
    );
    expect(getCommitmentClaimRequestId(42161, 11n, ACCOUNT)).toBe(
      "42161-11-0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
    );
    expect(getCommitmentUnitSummaryId(42161, "POOL", 9n, "0x1234")).toBe("42161-POOL-9-0x1234");
    expect(getNeedCommitmentIndexId(42161, "0xABCD")).toBe("42161-0xabcd");
    expect(getCommitmentExchangeId(42161, 9n, 11n, 12n)).toBe("42161-EXCHANGE-9-11-12");
    expect(getPoolMemberHistoryId(42161, 9n, ACCOUNT)).toBe(
      "42161-9-0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
    );
    expect(getCommitmentEventId(42161, "0xABCD", 3)).toBe("42161-0xabcd-3");
  });

  it("normalizes addresses in centralized query keys", () => {
    expect(queryKeys.commitmentPooling.memberHistory(42161, 9n, ACCOUNT, ACCOUNT)).toEqual([
      "greengoods",
      "commitment-pooling",
      42161,
      "member-history",
      "9",
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    ]);
  });
});

describe("commitment pooling public query boundary", () => {
  it("never binds internal replay entities or the removed commitment contributor array", () => {
    const directory = "src/modules/commitment-pooling";
    const source = readdirSync(directory)
      .filter((file) => file === "data.ts" || file.startsWith("data-"))
      .map((file) => readFileSync(`${directory}/${file}`, "utf8"))
      .join("\n");
    expect(source).not.toMatch(/\bCommitmentPendingLifecycleProjection\b/);
    expect(source).not.toMatch(/\bCommitmentPendingLifecycleProjectionIndex\b/);
    const commitmentFields = source.match(/const COMMITMENT_FIELDS[\s\S]*?`([\s\S]*?)`;/)?.[1];
    expect(commitmentFields).toBeDefined();
    expect(commitmentFields).not.toMatch(/\bcontributorEntityIds\b/);
  });
});

describe("commitment pooling availability", () => {
  const capability = {
    deployment: "deployed" as const,
    activation: "active" as const,
    integration: "not-integrated" as const,
    availability: "deployed-not-available" as const,
    evidence: [],
    verified_at: "2026-08-16",
  };

  it("fails closed until deployment, activation, integration, and availability are green", () => {
    expect(selectCommitmentPoolingAvailability(capability)).toEqual({
      status: "unavailable",
      reason: "not-integrated",
      capability,
    });
    expect(
      selectCommitmentPoolingAvailability({
        ...capability,
        integration: "integrated",
        availability: "available",
      })
    ).toMatchObject({ status: "available" });
    expect(selectCommitmentPoolingAvailability(undefined)).toEqual({ status: "unknown-chain" });
  });

  it("uses the chain-scoped capability ledger for the hosted-indexer and Sepolia gaps", () => {
    expect(
      selectCommitmentPoolingAvailability(getOntologyChainMaturity("entity:commitment-pool", 42161))
    ).toMatchObject({ status: "unavailable", reason: "not-integrated" });
    expect(
      selectCommitmentPoolingAvailability(
        getOntologyChainMaturity("entity:commitment-pool", 11155111)
      )
    ).toMatchObject({ status: "unavailable", reason: "not-deployed" });
    expect(
      selectCommitmentPoolingAvailability(getOntologyChainMaturity("entity:commitment-pool", 42220))
    ).toEqual({ status: "unknown-chain" });
  });
});

describe("pool promise rate", () => {
  it("returns an exact rational and never a stored float", () => {
    expect(selectPromiseKeptRate({ commitmentsFulfilled: 3n, commitmentsDue: 4n })).toEqual({
      fulfilled: 3n,
      due: 4n,
    });
    expect(selectPromiseKeptRate({ commitmentsFulfilled: 0n, commitmentsDue: 0n })).toBeNull();
  });
});

describe("commitment read selectors", () => {
  const commitment = (overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel => {
    const onchainState = overrides.onchainState ?? overrides.state ?? "ACCEPTED";
    return {
      id: "42161-1",
      chainId: 42161,
      commitmentId: 1n,
      creationSeen: true,
      onchainState,
      derivedState: "ACTIVE",
      state: onchainState,
      approvedUnits: 0n,
      evidenceCount: 0,
      cycleId: null,
      declaredUnitValue: null,
      declaredValueBasis: null,
      targetUnits: 1n,
      ...overrides,
      onchainState,
      state: onchainState,
    };
  };

  it("never returns unseen placeholders in ordinary lists", () => {
    expect(
      selectSeenCommitments([commitment(), commitment({ id: "hidden", creationSeen: false })])
    ).toHaveLength(1);
  });

  it("pins derived-state precedence", () => {
    expect(deriveCommitmentState(commitment({ evidenceCount: 1 }))).toBe("EVIDENCE_SUBMITTED");
    expect(deriveCommitmentState(commitment({ evidenceCount: 1, approvedUnits: 1n }))).toBe(
      "PARTIALLY_APPROVED"
    );
    expect(deriveCommitmentState(commitment())).toBe("ACTIVE");
    expect(deriveCommitmentState(commitment({ state: "DISPUTED", approvedUnits: 1n }))).toBe(
      "DISPUTED"
    );
    expect(
      deriveCommitmentState(commitment({ state: "FULFILLED", cycleId: 4n }), "RECONCILED")
    ).toBe("RECONCILED");
    expect(deriveCommitmentState(commitment({ state: "FULFILLED", cycleId: 4n }), "OPEN")).toBe(
      "FULFILLED"
    );
    expect(
      deriveCommitmentState(commitment({ state: "FULFILLED", cycleId: 0n }), "RECONCILED")
    ).toBe("FULFILLED");
  });

  it("groups declared values by exact basis bytes and omits undeclared pairs", () => {
    const summaries = selectDeclaredValueSummaries([
      commitment({
        commitmentId: 1n,
        declaredUnitValue: 2n,
        declaredValueBasis: "G$",
        targetUnits: 3n,
      }),
      commitment({
        commitmentId: 2n,
        declaredUnitValue: 4n,
        declaredValueBasis: "G$",
        targetUnits: 5n,
      }),
      commitment({
        commitmentId: 3n,
        declaredUnitValue: 10n,
        declaredValueBasis: "g$",
        targetUnits: 2n,
      }),
      commitment({ commitmentId: 4n, declaredUnitValue: null, declaredValueBasis: null }),
    ]);
    expect(summaries).toEqual([
      { declaredValueBasis: "G$", commitmentCount: 2, declaredValue: 26n },
      { declaredValueBasis: "g$", commitmentCount: 1, declaredValue: 20n },
    ]);
  });

  it("does not silently classify unresolved Hypercert metadata as legacy", () => {
    expect(
      parseHypercertBundle({ bundleKind: "WORK_LEGACY", metadataReconciliationRequired: true })
    ).toEqual({ status: "metadata-pending" });
    expect(
      parseHypercertBundle({ bundleKind: "COMMITMENT", metadataReconciliationRequired: false })
    ).toEqual({ status: "ready", bundleKind: "COMMITMENT" });
    expect(
      parseHypercertBundle({ bundleKind: "commitment", metadataReconciliationRequired: false })
    ).toEqual({ status: "ready", bundleKind: "WORK_LEGACY" });
  });

  it("keeps readiness gates explicit and does not let override bypass safety", () => {
    expect(
      selectCommitmentReadiness({
        state: "ACCEPTED",
        commitmentKind: "DOMAIN_IMPACT",
        poolOpen: true,
        cycleId: 2n,
        cycleState: "OPEN",
        requirements: [{ requiredCount: 2, approvedCount: 2 }],
        evidenceCount: 0,
        requiresAssessment: true,
        assessmentUID: "0x1234",
        totalVerifiedCredits: 1,
        linkedWorkFresh: true,
        ordinaryConfirmationReachable: false,
        protocolFallbackEnabled: true,
        protocolPoolRegistered: true,
      })
    ).toEqual({ ready: true, blockers: [] });
    expect(
      selectCommitmentReadiness({
        state: "ACCEPTED",
        commitmentKind: "DOMAIN_IMPACT",
        poolOpen: true,
        cycleId: null,
        requirements: [{ requiredCount: 2, approvedCount: 0 }],
        evidenceCount: 0,
        requiresAssessment: false,
        totalVerifiedCredits: 0,
        linkedWorkFresh: false,
        ordinaryConfirmationReachable: true,
        protocolFallbackEnabled: false,
        protocolPoolRegistered: false,
        override: true,
      }).blockers
    ).toEqual(["verified-credit-required", "linked-work-stale"]);
  });

  it("pins action progress, claim guards, roster removal, and contributor-wide confirmation exclusion", () => {
    expect(
      selectRequirementProgress([{ requirementIndex: 0, requiredCount: 2, approvedCount: 3 }])
    ).toEqual([
      {
        requirementIndex: 0,
        requiredCount: 2,
        approvedCount: 3,
        approvedForProgress: 2,
        complete: true,
      },
    ]);
    expect(
      selectClaimPreflight({
        state: "OFFERED",
        creator: ACCOUNT as `0x${string}`,
        claimant: "0x1111111111111111111111111111111111111111",
        claimType: "GARDEN",
        poolType: "GARDEN",
        creatorOperatesGarden: true,
      }).blockers
    ).toEqual(["garden-claim-disabled-in-garden-pool", "creator-operated-garden"]);
    expect(
      selectContributorRemoval({
        active: true,
        isLead: false,
        approvedWorkCredits: 0,
        evidenceCredits: 0,
        uncountedLinkedWorkCount: 1,
        rosterFrozen: false,
      })
    ).toEqual({ allowed: false, blockers: ["linked-work"] });
    expect(
      selectConfirmationEligibility({
        state: "READY_FOR_CONFIRMATION",
        viewer: ACCOUNT as `0x${string}`,
        contributors: [ACCOUNT as `0x${string}`],
        alreadyConfirmed: false,
        ordinaryEligible: true,
        ordinaryReachable: true,
        localFallbackSteward: true,
        protocolFallbackSteward: true,
        protocolFallbackEnabled: true,
      })
    ).toEqual({ allowed: false, path: null, reason: "contributor" });
  });

  it("keeps closure and Hypercert certificate eligibility fail closed", () => {
    expect(
      selectPoolClosureEligibility({ liveCommitmentCount: 0n, nonTerminalCycleCount: 0n })
    ).toEqual({ allowed: true, blockers: [] });
    expect(
      selectHypercertCycleEligibility({
        cycleId: 0n,
        cycleState: "RECONCILED",
        commitmentStates: ["FULFILLED"],
      })
    ).toEqual({ allowed: false, blockers: ["cycle-required"] });
  });
});
