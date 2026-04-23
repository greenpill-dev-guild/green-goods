/**
 * Public Garden Detail View Tests
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const mockGardens = [
  {
    id: "garden-1",
    name: "Solar Community Garden",
    description: "A solar-powered community garden in downtown Austin",
    location: "Austin, TX",
    bannerImage: "https://example.com/banner.jpg",
    operators: [],
    gardeners: [
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
    ],
    works: [{ id: "work-1" }, { id: "work-2" }],
  },
];

const mockUseGardens = vi.fn();

vi.mock("@green-goods/shared", () => ({
  useGardens: (...args: unknown[]) => mockUseGardens(...args),
}));

import GardenDetail from "../../views/Public/GardenDetail";

const messages: Record<string, string> = {
  "public.gardens.title": "Gardens",
  "public.gardens.join": "Join this Garden",
  "public.gardens.gardeners": "{count} gardeners",
  "public.gardens.works": "{count} works",
  "public.gardenDetail.notFound": "Garden not found",
  "public.gardenDetail.location": "Location",
};

function renderView(route = "/gardens/garden-1") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [route] },
      createElement(
        IntlProvider,
        { locale: "en", messages },
        createElement(
          Routes,
          null,
          createElement(Route, { path: "/gardens/:id", element: createElement(GardenDetail) })
        )
      )
    )
  );
}

describe("GardenDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false });
  });

  it("renders the garden name as heading", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Solar Community Garden");
  });

  it("renders the garden description", () => {
    renderView();
    expect(screen.getByText(/solar-powered community garden/i)).toBeInTheDocument();
  });

  it("renders the garden location", () => {
    renderView();
    expect(screen.getByText("Austin, TX")).toBeInTheDocument();
  });

  it("renders banner image", () => {
    const { container } = renderView();
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("https://example.com/banner.jpg");
  });

  it("shows gardener and work counts", () => {
    renderView();
    expect(screen.getByText("2 gardeners")).toBeInTheDocument();
    expect(screen.getByText("2 works")).toBeInTheDocument();
  });

  it("routes the Join CTA into the authenticated app garden", () => {
    renderView();
    expect(screen.getByRole("link", { name: /join this garden/i })).toHaveAttribute(
      "href",
      "/home/garden-1"
    );
  });

  it("shows not-found message for unknown garden", () => {
    renderView("/gardens/nonexistent");
    expect(screen.getByText("Garden not found")).toBeInTheDocument();
  });
});
