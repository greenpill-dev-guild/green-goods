/**
 * Public Gardens Gallery View Tests
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
    gardeners: [
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
    ],
    works: [{ id: "work-1" }, { id: "work-2" }, { id: "work-3" }],
  },
  {
    id: "garden-2",
    name: "Urban Composting Hub",
    description: "Turning waste into soil",
    location: "Portland, OR",
    bannerImage: "",
    operators: [],
    gardeners: ["0x3333333333333333333333333333333333333333"],
    works: [],
  },
];

const mockUseGardens = vi.fn();

vi.mock("@green-goods/shared", () => ({
  useGardens: (...args: unknown[]) => mockUseGardens(...args),
}));

// Import after mocks
import GardensGallery from "../../views/Public/Gardens";

const messages: Record<string, string> = {
  "public.gardens.title": "Gardens",
  "public.gardens.description": "Explore regenerative gardens documenting impact on-chain",
  "public.gardens.gardeners": "{count} gardeners",
  "public.gardens.works": "{count} works",
};

function renderView() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(IntlProvider, { locale: "en", messages }, createElement(GardensGallery))
    )
  );
}

describe("GardensGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false });
  });

  it("renders the page title and description", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Gardens");
    expect(screen.getAllByText(/explore regenerative gardens/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders garden cards with names", () => {
    renderView();
    expect(screen.getAllByText("Solar Community Garden").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Urban Composting Hub").length).toBeGreaterThanOrEqual(1);
  });

  it("renders garden descriptions", () => {
    renderView();
    expect(screen.getAllByText("A solar-powered community garden").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getAllByText("Turning waste into soil").length).toBeGreaterThanOrEqual(1);
  });

  it("renders gardener and work counts", () => {
    renderView();
    expect(screen.getAllByText("2 gardeners").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("3 works").length).toBeGreaterThanOrEqual(1);
  });

  it("renders banner image when available", () => {
    const { container } = renderView();
    const imgs = container.querySelectorAll("img");
    // Only garden-1 has a non-empty bannerImage
    expect(imgs.length).toBe(1);
    expect(imgs[0].getAttribute("src")).toBe("https://example.com/banner.jpg");
  });

  it("renders links to garden detail pages", () => {
    renderView();
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(2);
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/gardens/garden-1");
    expect(hrefs).toContain("/gardens/garden-2");
  });

  it("shows skeleton loading state", () => {
    mockUseGardens.mockReturnValue({ data: [], isLoading: true });
    const { container } = renderView();
    const pulsingElements = container.querySelectorAll(".animate-pulse");
    expect(pulsingElements.length).toBeGreaterThanOrEqual(3);
  });

  it("shows truncated garden names with title attribute", () => {
    renderView();
    const gardenHeadings = screen.getAllByText("Solar Community Garden");
    const h3 = gardenHeadings.find((el) => el.tagName === "H3");
    expect(h3).toBeDefined();
    expect(h3!.getAttribute("title")).toBe("Solar Community Garden");
  });
});
