/** @vitest-environment happy-dom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  proofSendKey,
  settleProofSend,
  useProofSend,
} from "../../../hooks/client-ui/commitment/proofSend";
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
import type {
  CommitmentCycleRecord,
  CommitmentDetail,
  CommitmentPoolRecord,
} from "../../../modules/commitment-pooling/types";
import { jobQueueEventBus } from "../../../modules/job-queue/event-bus";
import type { Job } from "../../../types/job-queue";
import type { Address } from "../../../types/domain";
import {
  availableCapability,
  commitmentDetailFixture,
  commitmentFixture,
  contributorFixture,
  cycleFixture,
  poolFixture,
} from "../../test-utils/commitment-pooling-fixtures";

type Enqueue = (input: CommitmentJobVariables) => Promise<string>;
type Prepared = { files: File[]; rejectedCount: number };

// Amara-style lead with a teammate, on an offer someone took up: the chain can
// reach its confirmer, so Add and Send is a real choice once the proof lands.
const detail = commitmentDetailFixture({
  commitment: commitmentFixture({
    commitmentId: 1001n,
    creator: TUNDE,
    leadProvider: TUNDE,
    counterparty: EDU,
    counterpartyKind: "INDIVIDUAL",
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
  pool: null as CommitmentPoolRecord | null,
  cycle: null as CommitmentCycleRecord | null,
  metadata: null as { version: 1; title: string } | null,
  enqueue: vi.fn<Enqueue>(),
  sendQueued: vi.fn(async (_input: { jobId: string; commitmentId: bigint }) => "landed"),
  jobsPending: false,
  sendsFromTap: true,
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
  getJobs: vi.fn(async () => [] as Job[]),
  toasts: {
    adding: vi.fn(),
    confirming: vi.fn(),
    added: vi.fn(),
    savedOffline: vi.fn(),
    notAdded: vi.fn(),
    takingLonger: vi.fn(),
    couldNotAdd: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("../../../hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => mocks.isOnline,
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mocks.viewer,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentPooling", () => ({
  useCommitment: () => mocks.query,
  useCommitmentPool: () => ({ pool: mocks.pool }),
  useCommitmentCycle: () => ({ cycle: mocks.cycle }),
}));

vi.mock("../../../hooks/commitment-pooling/useProtocolPool", () => ({
  useProtocolPool: () => ({ isRegistered: false, rootGarden: null }),
}));

vi.mock("../../../hooks/garden/useGardenRecord", () => ({
  useGardenRecord: () => ({ data: null }),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentMetadata", () => ({
  useCommitmentMetadataFor: () => mocks.metadata,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentJobs", () => ({
  useCommitmentJobs: () => ({
    enqueue: mocks.enqueue,
    sendQueued: mocks.sendQueued,
    isPending: mocks.jobsPending,
    error: null,
    viewer: mocks.viewer,
    sendsFromTap: mocks.sendsFromTap,
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

vi.mock("../../../modules/job-queue/default-instance", () => ({
  jobQueue: { getJobs: mocks.getJobs },
}));

vi.mock("../../../components/Toast/presets/proof", () => ({
  createProofToasts: () => mocks.toasts,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sendQueued.mockResolvedValue("landed");
  mocks.viewer = TUNDE;
  mocks.isOnline = true;
  mocks.query.detail = detail;
  mocks.query.isLoading = false;
  mocks.query.isError = false;
  mocks.query.availability = { status: "available", capability: availableCapability };
  mocks.pool = poolFixture();
  mocks.cycle = cycleFixture({ state: "OPEN" });
  mocks.metadata = { version: 1, title: "Restore the tool shed" };
  mocks.jobsPending = false;
  mocks.sendsFromTap = true;
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
  // A wallet send that lands: admitted, signed, confirmed.
  mocks.enqueue.mockImplementation(async ({ report }) => {
    report?.({ stage: "admitted", jobId: "job-1" });
    report?.({ stage: "wallet" });
    report?.({ stage: "confirming", txHash: "0x123" });
    report?.({ stage: "landed", txHash: "0x123" });
    return "job-1";
  });
});

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(IntlProvider, { locale: "en", messages: {} }, children);

const onOpenYourWork = vi.fn();
const renderController = () =>
  renderHook(
    () =>
      useProofComposerController({
        chainId: DEMO_CHAIN_ID,
        commitmentId: 1001n,
        routeGarden: DEMO_GARDEN,
        onOpenYourWork,
      }),
    { wrapper }
  );

/** A controller with something to send, as Review has it. */
function readyToSend() {
  const rendered = renderController();
  act(() => rendered.result.current.setNote("Posts replaced"));
  return rendered;
}

