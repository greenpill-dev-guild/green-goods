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
const mockSelectLinkIntent = vi.fn();
const mockClearLinkIntent = vi.fn();
const mockIntroProps = vi.fn();
const mockReviewProps = vi.fn();
let mockActiveTab = "Intro";
interface MockWorkLinkIntent {
  commitmentId: bigint;
  requirementIndex: number;
  actionUID: number;
  garden: `0x${string}`;
  commitmentTitle: string;
  requirementLabel: string;
  returnTo: string;
}
let mockLinkIntent: MockWorkLinkIntent | null = null;
let mockCommitmentLinkChoices: MockWorkLinkIntent[] = [];
let mockLinkIntentStatus: "none" | "validating" | "valid" | "invalid" = "none";
const mockRefetchCommitmentLinkChoices = vi.fn();
const mockRetryLinkOnly = vi.fn();
let mockHasPendingLinkRecovery = false;
let mockLinkSchedulingSucceeded = false;
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
    activeTab: mockActiveTab,
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
    linkIntent: mockLinkIntent,
    linkIntentStatus: mockLinkIntentStatus,
    commitmentLinkChoices: mockCommitmentLinkChoices,
    commitmentLinkChoicesLoading: false,
    commitmentLinkChoicesError: null,
    refetchCommitmentLinkChoices: mockRefetchCommitmentLinkChoices,
    isSchedulingDependentLink: false,
    linkSchedulingError: mockHasPendingLinkRecovery ? new Error("queue unavailable") : null,
    linkSchedulingSucceeded: mockLinkSchedulingSucceeded,
    hasPendingLinkRecovery: mockHasPendingLinkRecovery,
    retryLinkOnly: mockRetryLinkOnly,
    clearLinkIntent: mockClearLinkIntent,
    selectLinkIntent: mockSelectLinkIntent,
    submissionOutcome: null,
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
  WorkIntro: (props: unknown) => {
    mockIntroProps(props);
    return createElement("div", { "data-testid": "work-intro" }, "Intro Step");
  },
}));

vi.mock("../../views/Garden/Media", () => ({
  WorkMedia: () => createElement("div", { "data-testid": "work-media" }, "Media Step"),
}));

vi.mock("../../views/Garden/Details", () => ({
  WorkDetails: () => createElement("div", { "data-testid": "work-details" }, "Details Step"),
}));

vi.mock("../../views/Garden/Review", () => ({
  WorkReview: (props: unknown) => {
    mockReviewProps(props);
    return createElement("div", { "data-testid": "work-review" }, "Review Step");
  },
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
  "app.garden.selectYourAction": "Select Your Action",
  "app.garden.whatTypeOfWork": "What type of work?",
  "app.garden.selectYourGarden": "Select Your Garden",
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
  "app.garden.commitment.linkSchedulingError":
    "Your work was submitted, but its commitment link could not be queued.",
  "app.garden.commitment.linkScheduled": "Work submitted. Its commitment link is queued.",
  "app.garden.commitment.retryLink": "Retry Link",
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
    mockActiveTab = "Intro";
    mockLinkIntent = null;
    mockLinkIntentStatus = "none";
    mockCommitmentLinkChoices = [];
    mockHasPendingLinkRecovery = false;
    mockLinkSchedulingSucceeded = false;
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

  it("keeps only a canonical eligible deep-link intent selected in the Work intro", () => {
    const canonicalChoice = {
      commitmentId: 9n,
      requirementIndex: 1,
      actionUID: 1,
      garden: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
      commitmentTitle: "Repair tool handles",
      requirementLabel: "2",
      returnTo: "/home/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/commitments/9",
    };
    mockSelection.actionUID = 1;
    mockSelection.gardenAddress = canonicalChoice.garden;
    mockLinkIntentStatus = "valid";
    mockLinkIntent = canonicalChoice;
    mockCommitmentLinkChoices = [canonicalChoice];

    renderWithProviders();

    const props = mockIntroProps.mock.lastCall?.[0] as {
      selectedCommitmentKey: string;
      commitmentChoices: Array<{ key: string; title: string; requirementIndex: number }>;
    };
    expect(props.selectedCommitmentKey).toBe("9:1");
    expect(props.commitmentChoices).toEqual([
      expect.objectContaining({ key: "9:1", title: "Repair tool handles", requirementIndex: 1 }),
    ]);
  });

  it.each([
    "stale",
    "frozen",
    "wrong-action",
    "tampered",
  ])("does not display a %s deep-link intent that shared rejected", () => {
    mockSelection.actionUID = 1;
    mockSelection.gardenAddress = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    mockLinkIntentStatus = "invalid";
    mockLinkIntent = null;
    mockCommitmentLinkChoices = [];

    renderWithProviders();

    const props = mockIntroProps.mock.lastCall?.[0] as {
      selectedCommitmentKey: string | null;
      commitmentChoices: unknown[];
      commitmentIntentStatus: string;
    };
    expect(props.selectedCommitmentKey).toBeNull();
    expect(props.commitmentChoices).toEqual([]);
    expect(props.commitmentIntentStatus).toBe("invalid");
  });

  it("passes a generic commitment choice back to the shared controller", () => {
    const choice = {
      commitmentId: 12n,
      requirementIndex: 0,
      actionUID: 1,
      garden: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
      commitmentTitle: "Plant the starts",
      requirementLabel: "1",
      returnTo: "/home/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/commitments/12",
    };
    mockSelection.actionUID = 1;
    mockSelection.gardenAddress = choice.garden;
    mockCommitmentLinkChoices = [choice];
    renderWithProviders();

    const props = mockIntroProps.mock.lastCall?.[0] as {
      setSelectedCommitmentKey: (key: string | null) => void;
    };
    props.setSelectedCommitmentKey("12:0");

    expect(mockSelectLinkIntent).toHaveBeenCalledWith(choice);
  });

  it("clears the Review Fulfills context through the submission controller", () => {
    mockActiveTab = "Review";
    mockLinkIntent = {
      commitmentId: 9n,
      requirementIndex: 0,
      actionUID: 1,
      garden: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      commitmentTitle: "Repair tool handles",
      requirementLabel: "1",
      returnTo: "/home/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/commitments/9",
    };
    renderWithProviders();

    const props = mockReviewProps.mock.lastCall?.[0] as {
      commitmentSelection: { title: string };
      onClearCommitment: () => void;
    };
    expect(props.commitmentSelection.title).toBe("Repair tool handles");
    props.onClearCommitment();
    expect(mockClearLinkIntent).toHaveBeenCalledTimes(1);
  });

  it("retries only the dependent commitment link after Work submission succeeds", () => {
    mockActiveTab = "Review";
    mockSelection.actionUID = 1;
    mockSelection.gardenAddress = "garden-1";
    mockHasPendingLinkRecovery = true;

    renderWithProviders();

    expect(screen.getByRole("alert")).toHaveTextContent(/work was submitted/i);
    expect(screen.getByRole("button", { name: "Upload Work" })).toBeDisabled();
    screen.getByRole("button", { name: "Retry Link" }).click();
    expect(mockRetryLinkOnly).toHaveBeenCalledTimes(1);
  });

  it("announces when the dependent commitment link is safely queued", () => {
    mockLinkSchedulingSucceeded = true;

    renderWithProviders();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Work submitted. Its commitment link is queued."
    );
  });
});
