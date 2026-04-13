import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Actions from "@/views/Actions";
import { en as enMessages } from "@green-goods/shared";

const mockUseActions = vi.fn();
const mockUseFilteredActions = vi.fn();
const mockSetFilter = vi.fn();
const mockResetFilters = vi.fn();
const mockUseFabConfig = vi.fn();

vi.mock("@green-goods/shared", () => ({
  DEFAULT_CHAIN_ID: 42161,
  Domain: {
    SOLAR: 0,
    AGRO: 1,
    EDU: 2,
    WASTE: 3,
  },
  DOMAIN_CONFIG: {
    0: { labelId: "app.domain.tab.solar", colors: { bg: "", text: "", border: "" } },
    1: { labelId: "app.domain.tab.agro", colors: { bg: "", text: "", border: "" } },
    2: { labelId: "app.domain.tab.education", colors: { bg: "", text: "", border: "" } },
    3: { labelId: "app.domain.tab.waste", colors: { bg: "", text: "", border: "" } },
  },
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
    React.createElement("button", { onClick }, children),
  CanvasWorkbenchList: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement("div", props, children),
  CanvasWorkbenchRow: ({
    title,
    description,
    statusLabel,
    meta,
    onClick,
  }: {
    title: string;
    description: string;
    statusLabel?: string;
    meta?: string[];
    onClick?: () => void;
  }) =>
    React.createElement(
      "button",
      { type: "button", onClick },
      React.createElement("h2", {}, title),
      React.createElement("p", {}, description),
      statusLabel ? React.createElement("span", {}, statusLabel) : null,
      meta?.length ? React.createElement("span", {}, meta.join(" | ")) : null
    ),
  EmptyState: ({ title }: { title: string }) => React.createElement("div", {}, title),
  adminRoutes: {
    actions: () => "/actions",
    actionCreate: () => "/actions/create",
    actionDetail: (id: string) => `/actions/${id}`,
  },
  en: {},
  formatDate: () => "Jan 1",
  useActions: () => mockUseActions(),
  useFabConfig: (...args: unknown[]) => mockUseFabConfig(...args),
  useFilteredActions: (...args: unknown[]) => mockUseFilteredActions(...args),
  useRole: () => ({ role: "deployer" }),
  useUrlFilters: () => ({
    filters: {},
    setFilter: mockSetFilter,
    resetFilters: mockResetFilters,
  }),
}));

vi.mock("@/components/AdminTabRail", () => ({
  AdminTabRail: () => React.createElement("div", { "data-testid": "stage-rail" }),
}));

vi.mock("@/components/AdminSearchToolbar", () => ({
  AdminSearchToolbar: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "search-toolbar" }, children),
}));

vi.mock("@/components/AdminFilterChip", () => ({
  AdminFilterChip: ({ label, selected }: { label: string; selected: boolean }) =>
    React.createElement("button", { "data-selected": selected }, label),
}));

vi.mock("@/components/Layout/PageHeader", () => ({
  PageHeader: ({
    title,
    description,
    actions,
    toolbar,
    children,
  }: {
    title: string;
    description: string;
    actions?: React.ReactNode;
    toolbar?: React.ReactNode;
    children?: React.ReactNode;
  }) =>
    React.createElement(
      "div",
      {},
      React.createElement("h1", {}, title),
      React.createElement("p", {}, description),
      React.createElement("div", {}, actions),
      React.createElement("div", {}, toolbar),
      React.createElement("div", {}, children)
    ),
}));

vi.mock("@remixicon/react", () => {
  const Icon = (props: unknown) => React.createElement("span", props as object);
  return new Proxy({}, { get: () => Icon });
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
      React.createElement("a", { href: to, ...props }, children),
  };
});

function renderWithIntl(ui: React.ReactElement) {
  return render(React.createElement(IntlProvider, { locale: "en", messages: enMessages }, ui));
}

const ACTION_FIXTURE = {
  id: "42161-1",
  slug: "solar.site_setup",
  startTime: 1700000000000,
  endTime: 1800000000000,
  title: "Site Setup",
  instructions: "ipfs://example",
  capitals: [],
  media: [],
  domain: 0,
  createdAt: 1700000000000,
  description: "Test action",
  inputs: [],
  mediaInfo: {
    title: "Capture Media",
    description: "Take photos to document your work",
    maxImageCount: 5,
    minImageCount: 1,
    required: true,
    needed: [],
    optional: [],
  },
  details: {
    title: "Details",
    description: "",
    feedbackPlaceholder: "",
    inputs: [],
  },
  review: {
    title: "Review",
    description: "",
  },
};

describe("Actions View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFilteredActions.mockImplementation((actions: unknown[]) => ({
      filteredActions: actions,
      isFilterActive: false,
      activeFilterCount: 0,
    }));
  });

  it("renders a registry row when media is missing", () => {
    const mockRefetch = vi.fn();
    mockUseActions.mockReturnValue({
      data: [ACTION_FIXTURE],
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });

    renderWithIntl(React.createElement(Actions));

    expect(screen.getByRole("heading", { name: "Site Setup" })).toBeInTheDocument();
    expect(screen.getByText("Test action")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("triggers refetch when refresh is clicked", () => {
    const mockRefetch = vi.fn();
    mockUseActions.mockReturnValue({
      data: [ACTION_FIXTURE],
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });

    renderWithIntl(React.createElement(Actions));

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
