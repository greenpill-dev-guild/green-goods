import { describe, expect, it, vi } from "vitest";

import {
  type CommitmentCreationPayload,
  type CommitmentJob,
  type CommitmentJobExecutionDependencies,
  type CommitmentReadModel,
  type CommitmentSeriesJobPayload,
  createCommitmentCreationRequestKey,
  createSeriesCreationRequestKey,
  createWorkLinkOperationKey,
  deriveCommitmentState,
  executeCommitmentJob,
  hashCommitmentCreationPayload,
  hashSeriesCreationPayload,
  hashWorkLinkPayload,
  prepareCommitmentJobPayload,
  selectClaimPreflight,
  selectCommitmentPoolingAvailability,
  selectCommitmentReadiness,
  selectConfirmationEligibility,
  selectContributorRemoval,
  selectCycleDerivedState,
  selectDeclaredValueSummaries,
  selectHypercertCycleEligibility,
  selectPoolClosureEligibility,
  selectRequirementProgress,
  selectSeenCommitments,
} from "../modules/commitment-pooling";
import { mapClaim } from "../modules/commitment-pooling/data-commitments";
import {
  mapCommitment,
  mapCycle,
  mapPool,
  mapSeries,
  mapUnitSummary,
} from "../modules/commitment-pooling/data-core";

const MODULE = "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a" as const;
const HOLDER = "0x1111111111111111111111111111111111111111" as const;
const GARDEN = "0x2222222222222222222222222222222222222222" as const;
const OTHER = "0x3333333333333333333333333333333333333333" as const;
const ZERO_HASH = `0x${"00".repeat(32)}` as const;

function seriesJob(): CommitmentJob<"commitmentSeries"> {
  const payload: CommitmentSeriesJobPayload = {
    clientSeriesId: "series-local-1",
    creationRequestKey: createSeriesCreationRequestKey({
      chainId: 42161,
      moduleAddress: MODULE,
      holder: HOLDER,
      clientSeriesId: "series-local-1",
    }),
    poolId: 7n,
    gardenAddress: GARDEN,
    metadataCID: "bafy-series",
  };
  return {
    id: "series-job",
    kind: "commitmentSeries",
    payload,
    chainId: 42161,
    moduleAddress: MODULE,
    userAddress: HOLDER,
  };
}

function executionDependencies(
  overrides: Partial<CommitmentJobExecutionDependencies> = {}
): CommitmentJobExecutionDependencies {
  return {
    readSeriesId: vi.fn().mockResolvedValue(0n),
    readSeries: vi.fn(),
    readPoolGarden: vi.fn().mockResolvedValue(GARDEN),
    readCommitmentId: vi.fn().mockResolvedValue(0n),
    readCommitment: vi.fn(),
    readWorkLinkPayloadHash: vi.fn().mockResolvedValue(ZERO_HASH),
    send: vi.fn().mockResolvedValue(`0x${"12".repeat(32)}`),
    ...overrides,
  };
}

function commitmentPayload(
  overrides: Partial<CommitmentCreationPayload> = {}
): CommitmentCreationPayload {
  return {
    clientCommitmentId: "commitment-local-1",
    creationRequestKey: createCommitmentCreationRequestKey({
      chainId: 42161,
      moduleAddress: MODULE,
      creator: HOLDER,
      clientCommitmentId: "commitment-local-1",
    }),
    poolId: 7n,
    cycleId: 8n,
    commitmentSeriesId: 0n,
    direction: 0,
    commitmentType: 0,
    claimType: 0,
    claimMode: 0,
    contributorPolicy: 0,
    onBehalfOf: HOLDER,
    domainTags: [1, 2],
    requirements: [{ actionUID: 44n, requiredCount: 2 }],
    unitLabel: "hours",
    targetUnits: 10n,
    requiresAssessment: true,
    dueDate: 2_000_000_000n,
    metadataCID: "bafy-commitment",
    needUID: `0x${"34".repeat(32)}`,
    counterCommitmentId: 0n,
    confirmers: [OTHER],
    confirmationThreshold: 1,
    protocolFallbackEnabled: false,
    consideration: { rail: 0, source: HOLDER, token: OTHER, amount: 0n },
    declaredUnitValue: 25n,
    declaredValueBasis: "G$/hour",
    gardenAddress: GARDEN,
    ...overrides,
  };
}

