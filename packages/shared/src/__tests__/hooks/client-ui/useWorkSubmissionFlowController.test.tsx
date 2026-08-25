/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actionUID: null as number | null,
  gardenAddress: null as string | null,
  setActiveTab: vi.fn(),
  ensureJourney: vi.fn(() => "journey-1"),
  reset: vi.fn(),
  enqueue: vi.fn(),
  uploadWork: vi.fn(),
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
  logger: { error: vi.fn() },
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
  useDraftAutoSave: () => ({ saveOnExit: vi.fn() }),
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
    setImages: vi.fn(),
    register: vi.fn(),
    control: {},
    setValue: vi.fn(),
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

describe("useWorkSubmissionFlowController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actionUID = null;
    mocks.gardenAddress = null;
    mocks.outcome = null;
    mocks.choices = [];
    mocks.enqueue.mockResolvedValue("link-job");
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
