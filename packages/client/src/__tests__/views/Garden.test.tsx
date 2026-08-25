/**
 * Garden (Work) View Smoke Tests
 *
 * Tests that the Garden/Work view renders without crashing.
 * This is the work submission flow view at /garden.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock form state (referenced in the barrel mock below).
// Must mirror WorkFormValue from packages/shared/src/providers/Work.tsx — adding
// fields that live on WorkSelectionValue (actionUID, gardenAddress, their setters)
// here is what hid the Jan 2026 context-split regression for 4 months.
const mockForm = {
  state: { isSubmitting: false, isValid: true },
  images: [],
  setImages: vi.fn(),
  register: vi.fn(),
  control: {},
  setValue: vi.fn(),
  uploadWork: vi.fn().mockResolvedValue(true),
  feedback: "",
  timeSpentMinutes: undefined,
  values: {},
  reset: vi.fn(),
  validationErrors: [] as string[],
};

const mockSelection = {
  actionUID: null as number | null,
  setActionUID: vi.fn(),
  gardenAddress: null as string | null,
  setGardenAddress: vi.fn(),
};

const mockWorkFlowState = {
  submissionCompleted: false,
  workSubmissionJourneyId: "journey-123",
  ensureWorkSubmissionJourneyId: vi.fn(() => "journey-123"),
  audioNotes: [] as File[],
  setAudioNotes: vi.fn(),
  setGardenAddress: vi.fn(),
  reset: vi.fn(),
};

const mockSetActiveTab = vi.fn();
const mockSetSelectedDomain = vi.fn();
const mockActions = [
  {
    id: "action-1",
    title: "Test Action",
    description: "Test description",
    startTime: Date.now() - 86400000,
    endTime: Date.now() + 86400000,
    capitals: [],
    media: ["/test.jpg"],
    createdAt: Date.now(),
    inputs: [],
    mediaInfo: { required: false, maxImageCount: 5 },
  },
];
const mockGardens = [
  {
    id: "garden-1",
    name: "Test Garden",
    location: "Test Location",
    bannerImage: "",
    gardeners: [],
    stewards: [],
    createdAt: Date.now(),
  },
];

// The component imports everything from @green-goods/shared barrel.
// Must mock the barrel directly — deep-path mocks don't intercept barrel imports.
vi.mock("@green-goods/shared/config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("@green-goods/shared/stores/workFlowTypes", () => ({
  WorkTab: {
    Intro: "Intro",
    Media: "Media",
    Details: "Details",
    Review: "Review",
  },
}));

vi.mock("@green-goods/shared/hooks/client-ui/work/useWorkSubmissionFlowController", () => ({
  useWorkSubmissionFlowController: () => ({
    ...mockForm,
    ...mockSelection,
    actions: mockActions,
    gardens: mockGardens,
    hasJoinedGardens: true,
    joinableCommunityGarden: null,
    isLoading: false,
    activeTab: "Intro",
    selectedDomain: null,
    setSelectedDomain: mockSetSelectedDomain,
    audioNotes: [],
    authMode: "wallet",
    brokenMediaIds: new Set(),
    cameraClickRef: { current: null },
    canProceed: Boolean(mockSelection.gardenAddress && mockSelection.actionUID !== null),
    changeTab: mockSetActiveTab,
    detailsConfig: {},
    detailInputs: [],
    draft: {
      showDraftDialog: false,
      handleContinueDraft: vi.fn(),
      startFresh: vi.fn(),
    },
    ensureWorkSubmissionJourneyId: mockWorkFlowState.ensureWorkSubmissionJourneyId,
    exit: vi.fn(),
    isJoiningCommunityGarden: false,
    isRecording: false,
    isWalletRequestExpired: false,
    joinCommunityGarden: vi.fn(),
    markMediaPreviewFailed: vi.fn(),
    mediaClickRef: { current: null },
    mediaConfig: {},
    minRequired: 0,
    queueStatusMessage: null,
    recordingElapsed: 0,
    removeBrokenMedia: vi.fn(),
    removeMedia: vi.fn(),
    reviewConfig: {},
    reviewData: { garden: mockGardens[0], action: mockActions[0] },
    setAudioNotes: mockWorkFlowState.setAudioNotes,
    showSkeleton: false,
    submissionCompleted: false,
    submit: vi.fn(),
    toggleAudioRecording: vi.fn(),
    workSubmissionJourneyId: "journey-123",
  }),
}));

vi.mock("@green-goods/shared/modules/app/posthog", () => ({
  track: vi.fn(),
}));

// Mock child components to simplify
vi.mock("../../views/Garden/Intro", () => ({
  WorkIntro: () => createElement("div", { "data-testid": "work-intro" }, "Intro Step"),
}));

vi.mock("../../views/Garden/Media", () => ({
  WorkMedia: () => createElement("div", { "data-testid": "work-media" }, "Media Step"),
}));

vi.mock("../../views/Garden/Details", () => ({
  WorkDetails: () => createElement("div", { "data-testid": "work-details" }, "Details Step"),
}));

vi.mock("../../views/Garden/Review", () => ({
  WorkReview: () => createElement("div", { "data-testid": "work-review" }, "Review Step"),
}));

// Mock UI components
vi.mock("@/components/Actions", () => ({
  Button: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => createElement("button", { onClick, disabled, type: "button" }, label),
}));

vi.mock("@/components/Cards", () => ({
  ActionCardSkeleton: () => createElement("div", { "data-testid": "action-skeleton" }),
  FormInfo: ({ title }: { title: string }) => createElement("div", null, title),
  GardenCardSkeleton: () => createElement("div", { "data-testid": "garden-skeleton" }),
}));

vi.mock("@/components/Communication", () => ({
  FormProgress: () => createElement("div", { "data-testid": "form-progress" }),
}));

vi.mock("@/components/Dialogs", () => ({
  DraftDialog: () => null,
}));

vi.mock("@/components/Features/Work", () => ({
  WorkViewSkeleton: () => createElement("div", { "data-testid": "work-skeleton" }),
}));

vi.mock("@/components/Navigation", () => ({
  TopNav: ({ children }: { children?: React.ReactNode }) =>
    createElement("nav", { "data-testid": "top-nav" }, children),
}));

// Import after mocks
import Work from "../../views/Garden";

const messages = {
  "app.garden.selectYourAction": "Select your action",
  "app.garden.whatTypeOfWork": "What type of work?",
  "app.garden.selectYourGarden": "Select your garden",
  "app.garden.whichGarden": "Which garden?",
  "app.garden.upload.title": "Upload Media",
  "app.garden.submit.tab.media.instruction": "Take a photo",
  "app.garden.details.title": "Enter Details",
  "app.garden.submit.tab.details.instruction": "Provide details",
  "app.garden.details.feedbackPlaceholder": "Feedback",
  "app.garden.review.title": "Review",
  "app.garden.submit.tab.review.instruction": "Check info",
  "app.garden.submit.tab.intro.label": "Start Gardening",
  "app.garden.submit.tab.media.label": "Add Details",
  "app.garden.submit.tab.details.label": "Review Work",
  "app.garden.submit.tab.review.label": "Upload Work",
  "app.garden.unknown": "Unknown Garden",
  "app.action.selected": "Selected Action",
};

const renderWithProviders = (initialRoute = "/home/garden") => {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialRoute] },
      createElement(
        IntlProvider,
        { locale: "en", messages },
        createElement(
          Routes,
          null,
          createElement(Route, { path: "/home/garden", element: createElement(Work) }),
          createElement(Route, { path: "/home", element: createElement("div", null, "Home") })
        )
      )
    )
  );
};

describe("Garden (Work) View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelection.actionUID = null;
    mockSelection.gardenAddress = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders without crashing", () => {
    renderWithProviders();

    expect(screen.getByTestId("top-nav")).toBeInTheDocument();
  });

  it("renders form progress indicator", () => {
    renderWithProviders();

    expect(screen.getByTestId("form-progress")).toBeInTheDocument();
  });

  it("renders intro step by default", () => {
    renderWithProviders();

    expect(screen.getByTestId("work-intro")).toBeInTheDocument();
  });

  it("shows Start Gardening button on intro step", () => {
    renderWithProviders();

    expect(screen.getByRole("button", { name: "Start Gardening" })).toBeInTheDocument();
  });

  it("disables Start Gardening when no garden/action selected", () => {
    renderWithProviders();

    const button = screen.getByRole("button", { name: "Start Gardening" });
    expect(button).toBeDisabled();
  });
});
