/**
 * Public Fund View Tests
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const mockGardens = [
  {
    id: "garden-1",
    name: "Solar Community Garden",
    description: "A solar-powered community garden",
    location: "Austin, TX",
    bannerImage: "https://example.com/banner.jpg",
    operators: [],
    gardeners: ["0x1111", "0x2222"],
    works: [{ id: "work-1" }],
  },
  {
    id: "garden-2",
    name: "Urban Composting Hub",
    description: "Turning waste into soil",
    location: "Portland, OR",
    bannerImage: "",
    operators: [],
    gardeners: ["0x3333"],
    works: [],
  },
];

const mockUseGardens = vi.fn();

vi.mock("@green-goods/shared", () => ({
  useGardens: (...args: unknown[]) => mockUseGardens(...args),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import FundPage from "../../views/Public/Fund";

const messages: Record<string, string> = {
  "public.fund.title": "Fund",
  "public.fund.description": "Support regenerative gardens by funding their vaults",
  "public.fund.deposit": "Deposit",
  "public.fund.cookieJar": "Cookie Jar",
  "public.fund.totalGardens": "Total Gardens",
  "public.fund.totalGardeners": "Total Gardeners",
};

function renderView() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(IntlProvider, { locale: "en", messages }, createElement(FundPage))
    )
  );
}

describe("FundPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false });
  });

  it("renders the page title", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Fund");
  });

  it("renders the page description", () => {
    renderView();
    expect(screen.getByText(/support regenerative gardens/i)).toBeInTheDocument();
  });

  it("renders aggregate stats section", () => {
    renderView();
    expect(screen.getByText("Total Gardens")).toBeInTheDocument();
    expect(screen.getByText("Total Gardeners")).toBeInTheDocument();
  });

  it("renders garden cards in gallery", () => {
    renderView();
    expect(screen.getByText("Solar Community Garden")).toBeInTheDocument();
    expect(screen.getByText("Urban Composting Hub")).toBeInTheDocument();
  });

  it("renders Deposit button for each garden", () => {
    renderView();
    const depositButtons = screen.getAllByRole("button", { name: /deposit/i });
    expect(depositButtons).toHaveLength(2);
  });

  it("renders Cookie Jar button for each garden", () => {
    renderView();
    const cookieButtons = screen.getAllByRole("button", { name: /cookie jar/i });
    expect(cookieButtons).toHaveLength(2);
  });

  it("shows loading skeletons when fetching", () => {
    mockUseGardens.mockReturnValue({ data: [], isLoading: true });
    const { container } = renderView();
    const pulsingElements = container.querySelectorAll(".animate-pulse");
    expect(pulsingElements.length).toBeGreaterThanOrEqual(1);
  });
});
