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
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { createCommitmentChainReads } from "../../modules/job-queue/commitment-chain-reads";
import { CommitmentPoolingModuleABI } from "../../utils/blockchain/contracts";
import { executeApprovalJob } from "../../modules/job-queue/approval-executor";
import { executeCommitmentQueueJob } from "../../modules/job-queue/job-executors";
import { executeWorkJob } from "../../modules/job-queue/work-executor";
import { jobQueueDB } from "../../modules/job-queue/db";
import { createJobExecutorRegistry } from "../../modules/job-queue/executor-registry";
import type { Address } from "../../types/domain";
import type { ApprovalJobPayload, Job, WorkJobPayload } from "../../types/job-queue";
import { createMockTransactionSender } from "../test-utils/transaction-fakes";
import { sendLockName, stubWebLocks } from "../test-utils/web-locks";
import { PendingHeicConversionError } from "../../modules/work/work-attachments";
import { isDiscardableJob } from "../../modules/job-queue/job-recovery";
import { hasRecordedSend, sendCheckpointOf } from "../../modules/job-queue/queue-policy";
import { WorkSendCancelledError } from "../../modules/work/send-outcome";
import { intentHead } from "../../modules/job-queue/send-chain-reads";
import { StrandedSendReopened } from "../../modules/work/stranded-intent";
import { AwaitingWorkConfirmation } from "../../modules/work/work-confirmation";

