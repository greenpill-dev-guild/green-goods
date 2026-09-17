/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  isUploadJob,
  queuedUploadStatus,
  uploadPreparationOf,
} from "../../../modules/work/upload-state";
import type { Job } from "../../../types/job-queue";

const CHECKED_AT = "2026-09-17T10:00:00.000Z";

function queued(kind: string, overrides: Partial<Job> = {}): Job {
  return {
    id: `${kind}-1`,
    kind,
    payload: { actionUID: 1, gardenAddress: "0xgarden", feedback: "" },
    createdAt: 1,
    attempts: 0,
    synced: false,
    userAddress: "0xuser",
    ...overrides,
  } as Job;
}

describe("where a queued item stands for Upload all", () => {
  it("sends only work and decisions through Upload all", () => {
    expect(isUploadJob({ kind: "work" })).toBe(true);
    expect(isUploadJob({ kind: "approval" })).toBe(true);
    expect(isUploadJob({ kind: "claim" })).toBe(false);
  });

  it("is preparing until preparation records an answer", () => {
    expect(queuedUploadStatus(queued("work"))).toEqual({ state: "preparing", declined: false });
  });

  it("is ready once prepared, and remembers a declined prompt", () => {
    const ready = queued("approval", {
      meta: { preparation: { status: "ready", checkedAt: CHECKED_AT }, requiresExplicitSend: true },
    });
    expect(queuedUploadStatus(ready)).toEqual({ state: "ready", declined: true });
  });

  it("says why a blocked item cannot be sent", () => {
    const blocked = queued("work", {
      meta: { preparation: { status: "blocked", reason: "action-ended", checkedAt: CHECKED_AT } },
    });
    expect(queuedUploadStatus(blocked)).toEqual({
      state: "blocked",
      declined: false,
      reason: "action-ended",
    });
  });

  it("reports photos that wait for the decoder or could not convert", () => {
    expect(
      queuedUploadStatus(
        queued("work", {
          meta: { preparation: { status: "photo-pending", checkedAt: CHECKED_AT } },
        })
      ).state
    ).toBe("photo-pending");
    // A send attempt that found the photo still waiting outranks an older answer.
    expect(
      queuedUploadStatus(
        queued("work", {
          meta: {
            preparation: { status: "ready", checkedAt: CHECKED_AT },
            waitingReason: "photo-needs-attention",
          },
        })
      ).state
    ).toBe("photo-needs-attention");
  });

  it("never offers a sent, reverted, or retired item for upload", () => {
    const ready = { preparation: { status: "ready", checkedAt: CHECKED_AT } };
    expect(
      queuedUploadStatus(
        queued("work", {
          meta: ready,
          payload: { uploadCheckpoint: { submittedAt: "", files: {}, broadcastPending: true } },
        })
      ).state
    ).toBe("sent");
    expect(
      queuedUploadStatus(
        queued("approval", {
          meta: ready,
          payload: { sendCheckpoint: { transactionHash: `0x${"ab".repeat(32)}` } },
        })
      ).state
    ).toBe("sent");
    expect(
      queuedUploadStatus(queued("work", { meta: { ...ready, workTransactionReverted: true } }))
        .state
    ).toBe("reverted");
    expect(
      queuedUploadStatus(queued("work", { meta: ready, attempts: 5, lastError: "Max retries" }))
        .state
    ).toBe("failed");
  });

  it("ignores a preparation record it does not understand", () => {
    expect(uploadPreparationOf({ meta: { preparation: { status: "ready" } } })).toBeUndefined();
    expect(
      uploadPreparationOf({ meta: { preparation: { status: "blocked", checkedAt: CHECKED_AT } } })
    ).toBeUndefined();
    expect(
      uploadPreparationOf({ meta: { preparation: { status: "sent", checkedAt: CHECKED_AT } } })
    ).toBeUndefined();
  });
});
