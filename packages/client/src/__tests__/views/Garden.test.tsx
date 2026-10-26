/**
 * Garden (Work) View Smoke Tests
 *
 * Tests that the Garden/Work view renders without crashing.
 * This is the work submission flow view at /garden.
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
const mockExit = vi.fn();
const mockToggleAudioRecording = vi.fn();
const mockSetSelectedDomain = vi.fn();
const mockClearLinkIntent = vi.fn();
const mockStartProps = vi.fn();
const mockStartBack = vi.fn(() => false);
const mockReviewProps = vi.fn();
const mockWorkForSheetProps = vi.fn();
let mockActiveTab = "Intro";
interface MockWorkLinkIntent {
  commitmentId: bigint;
  requirementIndex: number;
  actionUID: number;
  garden: `0x${string}`;
  commitmentTitle: string;
  requirementLabel: string;
  returnTo: string;
  direction?: "OFFER" | "REQUEST";
}
let mockLinkIntent: MockWorkLinkIntent | null = null;
let mockLinkIntentStatus: "none" | "validating" | "valid" | "invalid" = "none";
const mockRefetchCommitmentLinkChoices = vi.fn();
const mockRetryLinkOnly = vi.fn();
let mockHasPendingLinkRecovery = false;
let mockLinkSchedulingSucceeded = false;
let mockLinkSchedulingWorkSent: boolean | null = null;
let mockIsSchedulingDependentLink = false;
let mockIsQueueingDependentLink = false;
let mockDraftSaveState: "saving" | "saved" | "failed" | undefined;
let mockNamedGarden: { id: string; name: string; bannerImage: string } | null = null;
let mockGardenSettled = false;
let mockTakesUp = false;
let mockPromptCount = 1;
const mockDraftRetry = vi.fn().mockResolvedValue(undefined);
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
      showDraftSheet: false,
      handleContinueDraft: vi.fn(),
      startFresh: vi.fn(),
      saveState: mockDraftSaveState,
      missingAttachments: [],
      retry: mockDraftRetry,
    },
    ensureWorkSubmissionJourneyId: mockWorkFlowState.ensureWorkSubmissionJourneyId,
    exit: mockExit,
    isJoiningCommunityGarden: false,
    isRecording: false,
    isWalletRequestExpired: false,
    joinCommunityGarden: vi.fn(),
    linkIntent: mockLinkIntent,
    linkIntentStatus: mockLinkIntentStatus,
    takesUp: mockTakesUp,
    promptCount: mockPromptCount,
    namedSubmissionGarden: mockNamedGarden,
    submissionGardenSettled: mockGardenSettled,
    refetchCommitmentLinkChoices: mockRefetchCommitmentLinkChoices,
    isSchedulingDependentLink: mockIsSchedulingDependentLink,
    isQueueingDependentLink: mockIsQueueingDependentLink,
    linkSchedulingError: mockHasPendingLinkRecovery ? new Error("queue unavailable") : null,
    linkSchedulingSucceeded: mockLinkSchedulingSucceeded,
    linkSchedulingWorkSent: mockLinkSchedulingWorkSent,
    hasPendingLinkRecovery: mockHasPendingLinkRecovery,
    retryLinkOnly: mockRetryLinkOnly,
    clearLinkIntent: mockClearLinkIntent,
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
    start: { skipped: false, waiting: false, back: mockStartBack },
    submissionCompleted: false,
    submit: vi.fn(),
    toggleAudioRecording: mockToggleAudioRecording,
    workSubmissionJourneyId: "journey-123",
  }),
}));

vi.mock("@green-goods/shared/modules/app/posthog", () => ({
  track: vi.fn(),
}));

// Mock child components to simplify
vi.mock("../../views/Garden/Start", () => ({
  WorkStart: (props: unknown) => {
    mockStartProps(props);
    return createElement("div", { "data-testid": "work-start" }, "Start Step");
  },
  StartSkeleton: () => createElement("div", { "data-testid": "start-skeleton" }),
}));

vi.mock("../../views/Garden/Media", () => ({
  WorkMedia: () => createElement("div", { "data-testid": "work-media" }, "Media Step"),
}));

vi.mock("../../views/Garden/Details", () => ({
  WorkDetails: () => createElement("div", { "data-testid": "work-details" }, "Details Step"),
}));

vi.mock("../../views/Garden/Review", () => ({
  WorkReview: (props: { pinned?: React.ReactNode }) => {
    mockReviewProps(props);
    return createElement("div", { "data-testid": "work-review" }, "Review Step", props.pinned);
  },
}));

// The promise sheet reads the promise; here it only reports what it was handed.
vi.mock("../../views/Garden/WorkForSheet", () => ({
  WorkForSheet: (props: { open: boolean }) => {
    mockWorkForSheetProps(props);
    return props.open ? createElement("div", { role: "dialog" }, "Promise sheet") : null;
  },
}));

// Mock UI components
vi.mock("@/components/Cards", () => ({
  ActionCardSkeleton: () => createElement("div", { "data-testid": "action-skeleton" }),
  FormInfo: ({ title }: { title: string }) => createElement("div", null, title),
  GardenCardSkeleton: () => createElement("div", { "data-testid": "garden-skeleton" }),
}));

vi.mock("@/components/Communication", () => ({
  FormProgress: () => createElement("div", { "data-testid": "form-progress" }),
}));

vi.mock("@/components/Sheets", () => ({
  DraftSheet: () => null,
}));

vi.mock("@/components/Features/Work", async (importOriginal) => ({
  ...(await importOriginal()),
  WorkViewSkeleton: () => createElement("div", { "data-testid": "work-skeleton" }),
}));

vi.mock("@/components/Navigation", () => ({
  TopNav: ({ steps, onBackClick }: { steps?: React.ReactNode; onBackClick?: () => void }) =>
    createElement(
      "nav",
      { "data-testid": "top-nav" },
      createElement("button", { type: "button", onClick: onBackClick }, "Go back"),
      steps
    ),
}));

// Import after mocks
import Work from "../../views/Garden";
import { createTestQueryClient } from "../test-utils";

const messages = {
  "app.garden.selectYourAction": "Select Your Action",
  "app.garden.whatTypeOfWork": "What type of work?",
  "app.garden.selectYourGarden": "Select Your Garden",
  "app.garden.whichGarden": "Which garden?",
  "app.garden.upload.title": "Upload Media",
  "app.garden.submit.tab.media.instruction": "Take a Photo",
  "app.garden.details.title": "Enter Details",
  "app.garden.submit.tab.details.instruction": "Provide details",
  "app.garden.details.feedbackPlaceholder": "Feedback",
  "app.garden.review.title": "Review",
  "app.garden.submit.tab.review.instruction": "Check info",
  "app.garden.submit.tab.media.label": "Details",
  "app.garden.submit.tab.details.label": "Review Work",
  "app.garden.submit.tab.review.label": "Upload Work",
  "app.garden.submit.takeUpPrompts":
    "{count, plural, one {Uploading takes up the ask first. It opens # wallet or passkey prompt.} other {Uploading takes up the ask first. It opens # wallet or passkey prompts: the take-up, the work and its link.}}",
  "app.garden.unknown": "Unknown Garden",
  "app.action.selected": "Selected Action",
  "app.commitment.pinned.workFor": "Work for",
  "app.commitment.pinned.open": "{label} {title}. Open the promise",
  "app.commitment.pinned.openWithDirection": "{direction}: {label} {title}. Open the promise",
  "app.commitments.row.request": "Request",
  "app.garden.commitment.linkSchedulingError":
    "Your work was submitted, but its link to the promise could not be queued.",
  "app.garden.commitment.linkScheduling": "Work submitted. Queueing its link to the promise…",
  "app.garden.commitment.linkScheduled": "Work submitted. Its link to the promise is queued.",
  "app.garden.commitment.retryLink": "Retry Link",
  "app.garden.draft.saving": "Saving…",
  "app.garden.draft.failed": "Could not save or restore this work.",
  "app.garden.draft.retry": "Retry",
  "app.garden.submit.gardenLine": "Logging work in {garden}",
  "app.proof.media.gallery": "Choose from Your Photos",
  "app.proof.media.camera": "Take a Photo",
  "app.proof.media.record": "Record a voice note",
};

const renderWithProviders = (initialRoute = "/home/garden") => {
  // The app renders under a query client; the pinned promise's row reads its name hook there.
  const queryClient = createTestQueryClient();
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
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
    mockHasPendingLinkRecovery = false;
    mockLinkSchedulingSucceeded = false;
    mockLinkSchedulingWorkSent = null;
    mockIsSchedulingDependentLink = false;
    mockIsQueueingDependentLink = false;
    mockDraftSaveState = undefined;
    mockNamedGarden = null;
    mockGardenSettled = false;
    mockTakesUp = false;
    mockPromptCount = 1;
  });

  afterEach(() => {
    cleanup();
  });

  it("says a draft is saving to screen readers only, so the step never moves (D29)", () => {
    mockDraftSaveState = "saving";
    renderWithProviders();

    const saving = screen.getAllByRole("status").find((status) => status.textContent === "Saving…");
    expect(saving).toHaveClass("sr-only");
  });

  it("keeps a failed draft save on screen with a way to try again", () => {
    mockDraftSaveState = "failed";
    renderWithProviders();

    expect(screen.getByRole("alert")).toHaveTextContent("Could not save or restore this work.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mockDraftRetry).toHaveBeenCalledOnce();
  });

  it("says under the steps where the work goes when its garden is not the active one", () => {
    mockActiveTab = "Media";
    mockNamedGarden = {
      id: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      name: "Hilltop Garden",
      bannerImage: "",
    };
    renderWithProviders();

    const line = screen.getByTestId("submission-garden");
    expect(line).toHaveTextContent("Logging work in Hilltop Garden");
    // A long name wraps rather than losing its end, clipped at two lines, with the whole
    // sentence in the title.
    expect(within(line).getByTitle("Logging work in Hilltop Garden")).toHaveClass("line-clamp-2");
  });

  it("names no garden while the work goes to the active one, and settles the Start step's garden", () => {
    mockGardenSettled = true;
    renderWithProviders();

    expect(screen.queryByTestId("submission-garden")).toBeNull();
    expect(mockStartProps.mock.lastCall?.[0]).toMatchObject({ gardenQuestion: null });
  });

  it("renders without crashing", () => {
    renderWithProviders();

    expect(screen.getByTestId("top-nav")).toBeInTheDocument();
  });

  it("renders form progress indicator", () => {
    renderWithProviders();

    expect(screen.getByTestId("form-progress")).toBeInTheDocument();
  });

  it("renders the Start step by default", () => {
    renderWithProviders();

    expect(screen.getByTestId("work-start")).toBeInTheDocument();
  });

  it("offers no Start button: Start has no bar, and Back there leaves the flow (DL-131)", () => {
    mockSelection.actionUID = 1;
    mockSelection.gardenAddress = "garden-1";
    const { container } = renderWithProviders();

    expect(container.ownerDocument.querySelector('[data-component="FlowBar"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Start Gardening" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(mockStartBack).toHaveBeenCalledTimes(1);
    expect(mockExit).toHaveBeenCalledTimes(1);
  });

  it("offers the media tools on Media only, and Back there returns to Start", () => {
    mockActiveTab = "Media";
    renderWithProviders();

    for (const tool of ["Choose from Your Photos", "Take a Photo", "Record a voice note"]) {
      expect(screen.getByRole("button", { name: tool })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Record a voice note" }));
    expect(mockToggleAudioRecording).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(mockSetActiveTab).toHaveBeenCalledWith("Intro");
    expect(mockExit).not.toHaveBeenCalled();
    cleanup();

    mockActiveTab = "Intro";
    renderWithProviders();
    expect(screen.queryByRole("button", { name: "Take a Photo" })).toBeNull();
  });

  it("hands the Start step a promise link that shared rejected, with a retry and a way out", () => {
    mockSelection.actionUID = 1;
    mockSelection.gardenAddress = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    mockGardenSettled = true;
    mockLinkIntentStatus = "invalid";
    renderWithProviders();

    const props = mockStartProps.mock.lastCall?.[0] as {
      link: { status: string; onRetry: () => void; onLetGo: () => void };
    };
    expect(props.link.status).toBe("invalid");
    props.link.onRetry();
    expect(mockRefetchCommitmentLinkChoices).toHaveBeenCalledTimes(1);
    props.link.onLetGo();
    expect(mockClearLinkIntent).toHaveBeenCalledTimes(1);
  });

  it("names the chosen promise on the step and unlinks the work from its sheet", () => {
    mockActiveTab = "Review";
    mockLinkIntent = {
      commitmentId: 9n,
      requirementIndex: 0,
      actionUID: 1,
      garden: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      commitmentTitle: "Repair tool handles",
      requirementLabel: "1",
      returnTo: "/home/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/commitments/9",
      direction: "REQUEST",
    };
    renderWithProviders();

    // The pin leads with the promise's own direction, a request's helping hand, and its
    // button's name says it too, since that name replaces the icon's for a screen reader.
    const pinned = within(screen.getByTestId("pinned-promise"));
    expect(pinned.getByRole("img", { name: "Request" })).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Request: Work for Repair tool handles. Open the promise",
      })
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Promise sheet");

    const sheet = mockWorkForSheetProps.mock.lastCall?.[0] as { onUnlink: () => void };
    sheet.onUnlink();
    expect(mockClearLinkIntent).toHaveBeenCalledTimes(1);
  });

  it("says above Upload Work, before the first prompt, that a draft for an Open ask takes it up first", () => {
    mockActiveTab = "Review";
    mockSelection.actionUID = 1;
    mockSelection.gardenAddress = "garden-1";
    mockLinkIntentStatus = "valid";
    mockLinkIntent = {
      commitmentId: 9n,
      requirementIndex: 0,
      actionUID: 1,
      garden: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      commitmentTitle: "Weeding",
      requirementLabel: "1",
      returnTo: "/home/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/commitments/9",
      direction: "REQUEST",
    };
    mockTakesUp = true;
    mockPromptCount = 3;
    renderWithProviders();

    const note =
      "Uploading takes up the ask first. It opens 3 wallet or passkey prompts: the take-up, the work and its link.";
    expect(screen.getByText(note)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload Work" })).toHaveAccessibleDescription(note);
    cleanup();

    // A draft for a promise of the member's own: Review says nothing more.
    mockTakesUp = false;
    mockPromptCount = 2;
    renderWithProviders();
    expect(screen.queryByText(/takes up the ask/)).toBeNull();
    expect(screen.getByRole("button", { name: "Upload Work" })).not.toHaveAccessibleDescription();
  });

  it("pins no promise when the work isn't for one", () => {
    mockActiveTab = "Review";
    renderWithProviders();

    expect(screen.queryByTestId("pinned-promise")).toBeNull();
    expect(mockWorkForSheetProps).not.toHaveBeenCalled();
  });

  it("retries only the dependent commitment link after Work submission succeeds", () => {
    mockActiveTab = "Review";
    mockSelection.actionUID = 1;
    mockSelection.gardenAddress = "garden-1";
    mockHasPendingLinkRecovery = true;
    mockLinkSchedulingWorkSent = true;

    renderWithProviders();

    expect(screen.getByRole("alert")).toHaveTextContent(/work was submitted/i);
    expect(screen.getByRole("button", { name: "Upload Work" })).toBeDisabled();
    screen.getByRole("button", { name: "Retry Link" }).click();
    expect(mockRetryLinkOnly).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["while the Work is still being sent", false],
    ["once the Work was sent", true],
  ] as const)("says the Work was submitted only %s", (_phase, queueing) => {
    mockActiveTab = "Review";
    mockSelection.actionUID = 1;
    mockSelection.gardenAddress = "garden-1";
    mockIsSchedulingDependentLink = true;
    mockIsQueueingDependentLink = queueing;

    renderWithProviders();

    expect(screen.getByRole("button", { name: "Upload Work" })).toBeDisabled();
    if (queueing) {
      expect(screen.getByText(/Queueing its link to the promise/)).toBeInTheDocument();
    } else {
      expect(screen.queryByText(/Work submitted/)).toBeNull();
    }
  });

  it("keeps queued Work and a failed link truthful", () => {
    mockActiveTab = "Review";
    mockHasPendingLinkRecovery = true;
    mockLinkSchedulingWorkSent = false;
    renderWithProviders();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your work is saved on this device, but its link to the promise could not be queued."
    );
    expect(screen.queryByText(/Your work was submitted/)).toBeNull();
  });

  it("keeps queued Work truthful after its dependent link is queued", () => {
    mockActiveTab = "Review";
    mockLinkSchedulingSucceeded = true;
    mockLinkSchedulingWorkSent = false;
    renderWithProviders();
    expect(screen.getAllByRole("status").map((status) => status.textContent)).toContain(
      "Work saved on this device. Its link to the promise is queued."
    );
  });

  it("announces when the dependent commitment link is safely queued after Work was sent", () => {
    mockActiveTab = "Review";
    mockLinkSchedulingSucceeded = true;
    mockLinkSchedulingWorkSent = true;

    renderWithProviders();

    expect(screen.getAllByRole("status").map((status) => status.textContent)).toContain(
      "Work submitted. Its link to the promise is queued."
    );
  });
});
