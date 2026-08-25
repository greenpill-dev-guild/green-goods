/** @vitest-environment node */

import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import type { Config } from "@wagmi/core";
import type { EASConfig } from "../../config/blockchain";
import type {
  CommitmentCreationPayload,
  CommitmentJobExecutionDependencies,
} from "../../modules/commitment-pooling/jobs";
import {
  hashCommitmentCreationPayload,
  hashSeriesCreationPayload,
  hashWorkLinkPayload,
} from "../../modules/commitment-pooling/jobs";
import { createCommitmentChainReads } from "../../modules/job-queue/commitment-chain-reads";
import {
  executeApprovalJob,
  executeCommitmentQueueJob,
  executeWorkJob,
} from "../../modules/job-queue/job-executors";
import { createJobExecutorRegistry } from "../../modules/job-queue/executor-registry";
import type { Address } from "../../types/domain";
import type { ApprovalJobPayload, Job, WorkJobPayload } from "../../types/job-queue";
import { createMockTransactionSender } from "../test-utils/transaction-fakes";
import { MOCK_TX_HASH } from "../test-utils/mock-factories";

const USER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0x2222222222222222222222222222222222222222" as Address;
const MODULE = "0x3333333333333333333333333333333333333333" as Address;
const HASH = `0x${"44".repeat(32)}` as const;
const ZERO_HASH = `0x${"00".repeat(32)}` as const;
const EAS_CONFIG = {
  EAS: { address: "0x5555555555555555555555555555555555555555" },
  WORK: { uid: `0x${"66".repeat(32)}`, schema: "" },
  WORK_APPROVAL: { uid: `0x${"77".repeat(32)}`, schema: "" },
  ASSESSMENT: { uid: ZERO_HASH, schema: "" },
  ASSESSMENT_V3: { uid: ZERO_HASH, schema: "" },
  SCHEMA_REGISTRY: { address: "0x8888888888888888888888888888888888888888" },
} satisfies EASConfig;

function job<T>(kind: string, payload: T, overrides: Partial<Job<T>> = {}): Job<T> {
  return {
    id: `job-${kind}`,
    kind,
    payload,
    createdAt: 1,
    attempts: 0,
    synced: false,
    userAddress: USER,
    ...overrides,
  };
}

function store() {
  return {
    updateJob: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue(undefined),
    getSeriesIdByClientId: vi.fn().mockResolvedValue(null),
    storeClientSeriesIdMapping: vi.fn().mockResolvedValue(undefined),
    storeClientCommitmentIdMapping: vi.fn().mockResolvedValue(undefined),
  };
}

function reads(
  overrides: Partial<CommitmentJobExecutionDependencies> = {}
): CommitmentJobExecutionDependencies {
  return {
    readSeriesId: vi.fn().mockResolvedValue(0n),
    readSeries: vi.fn(),
    readPoolGarden: vi.fn().mockResolvedValue(GARDEN),
    readCommitmentId: vi.fn().mockResolvedValue(0n),
    readCommitment: vi.fn(),
    readWorkLinkPayloadHash: vi.fn().mockResolvedValue(ZERO_HASH),
    readEvidenceAttached: vi.fn().mockResolvedValue(false),
    hasMembership: vi.fn().mockResolvedValue(true),
    send: vi.fn().mockResolvedValue(HASH),
    ...overrides,
  };
}

function commitmentPayload(
  overrides: Partial<CommitmentCreationPayload> = {}
): CommitmentCreationPayload {
  return {
    clientCommitmentId: "client-commitment",
    creationRequestKey: HASH,
    poolId: 1n,
    cycleId: 2n,
    commitmentSeriesId: 3n,
    direction: 0,
    commitmentType: 0,
    claimType: 0,
    claimMode: 0,
    contributorPolicy: 0,
    onBehalfOf: USER,
    domainTags: [],
    requirements: [],
    unitLabel: "hours",
    targetUnits: 1n,
    requiresAssessment: false,
    dueDate: 0n,
    metadataCID: "bafy-ready",
    needUID: ZERO_HASH,
    counterCommitmentId: 0n,
    confirmers: [],
    confirmationThreshold: 0,
    protocolFallbackEnabled: false,
    consideration: { rail: 0, source: USER, token: USER, amount: 0n },
    declaredUnitValue: 0n,
    declaredValueBasis: "",
    gardenAddress: GARDEN,
    ...overrides,
  };
}