function commitmentReadModel(overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  const onchainState = overrides.onchainState ?? overrides.state ?? "ACCEPTED";
  return {
    id: "42161-1",
    chainId: 42161,
    commitmentId: 1n,
    creationSeen: true,
    onchainState,
    state: onchainState,
    derivedState: "ACTIVE",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    poolId: 7n,
    commitmentSeriesId: null,
    creator: HOLDER,
    leadProvider: HOLDER,
    unitLabel: "hours",
    targetUnits: 1n,
    needUID: null,
    counterCommitmentId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    confirmers: [],
    contributorCount: 0,
    contributorsFrozen: false,
    considerationPaid: false,
    ...overrides,
  };
}

describe("commitment job authority and recovery boundary", () => {
  it("recovers a confirmed series after the creator is no longer a current member", async () => {
    const job = seriesJob();
    const hasMembership = vi.fn().mockResolvedValue(false);
    const send = vi.fn();

    const result = await executeCommitmentJob(
      job,
      executionDependencies({
        hasMembership,
        readSeriesId: vi.fn().mockResolvedValue(33n),
        readSeries: vi.fn().mockResolvedValue({
          poolId: job.payload.poolId,
          createdBy: HOLDER,
          metadataCID: "mutable-after-creation",
          creationPayloadHash: hashSeriesCreationPayload(
            job.payload.poolId,
            job.payload.metadataCID
          ),
        }),
        send,
      })
    );

    expect(result).toEqual({ status: "recovered", entityId: 33n });
    expect(hasMembership).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps a submitted first send in read-through recovery even after membership loss", async () => {
    const hasMembership = vi.fn().mockResolvedValue(false);
    const send = vi.fn();
    const result = await executeCommitmentJob(
      { ...seriesJob(), submittedTxHash: `0x${"56".repeat(32)}` },
      executionDependencies({ hasMembership, send })
    );

    expect(result).toEqual({ status: "waiting", reason: "pending-first-send" });
    expect(hasMembership).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    false,
    null,
  ])("fails an unsent Garden-scoped mutation closed when membership is %s", async (membership) => {
    const send = vi.fn();
    const hasMembership = vi.fn().mockResolvedValue(membership);
    const result = await executeCommitmentJob(
      seriesJob(),
      executionDependencies({ hasMembership, send })
    );

    expect(result).toEqual({ status: "waiting", reason: "membership-unavailable" });
    expect(hasMembership).toHaveBeenCalledWith(GARDEN, HOLDER);
    expect(send).not.toHaveBeenCalled();
  });

  it("checks membership only after resolving local dependencies, then sends the materialized id", async () => {
    const payload = commitmentPayload({
      commitmentSeriesClientId: "series-local-1",
      commitmentSeriesId: 0n,
    });
    const resolveSeriesId = vi.fn().mockResolvedValue(55n);
    const hasMembership = vi.fn().mockResolvedValue(true);
    const send = vi.fn().mockResolvedValue(`0x${"78".repeat(32)}`);
    const result = await executeCommitmentJob(
      {
        id: "commitment-job",
        kind: "commitment",
        payload,
        chainId: 42161,
        moduleAddress: MODULE,
        userAddress: HOLDER,
      },
      executionDependencies({ resolveSeriesId, hasMembership, send })
    );

    expect(result).toEqual({ status: "sent", txHash: `0x${"78".repeat(32)}` });
    expect(resolveSeriesId).toHaveBeenCalledWith("series-local-1");
    expect(hasMembership).toHaveBeenCalledWith(GARDEN, HOLDER);
    expect(resolveSeriesId.mock.invocationCallOrder[0]).toBeLessThan(
      hasMembership.mock.invocationCallOrder[0]
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ commitmentSeriesId: 55n }) })
    );
  });

  it("does not invent a membership requirement for an existing-commitment operation", async () => {
    const hasMembership = vi.fn().mockResolvedValue(false);
    const send = vi.fn().mockResolvedValue(`0x${"90".repeat(32)}`);
    const result = await executeCommitmentJob(
      {
        id: "claim-job",
        kind: "claim",
        payload: { commitmentId: 9n, kind: 0, gardenContext: GARDEN },
        chainId: 42161,
        moduleAddress: MODULE,
        userAddress: HOLDER,
      },
      executionDependencies({ hasMembership, send })
    );

    expect(result).toEqual({ status: "sent", txHash: `0x${"90".repeat(32)}` });
    expect(hasMembership).not.toHaveBeenCalled();
  });

  it("propagates transport failures so the queue can retain and retry the job", async () => {
    const failure = new Error("wallet transport unavailable");
    await expect(
      executeCommitmentJob(
        seriesJob(),
        executionDependencies({
          hasMembership: vi.fn().mockResolvedValue(true),
          send: vi.fn().mockRejectedValue(failure),
        })
      )
    ).rejects.toBe(failure);
  });
});

