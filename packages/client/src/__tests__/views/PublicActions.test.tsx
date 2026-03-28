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

vi.mock("@green-goods/shared", () => ({
  useActions: (...args: unknown[]) => mockUseActions(...args),
  Domain: { SOLAR: 0, AGRO: 1, EDU: 2, WASTE: 3 },
}));

import ActionsGallery from "../../views/Public/Actions";

const messages: Record<string, string> = {
  "public.actions.title": "Actions",
  "public.actions.description": "Browse available regenerative action templates",
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

  it("renders the page title", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Actions");
  });

  it("renders the page description", () => {
    renderView();
    expect(screen.getByText(/browse available regenerative/i)).toBeInTheDocument();
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
    // Image has alt="" so its accessible role is "presentation", not "img"
    const imgs = screen.getAllByRole("presentation");
    expect(imgs).toHaveLength(1); // Only action-1 has media
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
});
