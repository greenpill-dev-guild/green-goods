/**
 * Impact View — Phase 3 Evaluation Contract
 *
 * Defines the behavioral contract for the /impact view in Phase 3 (Public Platform).
 * Some tests verify existing behavior, others define new requirements that will FAIL
 * until Phase 3 implementation is complete.
 *
 * Phase 3 requirements:
 * - Protocol-wide assessment count (exists)
 * - Hypercert gallery in responsive grid (NEW — currently a placeholder)
 * - Correct responsive breakpoints: 3 desktop, 2 tablet, 1 mobile (NEW)
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

describe("ImpactGallery — Phase 3 contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false });
  });

  it("renders protocol-wide assessment count", () => {
    renderView();

    const label = screen.getByText("Total Assessments");
    expect(label).toBeInTheDocument();

    // 2 from garden-1 + 1 from garden-2 = 3
    const card = label.closest("div")!;
    expect(card.textContent).toContain("3");
  });

  it("renders hypercert gallery in responsive grid", () => {
    renderView();

    // Phase 3: should render actual hypercert cards in a grid, not just a placeholder
    // Look for a grid container with hypercert items
    const hypercertGrid = document.querySelector("[data-testid='hypercert-gallery']");
    expect(hypercertGrid).toBeInTheDocument();

    // Should have actual hypercert card elements (not just "coming soon")
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it("uses correct responsive breakpoints (3 desktop, 2 tablet, 1 mobile)", () => {
    renderView();

    // Phase 3: the hypercert gallery grid should use the standard responsive breakpoints
    // per frontend-design Rule 11: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
    const hypercertGrid = document.querySelector("[data-testid='hypercert-gallery']");
    expect(hypercertGrid).toBeInTheDocument();

    const classes = hypercertGrid!.className;
    // Must include sm: breakpoint (Rule 11: never skip from 1-col to md:)
    expect(classes).toMatch(/grid-cols-1/);
    expect(classes).toMatch(/sm:grid-cols-2/);
    expect(classes).toMatch(/lg:grid-cols-3/);
  });
});