describe("commitment job identity and conflict boundaries", () => {
  it("rejects invalid identity inputs before producing a persistent key", () => {
    expect(() =>
      createSeriesCreationRequestKey({
        chainId: 0,
        moduleAddress: MODULE,
        holder: HOLDER,
        clientSeriesId: "series-local-1",
      })
    ).toThrow("invalid chain");
    expect(() =>
      createCommitmentCreationRequestKey({
        chainId: 42161,
        moduleAddress: "not-an-address" as `0x${string}`,
        creator: HOLDER,
        clientCommitmentId: "commitment-local-1",
      })
    ).toThrow("invalid address");
    expect(() =>
      createWorkLinkOperationKey({
        chainId: 42161,
        moduleAddress: MODULE,
        caller: HOLDER,
        clientOperationId: "",
      })
    ).toThrow("client id is required");
  });

  it("scopes identities to chain, module, caller, and client id", () => {
    const base = {
      chainId: 42161,
      moduleAddress: MODULE,
      caller: HOLDER,
      clientOperationId: "work-local-1",
    } as const;
    const key = createWorkLinkOperationKey(base);
    expect(
      new Set([
        key,
        createWorkLinkOperationKey({ ...base, chainId: 42220 }),
        createWorkLinkOperationKey({ ...base, caller: OTHER }),
        createWorkLinkOperationKey({ ...base, clientOperationId: "work-local-2" }),
      ]).size
    ).toBe(4);
  });

  it("prepares only the three idempotent identity-bearing payloads", () => {
    const claim = { commitmentId: 9n, kind: 0, gardenContext: GARDEN };
    const prepared = prepareCommitmentJobPayload({
      kind: "claim",
      payload: claim,
      chainId: 42161,
      moduleAddress: MODULE,
      userAddress: HOLDER,
    });
    expect(prepared).toEqual(claim);
    expect(prepared).not.toBe(claim);
  });

  it("preserves frozen hash semantics for default confirmation and exact Work-link inputs", () => {
    const withoutConfirmers = commitmentPayload({ confirmers: [], confirmationThreshold: 0 });
    expect(
      hashCommitmentCreationPayload(
        commitmentPayload({ confirmers: [], confirmationThreshold: 99 })
      )
    ).toBe(hashCommitmentCreationPayload(withoutConfirmers));
    expect(
      hashCommitmentCreationPayload(
        commitmentPayload({ confirmers: [OTHER], confirmationThreshold: 2 })
      )
    ).not.toBe(hashCommitmentCreationPayload(commitmentPayload()));
    expect(hashWorkLinkPayload(9n, `0x${"ab".repeat(32)}`, 2)).not.toBe(
      hashWorkLinkPayload(9n, `0x${"ab".repeat(32)}`, 3)
    );
  });
});

