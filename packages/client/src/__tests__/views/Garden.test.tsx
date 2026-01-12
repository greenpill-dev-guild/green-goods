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

// Mock shared config
vi.mock("@green-goods/shared/config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 84532,
}));

// Mock shared hooks
vi.mock("@green-goods/shared/hooks", () => ({
  useActionTranslation: () => ({ translatedAction: null }),
  useDraftAutoSave: () => undefined,
  useDraftResume: () => ({
    showDraftDialog: false,
    handleContinueDraft: vi.fn(),
    handleStartFresh: vi.fn().mockResolvedValue(undefined),
  }),
  useDrafts: () => ({
    activeDraftId: null,
    _setActiveDraftId: vi.fn(),
    createDraft: vi.fn().mockResolvedValue("draft-1"),
    updateDraft: vi.fn().mockResolvedValue(undefined),
    setImages: vi.fn().mockResolvedValue(undefined),
    clearActiveDraft: vi.fn().mockResolvedValue(undefined),
    resumeDraft: vi.fn().mockResolvedValue(undefined),
  }),
  useGardenTranslation: () => ({ translatedGarden: null }),
}));

// Mock shared providers
const mockForm = {
  state: { isSubmitting: false, isValid: true },
  images: [],
  setImages: vi.fn(),
  actionUID: null,
  setActionUID: vi.fn(),
  gardenAddress: null,
  setGardenAddress: vi.fn(),
  register: vi.fn(),
  control: {},
  uploadWork: vi.fn().mockResolvedValue(true),
  feedback: "",
  plantSelection: [],
  plantCount: undefined,
  values: {},
  reset: vi.fn(),
};

vi.mock("@green-goods/shared/providers", () => ({
  useWork: () => ({
    form: mockForm,
    activeTab: "intro",
    setActiveTab: vi.fn(),
    actions: [
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
    ],
    gardens: [
      {
        id: "garden-1",
        name: "Test Garden",
        location: "Test Location",
        bannerImage: "",
        gardeners: [],
        operators: [],
        createdAt: Date.now(),
      },
    ],
    isLoading: false,
    workMutation: { isPending: false, isError: false },
  }),
  WorkTab: {
    Intro: "intro",
    Media: "media",
    Details: "details",
    Review: "review",
  },
}));

// Mock stores
vi.mock("@green-goods/shared/stores/useWorkFlowStore", () => ({
  useWorkFlowStore: Object.assign(
    (selector: (state: { submissionCompleted: boolean }) => boolean) =>
      selector({ submissionCompleted: false }),
    { getState: () => ({ reset: vi.fn() }) }
  ),
}));

// Mock utils
vi.mock("@green-goods/shared/utils", () => ({
  findActionByUID: () => ({
    id: "action-1",
    title: "Test Action",
    description: "Test description",
    inputs: [],
    mediaInfo: { required: false, maxImageCount: 5 },
  }),
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

const renderWithProviders = (initialRoute = "/garden") => {
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
          createElement(Route, { path: "/garden", element: createElement(Work) }),
          createElement(Route, { path: "/home", element: createElement("div", null, "Home") })
        )
      )
    )
  );
};

describe("Garden (Work) View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
