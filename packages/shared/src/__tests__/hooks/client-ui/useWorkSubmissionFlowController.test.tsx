/** @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
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
}));

vi.mock("../../../stores/workFlowTypes", () => ({
  WorkTab: { Intro: "Intro", Media: "Media", Details: "Details", Review: "Review" },
}));

vi.mock("../../../utils/action/parsers", () => ({
  findActionByUID: () => null,
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { error: vi.fn() },
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
  useUser: () => ({ authMode: "wallet" }),
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
    { getState: () => ({ audioNotes: [], reset: mocks.reset }) }
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
    uploadWork: vi.fn(),
    feedback: "",
    timeSpentMinutes: undefined,
    values: {},
    reset: vi.fn(),
    workMutation: { isPending: false, error: null },
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
});
