/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The queue-level identity tests below run `jobQueue.addJob` against a real
// (fake) IndexedDB, so the queue's heavy edges are stubbed the same way the
// core queue tests stub them.
import "fake-indexeddb/auto";

vi.mock("../config/appkit", () => ({
  getWagmiConfig: () => ({}),
  getAppKit: () => null,
}));
vi.mock("@wagmi/core", () => ({
  getPublicClient: vi.fn(() => ({ readContract: vi.fn() })),
  readContract: vi.fn(),
}));
vi.mock("../modules/app/posthog", () => ({ track: vi.fn() }));
vi.mock("../ontology/query", () => ({
  getOntologyChainMaturity: () => ({
    deployment: "deployed",
    activation: "active",
    integration: "integrated",
    availability: "available",
    evidence: [],
    verified_at: "2026-08-21",
  }),
}));
vi.mock("../utils/blockchain/contracts", async () => {
  const actual = await vi.importActual<typeof import("../utils/blockchain/contracts")>(
    "../utils/blockchain/contracts"
  );
  return {
    ...actual,
    getNetworkContracts: () => ({
      commitmentPoolingModule: "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a",
    }),
  };
});

import { jobQueue, jobQueueDB } from "../modules/job-queue";
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

describe("membership preflight covers every membership-gated act", () => {
  const SENT = `0x${"12".repeat(32)}`;
  const gated = [
    {
      kind: "claim" as const,
      payload: { commitmentId: 9n, kind: 1, gardenContext: GARDEN, gardenAddress: GARDEN },
    },
    {
      kind: "evidence" as const,
      payload: {
        commitmentId: 9n,
        cid: "bafy-proof",
        creditedContributors: [HOLDER],
        gardenAddress: GARDEN,
      },
    },
    {
      kind: "workLink" as const,
      payload: {
        clientOperationId: "work-link-local-1",
        commitmentId: 9n,
        workUID: `0x${"ab".repeat(32)}` as const,
        requirementIndex: 0,
        operationKey: createWorkLinkOperationKey({
          chainId: 42161,
          moduleAddress: MODULE,
          caller: HOLDER,
          clientOperationId: "work-link-local-1",
        }),
        gardenAddress: GARDEN,
      },
    },
    {
      kind: "confirmation" as const,
      payload: { action: "confirm" as const, commitmentId: 9n, gardenAddress: GARDEN },
    },
  ];
  const jobFor = (entry: (typeof gated)[number]): CommitmentJob =>
    ({
      id: `job-${entry.kind}`,
      kind: entry.kind,
      payload: entry.payload,
      chainId: 42161,
      moduleAddress: MODULE,
      userAddress: HOLDER,
    }) as CommitmentJob;

  it.each(
    gated
  )("holds a $kind job as waiting while the account has no hat in its garden", async (entry) => {
    const send = vi.fn();
    const hasMembership = vi.fn().mockResolvedValue(false);
    const result = await executeCommitmentJob(jobFor(entry), dependencies({ hasMembership, send }));

    expect(result).toEqual({ status: "waiting", reason: "membership-unavailable" });
    expect(hasMembership).toHaveBeenCalledWith(GARDEN, HOLDER);
    expect(send).not.toHaveBeenCalled();
  });

  it.each(gated)("sends a $kind job once membership is confirmed", async (entry) => {
    const send = vi.fn().mockResolvedValue(SENT);
    const result = await executeCommitmentJob(
      jobFor(entry),
      dependencies({ hasMembership: vi.fn().mockResolvedValue(true), send })
    );

    expect(result).toEqual({ status: "sent", txHash: SENT });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("still sends a job queued before the garden rode along, rather than stranding it", async () => {
    // Persisted before 2026-08-21: no gardenAddress on the record. It keeps
    // the behaviour it was queued with, a send with no preflight, instead of
    // waiting on a garden it cannot name.
    const legacy = {
      id: "job-legacy",
      kind: "confirmation",
      payload: { action: "confirm", commitmentId: 9n },
      chainId: 42161,
      moduleAddress: MODULE,
      userAddress: HOLDER,
    } as unknown as CommitmentJob;
    const send = vi.fn().mockResolvedValue(SENT);
    const hasMembership = vi.fn().mockResolvedValue(false);

    const result = await executeCommitmentJob(legacy, dependencies({ hasMembership, send }));

    expect(result).toEqual({ status: "sent", txHash: SENT });
    expect(hasMembership).not.toHaveBeenCalled();
  });
});

describe("queue identity for acts that name a commitment", () => {
  async function drain() {
    for (const job of await jobQueueDB.getAllJobsUnfiltered()) {
      await jobQueueDB.deleteJob(job.id);
    }
  }
  beforeEach(drain);
  afterEach(drain);

  const meta = { chainId: 42161 };

  it("returns the existing job when the same claim is enqueued twice", async () => {
    const payload = { commitmentId: 9n, kind: 1, gardenContext: GARDEN, gardenAddress: GARDEN };
    const first = await jobQueue.addJob("claim", payload, HOLDER, meta);
    const second = await jobQueue.addJob("claim", { ...payload }, HOLDER, meta);

    expect(second).toBe(first);
    expect(await jobQueueDB.getJobs({ userAddress: HOLDER, kind: "claim" })).toHaveLength(1);
  });

  it("returns the existing job when the same confirmation is enqueued twice", async () => {
    const payload = { action: "confirm" as const, commitmentId: 9n, gardenAddress: GARDEN };
    const first = await jobQueue.addJob("confirmation", payload, HOLDER, meta);
    const second = await jobQueue.addJob("confirmation", { ...payload }, HOLDER, meta);

    expect(second).toBe(first);
    expect(await jobQueueDB.getJobs({ userAddress: HOLDER, kind: "confirmation" })).toHaveLength(1);
  });

  it("keeps submit and confirm on one commitment as two different acts", async () => {
    const submit = await jobQueue.addJob(
      "confirmation",
      { action: "submit", commitmentId: 9n, gardenAddress: GARDEN },
      HOLDER,
      meta
    );
    const confirm = await jobQueue.addJob(
      "confirmation",
      { action: "confirm", commitmentId: 9n, gardenAddress: GARDEN },
      HOLDER,
      meta
    );

    expect(confirm).not.toBe(submit);
  });

  it("refuses a different payload behind the same identity instead of replacing it", async () => {
    const payload = commitmentPayload({ creationRequestKey: ZERO_HASH });
    await jobQueue.addJob("commitment", payload, HOLDER, meta);

    await expect(
      jobQueue.addJob("commitment", { ...payload, targetUnits: 11n }, HOLDER, meta)
    ).rejects.toThrow(/offline_job_identity_conflict/);
  });

  it("refuses the same claim under a different garden rather than quietly taking the second", async () => {
    const payload = { commitmentId: 9n, kind: 1, gardenContext: GARDEN, gardenAddress: GARDEN };
    await jobQueue.addJob("claim", payload, HOLDER, meta);

    await expect(
      jobQueue.addJob("claim", { ...payload, gardenAddress: OTHER }, HOLDER, meta)
    ).rejects.toThrow(/offline_job_identity_conflict/);
  });

  it("lets a terminally failed act be enqueued afresh rather than deduped against the corpse", async () => {
    const payload = { commitmentId: 9n, kind: 1, gardenContext: GARDEN, gardenAddress: GARDEN };
    const first = await jobQueue.addJob("claim", payload, HOLDER, meta);
    const stored = await jobQueueDB.getJob(first);
    await jobQueueDB.updateJob({ ...stored!, attempts: 5 });

    const retry = await jobQueue.addJob("claim", { ...payload }, HOLDER, meta);

    expect(retry).not.toBe(first);
  });
});
