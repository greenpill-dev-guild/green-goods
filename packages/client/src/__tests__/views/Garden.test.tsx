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
    operators: [],
    createdAt: Date.now(),
  },
];

// The component imports everything from @green-goods/shared barrel.
// Must mock the barrel directly — deep-path mocks don't intercept barrel imports.
vi.mock("@green-goods/shared", () => ({
  // config
  DEFAULT_CHAIN_ID: 11155111,
  // hooks
  useAudioRecording: vi.fn(() => ({
    isRecording: false,
    isRequesting: false,
    elapsed: 0,
    error: null,
    toggle: vi.fn(),
    stop: vi.fn(),
  })),
  useActionTranslation: () => ({ translatedAction: null }),
  useDraftAutoSave: () => ({ saveOnExit: vi.fn().mockResolvedValue(undefined) }),
  useDraftResume: () => ({
    showDraftDialog: false,
    handleContinueDraft: vi.fn(),
    handleStartFresh: vi.fn().mockResolvedValue(undefined),
    clearActiveDraft: vi.fn().mockResolvedValue(undefined),
  }),
  useGardenTranslation: () => ({ translatedGarden: null }),
  useUser: () => ({ authMode: "wallet" }),
  useJoinGarden: () => ({
    joinGarden: vi.fn(),
    isJoining: false,
    joiningGardenId: null,
  }),
  // providers
  useWorkFormContext: () => ({
    ...mockForm,
    workMutation: { isPending: false, isError: false },
  }),
  useWorkSelection: () => ({
    actions: mockActions,
    gardens: mockGardens,
    hasJoinedGardens: mockGardens.length > 0,
    joinableCommunityGarden: null,
    isLoading: false,
    activeTab: "Intro",
    setActiveTab: mockSetActiveTab,
    selectedDomain: null,
    setSelectedDomain: mockSetSelectedDomain,
    actionUID: mockSelection.actionUID,
    setActionUID: mockSelection.setActionUID,
    gardenAddress: mockSelection.gardenAddress,
    setGardenAddress: mockSelection.setGardenAddress,
  }),
  WorkTab: {
    Intro: "Intro",
    Media: "Media",
    Details: "Details",
    Review: "Review",
  },
  // stores
  useWorkFlowStore: Object.assign(
    (selector: (state: typeof mockWorkFlowState) => unknown) => selector(mockWorkFlowState),
    { getState: () => mockWorkFlowState }
  ),
  // utils
  findActionByUID: () => ({
    id: "action-1",
    title: "Test Action",
    description: "Test description",
    inputs: [],
    mediaInfo: { required: false, maxImageCount: 5 },
  }),
  parseContractError: () => ({
    raw: "",
    name: "UnknownError",
    message: "Transaction failed. Please try again.",
    isKnown: false,
    recoverable: true,
    suggestedAction: "retry",
  }),
  // offline + timers
  useOffline: () => ({ isOnline: true, pendingCount: 0, syncStatus: "idle" }),
  useTimeout: () => ({ set: vi.fn(), clear: vi.fn(), isPending: false }),
  // analytics
  track: vi.fn(),
  toastService: { success: vi.fn(), error: vi.fn() },
  // modules
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  mediaResourceManager: {
    cleanupUrls: vi.fn(),
    cleanupAll: vi.fn(),
    getOrCreateUrl: vi.fn(),
    createUrl: vi.fn(),
    createUrls: vi.fn(),
    cleanupUrl: vi.fn(),
    getStats: vi.fn(() => ({ totalUrls: 0, trackedIds: 0 })),
  },
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
