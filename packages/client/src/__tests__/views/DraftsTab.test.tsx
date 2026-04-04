/**
 * DraftsTab Component Tests
 *
 * Tests draft persistence tab: loading, empty, populated,
 * resume navigation, and delete confirmation.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Track mock state
const mockDraftsState = {
  drafts: [] as any[],
  isLoading: false,
  deleteDraft: vi.fn(),
  isDeleting: false,
  refetchDrafts: vi.fn(),
  draftCount: 0,
};

const mockNavigate = vi.fn();

// Mock @green-goods/shared
vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  DEFAULT_CHAIN_ID: 11155111,
  findActionByUID: (actions: any[], uid: number) => actions.find((a: any) => a.id === uid),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  toastService: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  useActions: () => ({
    data: [
      { id: 1, title: "Plant Trees" },
      { id: 2, title: "Water Garden" },
    ],
  }),
  useDrafts: () => mockDraftsState,
  useGardens: () => ({
    data: [
      { id: "0xgarden1", name: "Community Garden" },
      { id: "0xgarden2", name: "Rooftop Garden" },
    ],
  }),
  ConfirmDialog: ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
  }) =>
    isOpen
      ? createElement(
          "div",
          { "data-testid": "confirm-dialog" },
          createElement("span", null, title),
          createElement("span", null, description),
          createElement("button", { "data-testid": "confirm-delete", onClick: onConfirm }, "Delete"),
          createElement("button", { "data-testid": "cancel-delete", onClick: onClose }, "Cancel")
        )
      : null,
}));

// Mock react-router-dom navigate
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock @remixicon/react
vi.mock("@remixicon/react", () => ({
  RiAlertLine: (props: any) => createElement("span", props),
  RiDraftLine: (props: any) => createElement("span", props),
  RiLoader4Line: (props: any) => createElement("span", { ...props, "data-testid": "spinner" }),
  RiRefreshLine: (props: any) => createElement("span", props),
}));

// Mock DraftCard component
vi.mock("@/components/Cards", () => ({
  DraftCard: ({
    draft,
    actionTitle,
    gardenName,
    onResume,
    onDelete,
  }: {
    draft: { id: string };
    actionTitle?: string;
    gardenName?: string;
    onResume: () => void;
    onDelete: () => void;
  }) =>
    createElement(
      "div",
      { "data-testid": `draft-card-${draft.id}` },
      actionTitle && createElement("span", null, actionTitle),
      gardenName && createElement("span", null, gardenName),
      createElement("button", { "data-testid": `resume-${draft.id}`, onClick: onResume }, "Resume"),
      createElement("button", { "data-testid": `delete-${draft.id}`, onClick: onDelete }, "Delete")
    ),
}));

import { DraftsTab } from "../../views/Home/WorkDashboard/Drafts";

const wrap = (el: React.ReactElement) =>
  createElement(MemoryRouter, null, createElement(IntlProvider, { locale: "en", messages: {} }, el));

describe("DraftsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDraftsState.drafts = [];
    mockDraftsState.isLoading = false;
    mockDraftsState.isDeleting = false;
    mockDraftsState.draftCount = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loading state", () => {
    mockDraftsState.isLoading = true;

    render(wrap(createElement(DraftsTab)));

    expect(screen.getByText(/loading drafts/i)).toBeInTheDocument();
  });

  it("shows empty state when no drafts", () => {
    render(wrap(createElement(DraftsTab)));

    expect(screen.getByText(/no drafts yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/drafts are automatically saved when you start adding photos/i)
    ).toBeInTheDocument();
  });

  it("renders draft cards with action titles and garden names", () => {
    mockDraftsState.drafts = [
      { id: "d1", actionUID: 1, gardenAddress: "0xgarden1", createdAt: Date.now() },
      { id: "d2", actionUID: 2, gardenAddress: "0xgarden2", createdAt: Date.now() },
    ];
    mockDraftsState.draftCount = 2;

    render(wrap(createElement(DraftsTab)));

    expect(screen.getByTestId("draft-card-d1")).toBeInTheDocument();
    expect(screen.getByTestId("draft-card-d2")).toBeInTheDocument();
    expect(screen.getByText("Plant Trees")).toBeInTheDocument();
    expect(screen.getByText("Community Garden")).toBeInTheDocument();
    expect(screen.getByText("Water Garden")).toBeInTheDocument();
    expect(screen.getByText("Rooftop Garden")).toBeInTheDocument();
    expect(screen.getByText(/2 draft\(s\)/i)).toBeInTheDocument();
  });

  it("navigates to garden route on resume", async () => {
    const user = userEvent.setup();
    mockDraftsState.drafts = [
      { id: "d1", actionUID: 1, gardenAddress: "0xgarden1", createdAt: Date.now() },
    ];

    render(wrap(createElement(DraftsTab)));

    await user.click(screen.getByTestId("resume-d1"));
    expect(mockNavigate).toHaveBeenCalledWith("/garden?draftId=d1", { viewTransition: true });
  });

  it("shows confirm dialog on delete and confirms", async () => {
    const user = userEvent.setup();
    mockDraftsState.drafts = [
      { id: "d1", actionUID: 1, gardenAddress: "0xgarden1", createdAt: Date.now() },
    ];
    mockDraftsState.deleteDraft.mockResolvedValue(undefined);

    render(wrap(createElement(DraftsTab)));

    // Click delete on the draft card
    await user.click(screen.getByTestId("delete-d1"));

    // Confirm dialog should appear
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete Draft?")).toBeInTheDocument();

    // Confirm the delete
    await user.click(screen.getByTestId("confirm-delete"));
    expect(mockDraftsState.deleteDraft).toHaveBeenCalledWith("d1");
  });

  it("cancels delete when cancel is clicked", async () => {
    const user = userEvent.setup();
    mockDraftsState.drafts = [
      { id: "d1", actionUID: 1, gardenAddress: "0xgarden1", createdAt: Date.now() },
    ];

    render(wrap(createElement(DraftsTab)));

    await user.click(screen.getByTestId("delete-d1"));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();

    await user.click(screen.getByTestId("cancel-delete"));
    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    expect(mockDraftsState.deleteDraft).not.toHaveBeenCalled();
  });

  it("handles null actionUID and gardenAddress gracefully", () => {
    mockDraftsState.drafts = [
      { id: "d1", actionUID: null, gardenAddress: null, createdAt: Date.now() },
    ];

    render(wrap(createElement(DraftsTab)));

    expect(screen.getByTestId("draft-card-d1")).toBeInTheDocument();
  });
});
