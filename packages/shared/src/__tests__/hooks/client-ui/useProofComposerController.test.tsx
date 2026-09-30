/** @vitest-environment happy-dom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProofComposerController } from "../../../hooks/client-ui/commitment/useProofComposerController";
import type { CommitmentJobVariables } from "../../../hooks/commitment-pooling/useCommitmentJobs";
import type { CommitmentProofDraftHandle } from "../../../hooks/commitment-pooling/useCommitmentProofDraft";
import {
  DEMO_CHAIN_ID,
  DEMO_GARDEN,
  EDU,
  MARIA,
  TUNDE,
} from "../../../modules/commitment-pooling/demo/demo-builders";
import type { CommitmentDetail } from "../../../modules/commitment-pooling/types";
import { jobQueueEventBus } from "../../../modules/job-queue/event-bus";
import type { Job } from "../../../types/job-queue";
import type { Address } from "../../../types/domain";
import {
  availableCapability,
  commitmentDetailFixture,
  commitmentFixture,
  contributorFixture,
} from "../../test-utils/commitment-pooling-fixtures";

type Enqueue = (input: CommitmentJobVariables) => Promise<string>;
type Prepared = { files: File[]; rejectedCount: number };

const detail = commitmentDetailFixture({
  commitment: commitmentFixture({
    commitmentId: 1001n,
    leadProvider: TUNDE,
    providerGarden: DEMO_GARDEN,
    derivedState: "ACTIVE",
  }),
  contributors: [
    contributorFixture({ commitmentId: 1001n, contributor: TUNDE, isLead: true }),
    contributorFixture({ commitmentId: 1001n, contributor: MARIA, isLead: false }),
  ],
});

const mocks = vi.hoisted(() => ({
  viewer: null as Address | null,
  isOnline: true,
  query: {
    detail: null as CommitmentDetail | null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(async () => undefined),
    availability: { status: "unknown-chain" } as {
      status: "available" | "unknown-chain";
      capability?: typeof availableCapability;
    },
  },
  metadata: null as { version: 1; title: string } | null,
  enqueue: vi.fn<Enqueue>(),
  jobsPending: false,
  draft: {
    key: "proof-key",
    saved: undefined,
    savedFiles: { media: [], audioNotes: [] },
    isRestored: true,
    saveWords: vi.fn(),
    saveFiles: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  } as CommitmentProofDraftHandle,
  prepare: vi.fn<(files: File[]) => Promise<Prepared>>(),
  cleanup: vi.fn(),
  previewUrl: vi.fn((file: File) => `blob:${file.name}`),
  recordingComplete: null as ((file: File) => void) | null,
}));

vi.mock("../../../hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => mocks.isOnline,
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mocks.viewer,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentPooling", () => ({
  useCommitment: () => mocks.query,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentMetadata", () => ({
  useCommitmentMetadataFor: () => mocks.metadata,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentJobs", () => ({
  useCommitmentJobs: () => ({
    enqueue: mocks.enqueue,
    isPending: mocks.jobsPending,
    error: null,
    viewer: mocks.viewer,
  }),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentProofDraft", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../hooks/commitment-pooling/useCommitmentProofDraft")
    >();
  return { ...actual, useCommitmentProofDraft: () => mocks.draft };
});

vi.mock("../../../hooks/utils/useAudioRecording", () => ({
  useAudioRecording: (input: { onRecordingComplete: (file: File) => void }) => {
    mocks.recordingComplete = input.onRecordingComplete;
    return { isRecording: false, elapsed: 0, toggle: vi.fn() };
  },
}));

vi.mock("../../../modules/work/media-processing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../modules/work/media-processing")>();
  return { ...actual, prepareMediaForUpload: (files: File[]) => mocks.prepare(files) };
});

vi.mock("../../../modules/job-queue/media-resource-manager", () => ({
  mediaResourceManager: {
    cleanupUrls: mocks.cleanup,
    getOrCreateUrl: mocks.previewUrl,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.viewer = TUNDE;
  mocks.isOnline = true;
  mocks.query.detail = detail;
  mocks.query.isLoading = false;
  mocks.query.isError = false;
  mocks.query.availability = { status: "available", capability: availableCapability };
  mocks.metadata = { version: 1, title: "Restore the tool shed" };
  mocks.jobsPending = false;
  mocks.draft = {
    key: "proof-key",
    saved: undefined,
    savedFiles: { media: [], audioNotes: [] },
    isRestored: true,
    saveWords: vi.fn(),
    saveFiles: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  };
  mocks.prepare.mockImplementation(async (files) => ({ files, rejectedCount: 0 }));
  mocks.enqueue.mockResolvedValue("job-1");
});

const renderController = () =>
  renderHook(() =>
    useProofComposerController({
      chainId: DEMO_CHAIN_ID,
      commitmentId: 1001n,
      routeGarden: DEMO_GARDEN,
    })
  );

describe("useProofComposerController", () => {
  it("resolves the status ladder and keeps availability first", () => {
    mocks.query.availability = { status: "unknown-chain" };
    const { result, rerender } = renderController();
    expect(result.current.status).toBe("unavailable");

    mocks.query.availability = { status: "available", capability: availableCapability };
    mocks.query.isLoading = true;
    rerender();
    expect(result.current.status).toBe("loading");

    mocks.query.isLoading = false;
    mocks.query.isError = true;
    rerender();
    expect(result.current.status).toBe("error");

    mocks.query.isError = false;
    mocks.viewer = EDU;
    mocks.query.detail = commitmentDetailFixture({
      commitment: detail.commitment,
      contributors: [],
    });
    rerender();
    expect(result.current.status).toBe("notYours");

    mocks.viewer = TUNDE;
    mocks.query.detail = commitmentDetailFixture({
      commitment: commitmentFixture({
        commitmentId: 1001n,
        leadProvider: TUNDE,
        derivedState: "READY_FOR_CONFIRMATION",
      }),
    });
    rerender();
    expect(result.current.status).toBe("closed");
  });

  it("defaults credit visibly to the signed-in roster member", () => {
    const { result } = renderController();
    expect(result.current.status).toBe("ready");
    expect(result.current.roster).toEqual([
      { address: TUNDE, isLead: true },
      { address: MARIA, isLead: false },
    ]);
    expect(result.current.credited).toEqual([TUNDE]);

    act(() => result.current.toggleCredit(MARIA));
    expect(result.current.credited).toEqual([TUNDE, MARIA]);

    act(() => result.current.toggleCredit(TUNDE));
    expect(result.current.credited).toEqual([MARIA]);
  });

  it("prepares supported files, reports rejections, and accepts recorded audio", async () => {
    const accepted = new File(["photo"], "garden.jpg", { type: "image/jpeg" });
    const audio = new File(["audio"], "note.webm", { type: "audio/webm" });
    mocks.prepare.mockResolvedValue({ files: [accepted], rejectedCount: 2 });
    const { result } = renderController();

    await act(async () => {
      await expect(result.current.pick([accepted])).resolves.toEqual({ rejectedCount: 2 });
    });
    expect(result.current.media).toEqual([accepted]);
    expect(result.current.imageUrls).toEqual(["blob:garden.jpg"]);

    act(() => result.current.removeMedia(0));
    expect(result.current.media).toEqual([]);

    act(() => mocks.recordingComplete?.(audio));
    expect(result.current.audioNotes).toEqual([audio]);
    expect(result.current.readiness("details")).toEqual({ canAdvance: true, reason: null });

    act(() => result.current.removeAudio(0));
    expect(result.current.audioNotes).toEqual([]);

    await act(async () => {
      await expect(result.current.pick(null)).resolves.toEqual({ rejectedCount: 0 });
    });
  });

  it("submits one sparse payload and clears only after enqueue succeeds", async () => {
    const { result } = renderController();
    act(() => {
      result.current.setNote("  Beds cleared  ");
      result.current.toggleCredit(MARIA);
    });

    await act(async () => {
      await expect(result.current.submit()).resolves.toBe(true);
    });

    expect(mocks.enqueue).toHaveBeenCalledWith({
      act: "evidence",
      report: expect.any(Function),
      payload: {
        clientEvidenceId: result.current.clientEvidenceId,
        commitmentId: 1001n,
        creditedContributors: [TUNDE, MARIA],
        gardenAddress: DEMO_GARDEN,
        note: "Beds cleared",
      },
    });
    expect(mocks.draft.clear).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("queued");
  });

  it("distinguishes delayed signing, confirmation and a landed proof", async () => {
    let finish!: () => void;
    mocks.enqueue.mockImplementation(async ({ report }) => {
      report?.({ stage: "wallet" });
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      report?.({ stage: "confirming", txHash: "0x123" });
      report?.({ stage: "landed", txHash: "0x123" });
      return "job-1";
    });
    const { result } = renderController();
    act(() => result.current.setNote("Done"));
    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.submit();
    });
    await waitFor(() => expect(result.current.sendPhase).toBe("signing"));
    expect(result.current.status).toBe("ready");
    expect(mocks.draft.clear).not.toHaveBeenCalled();
    await act(async () => {
      await expect(result.current.submit()).resolves.toBe(false);
    });
    await act(async () => {
      finish();
      await pending;
    });
    expect(result.current.status).toBe("confirmed");
    expect(mocks.enqueue).toHaveBeenCalledOnce();
  });

  it("keeps queued proof unconfirmed when a send remains pending", async () => {
    mocks.enqueue.mockImplementation(async ({ report }) => {
      report?.({ stage: "confirming", txHash: "0x123" });
      report?.({ stage: "queued" });
      return "job-1";
    });
    const { result } = renderController();
    act(() => result.current.setNote("Done"));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.status).toBe("queued");
    expect(result.current.sendPhase).toBe("queued");
  });

  it("tracks only the admitted proof through background failure and confirmation", async () => {
    const { result } = renderController();
    act(() => result.current.setNote("Done"));
    await act(async () => {
      await result.current.submit();
    });
    const job: Job = {
      id: "job-1",
      kind: "evidence",
      chainId: DEMO_CHAIN_ID,
      userAddress: TUNDE,
      payload: { clientEvidenceId: result.current.clientEvidenceId },
      attempts: 0,
      createdAt: 1,
      synced: false,
    };
    act(() =>
      jobQueueEventBus.emit("job:completed", {
        jobId: "other",
        job: { ...job, payload: { clientEvidenceId: "other" } },
        txHash: "0x123",
      })
    );
    expect(result.current.status).toBe("queued");
    act(() =>
      jobQueueEventBus.emit("job:failed", { jobId: job.id, job, error: "connection lost" })
    );
    expect(result.current.status).toBe("failed");
    act(() => jobQueueEventBus.emit("job:completed", { jobId: job.id, job, txHash: "0x123" }));
    expect(result.current.status).toBe("confirmed");
  });

  it("keeps the draft and stable client id when enqueue rejects", async () => {
    mocks.enqueue.mockRejectedValue(new Error("queue unavailable"));
    const { result, rerender } = renderController();
    const id = result.current.clientEvidenceId;
    act(() => result.current.setNote("Done"));

    await act(async () => {
      await expect(result.current.submit()).resolves.toBe(false);
    });
    rerender();

    expect(result.current.clientEvidenceId).toBe(id);
    expect(result.current.note).toBe("Done");
    expect(mocks.draft.clear).not.toHaveBeenCalled();
  });

  it.each([
    { failure: "admission", reportsQueued: true },
    { failure: "wallet", reportsQueued: true },
    { failure: "admission", reportsQueued: false },
  ])("replaces $failure failure on a queued retry (report: $reportsQueued)", async ({
    failure,
    reportsQueued,
  }) => {
    mocks.enqueue.mockImplementationOnce(async ({ report }) => {
      if (failure === "wallet") report?.({ stage: "wallet" });
      throw new Error(failure === "wallet" ? "User rejected the request" : "queue unavailable");
    });
    const { result } = renderController();
    const id = result.current.clientEvidenceId;
    act(() => result.current.setNote("Done"));
    await act(async () => {
      await expect(result.current.submit()).resolves.toBe(false);
    });
    expect(result.current.sendPhase).toBe("failed");
    expect(mocks.draft.clear).not.toHaveBeenCalled();
    mocks.enqueue.mockImplementationOnce(async ({ report }) => {
      if (reportsQueued) report?.({ stage: "queued" });
      return "job-retry";
    });
    await act(async () => {
      await expect(result.current.submit()).resolves.toBe(true);
    });
    expect(result.current.status).toBe("queued");
    expect(result.current.sendPhase).toBe("queued");
    expect(result.current.clientEvidenceId).toBe(id);
    expect(mocks.draft.clear).toHaveBeenCalledOnce();
  });

  it.each([
    "confirmed",
    "failed",
  ] as const)("preserves a current-attempt %s event before enqueue resolves", async (phase) => {
    mocks.enqueue.mockImplementation(async (input) => {
      if (input.act !== "evidence") throw new Error("Expected an evidence job");
      const { payload, report } = input;
      const job: Job = {
        id: "job-1",
        kind: "evidence",
        chainId: DEMO_CHAIN_ID,
        userAddress: TUNDE,
        payload,
        attempts: 0,
        createdAt: 1,
        synced: false,
      };
      if (phase === "confirmed")
        jobQueueEventBus.emit("job:completed", { jobId: job.id, job, txHash: "0x123" });
      else jobQueueEventBus.emit("job:failed", { jobId: job.id, job, error: "connection lost" });
      report?.({ stage: "queued" });
      return job.id;
    });
    const { result } = renderController();
    act(() => result.current.setNote("Done"));
    await act(async () => {
      await expect(result.current.submit()).resolves.toBe(true);
    });
    expect(result.current.status).toBe(phase);
    expect(result.current.sendPhase).toBe(phase);
  });

  it("restores words, choices, files, and the saved client id", async () => {
    const photo = new File(["photo"], "restored.jpg", { type: "image/jpeg" });
    mocks.draft = {
      ...mocks.draft,
      saved: {
        note: "Restored words",
        links: ["https://example.org"],
        credited: [MARIA],
        clientEvidenceId: "restored-id",
        updatedAt: 1,
      },
      savedFiles: { media: [photo], audioNotes: [] },
    };
    const { result } = renderController();

    await waitFor(() => expect(result.current.media).toEqual([photo]));
    expect(result.current).toMatchObject({
      note: "Restored words",
      links: ["https://example.org"],
      credited: [MARIA],
      clientEvidenceId: "restored-id",
    });
  });

  it("releases proof preview URLs on unmount", () => {
    const { unmount } = renderController();
    unmount();
    expect(mocks.cleanup).toHaveBeenCalledWith("proof");
  });
});