// An untitled job looks its action up; keep that lookup off the network.
vi.mock("../../modules/data/greengoods", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../modules/data/greengoods")>()),
  getActions: vi.fn(async () => []),
}));
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
      expect.objectContaining({
        gardenAddress: GARDEN,
        authMode: "passkey",
        onCheckpoint: expect.any(Function),
      })
    );
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it("sends an untitled job under its action's title, never a placeholder", async () => {
    const encodeWork = vi.fn().mockResolvedValue(HASH);
    const simulate = vi.fn().mockResolvedValue(undefined);
    const resolveTitle = vi.fn().mockResolvedValue("Weeding");
    const work = job<WorkJobPayload>("work", {
      actionUID: 7,
      gardenAddress: GARDEN,
      feedback: "Done",
    });

    await executeWorkJob("job-work", work, 11155111, createMockTransactionSender(), {
      images: vi.fn().mockResolvedValue([]),
      convertMedia: vi.fn().mockResolvedValue({ status: "ready" }),
      resolveTitle,
      simulate,
      encodeWork,
      easConfig: EAS_CONFIG,
    });

    expect(resolveTitle).toHaveBeenCalledWith(work, 11155111);
    expect(simulate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionTitle: "Weeding",
        draft: expect.objectContaining({ title: "Weeding" }),
      })
    );
    expect(encodeWork.mock.calls[0][0]).toMatchObject({ title: "Weeding" });
  });

  it.each([
    ["pending", "photo-conversion-pending"],
    ["needs-attention", "photo-needs-attention"],
  ] as const)("waits instead of uploading while a queued photo is %s", async (status, reason) => {
    const images = vi.fn();
    const encodeWork = vi.fn();
    const sender = createMockTransactionSender();
    const work = job<WorkJobPayload>("work", {
      actionUID: 7,
      gardenAddress: GARDEN,
      feedback: "Done",
    });

    const attempt = executeWorkJob("job-work", work, 11155111, sender, {
      images,
      convertMedia: vi.fn().mockResolvedValue({ status }),
      simulate: vi.fn(),
      encodeWork,
      easConfig: EAS_CONFIG,
    });

    await expect(attempt).rejects.toBeInstanceOf(PendingHeicConversionError);
    await expect(attempt).rejects.toMatchObject({ reason });
    expect(images).not.toHaveBeenCalled();
    expect(encodeWork).not.toHaveBeenCalled();
    expect(sender.sendContractCall).not.toHaveBeenCalled();
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
      expect.objectContaining({ functionName: "attachEvidence" }),
      expect.anything()
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
    // The send is recorded on the stored job; the resolved UID never is.
    for (const [persisted] of queueStore.updateJob.mock.calls) {
      expect((persisted as Job).payload).not.toHaveProperty("resolvedWorkUID");
    }
    expect(sender.sendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "linkWork", args: [1n, HASH, 0, HASH] }),
      expect.anything()
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

describe("commitment acts record their sends", () => {
  // Each test names its own job: a broadcast the queue keeps in memory is keyed by id.
  const takeUp = (id: string) =>
    job(
      "claim",
      { commitmentId: 7n, kind: 1, gardenContext: GARDEN, gardenAddress: GARDEN },
      { id }
    );

  it("holds a take-up whose receipt was lost and confirms it without sending again", async () => {
    const claim = takeUp("claim-receipt-lost");
    const sender = createMockTransactionSender({ authMode: "wallet" });
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      await options?.onBroadcast?.(HASH);
      throw new Error("receipt timeout");
    });
    const jobStore = store();
    const reconcile = vi.fn().mockResolvedValue("unresolved");
    // The chain's head goes with the intent: nothing this send did can predate it.
    // It is read again just before the intent, after any prompt, so a prompt left
    // open never ages it.
    const readChainHead = vi
      .fn()
      .mockResolvedValueOnce({ number: 100n, timestamp: 1_234 })
      .mockResolvedValue({ number: 101n, timestamp: 1_240 });
    // The nonce comes off the transaction itself once it is out: the wallet
    // may know sends this network does not, so a count read before the prompt
    // is only a floor.
    const readTransactionNonce = vi.fn().mockResolvedValue(7);
    const deps = {
      demoActive: () => false,
      reads: { ...reads(), readChainHead, readTransactionNonce },
      store: jobStore,
      reconcile,
    };

    await expect(executeCommitmentQueueJob(claim.id, claim, 42161, sender, deps)).resolves.toEqual({
      status: "waiting",
      reason: "awaiting-confirmation",
    });
    // The stored job says the send is out, so no screen offers to drop it.
    expect(sendCheckpointOf(claim)).toMatchObject({
      transactionHash: HASH,
      intentChainTime: 1_240,
      intentBlock: 101n,
      transactionNonce: { hash: HASH, nonce: 7 },
    });
    expect(readTransactionNonce).toHaveBeenCalledWith(HASH);
    expect(jobStore.updateJob).toHaveBeenCalledWith(claim);
    expect(isDiscardableJob(claim)).toBe(false);

    // Later runs read the receipt; nothing is sent twice.
    await expect(executeCommitmentQueueJob(claim.id, claim, 42161, sender, deps)).resolves.toEqual({
      status: "waiting",
      reason: "awaiting-confirmation",
    });
    reconcile.mockResolvedValue("confirmed");
    await expect(executeCommitmentQueueJob(claim.id, claim, 42161, sender, deps)).resolves.toEqual({
      status: "complete",
      txHash: HASH,
    });
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it("keeps the intent when the answer is lost before any reference, and never sends blind", async () => {
    const claim = takeUp("claim-answer-lost");
    const sender = createMockTransactionSender({ authMode: "wallet" });
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      throw new Error("connection lost");
    });
    const settleStrandedIntent = vi.fn().mockRejectedValue(new AwaitingWorkConfirmation("0x"));
    const deps = { demoActive: () => false, reads: reads(), store: store(), settleStrandedIntent };

    await expect(executeCommitmentQueueJob(claim.id, claim, 42161, sender, deps)).resolves.toEqual({
      status: "waiting",
      reason: "awaiting-confirmation",
    });
    expect(hasRecordedSend(claim)).toBe(true);
    expect(isDiscardableJob(claim)).toBe(false);

    // A later run asks the chain whether it landed instead of sending again.
    await executeCommitmentQueueJob(claim.id, claim, 42161, sender, deps);
    expect(settleStrandedIntent).toHaveBeenCalledWith(claim, 42161, "0x");
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it("offers a stranded act again once the chain shows it never landed", async () => {
    const claim = takeUp("claim-reopened");
    claim.payload = {
      ...claim.payload,
      sendCheckpoint: { broadcastPending: true, broadcastPendingAt: new Date(0).toISOString() },
    } as typeof claim.payload;
    const sender = createMockTransactionSender({ authMode: "wallet" });
    const settleStrandedIntent = vi.fn().mockRejectedValue(new StrandedSendReopened());

    await expect(
      executeCommitmentQueueJob(claim.id, claim, 42161, sender, {
        demoActive: () => false,
        reads: reads(),
        store: store(),
        settleStrandedIntent,
      })
    ).resolves.toEqual({ status: "waiting", reason: "send-intent-expired" });
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it.each([
    ["claim", { commitmentId: 7n, kind: 1, gardenContext: GARDEN, gardenAddress: GARDEN }],
    [
      "evidence",
      {
        clientEvidenceId: "proof",
        commitmentId: 7n,
        cid: "bafy-proof",
        creditedContributors: [USER],
        gardenAddress: GARDEN,
      },
    ],
    [
      "workLink",
      {
        clientOperationId: "operation",
        commitmentId: 7n,
        workUID: HASH,
        requirementIndex: 0,
        operationKey: HASH,
        gardenAddress: GARDEN,
      },
    ],
    ["confirmation", { action: "confirm", commitmentId: 7n, gardenAddress: GARDEN }],
  ])("settles a recorded %s by receipt, by UserOperation or from the chain, never sending again", async (kind, payload) => {
    // A first Safe proposal is not a completed act; a fresh copy after reload
    // must still reconcile it rather than create a second proposal.
    const safeSender = createMockTransactionSender({ authMode: "wallet" });
    vi.mocked(safeSender.sendContractCall).mockResolvedValue({
      hash: HASH,
      sponsored: false,
      confirmation: "pending",
    });
    const pendingSafe = job(kind, payload, { id: `${kind}-safe-first-send` });
    const safeDeps = {
      demoActive: () => false,
      reads: reads(),
      store: store(),
      reconcile: vi.fn().mockResolvedValue("unresolved"),
      settleStrandedIntent: vi.fn().mockRejectedValue(new AwaitingWorkConfirmation(HASH)),
    };
    await expect(
      executeCommitmentQueueJob(pendingSafe.id, pendingSafe, 42161, safeSender, safeDeps)
    ).resolves.toEqual({ status: "waiting", reason: "awaiting-confirmation" });
    expect(isDiscardableJob(pendingSafe)).toBe(false);
    const reloadedSafe = structuredClone(pendingSafe);
    await expect(
      executeCommitmentQueueJob(reloadedSafe.id, reloadedSafe, 42161, safeSender, safeDeps)
    ).resolves.toEqual({ status: "waiting", reason: "awaiting-confirmation" });
    expect(safeSender.sendContractCall).toHaveBeenCalledOnce();
    safeDeps.reconcile.mockResolvedValue("confirmed");
    await expect(
      executeCommitmentQueueJob(reloadedSafe.id, reloadedSafe, 42161, safeSender, safeDeps)
    ).resolves.toEqual({ status: "complete", txHash: HASH });
    expect(safeSender.sendContractCall).toHaveBeenCalledOnce();

    const operation = `0x${"cd".repeat(32)}` as const;
    // A Safe's own transaction id: no receipt ever answers it.
    const safeId = `0x${"5a".repeat(20)}` as const;
    const sender = createMockTransactionSender({ authMode: "passkey" });
    sender.reconcileBroadcast = vi
      .fn()
      .mockResolvedValue({ status: "confirmed", transactionHash: HASH });
    const recorded = (id: string, sendCheckpoint: object) =>
      job(kind, { ...payload, sendCheckpoint }, { id: `${kind}-${id}` });
    const byReceipt = recorded("by-receipt", { broadcastPending: false, transactionHash: HASH });
    const byOperation = recorded("by-operation", {
      broadcastPending: false,
      broadcast: { kind: "user-operation", chainId: 42161, hash: operation },
    });
    const stranded = recorded("stranded", {
      broadcastPending: true,
      broadcastPendingAt: new Date(0).toISOString(),
    });
    const unanswered = recorded("unanswered", { broadcastPending: false, transactionHash: safeId });
    const settleStrandedIntent = vi.fn().mockResolvedValue(HASH);
    const deps = {
      demoActive: () => false,
      reads: reads(),
      store: store(),
      reconcile: vi.fn(async (hash: string) => (hash === HASH ? "confirmed" : "unresolved")),
      settleStrandedIntent,
    };

    for (const act of [byReceipt, byOperation, stranded, unanswered]) {
      await expect(executeCommitmentQueueJob(act.id, act, 42161, sender, deps)).resolves.toEqual({
        status: "complete",
        txHash: HASH,
      });
    }
    expect(deps.reconcile).toHaveBeenCalledWith(HASH, 42161);
    expect(sender.reconcileBroadcast).toHaveBeenCalledOnce();
    expect(settleStrandedIntent).toHaveBeenCalledWith(stranded, 42161, "0x");
    // Settled by the act's landing on chain, under the id the wallet gave.
    expect(settleStrandedIntent).toHaveBeenCalledWith(unanswered, 42161, safeId);
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("holds its send while the prompt is open, and leaves an act to a tab still holding one", async () => {
    const held = new Set<string>();
    stubWebLocks(held);
    const heldDuringSend: string[] = [];
    const sender = createMockTransactionSender({ authMode: "wallet" });
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      heldDuringSend.push(...held);
      await options?.onBroadcast?.(HASH);
      return { hash: HASH, sponsored: false };
    });
    const deps = { demoActive: () => false, reads: reads(), store: store() };

    try {
      const sent = takeUp("claim-holds-lock");
      await expect(executeCommitmentQueueJob(sent.id, sent, 42161, sender, deps)).resolves.toEqual({
        status: "complete",
        txHash: HASH,
      });
      expect(heldDuringSend).toEqual([sendLockName(sent.id)]);
      expect(held.size).toBe(0);

      const elsewhere = takeUp("claim-held-elsewhere");
      held.add(sendLockName(elsewhere.id));
      await expect(
        executeCommitmentQueueJob(elsewhere.id, elsewhere, 42161, sender, deps)
      ).rejects.toThrow("submission-ownership-changed");
      expect(sender.sendContractCall).toHaveBeenCalledOnce();
      expect(hasRecordedSend(elsewhere)).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("offers a lost act again only when no tab holds its send and its account has nothing waiting", async () => {
    // Long past the grace window, and the chain holds no sign of it.
    const lost = (id: string) => {
      const act = takeUp(id);
      act.payload = {
        ...act.payload,
        sendCheckpoint: { broadcastPending: true, broadcastPendingAt: new Date(0).toISOString() },
      } as typeof act.payload;
      return act;
    };
    const sender = createMockTransactionSender({ authMode: "wallet" });
    const hasPendingTransaction = vi.fn().mockResolvedValue(false);
    const userOperationMayLand = vi.fn().mockResolvedValue(false);
    const deps = {
      demoActive: () => false,
      reads: { ...reads(), hasPendingTransaction, userOperationMayLand },
      store: store(),
      lookUpLanded: vi.fn().mockResolvedValue({ status: "absent" }),
    };
    const settle = (act: ReturnType<typeof lost>) =>
      executeCommitmentQueueJob(act.id, act, 42161, sender, deps);
    const held = new Set<string>();

    try {
      // Without Web Locks nothing can say whether another tab's prompt is open.
      vi.stubGlobal("navigator", {});
      await expect(settle(lost("claim-no-locks"))).resolves.toEqual({
        status: "waiting",
        reason: "awaiting-confirmation",
      });

      stubWebLocks(held);
      const holding = lost("claim-still-held");
      held.add(sendLockName(holding.id));
      await expect(settle(holding)).resolves.toEqual({
        status: "waiting",
        reason: "awaiting-confirmation",
      });
      // A transaction the network holds but has not mined may be the lost send.
      hasPendingTransaction.mockResolvedValueOnce(true);
      await expect(settle(lost("claim-account-busy"))).resolves.toEqual({
        status: "waiting",
        reason: "awaiting-confirmation",
      });
      expect(hasPendingTransaction).toHaveBeenCalledWith(USER);
      // A passkey send's pending state lives at its bundler, not in the account's nonce.
      const operation = `0x${"0e".repeat(32)}` as const;
      const queued = lost("claim-operation-queued");
      queued.payload = {
        ...queued.payload,
        sendCheckpoint: {
          broadcastPending: true,
          broadcastPendingAt: new Date(0).toISOString(),
          broadcast: { kind: "user-operation", chainId: 42161, hash: operation },
        },
      } as typeof queued.payload;
      userOperationMayLand.mockResolvedValueOnce(true);
      await expect(settle(queued)).resolves.toEqual({
        status: "waiting",
        reason: "awaiting-confirmation",
      });
      expect(userOperationMayLand).toHaveBeenCalledWith(operation);
      await expect(settle(lost("claim-released"))).resolves.toEqual({
        status: "waiting",
        reason: "send-intent-expired",
      });
      expect(sender.sendContractCall).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("waits out a lost act that kept the chain's time on the chain's clock, whichever way the device's clock moved", async () => {
    // The device's clock ran two hours fast when the send was recorded and has
    // since been set right, so by the device the send has not happened yet.
    const intentAt = Math.floor(Date.now() / 1000) - 45 * 60;
    const lost = (id: string) => {
      const act = takeUp(id);
      act.payload = {
        ...act.payload,
        sendCheckpoint: {
          broadcastPending: true,
          broadcastPendingAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
          intentChainTime: intentAt,
          intentBlock: 100n,
        },
      } as typeof act.payload;
      return act;
    };
    const readChainHead = vi.fn();
    const sender = createMockTransactionSender({ authMode: "wallet" });
    const deps = {
      demoActive: () => false,
      reads: {
        ...reads(),
        readChainHead,
        hasPendingTransaction: vi.fn().mockResolvedValue(false),
        userOperationMayLand: vi.fn().mockResolvedValue(false),
      },
      store: store(),
      lookUpLanded: vi.fn().mockResolvedValue({ status: "absent" }),
    };
    const settle = (act: ReturnType<typeof lost>) =>
      executeCommitmentQueueJob(act.id, act, 42161, sender, deps);
    stubWebLocks(new Set());

    try {
      // Ten minutes after the send on the chain's clock, its window holds it.
      readChainHead.mockResolvedValueOnce({ number: 100n, timestamp: intentAt + 10 * 60 });
      await expect(settle(lost("claim-window-open"))).resolves.toEqual({
        status: "waiting",
        reason: "awaiting-confirmation",
      });
      // Past the window on the chain's clock, with nothing holding it, the head is
      // kept: the act is offered again once the indexer has passed that block.
      readChainHead.mockResolvedValue({ number: 200n, timestamp: intentAt + 31 * 60 });
      const passed = lost("claim-window-passed");
      await expect(settle(passed)).resolves.toEqual({
        status: "waiting",
        reason: "awaiting-confirmation",
      });
      expect(sendCheckpointOf(passed)?.idleBlock).toBe(200n);
      expect(sender.sendContractCall).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("offers a transaction on record again only once another took its nonce", async () => {
    // Long past the grace window, no receipt, and the chain holds no sign of the act.
    const unanswered = (id: string, nonce?: number, extra: Record<string, unknown> = {}) => {
      const act = takeUp(id);
      act.payload = {
        ...act.payload,
        sendCheckpoint: {
          broadcastPending: false,
          broadcastPendingAt: new Date(0).toISOString(),
          broadcast: { kind: "transaction", hash: HASH },
          transactionHash: HASH,
          ...(nonce === undefined ? {} : { transactionNonce: { hash: HASH, nonce } }),
          ...extra,
        },
      } as typeof act.payload;
      return act;
    };
    const sender = createMockTransactionSender({ authMode: "wallet" });
    const transactionSuperseded = vi.fn().mockResolvedValue(false);
    // The network no longer holds the transaction, so its nonce cannot be read now.
    const readTransactionNonce = vi.fn().mockResolvedValue(null);
    const deps = {
      demoActive: () => false,
      reads: {
        ...reads(),
        hasPendingTransaction: vi.fn().mockResolvedValue(false),
        transactionSuperseded,
        readTransactionNonce,
      },
      store: store(),
      reconcile: vi.fn().mockResolvedValue("unresolved"),
      lookUpLanded: vi.fn().mockResolvedValue({ status: "absent" }),
    };
    const settle = (act: ReturnType<typeof unanswered>) =>
      executeCommitmentQueueJob(act.id, act, 42161, sender, deps);
    const waiting = { status: "waiting", reason: "awaiting-confirmation" };
    stubWebLocks(new Set());

    try {
      // Its nonce unspent, or unreadable, the signed transaction may still land.
      await expect(settle(unanswered("claim-nonce-unspent", 5))).resolves.toEqual(waiting);
      expect(transactionSuperseded).toHaveBeenCalledWith(HASH, USER, 5);
      transactionSuperseded.mockRejectedValueOnce(new Error("rpc down"));
      await expect(settle(unanswered("claim-nonce-unread", 5))).resolves.toEqual(waiting);
      // A record without the nonce cannot show it: it completes only by landing.
      transactionSuperseded.mockClear();
      await expect(settle(unanswered("claim-no-nonce"))).resolves.toEqual(waiting);
      expect(transactionSuperseded).not.toHaveBeenCalled();
      // Nor can a count read before the prompt, or a nonce read off another hash:
      // the transaction may use a later nonce the wallet knew and this network did not.
      await expect(
        settle(unanswered("claim-floor-only", undefined, { intentNonce: 5 }))
      ).resolves.toEqual(waiting);
      await expect(
        settle(
          unanswered("claim-other-hash", undefined, {
            transactionNonce: { hash: `0x${"cd".repeat(32)}`, nonce: 5 },
          })
        )
      ).resolves.toEqual(waiting);
      expect(transactionSuperseded).not.toHaveBeenCalled();
      // While the network holds it, the settle pass keeps the nonce it used.
      readTransactionNonce.mockResolvedValueOnce(9);
      const held = unanswered("claim-held");
      await expect(settle(held)).resolves.toEqual(waiting);
      expect(sendCheckpointOf(held)).toMatchObject({ transactionNonce: { hash: HASH, nonce: 9 } });
      expect(transactionSuperseded).toHaveBeenCalledWith(HASH, USER, 9);

      transactionSuperseded.mockResolvedValue(true);
      const spent = unanswered("claim-nonce-spent", 5);
      await expect(settle(spent)).resolves.toEqual({
        status: "waiting",
        reason: "send-intent-expired",
      });
      expect(hasRecordedSend(spent)).toBe(false);
      expect(isDiscardableJob(spent)).toBe(true);
      expect(sender.sendContractCall).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("clears the intent when the person declines, and waits for their own tap to ask again", async () => {
    const claim = takeUp("claim-declined");
    const declined = new WorkSendCancelledError();
    const sender = createMockTransactionSender({ authMode: "wallet" });
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      throw declined;
    });
    const jobStore = store();
    // What each write stored, so the flag is known to have reached storage.
    const stored: Array<Job["meta"]> = [];
    jobStore.updateJob.mockImplementation(async (written: Job) => {
      stored.push({ ...written.meta });
    });

    await expect(
      executeCommitmentQueueJob(claim.id, claim, 42161, sender, {
        demoActive: () => false,
        reads: reads(),
        store: jobStore,
      })
    ).rejects.toBe(declined);
    expect(hasRecordedSend(claim)).toBe(false);
    expect(isDiscardableJob(claim)).toBe(true);
    // A background flush passes it by until the person sends it themselves.
    expect(stored.at(-1)).toMatchObject({ requiresExplicitSend: true });
  });

  it("asks the chain before recording an intent, so a refused act fails at once", async () => {
    // A wallet estimates inside its own send, after the intent: without this a
    // refusal would read as a send that may have gone out.
    const claim = takeUp("claim-refused");
    const refused = new Error("NotEligibleClaimant");
    const sender = createMockTransactionSender({ authMode: "wallet" });
    const simulateSend = vi.fn().mockRejectedValue(refused);

    await expect(
      executeCommitmentQueueJob(claim.id, claim, 42161, sender, {
        demoActive: () => false,
        reads: { ...reads(), simulateSend },
        store: store(),
      })
    ).rejects.toBe(refused);
    expect(simulateSend).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "claimCommitment", account: USER })
    );
    expect(sender.sendContractCall).not.toHaveBeenCalled();
    expect(hasRecordedSend(claim)).toBe(false);
  });
});

describe("the chain's head a send keeps", () => {
  it("gives up on a chain slow to say, so a signed send never waits on it", async () => {
    const never = () => new Promise<{ number: bigint; timestamp: number }>(() => undefined);
    await expect(intentHead(never, 5)).resolves.toBeUndefined();
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

  it("reads the chain's head: its latest block and that block's time", async () => {
    const getBlock = vi.fn().mockResolvedValue({ number: 100n, timestamp: 1_700_000_000n });
    const chainReads = createCommitmentChainReads({
      chainId: 42161,
      moduleAddress: MODULE,
      getBlock: getBlock as never,
      config: {} as Config,
    });

    await expect(chainReads.readChainHead?.()).resolves.toEqual({
      number: 100n,
      timestamp: 1_700_000_000,
    });
    expect(getBlock).toHaveBeenCalledWith(expect.anything(), { chainId: 42161 });
  });

  it("confirms a take-up by its request or acceptance event, in its receipt's block", async () => {
    const GARDEN_B = "0x9999999999999999999999999999999999999999" as Address;
    const requested = encodeEventTopics({
      abi: CommitmentPoolingModuleABI,
      eventName: "ClaimRequested",
      args: { commitmentId: 7n, claimant: USER, requestedBy: USER },
    });
    const requestLog = (gardenContext: Address) => ({
      address: MODULE,
      topics: requested,
      data: encodeAbiParameters(
        [{ type: "uint8" }, { type: "address" }, { type: "uint64" }],
        [1, gardenContext, 1_700_000_000n]
      ),
    });
    const acceptLog = {
      address: MODULE,
      topics: encodeEventTopics({
        abi: CommitmentPoolingModuleABI,
        eventName: "CommitmentAccepted",
        args: { commitmentId: 7n, claimant: USER, counterparty: USER },
      }),
      data: encodeAbiParameters(
        [
          { type: "uint8" },
          { type: "address" },
          { type: "address" },
          { type: "address" },
          { type: "address" },
        ],
        [1, GARDEN, USER, GARDEN, GARDEN]
      ),
    };
    const getTransactionReceipt = vi.fn();
    const chainReads = createCommitmentChainReads({
      chainId: 42161,
      moduleAddress: MODULE,
      getTransactionReceipt: getTransactionReceipt as never,
      config: {} as Config,
    });
    const claim = {
      commitmentId: 7n,
      claimant: USER,
      requestedBy: USER,
      kind: 1,
      gardenContext: GARDEN,
    };
    const receipt = (logs: object[]) => ({ status: "success", blockNumber: 101n, logs });

    getTransactionReceipt.mockResolvedValueOnce(receipt([requestLog(GARDEN)]));
    await expect(chainReads.transactionMadeClaim?.(MOCK_TX_HASH, claim)).resolves.toBe(101n);
    getTransactionReceipt.mockResolvedValueOnce(receipt([acceptLog]));
    await expect(chainReads.transactionMadeClaim?.(MOCK_TX_HASH, claim)).resolves.toBe(101n);
    // The same person's request through another garden is not this take-up.
    getTransactionReceipt.mockResolvedValueOnce(receipt([requestLog(GARDEN_B)]));
    await expect(chainReads.transactionMadeClaim?.(MOCK_TX_HASH, claim)).resolves.toBeNull();
  });

  it("asks the bundler whether a UserOperation may still land", async () => {
    const getUserOperationStatus = vi.fn();
    const chainReads = createCommitmentChainReads({
      chainId: 42161,
      moduleAddress: MODULE,
      getUserOperationStatus,
      config: {} as Config,
    });
    // Only an operation the bundler never held, or refused, can no longer land.
    for (const [status, mayLand] of [
      ["not_found", false],
      ["rejected", false],
      ["not_submitted", true],
      ["submitted", true],
      ["included", true],
    ] as const) {
      getUserOperationStatus.mockResolvedValueOnce({ status, transactionHash: null });
      await expect(chainReads.userOperationMayLand?.(HASH)).resolves.toBe(mayLand);
    }
    expect(getUserOperationStatus).toHaveBeenCalledWith(HASH);
  });

  it("reads a waiting transaction from the account's pending nonce", async () => {
    const getTransactionCount = vi.fn(async (_config: unknown, request: { blockTag: string }) =>
      request.blockTag === "pending" ? 5 : 4
    );
    const chainReads = createCommitmentChainReads({
      chainId: 42161,
      moduleAddress: MODULE,
      getTransactionCount: getTransactionCount as never,
      config: {} as Config,
    });

    await expect(chainReads.hasPendingTransaction?.(USER)).resolves.toBe(true);
    expect(getTransactionCount).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ address: USER, blockTag: "pending", chainId: 42161 })
    );
    getTransactionCount.mockImplementation(async () => 4);
    await expect(chainReads.hasPendingTransaction?.(USER)).resolves.toBe(false);
  });

  it("reads a transaction as superseded only once its signer's mined nonce has passed it", async () => {
    const state = { code: undefined as string | undefined, mined: 6, held: false };
    const notFound = Object.assign(new Error("Transaction not found"), {
      name: "TransactionNotFoundError",
    });
    const getTransaction = vi.fn(async () => {
      if (state.held) return { hash: HASH, nonce: 5 };
      throw notFound;
    });
    const getBytecode = vi.fn(async () => state.code);
    const chainReads = createCommitmentChainReads({
      chainId: 42161,
      moduleAddress: MODULE,
      getBytecode: getBytecode as never,
      getTransaction: getTransaction as never,
      getTransactionCount: vi.fn(async (_config: unknown, request: { blockTag: string }) =>
        request.blockTag === "pending" ? 7 : state.mined
      ) as never,
      config: {} as Config,
    });
    const superseded = () => chainReads.transactionSuperseded?.(HASH, USER, 5);

    // The nonce a transaction used comes off the transaction while the network holds it.
    state.held = true;
    await expect(chainReads.readTransactionNonce?.(HASH)).resolves.toBe(5);
    state.held = false;
    await expect(chainReads.readTransactionNonce?.(HASH)).resolves.toBeNull();
    // The account has no code, so the hash is a transaction it signed, and the
    // network dropped it while its nonce went to another.
    await expect(superseded()).resolves.toBe(true);
    expect(getBytecode).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ address: USER, chainId: 42161 })
    );
    expect(getTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ hash: HASH, chainId: 42161 })
    );
    // Its nonce unspent, the signed transaction may still land.
    state.mined = 5;
    await expect(superseded()).resolves.toBe(false);
    state.mined = 6;
    // The network still holds it.
    state.held = true;
    await expect(superseded()).resolves.toBe(false);
    state.held = false;
    // A Safe's id, or any send from an account with code, never reads as superseded.
    state.code = "0x6080";
    await expect(superseded()).resolves.toBe(false);
    state.code = undefined;
    // Any other failure is no answer.
    getTransaction.mockRejectedValueOnce(new Error("rpc down"));
    await expect(superseded()).rejects.toThrow("rpc down");
  });

  it("confirms a work link by the key its WorkLinked event carries", async () => {
    const OTHER_KEY = `0x${"99".repeat(32)}` as const;
    const workLinked = (operationKey: `0x${string}`, emitter: Address = MODULE) => ({
      address: emitter,
      topics: encodeEventTopics({
        abi: CommitmentPoolingModuleABI,
        eventName: "WorkLinked",
        args: { commitmentId: 7n, workUID: HASH, contributor: USER },
      }),
      data: encodeAbiParameters(
        [{ type: "uint16" }, { type: "address" }, { type: "bytes32" }],
        [0, USER, operationKey]
      ),
    });
    const getTransactionReceipt = vi.fn().mockResolvedValue({
      status: "success",
      logs: [workLinked(OTHER_KEY), workLinked(HASH)],
    });
    const chainReads = createCommitmentChainReads({
      chainId: 42161,
      moduleAddress: MODULE,
      getTransactionReceipt: getTransactionReceipt as never,
      config: {} as Config,
    });
    const link = { commitmentId: 7n, workUID: HASH, operationKey: HASH, linker: USER };

    await expect(chainReads.transactionMadeWorkLink?.(MOCK_TX_HASH, link)).resolves.toBe(true);
    expect(getTransactionReceipt).toHaveBeenCalledWith(expect.anything(), {
      hash: MOCK_TX_HASH,
      chainId: 42161,
    });
    // Another linker, or the same event from another contract, is not this link.
    await expect(
      chainReads.transactionMadeWorkLink?.(MOCK_TX_HASH, { ...link, linker: GARDEN })
    ).resolves.toBe(false);
    getTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [workLinked(HASH, GARDEN)],
    });
    await expect(chainReads.transactionMadeWorkLink?.(MOCK_TX_HASH, link)).resolves.toBe(false);
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
  it("persists upload checkpoints on the same job object used by subsequent queue writes", async () => {
    const media = [
      new File(["first"], "first.jpg", { type: "image/jpeg" }),
      new File(["second"], "second.jpg", { type: "image/jpeg" }),
    ];
    const id = await jobQueueDB.addJob({
      kind: "work",
      userAddress: USER,
      chainId: 11155111,
      payload: {
        clientWorkId: "queue-checkpoint-test",
        actionUID: 7,
        gardenAddress: GARDEN,
        feedback: "done",
        media,
      },
    });
    const queued = (await jobQueueDB.getJob(id)) as Job<WorkJobPayload>;
    expect(queued.payload).not.toHaveProperty("media");
    expect((await jobQueueDB.getImagesForJob(id)).map((item) => item.file.name)).toEqual([
      "first.jpg",
      "second.jpg",
    ]);
    const checkpoint = {
      submittedAt: "2026-09-09T00:00:00Z",
      files: { photo: { attachmentId: "one", contentHash: "photo", cid: "confirmed" } },
    };
    await expect(
      executeWorkJob(id, queued, 11155111, createMockTransactionSender(), {
        simulate: vi.fn().mockResolvedValue(undefined),
        encodeWork: vi.fn(async (_data, _chain, options) => {
          await options?.onCheckpoint?.(checkpoint);
          throw new Error("timeout after media");
        }),
        easConfig: EAS_CONFIG,
      })
    ).rejects.toThrow("timeout after media");
    expect(queued.payload.uploadCheckpoint).toEqual(checkpoint);
    await jobQueueDB.updateJob({ ...queued, lastAttemptAt: Date.now() });
    expect((await jobQueueDB.getJob(id))?.payload).toMatchObject({ uploadCheckpoint: checkpoint });
    const duplicate = await jobQueueDB.addJob({
      kind: "work",
      userAddress: USER,
      chainId: 11155111,
      payload: {
        clientWorkId: "queue-checkpoint-test",
        actionUID: 7,
        gardenAddress: GARDEN,
        feedback: "done",
        media,
      },
    });
    expect(duplicate).toBe(id);
    expect((await jobQueueDB.getJob(id))?.payload).toMatchObject({ uploadCheckpoint: checkpoint });
    await jobQueueDB.deleteJob(id);
  });
});

it("queued known transaction must be reconciled before another send", async () => {
  const sender = createMockTransactionSender({ authMode: "wallet" });
  const work = job<WorkJobPayload>("work", {
    actionUID: 3,
    gardenAddress: GARDEN,
    feedback: "Done",
    clientWorkId: "review-known-broadcast",
    uploadCheckpoint: { submittedAt: new Date().toISOString(), files: {}, transactionHash: HASH },
  });
  await executeWorkJob(work.id, work, 11155111, sender, {
    reconcile: vi.fn().mockResolvedValue("confirmed"),
    images: vi.fn().mockResolvedValue([]),
    simulate: vi.fn().mockResolvedValue(undefined),
    encodeWork: vi.fn().mockResolvedValue(HASH),
    easConfig: EAS_CONFIG,
  });
  expect(sender.sendContractCall).not.toHaveBeenCalled();
});

it("rechecks after a sender timeout without uploading or sending again", async () => {
  const work = job<WorkJobPayload>(
    "work",
    { actionUID: 3, gardenAddress: GARDEN, feedback: "Done" },
    { id: "timeout-confirmation" }
  );
  const sender = createMockTransactionSender({ authMode: "wallet" });
  vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
    await options?.onBroadcast?.(HASH);
    throw new Error("receipt timeout");
  });
  const deps = {
    images: vi.fn().mockResolvedValue([]),
    simulate: vi.fn().mockResolvedValue(undefined),
    encodeWork: vi.fn().mockResolvedValue(HASH),
    easConfig: EAS_CONFIG,
    reconcile: vi.fn().mockResolvedValue("unresolved"),
  };
  await expect(executeWorkJob(work.id, work, 11155111, sender, deps)).rejects.toThrow(
    "awaiting-confirmation"
  );
  // The stored job already says so, in case this tab dies before the receipt arrives.
  expect(work.meta?.waitingReason).toBe("awaiting-confirmation");
  await expect(executeWorkJob(work.id, work, 11155111, sender, deps)).rejects.toThrow(
    "awaiting-confirmation"
  );
  expect(sender.sendContractCall).toHaveBeenCalledTimes(1);
  expect(deps.encodeWork).toHaveBeenCalledTimes(1);
  deps.reconcile.mockResolvedValue("confirmed");
  expect(await executeWorkJob(work.id, work, 11155111, sender, deps)).toBe(HASH);
});

it("keeps the broadcast in memory when writing its checkpoint fails", async () => {
  const work = job<WorkJobPayload>(
    "work",
    { actionUID: 3, gardenAddress: GARDEN, feedback: "Done" },
    { id: "failed-broadcast-write" }
  );
  const sender = createMockTransactionSender({ authMode: "wallet" });
  const update = vi.spyOn(jobQueueDB, "updateJob").mockRejectedValueOnce(new Error("quota"));
  vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
    await options?.onBroadcast?.(HASH);
    return { hash: HASH, sponsored: false };
  });
  const deps = {
    images: vi.fn().mockResolvedValue([]),
    simulate: vi.fn().mockResolvedValue(undefined),
    encodeWork: vi.fn().mockResolvedValue(HASH),
    easConfig: EAS_CONFIG,
    reconcile: vi.fn().mockResolvedValue("confirmed"),
  };
  await expect(executeWorkJob(work.id, work, 11155111, sender, deps)).rejects.toThrow(
    "awaiting-confirmation"
  );
  // A later attempt may reload the old persisted payload.
  delete work.payload.uploadCheckpoint;
  await executeWorkJob(work.id, work, 11155111, sender, deps);
  expect(sender.sendContractCall).toHaveBeenCalledTimes(1);
  update.mockRestore();
});

