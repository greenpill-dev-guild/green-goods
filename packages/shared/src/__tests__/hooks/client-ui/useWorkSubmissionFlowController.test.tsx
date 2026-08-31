/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, StrictMode, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actionUID: null as number | null,
  gardenAddress: null as string | null,
  setActiveTab: vi.fn(),
  ensureJourney: vi.fn(() => "journey-1"),
  reset: vi.fn(),
  enqueue: vi.fn(),
  uploadWork: vi.fn(),
  consumeShareTarget: vi.fn(),
  loadShareTarget: vi.fn(),
  normalizeWorkMediaFiles: vi.fn(),
  saveOnExit: vi.fn(),
  setImages: vi.fn(),
  setValue: vi.fn(),
  loggerWarn: vi.fn(),
  outcome: null as null | Record<string, unknown>,
  choices: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../../stores/workFlowTypes", () => ({
  WorkTab: { Intro: "Intro", Media: "Media", Details: "Details", Review: "Review" },
}));

vi.mock("../../../utils/action/parsers", () => ({
  findActionByUID: () => ({}),
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { error: vi.fn(), warn: mocks.loggerWarn },
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() }),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentJobs", () => ({
  useCommitmentJobs: () => ({
    enqueue: mocks.enqueue,
    isPending: false,
    error: null,
    viewer: null,
  }),
}));

vi.mock("../../../hooks/commitment-pooling/useWorkLinkChoices", () => ({
  useWorkLinkChoices: () => ({
    choices: mocks.choices,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../../utils/errors/contract-errors", () => ({
  parseContractError: () => ({ name: "UnknownError" }),
}));

vi.mock("../../../components/Toast/toast.service", () => ({
  toastService: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../../modules/app/posthog", () => ({
  track: vi.fn(),
}));

vi.mock("../../../hooks/utils/useAudioRecording", () => ({
  useAudioRecording: () => ({ isRecording: false, elapsed: 0, toggle: vi.fn() }),
}));

vi.mock("../../../hooks/work/useDraftAutoSave", () => ({
  useDraftAutoSave: () => ({ saveOnExit: mocks.saveOnExit }),
}));

vi.mock("../../../modules/app/share-target", () => ({
  consumeShareTarget: mocks.consumeShareTarget,
  loadShareTarget: mocks.loadShareTarget,
}));

vi.mock("../../../modules/work/media-processing", () => ({
  normalizeWorkMediaFiles: mocks.normalizeWorkMediaFiles,
}));

vi.mock("../../../hooks/work/useDraftResume", () => ({
  useDraftResume: () => ({
    showDraftDialog: false,
    handleContinueDraft: vi.fn(),
    handleStartFresh: vi.fn(),
    clearActiveDraft: vi.fn(),
  }),
}));

vi.mock("../../../hooks/garden/useJoinGarden", () => ({
  useJoinGarden: () => ({ joinGarden: vi.fn(), isJoining: false, joiningGardenId: null }),
}));

vi.mock("../../../hooks/app/useOffline", () => ({
  useOffline: () => ({ isOnline: true, pendingCount: 0, syncStatus: "idle" }),
}));

vi.mock("../../../hooks/utils/useTimeout", () => ({
  useTimeout: () => ({ set: vi.fn() }),
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({
    authMode: "wallet",
    primaryAddress: "0x9999999999999999999999999999999999999999",
  }),
}));

vi.mock("../../../stores/useWorkFlowStore", () => ({
  useWorkFlowStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        submissionCompleted: false,
        workSubmissionJourneyId: "journey-1",
        ensureWorkSubmissionJourneyId: mocks.ensureJourney,
        setGardenAddress: vi.fn(),
        audioNotes: [],
        setAudioNotes: vi.fn(),
      }),
    { getState: () => ({ audioNotes: [], reset: mocks.reset, setActionUID: vi.fn() }) }
  ),
}));

