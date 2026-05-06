/**
 * Public Actions Gallery View Tests
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const mockActions = [
  {
    id: "action-1",
    slug: "tree-planting",
    title: "Tree Planting",
    description: "Plant native trees to restore ecosystems",
    domain: 1, // AGRO
    capitals: [3], // LIVING
    media: ["https://example.com/tree.jpg"],
    startTime: 1700000000,
    endTime: 1800000000,
    createdAt: 1700000000,
  },
  {
    id: "action-2",
    slug: "solar-install",
    title: "Solar Panel Installation",
    description: "Install solar panels for clean energy",
    domain: 0, // SOLAR
    capitals: [1, 2], // MATERIAL, FINANCIAL
    media: [],
    startTime: 1700000000,
    endTime: 1800000000,
    createdAt: 1700000000,
  },
];

const mockUseActions = vi.fn();

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");

  return {
    ...actual,
    useActions: (...args: unknown[]) => mockUseActions(...args),
    Domain: { SOLAR: 0, AGRO: 1, EDU: 2, WASTE: 3 },
  };
});

import ActionsGallery from "../../views/Public/Actions";

const messages: Record<string, string> = {
  "app.domain.tab.agro": "Agro",
  "app.domain.tab.education": "Education",
  "app.domain.tab.solar": "Solar",
  "app.domain.tab.waste": "Waste",
  "public.actions.heroTitle": "A field guide for regenerative work.",
  "public.actions.heroLede":
    "Actions are the templates Gardens use to document Work across solar, agroforestry, education, and waste.",
  "public.actions.gridTitle": "Templates Gardens use to plan and document Work.",
  "public.actions.kicker": "Field guide",
  "public.actions.domain.unknown": "Unknown",
  "public.actions.empty": "Action templates will appear here as they are published.",
};

function renderView() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(IntlProvider, { locale: "en", messages }, createElement(ActionsGallery))
    )
  );
}

describe("ActionsGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActions.mockReturnValue({ data: mockActions, isLoading: false });
  });

  it("renders the editorial hero title", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /a field guide for regenerative work/i
    );
  });

  it("renders the editorial hero lede", () => {
    renderView();
    expect(
      screen.getByText(
        /actions are the templates gardens use to document work across solar, agroforestry/i
      )
    ).toBeInTheDocument();
  });

  it("renders action cards with titles", () => {
    renderView();
    expect(screen.getByText("Tree Planting")).toBeInTheDocument();
    expect(screen.getByText("Solar Panel Installation")).toBeInTheDocument();
  });

  it("renders action descriptions", () => {
    renderView();
    expect(screen.getByText("Plant native trees to restore ecosystems")).toBeInTheDocument();
    expect(screen.getByText("Install solar panels for clean energy")).toBeInTheDocument();
  });

  it("renders action media when available", () => {
    renderView();
    expect(screen.getByRole("img", { name: "Tree Planting" })).toBeInTheDocument();
  });

  it("shows loading skeletons", () => {
    mockUseActions.mockReturnValue({ data: [], isLoading: true });
    const { container } = renderView();
    const pulsingElements = container.querySelectorAll(".animate-pulse");
    expect(pulsingElements.length).toBeGreaterThanOrEqual(3);
  });

  it("is read-only with no create/edit buttons", () => {
    renderView();
    expect(screen.queryByRole("button", { name: /create/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("shows an empty state when no actions are available", () => {
    mockUseActions.mockReturnValue({ data: [], isLoading: false });
    renderView();
    expect(
      screen.getByText("Action templates will appear here as they are published.")
    ).toBeInTheDocument();
  });
});
