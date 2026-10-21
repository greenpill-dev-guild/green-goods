/**
 * Public Home — hero CTA layout tests.
 *
 * Covers the browser-editorial CTA contract (DESIGN.browser.md § Homepage):
 * - Desktop renders `Explore Gardens`, then `Support a Garden`; Install App stays in the header.
 * - A phone renders the install CTA first (`Open App` once installed), then `Explore Gardens`.
 *
 * @vitest-environment happy-dom
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
  mockUsePublicCommitmentImpact,
} = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
  mockUseInstallGuidance: vi.fn(),
  mockUsePublicInstallHandler: vi.fn(),
  mockInstallHandler: vi.fn(),
  mockUsePublicStats: vi.fn(),
  mockUsePublicCommitmentImpact: vi.fn(),
}));

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/providers/App", () => ({
  useApp: mockUseApp,
}));

vi.mock("@green-goods/shared/hooks/app/useIsBraveBrowser", () => ({
  useIsBraveBrowser: () => false,
}));

vi.mock("@green-goods/shared/hooks/app/useInstallGuidance", () => ({
  useInstallGuidance: mockUseInstallGuidance,
}));

vi.mock("@green-goods/shared/hooks/app/usePublicInstallHandler", () => ({
  usePublicInstallHandler: mockUsePublicInstallHandler,
}));

vi.mock("@green-goods/shared/hooks/app/useTunnelUrl", () => ({
  useTunnelUrl: () => null,
}));

vi.mock("@green-goods/shared/hooks/public/usePublicStats", () => ({
  usePublicStats: mockUsePublicStats,
}));

vi.mock("@green-goods/shared/hooks/public/usePublicCommitmentImpact", () => ({
  usePublicCommitmentImpact: mockUsePublicCommitmentImpact,
}));

vi.mock("@green-goods/shared/hooks/ui/useInViewReveal", () => ({
  useInViewReveal: () => ({ ref: vi.fn(), revealed: true }),
}));

// Stub the heavy section components — this test only cares about the hero
// CTAs and their wiring.
vi.mock("@/components/Public/PublicFeaturedGardens", () => ({
  PublicFeaturedGardens: () => createElement("div", { "data-testid": "stub-featured" }),
}));
vi.mock("@/components/Public/PublicProofBand", () => ({
  PublicProofBand: (props: { commitmentsKept: bigint | null }) =>
    createElement("div", {
      "data-testid": "stub-proof",
      "data-commitments-kept": String(props.commitmentsKept),
    }),
}));
vi.mock("@/components/Public/PublicFundingBridge", () => ({
  PublicFundingBridge: () => createElement("div", { "data-testid": "stub-funding" }),
}));
vi.mock("@/components/Public/PublicRecordLoop", () => ({
  PublicRecordLoop: () => createElement("div", { "data-testid": "stub-loop" }),
}));
vi.mock("@/components/Public/PublicWhoTendsAGarden", () => ({
  PublicWhoTendsAGarden: () => createElement("div", { "data-testid": "stub-who" }),
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
    "<line>From <accent>good</accent></line> <line>intentions to</line> <line><accent>green</accent> outcomes</line>",
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

/** The hero's actions in document order, with the label each one shows. */
function heroCtas() {
  const heroSection = screen.getByRole("heading", { level: 1 }).closest("section");
  expect(heroSection, "hero <section> should wrap the H1").not.toBeNull();
  const nodes = Array.from(heroSection!.querySelectorAll("a, button"));
  return { nodes, labels: nodes.map((node) => (node.textContent ?? "").trim()) };
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
    mockUsePublicCommitmentImpact.mockReturnValue({
      data: { commitmentsMade: 18n, commitmentsFulfilled: 2n },
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("desktop: pairs Explore Gardens with Support a Garden and keeps Install App out of the hero", () => {
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

    const { nodes, labels } = heroCtas();
    expect(labels).toEqual(["Explore Gardens", "Support a Garden"]);
    expect(nodes[0]).toHaveAttribute("href", "/gardens");
    expect(nodes[1]).toHaveAttribute("href", "/fund");
  });

  it("keeps the public homepage visible even when PWA presentation is detected", () => {
    mockUseApp.mockReturnValue({
      isPwaPresentation: true,
      isMobile: false,
      isInstalled: true,
      wasInstalled: true,
      platform: "unknown",
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });

    renderHome();

    // Anchored: a string argument matches part of the text and would let a closing period back in.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /^From good intentions to green outcomes$/
    );
    expect(screen.queryByText("Create your account")).not.toBeInTheDocument();
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

  it("renders the eight canonical sections in order", () => {
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

    // Hero (asserted via H1 elsewhere) is section 1; the stubbed sections
    // pin the remaining order. DESIGN.browser.md § Homepage is the canon —
    // a section added or removed here must change that list too.
    const orderedStubs = [
      "stub-featured",
      "stub-proof",
      "stub-loop",
      "stub-who",
      "stub-funding",
      "stub-getintouch",
      "stub-footer",
    ].map((id) => screen.getByTestId(id));

    for (let i = 0; i < orderedStubs.length - 1; i++) {
      expect(
        orderedStubs[i].compareDocumentPosition(orderedStubs[i + 1]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        `${orderedStubs[i].dataset.testid} should precede ${orderedStubs[i + 1].dataset.testid}`
      ).toBeTruthy();
    }
  });

  // The record band's commitment figure comes from its own read; a read that
  // settled without data must reach the band as unknown, never as zero.
  it.each([
    ["the snapshot", { data: { commitmentsMade: 18n, commitmentsFulfilled: 2n } }, "2"],
    ["a read that settled without data", { data: undefined }, "null"],
  ])("hands the kept commitments from %s to the record band", (_, read, kept) => {
    mockUseApp.mockReturnValue({
      isPwaPresentation: false,
      isMobile: false,
      isInstalled: false,
      wasInstalled: false,
      platform: "unknown",
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });
    mockUsePublicCommitmentImpact.mockReturnValue({ ...read, isLoading: false });

    renderHome();

    expect(screen.getByTestId("stub-proof")).toHaveAttribute("data-commitments-kept", kept);
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

  it.each([
    {
      state: "before install",
      isInstalled: false,
      scenario: "manual-install-available",
      installAction: "show-manual-steps",
      lead: "Install App",
    },
    {
      state: "once installed",
      isInstalled: true,
      scenario: "already-installed",
      installAction: "open-app",
      lead: "Open App",
    },
  ])("phone, $state: leads with $lead, then Explore Gardens", ({
    isInstalled,
    scenario,
    installAction,
    lead,
  }) => {
    mockUseApp.mockReturnValue({
      isPwaPresentation: false,
      isMobile: true,
      isInstalled,
      wasInstalled: isInstalled,
      platform: "unknown",
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });
    mockUseInstallGuidance.mockReturnValue({
      scenario,
      primaryAction: { type: installAction, label: lead },
      secondaryAction: null,
      browserInfo: { browser: "unknown" },
      showBrowserOption: false,
      manualInstructions: null,
      browserSwitchReason: null,
      openInBrowserUrl: null,
    });

    renderHome();

    const { nodes, labels } = heroCtas();
    expect(labels).toEqual([lead, "Explore Gardens"]);
    // The shared install action owns the lead, so its click and label stay one source of truth.
    expect(nodes[0]).toHaveAttribute("data-install-action", installAction);
    expect(nodes[1]).toHaveAttribute("href", "/gardens");
  });
});
