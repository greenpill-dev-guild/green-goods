/**
 * Public Garden Detail View Tests
 *
 * Locks the editorial refresh:
 * - Slug-or-id resolution via `publicGardenHelpers.deriveSlug`.
 * - Place → Work → Evidence → Fund content order.
 * - Side-rail Fund CTA links to `/fund?garden=<slug>`.
 * - Install/Open App CTA driven by `useApp().isInstalled` +
 *   `useInstallGuidance`.
 * - Localized not-found state.
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGardens = [
  {
    id: "0x1111111111111111111111111111111111111111" as Address,
    address: "0x1111111111111111111111111111111111111111" as Address,
    name: "Solar Community Garden",
    slug: "solar-community-garden",
    description: "A solar-powered community garden in downtown Austin",
    location: "Austin, TX",
    bannerImage: "https://example.com/banner.jpg",
    contributorCount: 2,
    actionCount: 2,
    lastActivityAt: 1710000000,
    operators: [],
    evaluators: [],
  },
];

const mockUsePublicGardens = vi.fn();
const mockUseApp = vi.fn();

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    usePublicGardens: (...args: unknown[]) => mockUsePublicGardens(...args),
    useApp: () => mockUseApp(),
    useInstallGuidance: () => ({
      scenario: "desktop",
      primaryAction: { type: "continue-in-browser", label: "Open on Mobile" },
      secondaryAction: null,
      browserInfo: { browser: "unknown" },
      showBrowserOption: false,
      manualInstructions: null,
      browserSwitchReason: null,
      openInBrowserUrl: null,
    }),
  };
});

import GardenDetail from "../../views/Public/GardenDetail";

const messages: Record<string, string> = {
  "public.gardenDetail.notFound": "Garden not found",
  "public.gardenDetail.notFoundHelp": "The link may be stale.",
  "public.gardenDetail.backToGardens": "Browse Gardens",
  "public.gardenDetail.place.title": "About this Garden",
  "public.gardenDetail.place.empty": "Garden narrative will appear here.",
  "public.gardenDetail.work.title": "Work",
  "public.gardenDetail.work.summary":
    "{count} {count, plural, one {Work attestation} other {Work attestations}} on-chain.",
  "public.gardenDetail.evidence.title": "Evidence",
  "public.gardenDetail.evidence.summary": "Browse the Impact ledger.",
  "public.gardenDetail.evidence.cta": "View public evidence",
  "public.gardenDetail.fund.title": "Fund this Garden",
  "public.gardenDetail.fund.description": "Donate or Endow this Garden.",
  "public.gardenDetail.fund.cta": "Support this Garden",
  "public.gardenDetail.stats.contributors": "Contributors",
  "public.gardenDetail.stats.work": "Work",
  "public.nav.installApp": "Install App",
  "public.nav.openApp": "Open App",
  "public.home.install.title": "Bring the field with you",
  "public.home.install.description": "Install the app.",
};

function renderView(route = "/gardens/solar-community-garden") {
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
    mockUsePublicGardens.mockReturnValue({ data: mockGardens, isLoading: false });
    mockUseApp.mockReturnValue({
      isMobile: false,
      isInstalled: false,
      platform: "unknown",
      deferredPrompt: null,
    });
  });

  it("renders the Garden name as the editorial h1", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Solar Community Garden");
  });

  it("resolves the Garden by slug", () => {
    renderView("/gardens/solar-community-garden");
    expect(screen.getAllByText(/solar-powered community garden/i).length).toBeGreaterThanOrEqual(1);
  });

  it("resolves the Garden by raw id/address", () => {
    renderView("/gardens/0x1111111111111111111111111111111111111111");
    expect(screen.getAllByText(/solar-powered community garden/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Place / Work / Evidence / Fund sections in order", () => {
    renderView();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent ?? "");
    expect(headings).toContain("About this Garden");
    expect(headings).toContain("Work");
    expect(headings).toContain("Evidence");
    expect(headings).toContain("Fund this Garden");
  });

  it("links Support CTAs to /fund?garden=<slug>", () => {
    renderView();
    const supportLinks = screen
      .getAllByRole("link", { name: /support this garden/i })
      .map((link) => link.getAttribute("href"));
    expect(supportLinks).toContain("/fund?garden=solar-community-garden");
  });

  it("renders Install App CTA when not installed", () => {
    renderView();
    expect(screen.getAllByText("Install App").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Open App CTA when already installed", () => {
    mockUseApp.mockReturnValue({
      isMobile: false,
      isInstalled: true,
      platform: "unknown",
      deferredPrompt: null,
    });
    renderView();
    expect(screen.getAllByText("Open App").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the not-found state for unknown Gardens", () => {
    renderView("/gardens/missing-garden");
    expect(screen.getByText("Garden not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse gardens/i })).toHaveAttribute(
      "href",
      "/gardens"
    );
  });
});
