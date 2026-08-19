import { describe, expect, it, vi } from "vitest";

import {
  COMMITMENT_JOB_KINDS,
  createCommitmentCreationRequestKey,
  createSeriesCreationRequestKey,
  createWorkLinkOperationKey,
  executeCommitmentJob,
  hashCommitmentCreationPayload,
  hashSeriesCreationPayload,
  hashWorkLinkPayload,
  prepareCommitmentJobPayload,
  type CommitmentCreationPayload,
  type CommitmentJob,
  type CommitmentJobExecutionDependencies,
  type CommitmentSeriesJobPayload,
  type WorkLinkJobPayload,
} from "../modules/commitment-pooling/jobs";

const MODULE = "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a" as const;
const HOLDER = "0x1111111111111111111111111111111111111111" as const;
const GARDEN = "0x2222222222222222222222222222222222222222" as const;
const OTHER = "0x3333333333333333333333333333333333333333" as const;
const ZERO_HASH = `0x${"00".repeat(32)}` as const;

function dependencies(
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

describe("commitment offline job vocabulary", () => {
  it("contains the six frozen kinds and no online settlement/transfer kind", () => {
    expect(COMMITMENT_JOB_KINDS).toEqual([
      "commitmentSeries",
      "commitment",
      "claim",
      "evidence",
      "workLink",
      "confirmation",
    ]);
    expect(COMMITMENT_JOB_KINDS).not.toContain("settlement");
    expect(COMMITMENT_JOB_KINDS).not.toContain("funding");
    expect(COMMITMENT_JOB_KINDS).not.toContain("transfer");
  });
});

describe("stable offline identities", () => {
  it("matches the frozen Solidity creation hash for packed dynamic arrays", () => {
    expect(hashCommitmentCreationPayload(commitmentPayload())).toBe(
      "0x2f8301bb534e5086d62c3cd4706f9bfc1e2af673d982d76639874ea7b3ee1a11"
    );
  });

  it("derives deterministic non-zero keys scoped by chain, module, caller, and private id", () => {
    const series = createSeriesCreationRequestKey({
      chainId: 42161,
      moduleAddress: MODULE,
      holder: HOLDER,
      clientSeriesId: "series-local-1",
    });
    const commitment = createCommitmentCreationRequestKey({
      chainId: 42161,
      moduleAddress: MODULE,
      creator: HOLDER,
      clientCommitmentId: "commitment-local-1",
    });
    const work = createWorkLinkOperationKey({
      chainId: 42161,
      moduleAddress: MODULE,
      caller: HOLDER,
      clientOperationId: "work-link-local-1",
    });
    expect(series).toMatch(/^0x[0-9a-f]{64}$/);
    expect(commitment).toMatch(/^0x[0-9a-f]{64}$/);
    expect(work).toMatch(/^0x[0-9a-f]{64}$/);
    expect(new Set([series, commitment, work])).toHaveLength(3);
    expect(
      createSeriesCreationRequestKey({
        chainId: 42161,
        moduleAddress: MODULE,
        holder: HOLDER,
        clientSeriesId: "series-local-1",
      })
    ).toBe(series);
  });

  it("derives the persisted identity fields immediately before queue storage", () => {
    const series = prepareCommitmentJobPayload({
      kind: "commitmentSeries",
      payload: {
        clientSeriesId: "series-local-1",
        creationRequestKey: ZERO_HASH,
        poolId: 7n,
        gardenAddress: GARDEN,
        metadataCID: "bafy-series",
      },
      chainId: 42161,
      moduleAddress: MODULE,
      userAddress: HOLDER,
    });
    const commitment = prepareCommitmentJobPayload({
      kind: "commitment",
      payload: commitmentPayload({ creationRequestKey: ZERO_HASH }),
      chainId: 42161,
      moduleAddress: MODULE,
      userAddress: HOLDER,
    });
    const workLink = prepareCommitmentJobPayload({
      kind: "workLink",
      payload: {
        clientOperationId: "work-link-local-1",
        commitmentId: 9n,
        workUID: `0x${"ab".repeat(32)}`,
        requirementIndex: 2,
        operationKey: ZERO_HASH,
      },
      chainId: 42161,
      moduleAddress: MODULE,
      userAddress: HOLDER,
    });
    expect(series.creationRequestKey).toBe(
      createSeriesCreationRequestKey({
        chainId: 42161,
        moduleAddress: MODULE,
        holder: HOLDER,
        clientSeriesId: "series-local-1",
      })
    );
    expect(commitment.creationRequestKey).toBe(
      createCommitmentCreationRequestKey({
        chainId: 42161,
        moduleAddress: MODULE,
        creator: HOLDER,
        clientCommitmentId: "commitment-local-1",
      })
    );
    expect(workLink.operationKey).toBe(
      createWorkLinkOperationKey({
        chainId: 42161,
        moduleAddress: MODULE,
        caller: HOLDER,
        clientOperationId: "work-link-local-1",
      })
    );
  });
});

describe("commitment series recovery", () => {
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
  const job: CommitmentJob<"commitmentSeries"> = {
    id: "job-1",
    kind: "commitmentSeries",
    payload,
    chainId: 42161,
    moduleAddress: MODULE,
    userAddress: HOLDER,
  };

  it("binds a canonical matching read-through without broadcasting", async () => {
    const send = vi.fn();
    const result = await executeCommitmentJob(job, {
      readSeriesId: vi.fn().mockResolvedValue(33n),
      readSeries: vi.fn().mockResolvedValue({
        poolId: 7n,
        createdBy: HOLDER,
        metadataCID: "changed-after-creation",
        creationPayloadHash: hashSeriesCreationPayload(7n, "bafy-series"),
      }),
      readPoolGarden: vi.fn().mockResolvedValue(GARDEN),
      readCommitmentId: vi.fn(),
      readCommitment: vi.fn(),
      readWorkLinkPayloadHash: vi.fn(),
      send,
    });
    expect(result).toEqual({ status: "recovered", entityId: 33n });
    expect(send).not.toHaveBeenCalled();
  });

  it("fails terminally when a non-zero lookup does not match the persisted payload", async () => {
    const result = await executeCommitmentJob(job, {
      readSeriesId: vi.fn().mockResolvedValue(33n),
      readSeries: vi.fn().mockResolvedValue({
        poolId: 8n,
        createdBy: HOLDER,
        metadataCID: "bafy-series",
        creationPayloadHash: hashSeriesCreationPayload(8n, "bafy-series"),
      }),
      readPoolGarden: vi.fn().mockResolvedValue(GARDEN),
      readCommitmentId: vi.fn(),
      readCommitment: vi.fn(),
      readWorkLinkPayloadHash: vi.fn(),
      send: vi.fn(),
    });
    expect(result).toEqual({ status: "identity-conflict", reason: "series-payload-mismatch" });
  });

  it("does not rebroadcast while a first send is awaiting read-through materialization", async () => {
    const send = vi.fn();
    const result = await executeCommitmentJob(
      { ...job, submittedTxHash: `0x${"56".repeat(32)}` },
      dependencies({ readSeriesId: vi.fn().mockResolvedValue(0n), send })
    );
    expect(result).toEqual({ status: "waiting", reason: "pending-first-send" });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("commitment creation recovery", () => {
  const job = (payload = commitmentPayload()): CommitmentJob<"commitment"> => ({
    id: "job-commitment",
    kind: "commitment",
    payload,
    chainId: 42161,
    moduleAddress: MODULE,
    userAddress: HOLDER,
  });

  it("waits for a series dependency without reading or sending the commitment", async () => {
    const readCommitmentId = vi.fn();
    const send = vi.fn();
    const result = await executeCommitmentJob(
      job(
        commitmentPayload({
          commitmentSeriesId: 0n,
          commitmentSeriesClientId: "series-local-1",
        })
      ),
      dependencies({
        resolveSeriesId: vi.fn().mockResolvedValue(null),
        readCommitmentId,
        send,
      })
    );
    expect(result).toEqual({ status: "waiting", reason: "series-not-materialized" });
    expect(readCommitmentId).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("binds an exact canonical commitment and rejects the same key with another payload", async () => {
    const payload = commitmentPayload();
    const exact = await executeCommitmentJob(
      job(payload),
      dependencies({
        readCommitmentId: vi.fn().mockResolvedValue(91n),
        readCommitment: vi.fn().mockResolvedValue({
          poolId: payload.poolId,
          creator: HOLDER,
          creationPayloadHash: hashCommitmentCreationPayload(payload),
        }),
      })
    );
    const conflict = await executeCommitmentJob(
      job(payload),
      dependencies({
        readCommitmentId: vi.fn().mockResolvedValue(91n),
        readCommitment: vi.fn().mockResolvedValue({
          poolId: payload.poolId,
          creator: HOLDER,
          creationPayloadHash: hashCommitmentCreationPayload(
            commitmentPayload({ declaredUnitValue: 26n })
          ),
        }),
      })
    );
    expect(exact).toEqual({ status: "recovered", entityId: 91n });
    expect(conflict).toEqual({
      status: "identity-conflict",
      reason: "commitment-payload-mismatch",
    });
  });

  it("holds a submitted commitment until the canonical lookup materializes", async () => {
    const send = vi.fn();
    const result = await executeCommitmentJob(
      { ...job(), submittedTxHash: `0x${"78".repeat(32)}` },
      dependencies({ send })
    );
    expect(result).toEqual({ status: "waiting", reason: "pending-first-send" });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("work-link recovery", () => {
  const payload: WorkLinkJobPayload = {
    clientOperationId: "work-link-local-1",
    commitmentId: 9n,
    workUID: `0x${"ab".repeat(32)}`,
    requirementIndex: 2,
    operationKey: createWorkLinkOperationKey({
      chainId: 42161,
      moduleAddress: MODULE,
      caller: HOLDER,
      clientOperationId: "work-link-local-1",
    }),
  };

  it("treats an exact prior operation as complete even after a later unlink", async () => {
    const result = await executeCommitmentJob(
      {
        id: "job-work",
        kind: "workLink",
        payload,
        chainId: 42161,
        moduleAddress: MODULE,
        userAddress: HOLDER,
      },
      {
        readSeriesId: vi.fn(),
        readSeries: vi.fn(),
        readPoolGarden: vi.fn(),
        readCommitmentId: vi.fn(),
        readCommitment: vi.fn(),
        readWorkLinkPayloadHash: vi
          .fn()
          .mockResolvedValue(hashWorkLinkPayload(payload.commitmentId, payload.workUID, 2)),
        send: vi.fn(),
      }
    );
    expect(result).toEqual({ status: "recovered" });
  });

  it("rejects operation-key reuse for a different Work-link payload", async () => {
    const result = await executeCommitmentJob(
      {
        id: "job-work",
        kind: "workLink",
        payload,
        chainId: 42161,
        moduleAddress: MODULE,
        userAddress: HOLDER,
      },
      dependencies({
        readWorkLinkPayloadHash: vi
          .fn()
          .mockResolvedValue(hashWorkLinkPayload(payload.commitmentId, payload.workUID, 3)),
      })
    );
    expect(result).toEqual({
      status: "identity-conflict",
      reason: "work-link-payload-mismatch",
    });
  });
});