describe("work and approval job executors", () => {
  it("splits queued audio from visual media before simulating and encoding work", async () => {
    const image = new File(["image"], "proof.jpg", { type: "image/jpeg" });
    const audio = new File(["audio"], "note.webm", { type: "audio/webm" });
    const simulate = vi.fn().mockResolvedValue(undefined);
    const encodeWork = vi.fn().mockResolvedValue(HASH);
    const sender = createMockTransactionSender();
    const work = job<WorkJobPayload>("work", {
      title: "",
      actionUID: 7,
      gardenAddress: GARDEN,
      feedback: "Done",
      details: {},
      timeSpentMinutes: 30,
      tags: ["soil"],
    });

    await expect(
      executeWorkJob("job-work", work, 11155111, sender, {
        images: vi.fn().mockResolvedValue([
          { id: "image", file: image, url: "blob:image" },
          { id: "audio", file: audio, url: "blob:audio" },
        ]),
        simulate,
        encodeWork,
        easConfig: EAS_CONFIG,
      })
    ).resolves.toBe(MOCK_TX_HASH);

    expect(simulate).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ media: [image], audioNotes: [audio] }),
        images: [image],
      })
    );
    expect(encodeWork).toHaveBeenCalledWith(
      expect.objectContaining({ media: [image], audioNotes: [audio], title: "Action 7" }),
      11155111,
      { gardenAddress: GARDEN, authMode: "passkey" }
    );
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it("encodes and sends an approval through the injected dependencies", async () => {
    const encodeApproval = vi.fn().mockReturnValue(HASH);
    const sender = createMockTransactionSender({ authMode: "wallet" });
    const approval = job<ApprovalJobPayload>("approval", {
      actionUID: 7,
      workUID: HASH,
      gardenAddress: GARDEN,
      gardenerAddress: USER,
      approved: true,
      confidence: 2,
      verificationMethod: 1,
    });

    await expect(
      executeApprovalJob(approval, 11155111, sender, {
        encodeApproval,
        easConfig: EAS_CONFIG,
      })
    ).resolves.toBe(MOCK_TX_HASH);

    expect(encodeApproval).toHaveBeenCalledWith(
      expect.objectContaining({ workUID: HASH }),
      11155111
    );
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it("uses optional work defaults without inventing tags, audio, or details", async () => {
    const encodeWork = vi.fn().mockResolvedValue(HASH);
    const sender = createMockTransactionSender({ authMode: "wallet" });
    const work = job<WorkJobPayload>("work", {
      actionUID: 3,
      gardenAddress: GARDEN,
      feedback: "Done",
    });

    await executeWorkJob("missing-images", work, 11155111, sender, {
      simulate: vi.fn().mockResolvedValue(undefined),
      encodeWork,
    });

    expect(encodeWork).toHaveBeenCalledWith(
      expect.not.objectContaining({ tags: expect.anything(), audioNotes: expect.anything() }),
      11155111,
      expect.objectContaining({ authMode: "wallet" })
    );
    expect(encodeWork.mock.calls[0][0]).toEqual(
      expect.objectContaining({ details: {}, timeSpentMinutes: 0, media: [] })
    );
  });

  it("keeps the production simulator as the default work adapter", async () => {
    const work = job<WorkJobPayload>("work", {
      actionUID: 3,
      gardenAddress: GARDEN,
      feedback: "Done",
    });

    await expect(
      executeWorkJob("job-work", work, 11155111, createMockTransactionSender(), {
        images: vi.fn().mockResolvedValue([]),
        encodeWork: vi.fn().mockResolvedValue(HASH),
        easConfig: EAS_CONFIG,
      })
    ).rejects.toThrow("getWagmiConfig() called before AppKit initialization");
  });

  it("keeps the production work encoder as the default upload adapter", async () => {
    const work = job<WorkJobPayload>("work", {
      actionUID: 3,
      gardenAddress: GARDEN,
      feedback: "Done",
    });

    await expect(
      executeWorkJob("job-work", work, 11155111, createMockTransactionSender(), {
        images: vi.fn().mockResolvedValue([]),
        simulate: vi.fn().mockResolvedValue(undefined),
        easConfig: EAS_CONFIG,
      })
    ).rejects.toThrow("IPFS upload service is not configured");
  });

  it("keeps the production approval encoder and EAS config as defaults", async () => {
    const sender = createMockTransactionSender({ authMode: "wallet" });
    const approval = job<ApprovalJobPayload>("approval", {
      actionUID: 7,
      workUID: HASH,
      gardenAddress: GARDEN,
      gardenerAddress: USER,
      approved: true,
      confidence: 2,
      verificationMethod: 1,
    });

    await expect(executeApprovalJob(approval, 11155111, sender)).resolves.toBe(MOCK_TX_HASH);
  });
});

