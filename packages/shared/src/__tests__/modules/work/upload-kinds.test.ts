/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import type { EASConfig } from "../../../config/blockchain";
import {
  hasRecordedSend,
  sendCheckpointOf,
  writeSendCheckpoint,
} from "../../../modules/job-queue/queue-policy";
import {
  UPLOAD_KINDS,
  type UploadKindContext,
  uploadKindOf,
} from "../../../modules/work/upload-kinds";
import { isUploadJob } from "../../../modules/work/upload-state";
import type { ApprovalJobPayload, Job, WorkJobPayload } from "../../../types/job-queue";

vi.mock("../../../modules/job-queue/db", () => ({ jobQueueDB: {} }));
vi.mock("../../../modules/job-queue/job-media-conversion", () => ({
  convertQueuedHeicMedia: vi.fn(),
}));

const GARDEN = "0x2222222222222222222222222222222222222222";
const EAS_CONFIG = {
  EAS: { address: "0x5555555555555555555555555555555555555555" },
  WORK: { uid: `0x${"66".repeat(32)}`, schema: "" },
  WORK_APPROVAL: { uid: `0x${"77".repeat(32)}`, schema: "" },
  ASSESSMENT: { uid: `0x${"00".repeat(32)}`, schema: "" },
  ASSESSMENT_V3: { uid: `0x${"00".repeat(32)}`, schema: "" },
  SCHEMA_REGISTRY: { address: "0x8888888888888888888888888888888888888888" },
} satisfies EASConfig;

function job<Payload>(kind: string, payload: Payload): Job<Payload> {
  return {
    id: `${kind}-1`,
    kind,
    chainId: 42161,
    userAddress: "0x1111111111111111111111111111111111111111",
    createdAt: 1,
    attempts: 0,
    synced: false,
    payload,
  } as Job<Payload>;
}

const workJob = () =>
  job<WorkJobPayload>("work", {
    actionUID: 7,
    gardenAddress: GARDEN,
    feedback: "Weeded the east beds",
    title: "Weeding",
    clientWorkId: "client-1",
    uploadCheckpoint: {
      submittedAt: "2026-09-17T09:00:00.000Z",
      files: { photo: { attachmentId: "a", contentHash: "photo", cid: "bafy-photo" } },
    },
  });

function context(overrides: Partial<UploadKindContext["dependencies"]> = {}) {
  const save = vi.fn(async (_claim, _id, amend: (stored: Job) => void) => amend(stored));
  const stored = workJob() as Job;
  return {
    stored,
    save,
    context: {
      chainId: 42161,
      claim: { token: "claim" },
      save,
      authMode: "wallet",
      dependencies: {
        images: async () => [],
        easConfig: () => EAS_CONFIG,
        encodeWork: vi.fn(async () => "0xabcdef" as const),
        encodeApproval: vi.fn(() => "0x123456" as const),
        ...overrides,
      },
    } satisfies UploadKindContext,
  };
}

describe("what each kind of queued job brings to Upload all", () => {
  it("has a kind, and a place for its send record, for every job Upload all counts", () => {
    for (const kind of Object.keys(UPLOAD_KINDS)) {
      const queued = job(kind, {});
      expect(isUploadJob(queued)).toBe(true);
      // A kind with no send record could be sent twice: nothing would mark it sent.
      writeSendCheckpoint(queued, { broadcastPending: true });
      expect(hasRecordedSend(queued)).toBe(true);
      writeSendCheckpoint(queued, undefined);
      expect(hasRecordedSend(queued)).toBe(false);
    }
    expect(uploadKindOf(job("commitment", {}))).toBeUndefined();
    expect(isUploadJob(job("commitment", {}))).toBe(false);
  });

  it("keeps a work's saved uploads when its send record is written or cleared", () => {
    const queued = workJob();
    writeSendCheckpoint(queued, { broadcastPending: true, broadcastPendingAt: "now" });
    expect(queued.payload.uploadCheckpoint?.files).toHaveProperty("photo");
    expect(sendCheckpointOf(queued)).toMatchObject({ broadcastPending: true });

    writeSendCheckpoint(queued, undefined);
    expect(queued.payload.uploadCheckpoint).toEqual({
      submittedAt: "2026-09-17T09:00:00.000Z",
      files: { photo: { attachmentId: "a", contentHash: "photo", cid: "bafy-photo" } },
    });
  });

  it("removes a decision's send record entirely when it is cleared", () => {
    const decision = job<ApprovalJobPayload>("approval", {
      actionUID: 7,
      workUID: `0x${"44".repeat(32)}`,
      gardenAddress: GARDEN,
      gardenerAddress: GARDEN,
      approved: true,
      confidence: 2,
      verificationMethod: 1,
      sendCheckpoint: { broadcastPending: true },
    });
    writeSendCheckpoint(decision, undefined);
    expect(decision.payload).not.toHaveProperty("sendCheckpoint");
  });

  it("turns a work into a work attestation from what preparation saved, for whoever signs", async () => {
    const queued = workJob();
    const { context: ctx } = context();

    await expect(UPLOAD_KINDS.work.attestation(queued as never, ctx)).resolves.toEqual({
      schema: EAS_CONFIG.WORK.uid,
      gardenAddress: GARDEN,
      attestationData: "0xabcdef",
    });
    expect(ctx.dependencies.encodeWork).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Weeding", actionUID: 7, feedback: "Weeded the east beds" }),
      42161,
      expect.objectContaining({
        clientWorkId: "client-1",
        checkpoint: queued.payload.uploadCheckpoint,
        gardenAddress: GARDEN,
        authMode: "wallet",
      })
    );
  });

  it("saves an upload that still had to run at send time under the claim, never over a recorded send", async () => {
    const queued = workJob();
    const {
      context: ctx,
      stored,
      save,
    } = context({
      encodeWork: vi.fn(async (_draft, _chainId, options) => {
        await options?.onCheckpoint?.({
          submittedAt: "later",
          files: { video: { attachmentId: "v", contentHash: "video", cid: "bafy-video" } },
          broadcastPending: true,
        });
        return "0xabcdef" as const;
      }),
    });

    await UPLOAD_KINDS.work.attestation(queued as never, ctx);

    expect(save).toHaveBeenCalledWith({ token: "claim" }, queued.id, expect.any(Function));
    const saved = (stored.payload as WorkJobPayload).uploadCheckpoint;
    expect(Object.keys(saved?.files ?? {})).toEqual(["photo", "video"]);
    // Only uploads are taken from the encoder's copy.
    expect(saved).not.toHaveProperty("broadcastPending");
    expect(Object.keys(queued.payload.uploadCheckpoint?.files ?? {})).toEqual(["photo", "video"]);
  });

  it("turns a decision into a decision attestation", async () => {
    const decision = job<ApprovalJobPayload>("approval", {
      actionUID: 7,
      workUID: `0x${"44".repeat(32)}`,
      gardenAddress: GARDEN,
      gardenerAddress: GARDEN,
      approved: false,
      feedback: "Photo is of another bed",
      confidence: 0,
      verificationMethod: 1,
    });
    const { context: ctx } = context();

    await expect(UPLOAD_KINDS.approval.attestation(decision as never, ctx)).resolves.toEqual({
      schema: EAS_CONFIG.WORK_APPROVAL.uid,
      gardenAddress: GARDEN,
      attestationData: "0x123456",
    });
    expect(ctx.dependencies.encodeApproval).toHaveBeenCalledWith(
      expect.objectContaining({ approved: false, feedback: "Photo is of another bed" }),
      42161
    );
  });
});
