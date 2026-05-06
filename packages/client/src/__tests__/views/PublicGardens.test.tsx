/**
 * Public Gardens View Tests
 *
 * Locks the editorial refresh:
 * - Pulls Garden summaries from `usePublicGardens` (PublicGardenSummary shape).
 * - Editorial header + featured row + browse with search input.
 * - Cards link to `/gardens/<slug>` (slug, not id).
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGardens = [
  {
    id: "0x1111111111111111111111111111111111111111" as Address,
    address: "0x1111111111111111111111111111111111111111" as Address,
    name: "Solar Community Garden",
    slug: "solar-community-garden",
    description: "A solar-powered community garden",
    location: "Austin, TX",
    bannerImage: "https://example.com/banner.jpg",
    contributorCount: 2,
    actionCount: 3,
    lastActivityAt: 1710000000,
    operators: [],
    evaluators: [],
  },
  {
    id: "0x2222222222222222222222222222222222222222" as Address,
    address: "0x2222222222222222222222222222222222222222" as Address,
    name: "Urban Composting Hub",
    slug: "urban-composting-hub",
    description: "Turning waste into soil",
    location: "Portland, OR",
    bannerImage: "",
    contributorCount: 1,
    actionCount: 0,
    lastActivityAt: 1690000000,
    operators: [],
    evaluators: [],
  },
];

const mockUsePublicGardens = vi.fn();

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    usePublicGardens: (...args: unknown[]) => mockUsePublicGardens(...args),
  };
});

import GardensGallery from "../../views/Public/Gardens";

const messages: Record<string, string> = {
  "public.gardens.heroTitle": "Explore the Gardens growing the public record.",
  "public.gardens.heroLede":
    "Each Garden is a real place where communities document regenerative Work, gather evidence, and make support visible.",
  "public.gardens.archiveTitle": "Browse every Garden under documentation.",
  "public.gardens.kicker": "Living Archive",
  "public.gardens.searchLabel": "Search Gardens",
  "public.gardens.searchPlaceholder": "Search Gardens…",
  "public.gardens.empty": "Gardens will appear here as they come online.",
  "public.gardens.noMatches": 'No Gardens match "{query}".',
  "public.gardens.gardeners": "{count} gardeners",
  "public.gardens.works": "{count} entries",
  "public.gardens.archiveCount":
    "{count, plural, one {# Garden} other {# Gardens}} · updated daily",
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
    mockUsePublicGardens.mockReturnValue({ data: mockGardens, isLoading: false });
  });

  it("renders the editorial hero, kicker, and lede", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /explore the gardens growing the public record/i
    );
    expect(
      screen.getByText(/each garden is a real place where communities document regenerative work/i)
    ).toBeInTheDocument();
    // Living Archive kicker now lives over the archive section, not the hero.
    expect(screen.getByText("Living Archive")).toBeInTheDocument();
  });

  it("renders Garden cards with names and contributor / entry counts", () => {
    renderView();
    expect(screen.getAllByText("Solar Community Garden").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Urban Composting Hub").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2 gardeners").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("3 entries").length).toBeGreaterThanOrEqual(1);
  });

  it("links cards to `/gardens/<slug>`", () => {
    renderView();
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/gardens/solar-community-garden");
    expect(hrefs).toContain("/gardens/urban-composting-hub");
  });

  it("shows the search input and filters cards by query", async () => {
    const user = userEvent.setup();
    renderView();
    const searchInput = screen.getByLabelText("Search Gardens");
    await user.type(searchInput, "compost");
    // Solar Community Garden should disappear from the filtered grid (still
    // appears in the featured row above, which is unfiltered).
    const solar = screen.queryAllByText("Solar Community Garden");
    expect(solar.length).toBeLessThan(2); // featured only, no longer in browse grid
    expect(screen.getAllByText("Urban Composting Hub").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the no-matches message when the query has zero hits", async () => {
    const user = userEvent.setup();
    renderView();
    await user.type(screen.getByLabelText("Search Gardens"), "zzzzzzzz");
    expect(screen.getByText('No Gardens match "zzzzzzzz".')).toBeInTheDocument();
  });

  it("shows the empty state when no Gardens are loaded", () => {
    mockUsePublicGardens.mockReturnValue({ data: [], isLoading: false });
    renderView();
    expect(screen.getByText("Gardens will appear here as they come online.")).toBeInTheDocument();
  });

  it("shows skeletons during loading", () => {
    mockUsePublicGardens.mockReturnValue({ data: [], isLoading: true });
    const { container } = renderView();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(3);
  });
});
