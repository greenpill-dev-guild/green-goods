/**
 * Public Impact Gallery View Tests
 *
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const mockGardens = [
  {
    id: "garden-1",
    name: "Solar Garden",
    gardeners: ["0x1111", "0x2222"],
    assessments: [{ id: "a1" }, { id: "a2" }],
    works: [],
    operators: [],
  },
  {
    id: "garden-2",
    name: "Compost Hub",
    gardeners: ["0x3333"],
    assessments: [{ id: "a3" }],
    works: [],
    operators: [],
  },
];

const mockUseGardens = vi.fn();

vi.mock("@green-goods/shared", () => ({
  useGardens: (...args: unknown[]) => mockUseGardens(...args),
}));

import ImpactGallery from "../../views/Public/Impact";

const messages: Record<string, string> = {
  "public.impact.title": "Impact",
  "public.impact.description": "Protocol-wide regenerative impact metrics",
  "public.impact.totalAssessments": "Total Assessments",
  "public.impact.totalGardens": "Total Gardens",
  "public.impact.totalGardeners": "Total Gardeners",
  "public.impact.hypercertsPlaceholder": "Hypercert gallery coming soon",
};

function renderView() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(IntlProvider, { locale: "en", messages }, createElement(ImpactGallery))
    )
  );
}

describe("ImpactGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false });
  });

  it("renders the page title", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Impact");
  });

  it("renders the page description", () => {
    renderView();
    expect(screen.getByText(/protocol-wide regenerative impact/i)).toBeInTheDocument();
  });

  it("shows total assessments count", () => {
    renderView();
    const label = screen.getByText("Total Assessments");
    expect(label).toBeInTheDocument();
    // 2 from garden-1 + 1 from garden-2 = 3
    // Scope to the parent stat card to avoid ambiguity with other "3" values
    const card = label.closest("div")!;
    expect(within(card).getByText("3")).toBeInTheDocument();
  });

  it("shows total gardens count", () => {
    renderView();
    expect(screen.getByText("Total Gardens")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows total unique gardeners count", () => {
    renderView();
    const label = screen.getByText("Total Gardeners");
    expect(label).toBeInTheDocument();
    // 3 unique addresses across both gardens — scope to parent card
    const card = label.closest("div")!;
    expect(within(card).getByText("3")).toBeInTheDocument();
  });

  it("renders hypercert gallery placeholder", () => {
    renderView();
    expect(screen.getByText(/hypercert gallery coming soon/i)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseGardens.mockReturnValue({ data: [], isLoading: true });
    const { container } = renderView();
    const pulsingElements = container.querySelectorAll(".animate-pulse");
    expect(pulsingElements.length).toBeGreaterThanOrEqual(1);
  });
});