describe("commitment queue executor", () => {
  it("never reaches reads or sends while demo pooling is active", async () => {
    const chainReads = reads();
    const sender = createMockTransactionSender();

    await expect(
      executeCommitmentQueueJob(
        "job-confirmation",
        job("confirmation", {
          action: "confirm",
          commitmentId: 1n,
          gardenAddress: GARDEN,
        }),
        42161,
        sender,
        { demoActive: () => true, reads: chainReads, store: store() }
      )
    ).resolves.toEqual({ status: "waiting", reason: "demo-mode" });

    expect(chainReads.hasMembership).not.toHaveBeenCalled();
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("waits and persists a metadata attempt when publishing fails", async () => {
    const queueStore = store();
    const queued = job(
      "commitment",
      commitmentPayload({ metadataCID: "", metadata: { version: 1, title: "Compost" } as never })
    );

    await expect(
      executeCommitmentQueueJob("job-commitment", queued, 42161, createMockTransactionSender(), {
        demoActive: () => false,
        reads: reads(),
        store: queueStore,
        uploadJson: vi.fn().mockRejectedValue(new Error("gateway down")),
      })
    ).resolves.toEqual({ status: "waiting", reason: "metadata-unpublished" });

    expect(queued.meta?.metadataAttempts).toBe(1);
    expect(queueStore.updateJob).toHaveBeenCalledOnce();
  });

  it("marks metadata unavailable after the fifth failed publish", async () => {
    const queued = job(
      "commitment",
      commitmentPayload({ metadataCID: "", metadata: { version: 1, title: "Compost" } as never }),
      { meta: { metadataAttempts: 4 } }
    );

    await expect(
      executeCommitmentQueueJob("job-commitment", queued, 42161, createMockTransactionSender(), {
        demoActive: () => false,
        reads: reads(),
        store: store(),
        uploadJson: vi.fn().mockRejectedValue(new Error("gateway down")),
      })
    ).resolves.toEqual({ status: "unavailable", reason: "metadata-unavailable" });
  });

  it("records non-Error metadata failures without losing the retry", async () => {
    const queued = job(
      "commitment",
      commitmentPayload({ metadataCID: "", metadata: { version: 1, title: "Compost" } as never })
    );

    await expect(
      executeCommitmentQueueJob("job-commitment", queued, 42161, createMockTransactionSender(), {
        demoActive: () => false,
        reads: reads(),
        store: store(),
        uploadJson: vi.fn().mockRejectedValue("gateway down"),
      })
    ).resolves.toEqual({ status: "waiting", reason: "metadata-unpublished" });
  });

  it("publishes pending metadata before sending the commitment", async () => {
    const queueStore = store();
    const sender = createMockTransactionSender();
    const queued = job(
      "commitment",
      commitmentPayload({ metadataCID: "", metadata: { version: 1, title: "Compost" } as never })
    );

    await expect(
      executeCommitmentQueueJob("job-commitment", queued, 42161, sender, {
        demoActive: () => false,
        reads: reads(),
        store: queueStore,
        uploadJson: vi.fn().mockResolvedValue({ cid: "bafy-published" }),
      })
    ).resolves.toEqual({ status: "submitted", txHash: MOCK_TX_HASH });

    expect((queued.payload as CommitmentCreationPayload).metadataCID).toBe("bafy-published");
    expect(queueStore.updateJob).toHaveBeenCalledOnce();
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it.each([
    ["claim", { commitmentId: 1n, kind: 0, gardenContext: GARDEN, gardenAddress: GARDEN }],
    ["confirmation", { action: "submit", commitmentId: 1n, gardenAddress: GARDEN }],
    ["confirmation", { action: "confirm", commitmentId: 2n, gardenAddress: GARDEN }],
    [
      "workLink",
      {
        clientOperationId: "operation",
        commitmentId: 1n,
        workUID: HASH,
        requirementIndex: 0,
        operationKey: HASH,
        gardenAddress: GARDEN,
      },
    ],
    [
      "commitmentSeries",
      {
        clientSeriesId: "series",
        creationRequestKey: HASH,
        poolId: 1n,
        gardenAddress: GARDEN,
        metadataCID: "bafy-series",
      },
    ],
  ])("builds and sends the %s contract call", async (kind, payload) => {
    const sender = createMockTransactionSender();
    const result = await executeCommitmentQueueJob(
      `job-${kind}`,
      job(kind, payload),
      42161,
      sender,
      { demoActive: () => false, reads: reads(), store: store() }
    );

    expect(result.status).toBe(kind === "commitmentSeries" ? "submitted" : "complete");
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it("waits while the account has no current garden membership", async () => {
    const sender = createMockTransactionSender();

    await expect(
      executeCommitmentQueueJob(
        "job-claim",
        job("claim", { commitmentId: 1n, kind: 0, gardenContext: GARDEN, gardenAddress: GARDEN }),
        42161,
        sender,
        {
          demoActive: () => false,
          reads: reads({ hasMembership: vi.fn().mockResolvedValue(false) }),
          store: store(),
        }
      )
    ).resolves.toEqual({ status: "waiting", reason: "membership-unavailable" });

    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("sends published evidence through the injected evidence seam", async () => {
    const sender = createMockTransactionSender();
    const publishEvidence = vi.fn().mockResolvedValue({ published: true });

    await expect(
      executeCommitmentQueueJob(
        "job-evidence",
        job("evidence", {
          clientEvidenceId: "evidence",
          commitmentId: 1n,
          cid: "bafy-evidence",
          creditedContributors: [USER],
          gardenAddress: GARDEN,
        }),
        42161,
        sender,
        {
          demoActive: () => false,
          reads: reads(),
          store: store(),
          publishEvidence,
        }
      )
    ).resolves.toEqual({ status: "complete", txHash: MOCK_TX_HASH });

    expect(publishEvidence).toHaveBeenCalledOnce();
    expect(sender.sendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "attachEvidence" })
    );
  });

  it("persists a recovered commitment series mapping", async () => {
    const queueStore = store();
    const payload = {
      clientSeriesId: "series",
      creationRequestKey: HASH,
      poolId: 1n,
      gardenAddress: GARDEN,
      metadataCID: "bafy-series",
    };
    const chainReads = reads({
      readSeriesId: vi.fn().mockResolvedValue(9n),
      readSeries: vi.fn().mockResolvedValue({
        poolId: 1n,
        createdBy: USER,
        metadataCID: "bafy-series",
        creationPayloadHash: hashSeriesCreationPayload(1n, "bafy-series"),
      }),
      readPoolGarden: vi.fn().mockResolvedValue(GARDEN),
    });

    await expect(
      executeCommitmentQueueJob(
        "job-series",
        job("commitmentSeries", payload),
        42161,
        createMockTransactionSender(),
        { demoActive: () => false, reads: chainReads, store: queueStore }
      )
    ).resolves.toEqual({ status: "complete", entityId: 9n });

    expect(queueStore.storeClientSeriesIdMapping).toHaveBeenCalledWith(
      "series",
      9n,
      "job-series",
      42161
    );
  });

  it("persists a recovered commitment mapping", async () => {
    const queueStore = store();
    const payload = commitmentPayload();
    const chainReads = reads({
      readCommitmentId: vi.fn().mockResolvedValue(8n),
      readCommitment: vi.fn().mockResolvedValue({
        poolId: payload.poolId,
        creator: USER,
        creationPayloadHash: hashCommitmentCreationPayload(payload),
      }),
    });

    await expect(
      executeCommitmentQueueJob(
        "job-commitment",
        job("commitment", payload),
        42161,
        createMockTransactionSender(),
        { demoActive: () => false, reads: chainReads, store: queueStore }
      )
    ).resolves.toEqual({ status: "complete", entityId: 8n });

    expect(queueStore.storeClientCommitmentIdMapping).toHaveBeenCalledWith(
      "client-commitment",
      8n,
      "job-commitment",
      42161
    );
  });

  it("recovers a matching work link without an entity mapping", async () => {
    const payload = {
      clientOperationId: "operation",
      commitmentId: 1n,
      workUID: HASH,
      requirementIndex: 0,
      operationKey: HASH,
      gardenAddress: GARDEN,
    };
    const chainReads = reads({
      readWorkLinkPayloadHash: vi.fn().mockResolvedValue(hashWorkLinkPayload(1n, HASH, 0)),
    });

    await expect(
      executeCommitmentQueueJob(
        "job-work-link",
        job("workLink", payload, { meta: { submittedTxHash: HASH } }),
        42161,
        createMockTransactionSender(),
        { demoActive: () => false, reads: chainReads, store: store() }
      )
    ).resolves.toEqual({ status: "complete", entityId: undefined });
  });

  it("waits for deferred Work indexing without sending or consuming identity", async () => {
    const sender = createMockTransactionSender();
    const queued = job("workLink", {
      clientOperationId: "operation",
      commitmentId: 1n,
      clientWorkId: "client-work-1",
      sourceWorkJobId: "job-work",
      requirementIndex: 0,
      operationKey: HASH,
      gardenAddress: GARDEN,
    });

    await expect(
      executeCommitmentQueueJob("job-work-link", queued, 42161, sender, {
        demoActive: () => false,
        reads: reads(),
        store: store(),
        resolveWorkIdentity: vi.fn().mockResolvedValue({ status: "waiting" }),
      })
    ).resolves.toEqual({ status: "waiting", reason: "work-not-indexed" });
    expect(sender.sendContractCall).not.toHaveBeenCalled();
    expect(queued.attempts).toBe(0);
  });

  it("uses one exact deferred UID without mutating the canonical queued payload", async () => {
    const queueStore = store();
    const sender = createMockTransactionSender();
    const queued = job("workLink", {
      clientOperationId: "operation",
      commitmentId: 1n,
      clientWorkId: "client-work-1",
      sourceWorkJobId: "job-work",
      requirementIndex: 0,
      operationKey: HASH,
      gardenAddress: GARDEN,
    });

    await expect(
      executeCommitmentQueueJob("job-work-link", queued, 42161, sender, {
        demoActive: () => false,
        reads: reads(),
        store: queueStore,
        resolveWorkIdentity: vi.fn().mockResolvedValue({ status: "resolved", workUID: HASH }),
      })
    ).resolves.toEqual({ status: "complete", txHash: MOCK_TX_HASH });
    expect((queued.payload as { resolvedWorkUID?: string }).resolvedWorkUID).toBeUndefined();
    expect(queueStore.updateJob).not.toHaveBeenCalled();
    expect(sender.sendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "linkWork", args: [1n, HASH, 0, HASH] })
    );
  });

  it("throws retryable metadata failures so the ordinary retry budget applies", async () => {
    const queued = job("workLink", {
      clientOperationId: "operation",
      commitmentId: 1n,
      clientWorkId: "client-work-1",
      requirementIndex: 0,
      operationKey: HASH,
      gardenAddress: GARDEN,
    });
    await expect(
      executeCommitmentQueueJob("job-work-link", queued, 42161, createMockTransactionSender(), {
        demoActive: () => false,
        reads: reads(),
        store: store(),
        resolveWorkIdentity: vi.fn().mockResolvedValue({
          status: "retryable",
          reason: "work-metadata-unavailable",
        }),
      })
    ).rejects.toThrow("work-metadata-unavailable");
  });

  it("fails deferred links explicitly when the source Work is terminal", async () => {
    const queueStore = store();
    queueStore.getJob.mockResolvedValue(job("work", {}, { attempts: 5, lastError: "failed" }));
    const queued = job("workLink", {
      clientOperationId: "operation",
      commitmentId: 1n,
      clientWorkId: "client-work-1",
      sourceWorkJobId: "job-work",
      requirementIndex: 0,
      operationKey: HASH,
      gardenAddress: GARDEN,
    });

    await expect(
      executeCommitmentQueueJob("job-work-link", queued, 42161, createMockTransactionSender(), {
        demoActive: () => false,
        reads: reads(),
        store: queueStore,
        resolveWorkIdentity: vi.fn(),
      })
    ).resolves.toEqual({ status: "identity-conflict", reason: "source-work-terminal" });
  });

  it("returns identity conflicts without sending or mapping", async () => {
    const payload = {
      clientSeriesId: "series",
      creationRequestKey: HASH,
      poolId: 1n,
      gardenAddress: GARDEN,
      metadataCID: "bafy-series",
    };
    const chainReads = reads({
      readSeriesId: vi.fn().mockResolvedValue(9n),
      readSeries: vi.fn().mockResolvedValue({
        poolId: 2n,
        createdBy: USER,
        metadataCID: "bafy-series",
        creationPayloadHash: HASH,
      }),
      readPoolGarden: vi.fn().mockResolvedValue(GARDEN),
    });

    await expect(
      executeCommitmentQueueJob(
        "job-series",
        job("commitmentSeries", payload),
        42161,
        createMockTransactionSender(),
        { demoActive: () => false, reads: chainReads, store: store() }
      )
    ).resolves.toEqual({ status: "identity-conflict", reason: "series-payload-mismatch" });
  });
});

describe("commitment chain reads", () => {
  it("binds contract reads to the configured module, chain, and wagmi config", async () => {
    const readContract = vi.fn(async (_config, request: { functionName: string }) => {
      if (request.functionName === "getCommitmentSeriesIdByCreationRequest") return 9n;
      if (request.functionName === "getCommitmentSeries") {
        return {
          poolId: 1n,
          createdBy: USER,
          metadataCID: "bafy-series",
          creationPayloadHash: HASH,
        };
      }
      if (request.functionName === "getPool") return { garden: GARDEN };
      if (request.functionName === "getCommitmentIdByCreationRequest") return 8n;
      if (request.functionName === "getCommitment") {
        return { poolId: 1n, creator: USER, creationPayloadHash: HASH };
      }
      if (request.functionName === "isEvidenceAttached") return true;
      if (request.functionName === "getWorkLinkOperationPayloadHash") return HASH;
      if (request.functionName === "isOwner") return true;
      return false;
    });
    const config = {} as Config;
    const chainReads = createCommitmentChainReads({
      chainId: 42161,
      moduleAddress: MODULE,
      readContract: readContract as never,
      config,
    });

    await expect(chainReads.readSeriesId(USER, HASH)).resolves.toBe(9n);
    await expect(chainReads.readSeries(9n)).resolves.toEqual(
      expect.objectContaining({ poolId: 1n, createdBy: USER })
    );
    await expect(chainReads.readPoolGarden(1n)).resolves.toBe(GARDEN);
    await expect(chainReads.readCommitmentId(USER, HASH)).resolves.toBe(8n);
    await expect(chainReads.readCommitment(8n)).resolves.toEqual(
      expect.objectContaining({ poolId: 1n, creator: USER })
    );
    await expect(chainReads.readEvidenceAttached?.(1n, "bafy-proof")).resolves.toBe(true);
    await expect(chainReads.readWorkLinkPayloadHash(USER, HASH)).resolves.toBe(HASH);
    await expect(chainReads.hasMembership?.(GARDEN, USER)).resolves.toBe(true);

    expect(readContract.mock.calls[0][0]).toBe(config);
    expect(readContract.mock.calls[0][1]).toEqual(
      expect.objectContaining({ address: MODULE, chainId: 42161 })
    );
  });

  it("reports membership as unavailable when every role read rejects", async () => {
    let attempt = 0;
    const chainReads = createCommitmentChainReads({
      chainId: 42161,
      moduleAddress: MODULE,
      readContract: vi.fn(() =>
        Promise.reject(attempt++ === 0 ? new Error("rpc down") : "rpc unavailable")
      ) as never,
      config: {} as Config,
    });

    await expect(chainReads.hasMembership?.(GARDEN, USER)).resolves.toBeNull();
  });
});

describe("job executor registry", () => {
  it("dispatches to the registered job kind without changing its arguments", async () => {
    const execute = vi.fn().mockResolvedValue({ status: "complete", txHash: HASH });
    const registry = createJobExecutorRegistry({ work: execute });
    const queued = job("work", {});
    const sender = createMockTransactionSender();

    await expect(registry.execute("job-work", queued, 42161, sender)).resolves.toEqual({
      status: "complete",
      txHash: HASH,
    });
    expect(execute).toHaveBeenCalledWith("job-work", queued, 42161, sender);
  });

  it("rejects an unsupported persisted job kind", () => {
    const registry = createJobExecutorRegistry({});

    expect(() =>
      registry.execute("job-unknown", job("unknown", {}), 42161, createMockTransactionSender())
    ).toThrow("Unsupported job kind: unknown");
  });
});
