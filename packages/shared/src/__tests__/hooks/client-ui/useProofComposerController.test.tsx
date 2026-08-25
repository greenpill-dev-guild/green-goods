/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProofComposerController } from "../../../hooks/client-ui/commitment/useProofComposerController";
import type { CommitmentJobInput } from "../../../hooks/commitment-pooling/useCommitmentJobs";
import type { CommitmentProofDraftHandle } from "../../../hooks/commitment-pooling/useCommitmentProofDraft";
import {
  DEMO_CHAIN_ID,
  DEMO_GARDEN,
  EDU,
  MARIA,
  TUNDE,
} from "../../../modules/commitment-pooling/demo/demo-builders";
import type { CommitmentDetail } from "../../../modules/commitment-pooling/types";
import type { Address } from "../../../types/domain";
import {
  availableCapability,
  commitmentDetailFixture,
  commitmentFixture,
  contributorFixture,
} from "../../test-utils/commitment-pooling-fixtures";

type Enqueue = (input: CommitmentJobInput) => Promise<string>;
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

vi.mock("../../../hooks/app/useOffline", () => ({
  useOffline: () => ({ isOnline: mocks.isOnline }),
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