vi.mock("../../../providers/Work", () => ({
  useWorkFormContext: () => ({
    state: { isValid: true, isSubmitting: false },
    images: [],
    setImages: mocks.setImages,
    register: vi.fn(),
    control: {},
    setValue: mocks.setValue,
    uploadWork: mocks.uploadWork,
    feedback: "",
    timeSpentMinutes: undefined,
    values: {},
    reset: vi.fn(),
    workMutation: {
      isPending: false,
      error: null,
      lastSubmissionOutcome: mocks.outcome,
      getLastSubmissionOutcome: () => mocks.outcome,
      clearLastSubmissionOutcome: vi.fn(),
    },
  }),
  useWorkSelection: () => ({
    actions: [],
    gardens: [],
    hasJoinedGardens: false,
    joinableCommunityGarden: null,
    isLoading: false,
    activeTab: "Intro",
    setActiveTab: mocks.setActiveTab,
    selectedDomain: null,
    setSelectedDomain: vi.fn(),
    actionUID: mocks.actionUID,
    setActionUID: vi.fn(),
    gardenAddress: mocks.gardenAddress,
    setGardenAddress: vi.fn(),
  }),
}));

vi.mock("../../../hooks/client-ui/work/useWorkMediaLifecycle", () => ({
  useWorkMediaLifecycle: () => ({
    brokenMediaIds: new Set(),
    cameraClickRef: { current: null },
    markMediaPreviewFailed: vi.fn(),
    mediaClickRef: { current: null },
    removeBrokenMedia: vi.fn(),
    removeMedia: vi.fn(),
    resetBrokenMedia: vi.fn(),
  }),
}));

vi.mock("../../../hooks/client-ui/work/useWorkSubmissionPresentationModel", () => ({
  useWorkSubmissionPresentationModel: () => ({
    detailInputs: [],
    detailsConfig: {},
    mediaConfig: { required: false },
    minRequired: 0,
    reviewConfig: {},
    reviewData: {},
  }),
}));

import { useWorkSubmissionFlowController } from "../../../hooks/client-ui/work/useWorkSubmissionFlowController";

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(
    MemoryRouter,
    null,
    createElement(IntlProvider, { locale: "en", messages: {} }, children)
  );
}

function StrictShareWrapper({ children }: { children: ReactNode }) {
  return createElement(
    StrictMode,
    null,
    createElement(
      MemoryRouter,
      { initialEntries: ["/home/garden?shareTarget=share-1"] },
      createElement(IntlProvider, { locale: "en", messages: {} }, children)
    )
  );
}

let navigateShareRoute: ((path: string) => void) | null = null;

