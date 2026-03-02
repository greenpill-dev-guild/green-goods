import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Actions from "@/views/Actions";
import enMessages from "../../../../shared/src/i18n/en.json";

const mockUseActions = vi.fn();
const mockUseFilteredActions = vi.fn();

vi.mock("@green-goods/shared", () => ({
  DEFAULT_CHAIN_ID: 42161,
  Domain: {
    SOLAR: 0,
    AGRO: 1,
    EDU: 2,
    WASTE: 3,
  },
  formatDate: () => "Jan 1",
  useFilteredActions: (...args: unknown[]) => mockUseFilteredActions(...args),
  ImageWithFallback: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt, "data-testid": "image-with-fallback" }),
}));

vi.mock("@green-goods/shared/hooks", () => ({
  useActions: () => mockUseActions(),
}));

vi.mock("@green-goods/shared/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/components/Layout/PageHeader", () => ({
  PageHeader: ({
    title,
    description,
    actions,
    toolbar,
  }: {
    title: string;
    description: string;
    actions?: React.ReactNode;
    toolbar?: React.ReactNode;
  }) =>
    React.createElement(
      "div",
      {},
      React.createElement("h1", {}, title),
      React.createElement("p", {}, description),
      React.createElement("div", {}, actions),
      React.createElement("div", {}, toolbar)
    ),
}));

vi.mock("@/components/ui/EmptyState", () => ({
  EmptyState: ({ title }: { title: string }) => React.createElement("div", {}, title),
}));

vi.mock("@/components/ui/ListToolbar", () => ({
  ListToolbar: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", {}, children),
}));

vi.mock("@/components/ui/SortSelect", () => ({
  SortSelect: () => React.createElement("div", {}, "Sort"),
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

  it("shows image placeholder card when media is missing", () => {
    const mockRefetch = vi.fn();
    mockUseActions.mockReturnValue({
      data: [ACTION_FIXTURE],
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });

    renderWithIntl(React.createElement(Actions));

    expect(screen.getByText("Image unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("This action does not currently have a valid image.")
    ).toBeInTheDocument();
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