describe("commitment read-model materialization boundary", () => {
  it("rejects placeholder-only entities whose mandatory seen flag is absent", () => {
    expect(() => mapPool({ id: "42161-7", registrationSeen: false })).toThrow(
      "unseen commitment pool placeholder"
    );
    expect(() => mapCycle({ id: "42161-8", seedSeen: false })).toThrow(
      "unseen commitment cycle placeholder"
    );
    expect(() => mapSeries({ id: "42161-9", creationSeen: false })).toThrow(
      "unseen commitment series placeholder"
    );
    expect(() => mapClaim({ id: "42161-10", requestSeen: false })).toThrow(
      "unseen claim request placeholder"
    );
  });

  it("keeps a Commitment placeholder explicitly unseen until list selection filters it", () => {
    const placeholder = mapCommitment({
      id: "42161-9",
      chainId: "42161",
      commitmentId: "9",
      creationSeen: false,
      state: "ACCEPTED",
      approvedUnits: "0",
      evidenceCount: "0",
      targetUnits: "1",
    });
    expect(placeholder.creationSeen).toBe(false);
    expect(selectSeenCommitments([placeholder])).toEqual([]);
  });

  it("normalizes indexed scalar types without collapsing exact unit-label identity", () => {
    const lower = mapUnitSummary({
      id: "42161-POOL-7-0xAB",
      chainId: "42161",
      scope: "POOL",
      scopeId: "7",
      poolId: "7",
      cycleId: null,
      unitLabel: "hours",
      unitLabelHash: "0xAB",
      expectedUnits: "10",
      approvedUnits: "2",
      fulfilledUnits: "1",
      openUnits: "9",
      updatedAt: "12",
    });
    const upper = mapUnitSummary({ ...lower, id: "other", unitLabel: "Hours" });
    expect(lower).toMatchObject({
      chainId: 42161,
      scopeId: 7n,
      unitLabel: "hours",
      unitLabelHash: "0xab",
      expectedUnits: 10n,
    });
    expect(upper.unitLabel).toBe("Hours");
    expect(upper.unitLabel).not.toBe(lower.unitLabel);
  });
});

describe("commitment derived-state and aggregation selectors", () => {
  it.each([
    ["DISPUTED", "DISPUTED"],
    ["CANCELLED", "CANCELLED"],
    ["EXPIRED", "EXPIRED"],
    ["READY_FOR_CONFIRMATION", "READY_FOR_CONFIRMATION"],
    ["OFFERED", "OFFERED"],
  ] as const)("preserves the material %s state", (onchainState, expected) => {
    expect(deriveCommitmentState(commitmentReadModel({ onchainState }))).toBe(expected);
  });

  it("derives accepted progress and only reconciles fulfilled commitments in a real terminal cycle", () => {
    expect(deriveCommitmentState(commitmentReadModel({ evidenceCount: 1 }))).toBe(
      "EVIDENCE_SUBMITTED"
    );
    expect(
      deriveCommitmentState(commitmentReadModel({ evidenceCount: 1, approvedUnits: 1n }))
    ).toBe("PARTIALLY_APPROVED");
    expect(
      deriveCommitmentState(
        commitmentReadModel({ onchainState: "FULFILLED", cycleId: 8n }),
        "COMPOSTED"
      )
    ).toBe("RECONCILED");
    expect(
      deriveCommitmentState(
        commitmentReadModel({ onchainState: "FULFILLED", cycleId: 0n }),
        "RECONCILED"
      )
    ).toBe("FULFILLED");
  });

  it("sums only seen positive declarations within an exact case-sensitive basis", () => {
    expect(
      selectDeclaredValueSummaries([
        commitmentReadModel({ declaredValueBasis: "G$", declaredUnitValue: 2n, targetUnits: 3n }),
        commitmentReadModel({ declaredValueBasis: "G$", declaredUnitValue: 4n, targetUnits: 5n }),
        commitmentReadModel({ declaredValueBasis: "g$", declaredUnitValue: 10n, targetUnits: 2n }),
        commitmentReadModel({
          creationSeen: false,
          declaredValueBasis: "G$",
          declaredUnitValue: 1_000n,
        }),
        commitmentReadModel({ declaredValueBasis: "G$", declaredUnitValue: 0n }),
        commitmentReadModel({ declaredValueBasis: "", declaredUnitValue: 2n }),
      ])
    ).toEqual([
      { declaredValueBasis: "G$", commitmentCount: 2, declaredValue: 26n },
      { declaredValueBasis: "g$", commitmentCount: 1, declaredValue: 20n },
    ]);
  });
});

