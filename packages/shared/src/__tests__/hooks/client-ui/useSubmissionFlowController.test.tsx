/**
 * The one submission flow's stage sequence, composed over each kind's module: the work kind
 * keeps its step in the work store, the evidence kind keeps none, and the flow owns the rest.
 *
 * @vitest-environment happy-dom
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  type SubmissionKindInput,
  useSubmissionFlowController,
} from "../../../hooks/client-ui/submission/useSubmissionFlowController";
import {
  commitmentDetailFixture,
  commitmentFixture,
} from "../../test-utils/commitment-pooling-fixtures";
import { proofComposerControllerFixture } from "../../test-utils/controller-fixtures";

type WorkController = Extract<SubmissionKindInput, { kind: "work" }>["controller"];
type EvidenceController = Extract<SubmissionKindInput, { kind: "evidence" }>["controller"];

function workController(overrides: Record<string, unknown> = {}): WorkController {
  return {
    activeTab: "Intro",
    changeTab: vi.fn(async () => undefined),
    exit: vi.fn(),
    submit: vi.fn(async () => true),
    canProceed: true,
    isSchedulingDependentLink: false,
    hasPendingLinkRecovery: false,
    isWalletRequestExpired: false,
    submissionCompleted: false,
    submissionOutcome: null,
    linkIntent: null,
    mediaClickRef: { current: null },
    cameraClickRef: { current: null },
    toggleAudioRecording: vi.fn(),
    isRecording: false,
    start: { skipped: false, back: vi.fn(() => false) },
    ...overrides,
  } as unknown as WorkController;
}

const REQUEST = commitmentDetailFixture({
  commitment: commitmentFixture({ direction: "REQUEST" }),
});

function evidenceController(overrides: Partial<EvidenceController> = {}): EvidenceController {
  return proofComposerControllerFixture({
    detail: REQUEST,
    commitment: REQUEST.commitment,
    note: "Posts replaced",
    submit: vi.fn(async () => true),
    toggleRecording: vi.fn(),
    ...overrides,
  });
}

const renderWork = (controller: WorkController) =>
  renderHook((input: SubmissionKindInput) => useSubmissionFlowController(input), {
    initialProps: { kind: "work", controller } as SubmissionKindInput,
  });

const renderEvidence = (
  controller: EvidenceController,
  { leave = vi.fn(), commitmentId = 1001n as bigint | null } = {}
) =>
  renderHook((input: SubmissionKindInput) => useSubmissionFlowController(input), {
    initialProps: {
      kind: "evidence",
      controller,
      commitmentId,
      leave,
      promiseTitle: "Restore the tool shed",
    } as SubmissionKindInput,
  });

describe("useSubmissionFlowController", () => {
  it("walks one stage sequence per kind, named by the shared step markers", () => {
    const work = renderWork(workController());
    expect(work.result.current.kind).toBe("work");
    expect(work.result.current.stages).toEqual(["start", "media", "details", "review"]);
    expect(work.result.current.stageLabelIds).toEqual([
      "app.work.step.start",
      "app.work.step.media",
      "app.work.step.details",
      "app.work.step.review",
    ]);
    expect(work.result.current.stage).toBe("start");
    expect(work.result.current.progress).toBe(1);

    const evidence = renderEvidence(evidenceController());
    expect(evidence.result.current.kind).toBe("evidence");
    expect(evidence.result.current.stages).toEqual(["media", "details", "review"]);
    expect(evidence.result.current.stageLabelIds).toEqual([
      "app.work.step.media",
      "app.work.step.details",
      "app.work.step.review",
    ]);
    expect(evidence.result.current.stage).toBe("media");
    expect(evidence.result.current.progress).toBe(1);
  });

  it("moves the work kind through the work store's step and submits from Review", () => {
    const controller = workController({ activeTab: "Media" });
    const { result, rerender } = renderWork(controller);

    act(() => result.current.forward?.run());
    expect(controller.changeTab).toHaveBeenCalledWith("Details");
    expect(controller.submit).not.toHaveBeenCalled();

    // The store moved the step; the flow follows it rather than keeping one of its own.
    rerender({ kind: "work", controller: workController({ activeTab: "Details" }) });
    expect(result.current.stage).toBe("details");
    expect(result.current.progress).toBe(3);

    const atReview = workController({ activeTab: "Review" });
    rerender({ kind: "work", controller: atReview });
    act(() => result.current.forward?.run());
    expect(atReview.submit).toHaveBeenCalledTimes(1);
    expect(atReview.changeTab).not.toHaveBeenCalled();
  });

  it("offers no forward act on Start, where choosing a promise or an action moves on (DL-131)", () => {
    for (const overrides of [{}, { canProceed: false }]) {
      const { result } = renderWork(workController(overrides));
      expect(result.current.stage).toBe("start");
      expect(result.current.forward).toBeNull();
    }
  });

  it("opens on Media when Start is skipped, keeps the four markers, and leaves from Media", () => {
    const skipped = workController({ activeTab: "Media", start: { skipped: true, back: vi.fn() } });
    const { result } = renderWork(skipped);
    expect(result.current.stages).toEqual(["start", "media", "details", "review"]);
    expect(result.current.stage).toBe("media");
    expect(result.current.progress).toBe(2);

    // Back follows the path taken, which never went through Start.
    act(() => result.current.back());
    expect(skipped.exit).toHaveBeenCalledTimes(1);
    expect(skipped.changeTab).not.toHaveBeenCalled();
    expect(skipped.start.back).not.toHaveBeenCalled();
  });

  it("keeps the evidence kind's step itself and submits from Review", () => {
    const controller = evidenceController();
    const { result } = renderEvidence(controller);

    act(() => result.current.forward?.run());
    expect(result.current.stage).toBe("details");
    act(() => result.current.forward?.run());
    expect(result.current.stage).toBe("review");
    expect(result.current.progress).toBe(3);
    expect(controller.submit).not.toHaveBeenCalled();

    act(() => result.current.forward?.run());
    expect(controller.submit).toHaveBeenCalledTimes(1);
    expect(result.current.stage).toBe("review");
  });

  it("goes back a stage, through Start's own screens, and leaves from the first", () => {
    // On a promise's own screen, Back returns to the promises first (the path taken).
    const back = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    const atStart = workController({ start: { skipped: false, back } });
    const work = renderWork(atStart);
    act(() => work.result.current.back());
    expect(back).toHaveBeenCalledTimes(1);
    expect(atStart.exit).not.toHaveBeenCalled();
    act(() => work.result.current.back());
    expect(atStart.exit).toHaveBeenCalledTimes(1);
    expect(atStart.changeTab).not.toHaveBeenCalled();

    const atMedia = workController({ activeTab: "Media" });
    work.rerender({ kind: "work", controller: atMedia });
    act(() => work.result.current.back());
    expect(atMedia.changeTab).toHaveBeenCalledWith("Intro");
    expect(atMedia.exit).not.toHaveBeenCalled();

    const leave = vi.fn();
    const evidence = renderEvidence(evidenceController(), { leave });
    act(() => evidence.result.current.forward?.run());
    act(() => evidence.result.current.back());
    expect(evidence.result.current.stage).toBe("media");
    expect(leave).not.toHaveBeenCalled();
    act(() => evidence.result.current.back());
    expect(leave).toHaveBeenCalledTimes(1);
    expect(evidence.result.current.stage).toBe("media");
  });

  it.each([
    ["Media", {}, "app.garden.submit.tab.media.label", false],
    ["Details", {}, "app.garden.submit.tab.details.label", false],
    ["Review", {}, "app.garden.submit.tab.review.label", false],
    ["Review", { isWalletRequestExpired: true }, "app.garden.submit.tab.review.retryLabel", false],
    ["Media", { canProceed: false }, "app.garden.submit.tab.media.label", true],
    ["Review", { isSchedulingDependentLink: true }, "app.garden.submit.tab.review.label", true],
    ["Review", { hasPendingLinkRecovery: true }, "app.garden.submit.tab.review.label", true],
  ] as const)("names the work kind's forward act on %s with %o and says whether it waits", (activeTab, overrides, labelId, disabled) => {
    const { result } = renderWork(workController({ activeTab, ...overrides }));
    expect(result.current.forward).toMatchObject({
      labelId,
      disabled,
      loading: false,
      blockedReasonId: null,
    });
  });

  it.each([
    ["media", {}, { labelId: "app.proof.next.details", disabled: false, blockedReasonId: null }],
    [
      "media",
      { isProcessing: true },
      { labelId: "app.proof.next.details", disabled: true, blockedReasonId: null },
    ],
    [
      "media",
      { draftPersistence: "saving" as const },
      {
        labelId: "app.proof.next.details",
        disabled: true,
        blockedReasonId: "app.proof.draft.saving",
      },
    ],
    [
      "media",
      { draftPersistence: "failed" as const },
      {
        labelId: "app.proof.next.details",
        disabled: true,
        blockedReasonId: "app.proof.draft.saveRequired",
      },
    ],
    ["details", {}, { labelId: "app.proof.next.review", disabled: false, blockedReasonId: null }],
    [
      "details",
      { note: "" },
      {
        labelId: "app.proof.next.review",
        disabled: true,
        blockedReasonId: "app.proof.blocked.nothing",
      },
    ],
    [
      "details",
      { credited: [] },
      {
        labelId: "app.proof.next.review",
        disabled: true,
        blockedReasonId: "app.proof.blocked.credit",
      },
    ],
    [
      "details",
      { links: ["not a link"] },
      {
        labelId: "app.proof.next.review",
        disabled: true,
        blockedReasonId: "app.compose.details.linkInvalid",
      },
    ],
    ["review", {}, { labelId: "app.proof.submit", disabled: false, loading: false }],
    ["review", { sendToo: true }, { labelId: "app.proof.submitAndSend", disabled: false }],
    [
      "review",
      { isPending: true },
      { labelId: "app.proof.submit", disabled: false, loading: true },
    ],
    [
      "review",
      { isPending: true, draftPersistence: "saving" as const },
      { disabled: false, loading: true, blockedReasonId: "app.proof.draft.saving" },
    ],
  ] as const)("names the evidence kind's forward act on %s with %o and says why it waits", (stage, overrides, expected) => {
    // The table is `as const`, so its arrays are readonly; the controller takes plain ones.
    const { result } = renderEvidence(evidenceController(overrides as Partial<EvidenceController>));
    const hops = { media: 0, details: 1, review: 2 }[stage];
    for (let hop = 0; hop < hops; hop += 1) act(() => result.current.forward?.run());
    expect(result.current.stage).toBe(stage);
    expect(result.current.forward).toMatchObject(expected);
  });

  it("marks every step done once the work is submitted, except while it awaits confirmation", () => {
    const sent = renderWork(
      workController({
        activeTab: "Review",
        submissionCompleted: true,
        submissionOutcome: { kind: "direct", clientWorkId: "client-1" },
      })
    );
    expect(sent.result.current.progress).toBe(5);

    const waiting = renderWork(
      workController({
        activeTab: "Review",
        submissionCompleted: true,
        submissionOutcome: { kind: "awaiting-confirmation", clientWorkId: "client-1" },
      })
    );
    expect(waiting.result.current.progress).toBe(4);
  });

  it("pins the promise the submission is for and opens it without leaving the stage", () => {
    const unlinked = renderWork(workController());
    expect(unlinked.result.current.promise.pinned).toBeNull();

    const linked = renderWork(
      workController({
        activeTab: "Media",
        linkIntent: { commitmentTitle: "Trees", direction: "REQUEST" },
      })
    );
    expect(linked.result.current.promise.pinned).toEqual({ title: "Trees", direction: "REQUEST" });
    expect(linked.result.current.promise.open).toBe(false);
    act(() => linked.result.current.promise.show());
    expect(linked.result.current.promise.open).toBe(true);
    expect(linked.result.current.stage).toBe("media");
    act(() => linked.result.current.promise.hide());
    expect(linked.result.current.promise.open).toBe(false);

    const evidence = renderEvidence(evidenceController());
    expect(evidence.result.current.promise.pinned).toEqual({
      title: "Restore the tool shed",
      direction: "REQUEST",
    });
    const unread = renderEvidence(evidenceController({ commitment: null }));
    expect(unread.result.current.promise.pinned).toBeNull();
  });

  it("offers the media tools on the Media stage only, wired to each kind's own inputs", () => {
    const gallery = document.createElement("input");
    gallery.id = "work-media-upload";
    const camera = document.createElement("input");
    camera.id = "proof-media-camera";
    document.body.append(gallery, camera);
    const galleryClick = vi.spyOn(gallery, "click");
    const cameraClick = vi.spyOn(camera, "click");
    try {
      const atStart = renderWork(workController());
      expect(atStart.result.current.mediaTools).toBeNull();

      const openGallery = vi.fn();
      const toggleAudioRecording = vi.fn();
      const work = renderWork(
        workController({
          activeTab: "Media",
          mediaClickRef: { current: openGallery },
          toggleAudioRecording,
          isRecording: true,
        })
      );
      const workTools = work.result.current.mediaTools;
      expect(workTools).toMatchObject({ isRecording: true, disabled: false });
      // The media step registers its own openers; the hidden input is the fallback.
      workTools?.openGallery();
      expect(openGallery).toHaveBeenCalledTimes(1);
      expect(galleryClick).not.toHaveBeenCalled();
      workTools?.toggleRecording();
      expect(toggleAudioRecording).toHaveBeenCalledTimes(1);
      const fallback = renderWork(workController({ activeTab: "Media" }));
      fallback.result.current.mediaTools?.openGallery();
      expect(galleryClick).toHaveBeenCalledTimes(1);

      const toggleRecording = vi.fn();
      const evidence = renderEvidence(evidenceController({ isProcessing: true, toggleRecording }));
      const proofTools = evidence.result.current.mediaTools;
      expect(proofTools).toMatchObject({ isRecording: false, disabled: true });
      proofTools?.openCamera();
      expect(cameraClick).toHaveBeenCalledTimes(1);
      proofTools?.toggleRecording();
      expect(toggleRecording).toHaveBeenCalledTimes(1);
      act(() => evidence.result.current.forward?.run());
      expect(evidence.result.current.mediaTools).toBeNull();
    } finally {
      gallery.remove();
      camera.remove();
    }
  });

  it("starts the evidence kind over on another promise or account", () => {
    const controller = evidenceController();
    const { result, rerender } = renderEvidence(controller);
    act(() => result.current.forward?.run());
    act(() => result.current.promise.show());
    expect(result.current.stage).toBe("details");
    expect(result.current.promise.open).toBe(true);

    rerender({
      kind: "evidence",
      controller,
      commitmentId: 1002n,
      leave: vi.fn(),
      promiseTitle: "Restore the tool shed",
    });
    expect(result.current.stage).toBe("media");
    expect(result.current.promise.open).toBe(false);
  });
});