function ShareNavigationCapture({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  navigateShareRoute = (path) => navigate(path);
  return children;
}

function ShareNavigationWrapper({ children }: { children: ReactNode }) {
  return createElement(
    MemoryRouter,
    { initialEntries: ["/home/garden?shareTarget=share-1"] },
    createElement(
      ShareNavigationCapture,
      null,
      createElement(IntlProvider, { locale: "en", messages: {} }, children)
    )
  );
}

describe("useWorkSubmissionFlowController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actionUID = null;
    mocks.gardenAddress = null;
    mocks.outcome = null;
    mocks.choices = [];
    mocks.enqueue.mockResolvedValue("link-job");
    mocks.consumeShareTarget.mockResolvedValue(undefined);
    mocks.loadShareTarget.mockReset();
    mocks.normalizeWorkMediaFiles.mockReset();
    mocks.saveOnExit.mockReset();
    mocks.saveOnExit.mockResolvedValue("draft-1");
    navigateShareRoute = null;
  });

  it("projects selection and owns the intro progress gate", () => {
    const view = renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: Wrapper }
    );
    expect(view.result.current.canProceed).toBe(false);

    mocks.actionUID = 1;
    mocks.gardenAddress = "garden-1";
    view.rerender();
    expect(view.result.current.canProceed).toBe(true);
  });

  it("owns tab transitions", () => {
    const { result } = renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: Wrapper }
    );

    result.current.changeTab("Media" as never);
    expect(mocks.setActiveTab).toHaveBeenCalledWith("Media");
  });

  it("imports and consumes a Share Target exactly once under Strict Mode", async () => {
    const image = new File(["image"], "garden.webp", { type: "image/webp" });
    let resolveShareTarget: ((value: Record<string, unknown>) => void) | undefined;
    const shareTarget = new Promise<Record<string, unknown>>((resolve) => {
      resolveShareTarget = resolve;
    });
    mocks.actionUID = 1;
    mocks.gardenAddress = "0x1111111111111111111111111111111111111111";
    mocks.loadShareTarget.mockReturnValue(shareTarget);
    const loadedShareTarget = {
      envelope: {
        version: 1,
        token: "share-1",
        createdAt: 1,
        expiresAt: Date.now() + 60_000,
        title: "Creek restoration",
        text: "Seedlings planted",
        url: "https://example.org/proof",
        files: [],
      },
      feedback: "Creek restoration\n\nSeedlings planted\n\nhttps://example.org/proof",
      files: [image],
    };
    mocks.normalizeWorkMediaFiles.mockResolvedValue({
      accepted: [{ file: image }],
      rejected: [],
    });

    const view = renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: StrictShareWrapper }
    );

    await waitFor(() => expect(mocks.loadShareTarget).toHaveBeenCalled());
    view.rerender();
    await act(async () => {
      resolveShareTarget?.(loadedShareTarget);
      await shareTarget;
    });

    await waitFor(() =>
      expect(mocks.setValue).toHaveBeenCalledWith(
        "feedback",
        "Creek restoration\n\nSeedlings planted\n\nhttps://example.org/proof",
        { shouldDirty: true }
      )
    );
    expect(mocks.setImages).toHaveBeenCalledWith([image]);
    await waitFor(() => expect(mocks.saveOnExit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.consumeShareTarget).toHaveBeenCalledTimes(1));
    expect(mocks.consumeShareTarget).toHaveBeenCalledWith("share-1");
  });

  it("keeps the Share Target available when saving its draft fails", async () => {
    const image = new File(["image"], "garden.webp", { type: "image/webp" });
    mocks.actionUID = 1;
    mocks.gardenAddress = "0x1111111111111111111111111111111111111111";
    mocks.loadShareTarget.mockResolvedValue({
      envelope: {
        version: 1,
        token: "share-1",
        createdAt: 1,
        expiresAt: Date.now() + 60_000,
        title: "Creek restoration",
        text: "",
        url: "",
        files: [],
      },
      feedback: "Creek restoration",
      files: [image],
    });
    mocks.normalizeWorkMediaFiles.mockResolvedValue({
      accepted: [{ file: image }],
      rejected: [],
    });
    mocks.saveOnExit.mockRejectedValue(new Error("draft storage unavailable"));

    renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: StrictShareWrapper }
    );

    await waitFor(() =>
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        "Share Target draft save failed",
        expect.objectContaining({ source: "GardenFlow" })
      )
    );
    await waitFor(() => expect(mocks.saveOnExit).toHaveBeenCalledTimes(2));
    expect(mocks.consumeShareTarget).not.toHaveBeenCalled();
  });

  it("serializes overlapping Share Targets without dropping the newer token", async () => {
    const firstImage = new File(["first"], "first.webp", { type: "image/webp" });
    const secondImage = new File(["second"], "second.webp", { type: "image/webp" });
    const loadedShare = (token: string, feedback: string, file: File) => ({
      envelope: {
        version: 1,
        token,
        createdAt: 1,
        expiresAt: Date.now() + 60_000,
        title: feedback,
        text: "",
        url: "",
        files: [],
      },
      feedback,
      files: [file],
    });
    let resolveFirstSave: ((draftId: string) => void) | undefined;
    const firstSave = new Promise<string>((resolve) => {
      resolveFirstSave = resolve;
    });
    mocks.actionUID = 1;
    mocks.gardenAddress = "0x1111111111111111111111111111111111111111";
    mocks.loadShareTarget.mockImplementation((token: string) =>
      Promise.resolve(
        token === "share-1"
          ? loadedShare("share-1", "First share", firstImage)
          : loadedShare("share-2", "Second share", secondImage)
      )
    );
    mocks.normalizeWorkMediaFiles.mockImplementation((files: File[]) =>
      Promise.resolve({
        accepted: files.map((file) => ({ file })),
        rejected: [],
      })
    );
    mocks.saveOnExit.mockReturnValueOnce(firstSave).mockResolvedValueOnce("draft-2");

    renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: ShareNavigationWrapper }
    );

    await waitFor(() => expect(mocks.saveOnExit).toHaveBeenCalledTimes(1));
    await act(async () => {
      navigateShareRoute?.("/home/garden?shareTarget=share-2");
      await Promise.resolve();
    });

    expect(mocks.loadShareTarget).not.toHaveBeenCalledWith("share-2");

    await act(async () => {
      resolveFirstSave?.("draft-1");
      await firstSave;
    });

    await waitFor(() => expect(mocks.consumeShareTarget).toHaveBeenCalledWith("share-1"));
    await waitFor(() => expect(mocks.loadShareTarget).toHaveBeenCalledWith("share-2"));
    await waitFor(() => expect(mocks.setValue).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.saveOnExit).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.consumeShareTarget).toHaveBeenCalledWith("share-2"));
    expect(mocks.setValue).toHaveBeenNthCalledWith(1, "feedback", "First share", {
      shouldDirty: true,
    });
    expect(mocks.setValue).toHaveBeenNthCalledWith(2, "feedback", "Second share", {
      shouldDirty: true,
    });
  });

  it.each([
    ["direct", { kind: "direct", clientWorkId: "client-1", txHash: "0x1", sponsored: false }],
    [
      "queued",
      {
        kind: "queued",
        clientWorkId: "client-1",
        jobId: "work-job-1",
        txHash: "0x2",
        sponsored: false,
      },
    ],
  ] as const)("recovers a failed %s dependent link without resubmitting Work", async (_kind, outcome) => {
    const intent = {
      commitmentId: 9n,
      requirementIndex: 0,
      actionUID: 1,
      garden: "0x1111111111111111111111111111111111111111" as const,
      commitmentTitle: "Trees",
      requirementLabel: "1",
      returnTo: "/home/0x1111111111111111111111111111111111111111/commitments/9",
    };
    mocks.actionUID = 1;
    mocks.gardenAddress = intent.garden;
    mocks.choices = [intent];
    mocks.outcome = outcome;
    mocks.enqueue.mockRejectedValueOnce(new Error("storage unavailable"));
    const view = renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: Wrapper }
    );

    act(() => view.result.current.selectLinkIntent(intent));
    await waitFor(() => expect(view.result.current.linkIntentStatus).toBe("valid"));
    let submitted = false;
    await act(async () => {
      submitted = await view.result.current.submit();
    });
    expect(submitted).toBe(true);
    await waitFor(() => expect(view.result.current.hasPendingLinkRecovery).toBe(true));
    const firstPayload = mocks.enqueue.mock.calls[0][0].payload;

    mocks.enqueue.mockResolvedValueOnce("link-job");
    let retried = false;
    await act(async () => {
      retried = await view.result.current.retryLinkOnly();
    });
    expect(retried).toBe(true);
    expect(view.result.current.linkSchedulingSucceeded).toBe(true);
    expect(mocks.uploadWork).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue.mock.calls[1][0].payload).toEqual(firstPayload);
    expect(firstPayload.clientWorkId).toBe("client-1");
    expect(firstPayload.clientOperationId).toBe("work-link:client-1:9:0");
    if (_kind === "queued") expect(firstPayload.sourceWorkJobId).toBe("work-job-1");
    else expect(firstPayload).not.toHaveProperty("sourceWorkJobId");
  });
});