describe("useProofComposerController", () => {
  // The promise's view of a proof on its way outlives any one screen.
  afterEach(() => settleProofSend(proofSendKey(DEMO_CHAIN_ID, 1001n, TUNDE), { landed: false }));

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
    expect(result.current.leads).toBe(true);
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

  it("sends one sparse payload and lets go of the draft once the queue holds it", async () => {
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
    expect(result.current.landing).toBe("sending");
    expect(mocks.toasts.added).toHaveBeenCalledWith({ sent: false, leads: true });
  });

  it("hands over to the promise once signed, never while the prompt is open", async () => {
    let sign!: () => void;
    mocks.enqueue.mockImplementation(async ({ report }) => {
      report?.({ stage: "admitted", jobId: "job-1" });
      report?.({ stage: "wallet" });
      await new Promise<void>((resolve) => {
        sign = resolve;
      });
      report?.({ stage: "confirming", txHash: "0x123" });
      report?.({ stage: "landed", txHash: "0x123" });
      return "job-1";
    });
    const { result } = readyToSend();
    // What the promise hears about this proof while it sends.
    const onItsWay = renderHook(() => useProofSend(proofSendKey(DEMO_CHAIN_ID, 1001n, TUNDE)));
    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.submit();
    });

    // Admitted and asking: the proof is safe in the queue, and the page stays still.
    await waitFor(() => expect(mocks.draft.clear).toHaveBeenCalledOnce());
    expect(result.current.landing).toBeNull();
    expect(onItsWay.result.current).toBeNull();
    expect(mocks.toasts.adding).toHaveBeenCalledWith({ sendToo: false });
    // A second tap while the prompt is open never sends twice.
    await act(async () => {
      await expect(result.current.submit()).resolves.toBe(false);
    });

    await act(async () => {
      sign();
      await pending;
    });
    expect(result.current.landing).toBe("sending");
    expect(mocks.toasts.confirming).toHaveBeenCalledOnce();
    expect(mocks.enqueue).toHaveBeenCalledOnce();
    // Landed: the promise keeps saying so until its record counts the proof.
    expect(onItsWay.result.current).toMatchObject({
      contents: { words: true, photos: 0 },
      landed: true,
    });
  });

  it("stays on Review with the draft when the queue never took the proof", async () => {
    mocks.enqueue.mockRejectedValue(new Error("queue unavailable"));
    const { result } = readyToSend();
    const id = result.current.clientEvidenceId;

    await act(async () => {
      await expect(result.current.submit()).resolves.toBe(false);
    });

    expect(result.current.landing).toBeNull();
    expect(result.current.clientEvidenceId).toBe(id);
    expect(result.current.note).toBe("Posts replaced");
    expect(mocks.draft.clear).not.toHaveBeenCalled();
    expect(mocks.toasts.dismiss).toHaveBeenCalled();
  });

  it("lands on the promise with the proof kept when the signature is declined", async () => {
    mocks.enqueue.mockImplementation(async ({ report }) => {
      report?.({ stage: "admitted", jobId: "job-1" });
      report?.({ stage: "wallet" });
      report?.({ stage: "declined" });
      return "job-1";
    });
    const { result } = readyToSend();
    const id = result.current.clientEvidenceId;

    await act(async () => {
      await expect(result.current.submit()).resolves.toBe(true);
    });

    // Nothing was sent; the queued job carries the same identity, and the
    // promise offers Send Now and Discard.
    expect(result.current.landing).toBe("declined");
    expect(mocks.enqueue.mock.calls[0]?.[0]).toMatchObject({
      payload: { clientEvidenceId: id },
    });
    expect(mocks.toasts.notAdded).toHaveBeenCalledOnce();
    expect(mocks.toasts.takingLonger).not.toHaveBeenCalled();
    expect(mocks.draft.clear).toHaveBeenCalledOnce();
    // Nothing left the phone, so the promise shows its notice, not a proof on its way.
    const onItsWay = renderHook(() => useProofSend(proofSendKey(DEMO_CHAIN_ID, 1001n, TUNDE)));
    expect(onItsWay.result.current).toBeNull();
  });

  it("still lands on the promise when a send fails after the queue took the proof", async () => {
    mocks.enqueue.mockImplementation(async ({ report }) => {
      report?.({ stage: "admitted", jobId: "job-1" });
      throw new Error("execution reverted");
    });
    const { result } = readyToSend();

    await act(async () => {
      await expect(result.current.submit()).resolves.toBe(true);
    });

    expect(result.current.landing).toBe("failed");
    expect(mocks.toasts.couldNotAdd).toHaveBeenCalledWith(onOpenYourWork);
  });

  it("says a proof added offline is saved, and hands over at once", async () => {
    mocks.isOnline = false;
    mocks.enqueue.mockImplementation(async ({ report }) => {
      report?.({ stage: "admitted", jobId: "job-1" });
      report?.({ stage: "queued" });
      return "job-1";
    });
    const { result } = readyToSend();

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.landing).toBe("queued");
    expect(mocks.toasts.adding).not.toHaveBeenCalled();
    expect(mocks.toasts.savedOffline).toHaveBeenCalledOnce();
  });

  it("follows a background send to its end after the screen has handed over", async () => {
    mocks.sendsFromTap = false;
    mocks.enqueue.mockImplementation(async ({ report }) => {
      report?.({ stage: "admitted", jobId: "job-1" });
      report?.({ stage: "queued" });
      return "job-1";
    });
    const { result, unmount } = readyToSend();
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.landing).toBe("queued");
    unmount();

    const job = { id: "job-1", kind: "evidence", payload: {} } as unknown as Job;
    act(() => jobQueueEventBus.emit("job:completed", { jobId: "other", job, txHash: "0x1" }));
    expect(mocks.toasts.added).not.toHaveBeenCalled();
    act(() => jobQueueEventBus.emit("job:completed", { jobId: "job-1", job, txHash: "0x1" }));
    expect(mocks.toasts.added).toHaveBeenCalledWith({ sent: false, leads: true });
  });

  it("hears a background send that lands before the tap's own call returns", async () => {
    mocks.sendsFromTap = false;
    const job = { id: "job-1", kind: "evidence", payload: {} } as unknown as Job;
    mocks.enqueue.mockImplementation(async ({ report }) => {
      report?.({ stage: "admitted", jobId: "job-1" });
      // The flush picked it up and it landed while the call was still settling.
      jobQueueEventBus.emit("job:completed", { jobId: "job-1", job, txHash: "0x1" });
      report?.({ stage: "queued" });
      return "job-1";
    });
    const { result } = readyToSend();
    await act(async () => {
      await result.current.submit();
    });

    expect(mocks.toasts.added).toHaveBeenCalledWith({ sent: false, leads: true });
    expect(mocks.toasts.takingLonger).not.toHaveBeenCalled();
  });

  describe("Add and Send (D19)", () => {
    it("is offered to the lead, on alone and off with a team, and never to a teammate", () => {
      const { result, rerender } = renderController();
      expect(result.current.canSendToo).toBe(true);
      expect(result.current.sendToo).toBe(false);
      act(() => result.current.setSendToo(true));
      expect(result.current.sendToo).toBe(true);

      mocks.query.detail = commitmentDetailFixture({
        commitment: detail.commitment,
        contributors: [
          contributorFixture({ commitmentId: 1001n, contributor: TUNDE, isLead: true }),
        ],
      });
      const alone = renderController();
      expect(alone.result.current.sendToo).toBe(true);

      mocks.query.detail = detail;
      mocks.viewer = MARIA;
      rerender();
      expect(result.current.leads).toBe(false);
      expect(result.current.canSendToo).toBe(false);
      expect(result.current.sendToo).toBe(false);
    });

    it.each([
      [
        "garden work, which the chain never lets anyone send by hand",
        { commitmentType: "DOMAIN_IMPACT" },
      ],
      ["a waiting assessment", { requiresAssessment: true, assessmentUID: null }],
      ["a confirmer nobody can reach", { counterparty: null }],
    ] as const)("is not offered for %s", (_case, overrides) => {
      mocks.query.detail = commitmentDetailFixture({
        commitment: { ...detail.commitment, ...overrides },
        contributors: detail.contributors,
      });
      expect(renderController().result.current.canSendToo).toBe(false);
    });

    it("is not offered while the pool or cycle is still unread", () => {
      mocks.cycle = null;
      expect(renderController().result.current.canSendToo).toBe(false);
    });

    it("queues the send with the proof, and sends it only once the proof lands", async () => {
      const { result } = readyToSend();
      act(() => result.current.setSendToo(true));
      mocks.enqueue.mockImplementation(async ({ report }) => {
        report?.({ stage: "admitted", jobId: "job-1", followUpJobId: "job-2" });
        report?.({ stage: "wallet" });
        report?.({ stage: "confirming", txHash: "0x123" });
        // Sending for confirmation now would settle the team before the proof.
        expect(mocks.sendQueued).not.toHaveBeenCalled();
        report?.({ stage: "landed", txHash: "0x123" });
        return "job-1";
      });

      await act(async () => {
        await result.current.submit();
      });

      // One call queues both, so the send outlives this screen.
      expect(mocks.enqueue).toHaveBeenCalledOnce();
      expect(mocks.enqueue.mock.calls[0]?.[0]).toMatchObject({ act: "evidence", sendToo: true });
      await waitFor(() =>
        expect(mocks.sendQueued).toHaveBeenCalledWith({ jobId: "job-2", commitmentId: 1001n })
      );
      expect(mocks.toasts.adding).toHaveBeenCalledWith({ sendToo: true });
      await waitFor(() =>
        expect(mocks.toasts.added).toHaveBeenCalledWith({ sent: true, leads: true })
      );
    });

    it.each([
      [
        // The send stays queued behind the kept proof, for when the person sends it.
        "the proof did not land",
        [{ stage: "admitted", jobId: "job-1", followUpJobId: "job-2" }, { stage: "declined" }],
        "notAdded",
        [],
      ],
      [
        "the queue kept no send",
        [
          { stage: "admitted", jobId: "job-1" },
          { stage: "landed", txHash: "0x123" },
        ],
        "added",
        [{ sent: false, leads: true }],
      ],
    ] as const)("sends nothing for confirmation when %s", async (_case, events, toast, args) => {
      const { result } = readyToSend();
      act(() => result.current.setSendToo(true));
      mocks.enqueue.mockImplementation(async ({ report }) => {
        for (const event of events) report?.(event);
        return "job-1";
      });

      await act(async () => {
        await result.current.submit();
      });

      await waitFor(() => expect(mocks.toasts[toast]).toHaveBeenCalledWith(...args));
      expect(mocks.sendQueued).not.toHaveBeenCalled();
    });

    it("says sent only once the second act has landed, not while it waits in the queue", async () => {
      mocks.sendQueued.mockResolvedValue("queued");
      const { result } = readyToSend();
      act(() => result.current.setSendToo(true));
      mocks.enqueue.mockImplementation(async ({ report }) => {
        report?.({ stage: "admitted", jobId: "job-1", followUpJobId: "job-2" });
        report?.({ stage: "landed", txHash: "0x123" });
        return "job-1";
      });

      await act(async () => {
        await result.current.submit();
      });

      await waitFor(() =>
        expect(mocks.toasts.added).toHaveBeenCalledWith({ sent: false, leads: true })
      );
    });

    it("hears the background flush's second act from admission, and says sent once it lands", async () => {
      mocks.sendsFromTap = false;
      const { result } = readyToSend();
      act(() => result.current.setSendToo(true));
      mocks.enqueue.mockImplementation(async ({ report }) => {
        report?.({ stage: "admitted", jobId: "job-1", followUpJobId: "job-2" });
        report?.({ stage: "queued" });
        return "job-1";
      });
      await act(async () => {
        await result.current.submit();
      });

      // One flush lands the proof, then its send, before anything reads its outcome.
      const job = (id: string) => ({ id, kind: "evidence", payload: {} }) as unknown as Job;
      act(() => {
        jobQueueEventBus.emit("job:completed", {
          jobId: "job-1",
          job: job("job-1"),
          txHash: "0x1",
        });
        jobQueueEventBus.emit("job:processing", { jobId: "job-2", job: job("job-2") });
        jobQueueEventBus.emit("job:completed", {
          jobId: "job-2",
          job: job("job-2"),
          txHash: "0x2",
        });
      });

      await waitFor(() =>
        expect(mocks.toasts.added).toHaveBeenCalledWith({ sent: true, leads: true })
      );
      expect(mocks.sendQueued).not.toHaveBeenCalled();
    });
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