it("surfaces a sender-confirmed revert as explicit retry without discarding media checkpoints", async () => {
  const { TransactionRevertedError } = await import("../../modules/transactions/types");
  const work = job<WorkJobPayload>(
    "work",
    { actionUID: 3, gardenAddress: GARDEN, feedback: "Done" },
    { id: "sender-reverted-work" }
  );
  const sender = createMockTransactionSender({ authMode: "wallet" });
  vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
    await options?.onBroadcast?.(HASH);
    throw new TransactionRevertedError(HASH);
  });
  await expect(
    executeWorkJob(work.id, work, 11155111, sender, {
      images: vi.fn().mockResolvedValue([]),
      simulate: vi.fn().mockResolvedValue(undefined),
      encodeWork: vi.fn().mockResolvedValue(HASH),
      easConfig: EAS_CONFIG,
    })
  ).rejects.toThrow("work-transaction-reverted");
  expect(work.meta?.workTransactionReverted).toBe(true);
  expect(work.payload.uploadCheckpoint?.transactionHash).toBe(HASH);
});

it("reconciles a persisted UserOperation after restart without reading or uploading its evidence", async () => {
  const operation = `0x${"ab".repeat(32)}` as const;
  const work = job<WorkJobPayload>(
    "work",
    {
      actionUID: 3,
      gardenAddress: GARDEN,
      feedback: "Done",
      uploadCheckpoint: {
        files: {},
        submittedAt: "2026-09-12",
        broadcast: { kind: "user-operation", hash: operation },
      },
    },
    { id: crypto.randomUUID() }
  );
  const sender = createMockTransactionSender();
  sender.reconcileBroadcast = vi
    .fn()
    .mockResolvedValueOnce({ status: "unresolved" })
    .mockResolvedValueOnce({ status: "confirmed", transactionHash: HASH });
  const images = vi.fn();
  await expect(executeWorkJob(work.id, work, 11155111, sender, { images })).rejects.toThrow(
    "awaiting-confirmation"
  );
  await expect(executeWorkJob(work.id, work, 11155111, sender, { images })).resolves.toBe(HASH);
  expect(images).not.toHaveBeenCalled();
  expect(sender.sendContractCall).not.toHaveBeenCalled();
});
it("keeps a proved failed UserOperation terminal until explicit Retry", async () => {
  const operation = `0x${"ac".repeat(32)}` as const;
  const work = job<WorkJobPayload>(
    "work",
    {
      actionUID: 3,
      gardenAddress: GARDEN,
      feedback: "Done",
      uploadCheckpoint: {
        files: {},
        submittedAt: "2026-09-12",
        broadcast: { kind: "user-operation", hash: operation },
      },
    },
    { id: crypto.randomUUID() }
  );
  const sender = createMockTransactionSender();
  sender.reconcileBroadcast = vi.fn().mockResolvedValue({ status: "reverted" });
  await expect(executeWorkJob(work.id, work, 11155111, sender)).rejects.toThrow(
    "work-transaction-reverted"
  );
  expect(work.meta?.workTransactionReverted).toBe(true);
  expect(work.payload.uploadCheckpoint?.broadcast).toEqual({
    kind: "user-operation",
    hash: operation,
  });
  expect(sender.sendContractCall).not.toHaveBeenCalled();
});

