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

vi.mock("@green-goods/shared", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  WorkTab: { Intro: "Intro", Media: "Media", Details: "Details", Review: "Review" },
  findActionByUID: () => null,
  getSafeMediaMetadata: () => ({}),
  getWorkMediaId: (file: File) => file.name,
  logger: { error: vi.fn() },
  mediaResourceManager: { cleanupUrls: vi.fn() },
  parseContractError: () => ({ name: "UnknownError" }),
  toastService: { error: vi.fn(), success: vi.fn() },
  track: vi.fn(),
  useActionTranslation: () => ({ translatedAction: null }),
  useAudioRecording: () => ({ isRecording: false, elapsed: 0, toggle: vi.fn() }),
  useDraftAutoSave: () => ({ saveOnExit: vi.fn() }),
  useDraftResume: () => ({
    showDraftDialog: false,
    handleContinueDraft: vi.fn(),
    handleStartFresh: vi.fn(),
    clearActiveDraft: vi.fn(),
  }),
  useGardenTranslation: () => ({ translatedGarden: null }),
  useJoinGarden: () => ({ joinGarden: vi.fn(), isJoining: false, joiningGardenId: null }),
  useOffline: () => ({ isOnline: true, pendingCount: 0, syncStatus: "idle" }),
  useTimeout: () => ({ set: vi.fn() }),
  useUser: () => ({ authMode: "wallet" }),
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
