/**
 * PublicFeaturedGardens — featured Gardens section on the public homepage.
 *
 * Tests the homepage masonry contract:
 * - Renders four cards (not three) when enough gardens are available.
 * - Prefers image-backed gardens over placeholder-only ones.
 * - Avoids fake stagger offsets while keeping varied card sizes.
 * - Falls back gracefully when fewer than four are available.
 *
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PLACEHOLDER_BANNER = "/images/no-image-placeholder.png";

const { mockUsePublicGardens } = vi.hoisted(() => ({
  mockUsePublicGardens: vi.fn(),
}));

vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  usePublicGardens: mockUsePublicGardens,
}));

vi.mock("@/components/Display", () => ({
  ImageWithFallback: ({ alt }: { alt: string }) =>
    createElement("img", { alt, "data-testid": "garden-image" }),
}));

import { PublicFeaturedGardens } from "../../components/Public/PublicFeaturedGardens";

const messages: Record<string, string> = {
  "public.home.featured.kicker": "§ 01 — Featured Gardens",
  "public.home.featured.title": "Tended places, openly recorded.",
  "public.home.featured.cta": "Browse all Gardens",
  "public.home.featured.empty": "Featured Gardens will appear here as they come online.",
  "public.gardens.gardeners": "{count} gardeners",
  "public.gardens.works": "{count} entries",
};

interface MakeGardenOptions {
  id: string;
  bannerImage?: string;
  lastActivityAt?: number;
  name?: string;
}

function makeGarden({
  id,
  bannerImage = "https://example.test/banner.jpg",
  lastActivityAt = 1_700_000_000,
  name,
}: MakeGardenOptions) {
  return {
    id,
    address: id,
    name: name ?? `Garden ${id}`,
    slug: `garden-${id}`,
    location: "Anywhere",
    bannerImage,
    description: "A test garden",
    lastActivityAt,
    actionCount: 5,
    contributorCount: 3,
    operators: [],
    evaluators: [],
  };
}

function renderSection() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(IntlProvider, { locale: "en", messages }, createElement(PublicFeaturedGardens))
    )
  );
}

describe("PublicFeaturedGardens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders four garden cards in the masonry grid when enough gardens are available", () => {
    mockUsePublicGardens.mockReturnValue({
      data: [
        makeGarden({ id: "0x1" }),
        makeGarden({ id: "0x2" }),
        makeGarden({ id: "0x3" }),
        makeGarden({ id: "0x4" }),
        makeGarden({ id: "0x5" }),
      ],
      isLoading: false,
    });

    renderSection();

    const grid = screen.getByTestId("public-featured-grid");
    expect(grid.querySelectorAll("a").length).toBe(4);
  });

  it("uses natural masonry columns without artificial stagger offsets", () => {
    mockUsePublicGardens.mockReturnValue({
      data: [
        makeGarden({ id: "0x1" }),
        makeGarden({ id: "0x2" }),
        makeGarden({ id: "0x3" }),
        makeGarden({ id: "0x4" }),
      ],
      isLoading: false,
    });

    renderSection();

    const grid = screen.getByTestId("public-featured-grid");
    const wrappers = Array.from(grid.children);
    expect(wrappers.length).toBe(4);
    expect(wrappers.every((node) => !node.className.includes("sm:pt-12"))).toBe(true);
    expect(wrappers.every((node) => !node.className.includes("sm:-mt-6"))).toBe(true);
  });

  it("prefers image-backed gardens over placeholder-only gardens", () => {
    mockUsePublicGardens.mockReturnValue({
      data: [
        makeGarden({ id: "0xa", bannerImage: PLACEHOLDER_BANNER, name: "Placeholder One" }),
        makeGarden({ id: "0xb", bannerImage: PLACEHOLDER_BANNER, name: "Placeholder Two" }),
        makeGarden({ id: "0xc", bannerImage: "https://example.test/c.jpg", name: "Imaged C" }),
        makeGarden({ id: "0xd", bannerImage: "https://example.test/d.jpg", name: "Imaged D" }),
        makeGarden({ id: "0xe", bannerImage: "https://example.test/e.jpg", name: "Imaged E" }),
        makeGarden({ id: "0xf", bannerImage: "https://example.test/f.jpg", name: "Imaged F" }),
      ],
      isLoading: false,
    });

    renderSection();

    const grid = screen.getByTestId("public-featured-grid");
    const labels = Array.from(grid.querySelectorAll("a")).map((node) =>
      node.getAttribute("aria-label")
    );
    expect(labels).toEqual(
      expect.arrayContaining(["Imaged C", "Imaged D", "Imaged E", "Imaged F"])
    );
    expect(labels).not.toContain("Placeholder One");
    expect(labels).not.toContain("Placeholder Two");
  });

  it("renders fewer cards (no padding) when the data set is small", () => {
    mockUsePublicGardens.mockReturnValue({
      data: [makeGarden({ id: "0x1" }), makeGarden({ id: "0x2" })],
      isLoading: false,
    });

    renderSection();

    const grid = screen.getByTestId("public-featured-grid");
    expect(grid.querySelectorAll("a").length).toBe(2);
  });

  it("renders the empty state when no gardens are available", () => {
    mockUsePublicGardens.mockReturnValue({ data: [], isLoading: false });

    renderSection();

    expect(screen.queryByTestId("public-featured-grid")).toBeNull();
    expect(
      screen.getByText("Featured Gardens will appear here as they come online.")
    ).toBeInTheDocument();
  });

  it("renders four loading skeletons while data is loading", () => {
    mockUsePublicGardens.mockReturnValue({ data: undefined, isLoading: true });

    renderSection();

    const skeleton = screen.getByTestId("public-featured-loading");
    expect(skeleton.children.length).toBe(4);
  });
});