it("retains the operation identity in memory when its durable checkpoint write fails", async () => {
  const operation = `0x${"bc".repeat(32)}` as const;
  const work = job<WorkJobPayload>(
    "work",
    { actionUID: 3, gardenAddress: GARDEN, feedback: "Done" },
    { id: crypto.randomUUID() }
  );
  const sender = createMockTransactionSender();
  const update = vi.spyOn(jobQueueDB, "updateJob").mockRejectedValueOnce(new Error("quota"));
  vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
    await options?.onBroadcastReference?.({ kind: "user-operation", hash: operation });
    return { hash: HASH, sponsored: true };
  });
  sender.reconcileBroadcast = vi
    .fn()
    .mockResolvedValue({ status: "confirmed", transactionHash: HASH });
  const deps = {
    images: vi.fn().mockResolvedValue([]),
    simulate: vi.fn().mockResolvedValue(undefined),
    encodeWork: vi.fn().mockResolvedValue(HASH),
    easConfig: EAS_CONFIG,
  };
  try {
    await expect(executeWorkJob(work.id, work, 11155111, sender, deps)).rejects.toThrow(
      "awaiting-confirmation"
    );
    delete work.payload.uploadCheckpoint;
    await expect(executeWorkJob(work.id, work, 11155111, sender, deps)).resolves.toBe(HASH);
    expect(sender.reconcileBroadcast).toHaveBeenCalledWith({
      kind: "user-operation",
      hash: operation,
    });
    expect(sender.sendContractCall).toHaveBeenCalledTimes(1);
  } finally {
    update.mockRestore();
  }
});

