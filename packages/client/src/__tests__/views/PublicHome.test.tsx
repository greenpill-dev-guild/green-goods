/**
 * Public Home — hero CTA layout tests.
 *
 * Covers the new browser-editorial CTA contract:
 * - Desktop renders only `Explore Gardens`.
 * - Mobile renders the install CTA first, then `Explore Gardens` second.
 *
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUseApp,
  mockUseInstallGuidance,
  mockUsePublicInstallHandler,
  mockInstallHandler,
  mockUsePublicStats,
} = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
  mockUseInstallGuidance: vi.fn(),
  mockUsePublicInstallHandler: vi.fn(),
  mockInstallHandler: vi.fn(),
  mockUsePublicStats: vi.fn(),
}));

vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  useApp: mockUseApp,
  useInstallGuidance: mockUseInstallGuidance,
  usePublicInstallHandler: mockUsePublicInstallHandler,
  usePublicStats: mockUsePublicStats,
  usePublicGardens: () => ({ data: [], isLoading: false }),
}));

// Stub the heavy section components — this test only cares about the hero
// CTAs and their wiring.
vi.mock("@/components/Public/PublicFeaturedGardens", () => ({
  PublicFeaturedGardens: () => createElement("div", { "data-testid": "stub-featured" }),
}));
vi.mock("@/components/Public/PublicProofBand", () => ({
  PublicProofBand: () => createElement("div", { "data-testid": "stub-proof" }),
}));
vi.mock("@/components/Public/PublicFundingBridge", () => ({
  PublicFundingBridge: () => createElement("div", { "data-testid": "stub-funding" }),
}));
vi.mock("@/components/Public/PublicRecordLoop", () => ({
  PublicRecordLoop: () => createElement("div", { "data-testid": "stub-loop" }),
}));
vi.mock("@/components/Public/PublicGetInTouch", () => ({
  PublicGetInTouch: () => createElement("div", { "data-testid": "stub-getintouch" }),
}));
vi.mock("@/components/Public/PublicFooter", () => ({
  PublicFooter: () => createElement("div", { "data-testid": "stub-footer" }),
}));

import Home from "../../views/Public/Home";

const messages: Record<string, string> = {
  "public.home.hero.title.line1": "From good intentions to ",
  "public.home.hero.title.line2": "green outcomes",
  "public.home.hero.title":
    "From <accent>good</accent> intentions to <noBreak><accent>green</accent> outcomes</noBreak>.",
  "public.home.hero.lede":
    "Green Goods makes regenerative work easier to support, turning accessible contributions into a trusted public record of how land, water, and community grow healthier together.",
  "public.home.hero.exploreGardens": "Explore Gardens",
  "public.nav.installApp": "Install App",
  "public.nav.openApp": "Open App",
};

function renderHome() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(IntlProvider, { locale: "en", messages }, createElement(Home))
    )
  );
}

describe("Public Home — hero CTAs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInstallGuidance.mockReturnValue({
      scenario: "desktop",
      primaryAction: { type: "continue-in-browser", label: "Open on Mobile" },
      secondaryAction: null,
      browserInfo: { browser: "unknown" },
      showBrowserOption: false,
      manualInstructions: null,
      browserSwitchReason: null,
      openInBrowserUrl: null,
    });
    mockUsePublicInstallHandler.mockReturnValue(mockInstallHandler);
    mockUsePublicStats.mockReturnValue({
      data: { gardenCount: 0, contributorCount: 0, fieldNoteCount: 0, attestationCount: 0 },
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("desktop: renders only the Explore Gardens CTA in the hero (no Install App)", () => {
    mockUseApp.mockReturnValue({
      isPwaPresentation: false,
      isMobile: false,
      isInstalled: false,
      wasInstalled: false,
      platform: "unknown",
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });

    renderHome();

    const heroHeading = screen.getByRole("heading", { level: 1 });
    expect(heroHeading).toBeInTheDocument();

    const heroSection = heroHeading.closest("section");
    expect(heroSection, "hero <section> should wrap the H1").not.toBeNull();
    const heroCtas = Array.from(heroSection!.querySelectorAll("a, button")).filter(
      (node) => node.getAttribute("aria-label") !== "Green Goods"
    );

    const labels = heroCtas.map((node) => (node.textContent ?? "").trim());
    expect(labels).toContain("Explore Gardens");
    expect(labels).not.toContain("Install App");
    expect(labels).not.toContain("Open App");
  });

  it("accents both good and green in the homepage title", () => {
    mockUseApp.mockReturnValue({
      isPwaPresentation: false,
      isMobile: false,
      isInstalled: false,
      wasInstalled: false,
      platform: "unknown",
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });

    renderHome();

    const heroHeading = screen.getByRole("heading", { level: 1 });
    const accentedWords = Array.from(heroHeading.querySelectorAll("em")).map((node) =>
      (node.textContent ?? "").trim()
    );

    expect(accentedWords).toEqual(["good", "green"]);
    for (const accent of heroHeading.querySelectorAll("em")) {
      expect(accent).toHaveClass("text-primary-dark");
    }
  });

  it("renders the record loop after proof and before the funding bridge", () => {
    mockUseApp.mockReturnValue({
      isPwaPresentation: false,
      isMobile: false,
      isInstalled: false,
      wasInstalled: false,
      platform: "unknown",
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });

    renderHome();

    const proof = screen.getByTestId("stub-proof");
    const funding = screen.getByTestId("stub-funding");
    const loop = screen.getByTestId("stub-loop");

    expect(proof.compareDocumentPosition(loop) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(loop.compareDocumentPosition(funding) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("mobile: renders Install App first, then Explore Gardens second", () => {
    mockUseApp.mockReturnValue({
      isPwaPresentation: false,
      isMobile: true,
      isInstalled: false,
      wasInstalled: false,
      platform: "unknown",
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });

    renderHome();

    const heroHeading = screen.getByRole("heading", { level: 1 });
    const heroSection = heroHeading.closest("section");
    expect(heroSection).not.toBeNull();
    const heroCtas = Array.from(heroSection!.querySelectorAll("a, button")).filter(
      (node) => node.getAttribute("aria-label") !== "Green Goods"
    );
    const ctaLabels = heroCtas.map((node) => (node.textContent ?? "").trim());

    // Order matters: install first, explore second.
    const installIndex = ctaLabels.indexOf("Install App");
    const exploreIndex = ctaLabels.indexOf("Explore Gardens");
    expect(installIndex, "Install App should be present in the hero").toBeGreaterThanOrEqual(0);
    expect(exploreIndex, "Explore Gardens should be present in the hero").toBeGreaterThanOrEqual(0);
    expect(installIndex).toBeLessThan(exploreIndex);
  });

  it("mobile + already installed: shows Open App as the lead CTA", () => {
    mockUseApp.mockReturnValue({
      isPwaPresentation: false,
      isMobile: true,
      isInstalled: true,
      wasInstalled: true,
      platform: "unknown",
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });
    mockUseInstallGuidance.mockReturnValue({
      scenario: "already-installed",
      primaryAction: { type: "open-app", label: "Open App" },
      secondaryAction: null,
      browserInfo: { browser: "unknown" },
      showBrowserOption: false,
      manualInstructions: null,
      browserSwitchReason: null,
      openInBrowserUrl: null,
    });

    renderHome();

    const heroHeading = screen.getByRole("heading", { level: 1 });
    const heroSection = heroHeading.closest("section");
    expect(heroSection).not.toBeNull();
    const heroCtas = Array.from(heroSection!.querySelectorAll("a, button")).filter(
      (node) => node.getAttribute("aria-label") !== "Green Goods"
    );
    const ctaLabels = heroCtas.map((node) => (node.textContent ?? "").trim());

    expect(ctaLabels[0]).toBe("Open App");
    expect(ctaLabels).toContain("Explore Gardens");
  });
});