describe("commitment safety and lifecycle selectors", () => {
  const readiness = {
    state: "ACCEPTED",
    commitmentKind: "DOMAIN_IMPACT" as const,
    poolOpen: true,
    cycleId: 8n,
    cycleState: "OPEN",
    requirements: [{ requiredCount: 2, approvedCount: 2 }],
    evidenceCount: 0,
    requiresAssessment: false,
    assessmentUID: null,
    totalVerifiedCredits: 1,
    linkedWorkFresh: true,
    ordinaryConfirmationReachable: true,
    protocolFallbackEnabled: false,
    protocolPoolRegistered: false,
  };

  it("reports every independent readiness blocker in deterministic order", () => {
    expect(
      selectCommitmentReadiness({
        ...readiness,
        state: "OFFERED",
        poolOpen: false,
        cycleState: "CLOSED",
        requirements: [{ requiredCount: 2, approvedCount: 1 }],
        requiresAssessment: true,
        assessmentUID: ZERO_HASH,
        totalVerifiedCredits: 0,
        linkedWorkFresh: false,
        ordinaryConfirmationReachable: false,
      })
    ).toEqual({
      ready: false,
      blockers: [
        "wrong-state",
        "pool-not-open",
        "cycle-not-open",
        "requirements-incomplete",
        "assessment-required",
        "verified-credit-required",
        "linked-work-stale",
        "confirmation-unreachable",
      ],
    });
  });

  it("allows override to skip proof policy but not assessment, credit, freshness, or reachability", () => {
    expect(
      selectCommitmentReadiness({
        ...readiness,
        override: true,
        requirements: [],
        requiresAssessment: true,
        assessmentUID: "0x1234",
        ordinaryConfirmationReachable: false,
        protocolFallbackEnabled: true,
        protocolPoolRegistered: true,
      })
    ).toEqual({ ready: true, blockers: [] });
    expect(
      selectCommitmentReadiness({
        ...readiness,
        commitmentKind: "SUPPORT_SERVICE",
        requirements: [],
        evidenceCount: 0,
      }).blockers
    ).toEqual(["evidence-required"]);
  });

  it("caps display progress while preserving the audited approved count", () => {
    expect(
      selectRequirementProgress([
        { requirementIndex: 0, requiredCount: 2, approvedCount: 3 },
        { requirementIndex: 1, requiredCount: 0, approvedCount: 0 },
      ])
    ).toEqual([
      {
        requirementIndex: 0,
        requiredCount: 2,
        approvedCount: 3,
        approvedForProgress: 2,
        complete: true,
      },
      {
        requirementIndex: 1,
        requiredCount: 0,
        approvedCount: 0,
        approvedForProgress: 0,
        complete: false,
      },
    ]);
  });

  it("applies claim identity and Garden-target exclusions case-insensitively", () => {
    expect(
      selectClaimPreflight({
        state: "ACCEPTED",
        creator: HOLDER,
        claimant: HOLDER.toUpperCase() as `0x${string}`,
        claimType: "GARDEN",
        poolType: "GARDEN",
        creatorOperatesGarden: true,
        gardenContext: GARDEN,
        protocolGarden: GARDEN.toUpperCase() as `0x${string}`,
      })
    ).toEqual({
      allowed: false,
      blockers: [
        "wrong-state",
        "creator-cannot-claim",
        "garden-claim-disabled-in-garden-pool",
        "creator-operated-garden",
        "protocol-self-target",
      ],
    });
  });

  it("keeps every credited or frozen contributor removal blocker visible", () => {
    expect(
      selectContributorRemoval({
        active: false,
        isLead: true,
        approvedWorkCredits: 1,
        evidenceCredits: 1,
        uncountedLinkedWorkCount: 1,
        rosterFrozen: true,
      })
    ).toEqual({
      allowed: false,
      blockers: [
        "not-active",
        "lead-provider",
        "approved-work-credit",
        "evidence-credit",
        "linked-work",
        "roster-frozen",
      ],
    });
  });

  it.each([
    [{ viewer: undefined }, { allowed: false, path: null, reason: "unauthenticated" }],
    [{ state: "ACCEPTED" }, { allowed: false, path: null, reason: "wrong-state" }],
    [{ alreadyConfirmed: true }, { allowed: false, path: null, reason: "already-confirmed" }],
    [{ ordinaryEligible: true }, { allowed: true, path: "ORDINARY", reason: null }],
    [
      { ordinaryReachable: false, localFallbackSteward: true },
      { allowed: true, path: "POOL_FALLBACK", reason: null },
    ],
    [
      {
        ordinaryReachable: false,
        protocolFallbackEnabled: true,
        protocolFallbackSteward: true,
      },
      { allowed: true, path: "PROTOCOL_FALLBACK", reason: null },
    ],
    [{}, { allowed: false, path: null, reason: "not-eligible" }],
  ] as const)("selects the confirmation path for %#", (overrides, expected) => {
    expect(
      selectConfirmationEligibility({
        state: "READY_FOR_CONFIRMATION",
        viewer: HOLDER,
        contributors: [],
        alreadyConfirmed: false,
        ordinaryEligible: false,
        ordinaryReachable: true,
        localFallbackSteward: false,
        protocolFallbackSteward: false,
        protocolFallbackEnabled: false,
        ...overrides,
      })
    ).toEqual(expected);
  });

  it("derives cycle review only after the time boundary or when all live work is ready", () => {
    expect(
      selectCycleDerivedState({
        state: "OPEN",
        endTime: 10n,
        now: 10n,
        liveCommitmentCount: 1n,
        readyCommitmentCount: 0n,
      })
    ).toBe("IN_PROGRESS");
    expect(
      selectCycleDerivedState({
        state: "OPEN",
        endTime: 10n,
        now: 11n,
        liveCommitmentCount: 1n,
        readyCommitmentCount: 0n,
      })
    ).toBe("REVIEWING");
    expect(
      selectCycleDerivedState({
        state: "CLOSED",
        now: 11n,
        liveCommitmentCount: 0n,
        readyCommitmentCount: 0n,
      })
    ).toBe("CLOSED");
  });

  it("fails pool closure and Hypercert composition closed on incomplete lifecycle state", () => {
    expect(
      selectPoolClosureEligibility({ liveCommitmentCount: 1n, nonTerminalCycleCount: 1n })
    ).toEqual({ allowed: false, blockers: ["live-commitments", "non-terminal-cycles"] });
    expect(
      selectHypercertCycleEligibility({
        cycleId: 0n,
        cycleState: "OPEN",
        commitmentStates: [],
      })
    ).toEqual({
      allowed: false,
      blockers: ["cycle-required", "cycle-not-reconciled", "unfulfilled-commitment"],
    });
    expect(
      selectHypercertCycleEligibility({
        cycleId: 8n,
        cycleState: "RECONCILED",
        commitmentStates: ["FULFILLED"],
      })
    ).toEqual({ allowed: true, blockers: [] });
  });

  it("fails availability closed at each ledger stage", () => {
    const capability = {
      deployment: "deployed" as const,
      activation: "active" as const,
      integration: "integrated" as const,
      availability: "available" as const,
      evidence: [],
      verified_at: "2026-08-16",
    };
    expect(
      selectCommitmentPoolingAvailability({ ...capability, deployment: "not-deployed" })
    ).toMatchObject({ status: "unavailable", reason: "not-deployed" });
    expect(
      selectCommitmentPoolingAvailability({ ...capability, activation: "inactive" })
    ).toMatchObject({ status: "unavailable", reason: "not-activated" });
    expect(
      selectCommitmentPoolingAvailability({ ...capability, availability: "deployed-not-available" })
    ).toMatchObject({ status: "unavailable", reason: "not-integrated" });
    expect(selectCommitmentPoolingAvailability(capability)).toMatchObject({ status: "available" });
  });
});