describe("settling a send whose answer was lost", () => {
  const LANDED = `0x${"ab".repeat(32)}` as const;
  const stranded = (checkpoint: Partial<NonNullable<WorkJobPayload["uploadCheckpoint"]>>) =>
    job<WorkJobPayload>(
      "work",
      {
        actionUID: 3,
        gardenAddress: GARDEN,
        feedback: "Done",
        clientWorkId: crypto.randomUUID(),
        uploadCheckpoint: { submittedAt: "2026-09-16T11:00:00.000Z", files: {}, ...checkpoint },
      },
      { id: crypto.randomUUID() }
    );

  it("checks a UserOperation no bundler reports the same way", async () => {
    const work = stranded({ broadcast: { kind: "user-operation", hash: HASH } });
    const sender = createMockTransactionSender();
    sender.reconcileBroadcast = vi.fn().mockResolvedValue({ status: "unresolved" });
    const settleStrandedIntent = vi.fn().mockResolvedValue(LANDED);

    await expect(
      executeWorkJob(work.id, work, 11155111, sender, { settleStrandedIntent })
    ).resolves.toBe(LANDED);
    expect(settleStrandedIntent).toHaveBeenCalledWith(work, 11155111, HASH);
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("settles a transaction no receipt answers, such as a Safe's own id, by the work's landing", async () => {
    // A Safe's own transaction id: no receipt ever answers it.
    const safeId = `0x${"5a".repeat(20)}` as const;
    const work = stranded({
      broadcast: { kind: "transaction", hash: safeId },
      transactionHash: safeId,
    });
    const sender = createMockTransactionSender({ authMode: "wallet" });
    const settleStrandedIntent = vi.fn().mockResolvedValue(LANDED);

    await expect(
      executeWorkJob(work.id, work, 11155111, sender, {
        settleStrandedIntent,
        reconcile: vi.fn().mockResolvedValue("unresolved"),
      })
    ).resolves.toBe(LANDED);
    expect(settleStrandedIntent).toHaveBeenCalledWith(work, 11155111, safeId);
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });
});

describe("sending a decision once", () => {
  const LANDED = `0x${"ab".repeat(32)}` as const;
  const decision = (sendCheckpoint?: ApprovalJobPayload["sendCheckpoint"]) =>
    job<ApprovalJobPayload>(
      "approval",
      {
        actionUID: 7,
        workUID: HASH,
        gardenAddress: GARDEN,
        gardenerAddress: USER,
        approved: true,
        confidence: 2,
        verificationMethod: 1,
        ...(sendCheckpoint ? { sendCheckpoint } : {}),
      },
      { id: crypto.randomUUID() }
    );
  const sendDeps = (overrides = {}) => ({
    encodeApproval: vi.fn().mockReturnValue(HASH),
    easConfig: EAS_CONFIG,
    persist: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });
  const lostResponse = () =>
    Object.assign(new Error("The request took too long"), { name: "TimeoutError" });

  it("never sends a decision again when its answer is lost after the send", async () => {
    const approval = decision();
    const sender = createMockTransactionSender();
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.({ kind: "user-operation", hash: HASH });
      await options?.onBroadcastReference?.({ kind: "user-operation", hash: HASH });
      throw lostResponse();
    });
    sender.reconcileBroadcast = vi
      .fn()
      .mockResolvedValueOnce({ status: "unresolved" })
      .mockResolvedValueOnce({ status: "confirmed", transactionHash: LANDED });
    const deps = sendDeps({
      settleStrandedIntent: vi.fn().mockRejectedValue(new Error("waiting")),
    });

    await expect(executeApprovalJob(approval, 11155111, sender, deps)).rejects.toThrow(
      "awaiting-confirmation"
    );
    expect(approval.payload.sendCheckpoint).toMatchObject({
      broadcast: { kind: "user-operation", hash: HASH },
      broadcastPending: false,
    });
    expect(deps.persist).toHaveBeenCalled();

    // The next run asks about the operation instead of sending the decision again.
    await expect(executeApprovalJob(approval, 11155111, sender, deps)).rejects.toThrow("waiting");
    await expect(executeApprovalJob(approval, 11155111, sender, deps)).resolves.toBe(LANDED);
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it("confirms a recorded transaction by its receipt, and settles an unresolved one by its landing", async () => {
    const sender = createMockTransactionSender();
    const settleStrandedIntent = vi.fn();
    const confirmed = sendDeps({
      reconcile: vi.fn().mockResolvedValue("confirmed"),
      settleStrandedIntent,
    });

    await expect(
      executeApprovalJob(decision({ transactionHash: LANDED }), 11155111, sender, confirmed)
    ).resolves.toBe(LANDED);
    expect(settleStrandedIntent).not.toHaveBeenCalled();

    // A Safe's own transaction id: no receipt ever answers it, so the decision's
    // landing settles it. Its absence alone never reopens it.
    const safeId = `0x${"5a".repeat(20)}` as const;
    const safe = decision({ transactionHash: safeId });
    settleStrandedIntent.mockResolvedValue(LANDED);
    const unresolved = sendDeps({
      reconcile: vi.fn().mockResolvedValue("unresolved"),
      settleStrandedIntent,
    });
    await expect(executeApprovalJob(safe, 11155111, sender, unresolved)).resolves.toBe(LANDED);
    expect(settleStrandedIntent).toHaveBeenCalledWith(safe, 11155111, safeId);
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("clears a send that reverted, so the decision may be sent again", async () => {
    const approval = decision({ transactionHash: LANDED });
    const sender = createMockTransactionSender();
    const deps = sendDeps({ reconcile: vi.fn().mockResolvedValue("reverted") });

    await expect(executeApprovalJob(approval, 11155111, sender, deps)).rejects.toThrow(
      "Transaction reverted"
    );
    expect(approval.payload.sendCheckpoint).toBeUndefined();
    expect(deps.persist).toHaveBeenCalledWith(approval);
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("asks the steward's own decisions about a send whose answer was lost", async () => {
    const approval = decision({
      broadcastPending: true,
      broadcastPendingAt: "2026-09-16T11:00:00.000Z",
    });
    const sender = createMockTransactionSender();
    const settleStrandedIntent = vi.fn().mockResolvedValue(LANDED);

    await expect(
      executeApprovalJob(approval, 11155111, sender, sendDeps({ settleStrandedIntent }))
    ).resolves.toBe(LANDED);
    expect(settleStrandedIntent).toHaveBeenCalledWith(approval, 11155111, "0x");
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("clears the intent when the wallet rejects, and holds the decision for the person to send", async () => {
    const approval = decision();
    const sender = createMockTransactionSender({ authMode: "wallet" });
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      throw Object.assign(new Error("User rejected the request."), { code: 4001 });
    });
    const deps = sendDeps();

    await expect(executeApprovalJob(approval, 11155111, sender, deps)).rejects.toThrow(
      "User rejected"
    );
    expect(approval.payload.sendCheckpoint).toBeUndefined();
    expect(approval.meta?.requiresExplicitSend).toBe(true);
    expect(deps.persist).toHaveBeenCalledTimes(3);
  });
});

describe("work and decisions keep the send rules commitment acts follow", () => {
  const OPERATION = `0x${"0e".repeat(32)}` as const;
  const LONG_AGO = new Date(0).toISOString();
  type Send = Omit<NonNullable<WorkJobPayload["uploadCheckpoint"]>, "submittedAt" | "files">;

  const workWith = (id: string, record?: Send) =>
    job<WorkJobPayload>(
      "work",
      {
        actionUID: 3,
        gardenAddress: GARDEN,
        feedback: "Done",
        clientWorkId: `client-${id}`,
        uploadCheckpoint: { submittedAt: LONG_AGO, files: {}, ...record },
      },
      { id }
    );
  const decisionWith = (id: string, record?: Send) =>
    job<ApprovalJobPayload>(
      "approval",
      {
        actionUID: 7,
        workUID: HASH,
        gardenAddress: GARDEN,
        gardenerAddress: USER,
        approved: true,
        confidence: 2,
        verificationMethod: 1,
        ...(record ? { sendCheckpoint: record } : {}),
      },
      { id }
    );
  /** How each kind is made, and how its executor is run with shared test doubles. */
  const kinds = [
    {
      kind: "work",
      make: workWith,
      run: (queued: Job, sender: ReturnType<typeof createMockTransactionSender>, deps = {}) =>
        executeWorkJob(queued.id, queued as Job<WorkJobPayload>, 42161, sender, {
          images: vi.fn().mockResolvedValue([]),
          simulate: vi.fn().mockResolvedValue(undefined),
          encodeWork: vi.fn().mockResolvedValue(HASH),
          easConfig: EAS_CONFIG,
          ...deps,
        }),
    },
    {
      kind: "decision",
      make: decisionWith,
      run: (queued: Job, sender: ReturnType<typeof createMockTransactionSender>, deps = {}) =>
        executeApprovalJob(queued as Job<ApprovalJobPayload>, 42161, sender, {
          encodeApproval: vi.fn().mockReturnValue(HASH),
          easConfig: EAS_CONFIG,
          persist: vi.fn().mockResolvedValue(undefined),
          ...deps,
        }),
    },
  ] as const;

  it.each(
    kinds
  )("holds a $kind's send while the prompt is open, and leaves one another tab holds", async ({
    kind,
    make,
    run,
  }) => {
    const held = new Set<string>();
    stubWebLocks(held);
    const heldDuringSend: string[] = [];
    const sender = createMockTransactionSender({ authMode: "wallet" });
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      heldDuringSend.push(...held);
      await options?.onBroadcast?.(HASH);
      return { hash: HASH, sponsored: false };
    });

    try {
      const sent = make(`${kind}-holds-lock`);
      await expect(run(sent, sender)).resolves.toBe(HASH);
      expect(heldDuringSend).toEqual([sendLockName(sent.id)]);
      expect(held.size).toBe(0);

      // Another tab is mid-send, perhaps frozen with its prompt open.
      const elsewhere = make(`${kind}-held-elsewhere`);
      held.add(sendLockName(elsewhere.id));
      await expect(run(elsewhere, sender)).rejects.toThrow("submission-ownership-changed");
      expect(sender.sendContractCall).toHaveBeenCalledOnce();
      expect(hasRecordedSend(elsewhere)).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(
    kinds
  )("keeps the nonce a $kind's transaction used once its receipt does not come", async ({
    kind,
    make,
    run,
  }) => {
    const sender = createMockTransactionSender({ authMode: "wallet" });
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      await options?.onBroadcast?.(HASH);
      throw new Error("receipt timeout");
    });
    // Read off the transaction itself while the network holds it: the wallet
    // may know sends this network does not, so a count read before is a floor.
    const readTransactionNonce = vi.fn().mockResolvedValue(7);
    const queued = make(`${kind}-receipt-lost`);

    await expect(run(queued, sender, { reads: { readTransactionNonce } })).rejects.toBeInstanceOf(
      AwaitingWorkConfirmation
    );
    expect(sendCheckpointOf(queued)).toMatchObject({
      transactionHash: HASH,
      transactionNonce: { hash: HASH, nonce: 7 },
    });
    expect(readTransactionNonce).toHaveBeenCalledWith(HASH);
    expect(isDiscardableJob(queued)).toBe(false);
  });

  it.each(
    kinds
  )("keeps the chain's head with a $kind's intent, and sends without it when the chain cannot say", async ({
    kind,
    make,
    run,
  }) => {
    const steps: string[] = [];
    const sender = createMockTransactionSender({ authMode: "wallet" });
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      // A passkey signs before its intent: a prompt left open must not age the head.
      steps.push("signed");
      await options?.onBeforeBroadcast?.();
      await options?.onBroadcast?.(HASH);
      return { hash: HASH, sponsored: false };
    });
    // A lost send is then timed on the chain's clock, whatever the device's clock does.
    const kept = make(`${kind}-keeps-head`);
    const readChainHead = vi.fn(async () => {
      steps.push("head read");
      return { number: 100n, timestamp: 1_234 };
    });
    await expect(run(kept, sender, { reads: { readChainHead } })).resolves.toBe(HASH);
    expect(sendCheckpointOf(kept)).toMatchObject({ intentBlock: 100n, intentChainTime: 1_234 });
    expect(steps).toEqual(["signed", "head read"]);

    // The lookup falls back to the device's clock, so a failed read never stops the send.
    const unread = make(`${kind}-head-unread`);
    const failing = vi.fn().mockRejectedValue(new Error("rpc unavailable"));
    await expect(run(unread, sender, { reads: { readChainHead: failing } })).resolves.toBe(HASH);
    expect(sendCheckpointOf(unread)).toMatchObject({ transactionHash: HASH });
    expect(sendCheckpointOf(unread)?.intentChainTime).toBeUndefined();
  });

  it.each(
    kinds
  )("offers a lost $kind again only when no tab holds it, its account has nothing waiting and its bundler cannot land it", async ({
    kind,
    make,
    run,
  }) => {
    // Long past the grace window, and EAS, caught up, holds no sign of it.
    const lost = (id: string) =>
      make(`${kind}-${id}`, { broadcastPending: true, broadcastPendingAt: LONG_AGO });
    const sender = createMockTransactionSender({ authMode: "wallet" });
    sender.reconcileBroadcast = vi.fn().mockResolvedValue({ status: "unresolved" });
    const hasPendingTransaction = vi.fn().mockResolvedValue(false);
    const userOperationMayLand = vi.fn().mockResolvedValue(false);
    const deps = {
      reads: { hasPendingTransaction, userOperationMayLand },
      lookUpLanded: vi.fn().mockResolvedValue({ status: "absent" }),
    };
    const held = new Set<string>();

    try {
      // Without Web Locks nothing can say whether another tab's prompt is open.
      vi.stubGlobal("navigator", {});
      await expect(run(lost("no-locks"), sender, deps)).rejects.toBeInstanceOf(
        AwaitingWorkConfirmation
      );

      stubWebLocks(held);
      const holding = lost("still-held");
      held.add(sendLockName(holding.id));
      await expect(run(holding, sender, deps)).rejects.toBeInstanceOf(AwaitingWorkConfirmation);
      // A transaction the network holds but has not mined may be the lost send.
      hasPendingTransaction.mockResolvedValueOnce(true);
      await expect(run(lost("account-busy"), sender, deps)).rejects.toBeInstanceOf(
        AwaitingWorkConfirmation
      );
      expect(hasPendingTransaction).toHaveBeenCalledWith(USER);
      // A passkey send's pending state lives at its bundler, not in the account's nonce.
      const queued = make(`${kind}-operation-queued`, {
        broadcastPending: true,
        broadcastPendingAt: LONG_AGO,
        broadcast: { kind: "user-operation", hash: OPERATION },
      });
      userOperationMayLand.mockResolvedValueOnce(true);
      await expect(run(queued, sender, deps)).rejects.toBeInstanceOf(AwaitingWorkConfirmation);
      expect(userOperationMayLand).toHaveBeenCalledWith(OPERATION);

      const released = lost("released");
      await expect(run(released, sender, deps)).rejects.toBeInstanceOf(StrandedSendReopened);
      expect(hasRecordedSend(released)).toBe(false);
      expect(sender.sendContractCall).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(
    kinds
  )("waits out a lost $kind that kept the chain's time on the chain's clock, whichever way the device's clock moved", async ({
    kind,
    make,
    run,
  }) => {
    // The device's clock ran two hours fast when the send was recorded and has
    // since been set right, so by the device the send has not happened yet.
    const intentAt = Math.floor(Date.now() / 1000) - 45 * 60;
    const lost = (id: string) =>
      make(`${kind}-${id}`, {
        broadcastPending: true,
        broadcastPendingAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
        intentChainTime: intentAt,
      });
    const readChainHead = vi.fn();
    const sender = createMockTransactionSender({ authMode: "wallet" });
    const deps = {
      reads: {
        readChainHead,
        hasPendingTransaction: vi.fn().mockResolvedValue(false),
        userOperationMayLand: vi.fn().mockResolvedValue(false),
      },
      lookUpLanded: vi.fn().mockResolvedValue({ status: "absent" }),
    };
    stubWebLocks(new Set());

    try {
      // Ten minutes after the send on the chain's clock, its window holds it.
      readChainHead.mockResolvedValueOnce({ number: 100n, timestamp: intentAt + 10 * 60 });
      await expect(run(lost("window-open"), sender, deps)).rejects.toBeInstanceOf(
        AwaitingWorkConfirmation
      );
      // Past the window on the chain's clock, with nothing holding it, the head is
      // kept: the send is offered again once the indexer has passed that block.
      readChainHead.mockResolvedValue({ number: 200n, timestamp: intentAt + 31 * 60 });
      const passed = lost("window-passed");
      await expect(run(passed, sender, deps)).rejects.toBeInstanceOf(AwaitingWorkConfirmation);
      expect(sendCheckpointOf(passed)?.idleBlock).toBe(200n);
      expect(sender.sendContractCall).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(
    kinds
  )("offers a $kind's transaction on record again only once it can never be included", async ({
    kind,
    make,
    run,
  }) => {
    // Long past the grace window, no receipt, and EAS, caught up, holds no sign of it.
    const unanswered = (id: string, extra: Partial<Send> = {}) =>
      make(`${kind}-${id}`, {
        broadcastPending: false,
        broadcastPendingAt: LONG_AGO,
        broadcast: { kind: "transaction", hash: HASH },
        transactionHash: HASH,
        ...extra,
      });
    const sender = createMockTransactionSender({ authMode: "wallet" });
    const transactionSuperseded = vi.fn().mockResolvedValue(false);
    // The network no longer holds the transaction, so its nonce cannot be read now.
    const readTransactionNonce = vi.fn().mockResolvedValue(null);
    const deps = {
      reads: {
        hasPendingTransaction: vi.fn().mockResolvedValue(false),
        transactionSuperseded,
        readTransactionNonce,
      },
      reconcile: vi.fn().mockResolvedValue("unresolved"),
      lookUpLanded: vi.fn().mockResolvedValue({ status: "absent" }),
    };
    stubWebLocks(new Set());

    try {
      // Its nonce unspent, or unreadable, the signed transaction may still land.
      const unspent = unanswered("nonce-unspent", { transactionNonce: { hash: HASH, nonce: 5 } });
      await expect(run(unspent, sender, deps)).rejects.toBeInstanceOf(AwaitingWorkConfirmation);
      expect(transactionSuperseded).toHaveBeenCalledWith(HASH, USER, 5);
      // A record without the nonce cannot show it: it completes only by landing.
      transactionSuperseded.mockClear();
      await expect(run(unanswered("no-nonce"), sender, deps)).rejects.toBeInstanceOf(
        AwaitingWorkConfirmation
      );
      expect(transactionSuperseded).not.toHaveBeenCalled();
      // While the network holds it, the settle pass keeps the nonce it used.
      readTransactionNonce.mockResolvedValueOnce(9);
      const heldByNetwork = unanswered("held");
      await expect(run(heldByNetwork, sender, deps)).rejects.toBeInstanceOf(
        AwaitingWorkConfirmation
      );
      expect(sendCheckpointOf(heldByNetwork)).toMatchObject({
        transactionNonce: { hash: HASH, nonce: 9 },
      });

      // The wallet saw it replaced, and nothing landed in its place.
      const replaced = unanswered("replaced", { transactionReplaced: true });
      await expect(run(replaced, sender, deps)).rejects.toBeInstanceOf(StrandedSendReopened);
      expect(hasRecordedSend(replaced)).toBe(false);

      // Another transaction took its nonce.
      transactionSuperseded.mockResolvedValue(true);
      const spent = unanswered("nonce-spent", { transactionNonce: { hash: HASH, nonce: 5 } });
      await expect(run(spent, sender, deps)).rejects.toBeInstanceOf(StrandedSendReopened);
      expect(hasRecordedSend(spent)).toBe(false);
      expect(isDiscardableJob(spent)).toBe(true);
      expect(sender.sendContractCall).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
