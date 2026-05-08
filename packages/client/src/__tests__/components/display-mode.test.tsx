/**
 * Display Mode Tests — AppBar visibility based on display-mode
 *
 * Verifies the browser vs. PWA distinction (D6 rule):
 * - Browser = website (SiteHeader top nav, no bottom nav)
 * - Installed PWA = app (AppBar bottom nav)
 *
 * The AppBar component checks `isPwaPresentation` from `useApp()` and hides
 * itself in browser mode via `shouldHideBar = !isPwaPresentation || ...`.
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const mockUseApp = vi.fn();
const mockUsePendingWorksCount = vi.fn();
const mockUseUIStore = vi.fn();

vi.mock("@green-goods/shared", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
  SyncStatusBar: ({ className }: { className?: string }) =>
    createElement("div", { "data-testid": "sync-status-bar", className }),
  useApp: () => mockUseApp(),
  usePendingWorksCount: () => mockUsePendingWorksCount(),
  useUIStore: (selector: (s: any) => any) => mockUseUIStore(selector),
  APP_NAME: "Green Goods",
  useAppKit: () => ({ open: vi.fn() }),
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
  usePublicInstallHandler: () => vi.fn(),
  useEventListener: vi.fn(),
}));

import { AppBar } from "../../components/Layout/AppBar";
import { SiteHeader } from "../../components/Navigation/SiteHeader";

const appBarMessages: Record<string, string> = {
  "app.home": "Home",
  "app.garden": "Garden",
  "app.profile": "Profile",
};

const siteHeaderMessages: Record<string, string> = {
  "public.nav.gardens": "Gardens",
  "public.nav.actions": "Actions",
  "public.nav.impact": "Impact",
  "public.nav.fund": "Fund",
  "public.nav.installApp": "Install App",
  "public.nav.openApp": "Open App",
  "public.nav.openMenu": "Open menu",
  "public.nav.closeMenu": "Close menu",
};

function renderAppBar(initialRoute = "/home") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialRoute] },
      createElement(IntlProvider, { locale: "en", messages: appBarMessages }, createElement(AppBar))
    )
  );
}

function renderSiteHeader(initialRoute = "/gardens") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialRoute] },
      createElement(
        IntlProvider,
        { locale: "en", messages: siteHeaderMessages },
        createElement(SiteHeader)
      )
    )
  );
}

describe("Display mode — AppBar visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePendingWorksCount.mockReturnValue({ data: 0 });
    // Default: no drawers open
    mockUseUIStore.mockImplementation((selector: (s: any) => any) =>
      selector({
        isWorkDashboardOpen: false,
        isGardenFilterOpen: false,
        isEndowmentDrawerOpen: false,
      })
    );
  });

  it("standalone PWA: AppBar (bottom nav) visible", () => {
    mockUseApp.mockReturnValue({ isInstalled: true, isPwaPresentation: true });

    renderAppBar("/home");

    const nav = screen.getByTestId("authenticated-nav");
    expect(nav).toBeInTheDocument();

    // When installed and on /home (not garden), shouldHideBar = false
    // The nav should NOT have the translate-y-full class that hides it
    expect(nav.className).not.toMatch(/translate-y-full/);
    expect(nav.className).toContain("rounded-t-[var(--radius-lg)]");
    expect(nav.className).toContain("overflow-hidden");

    const syncStatusBar = screen.getByTestId("sync-status-bar");
    expect(syncStatusBar.className).toContain("rounded-t-[var(--radius-lg)]");
    expect(syncStatusBar.className).toContain("overflow-hidden");
  });

  it("localhost PWA preview: AppBar visible even when not installed", () => {
    mockUseApp.mockReturnValue({ isInstalled: false, isPwaPresentation: true });

    renderAppBar("/home");

    const nav = screen.getByTestId("authenticated-nav");
    expect(nav.className).not.toMatch(/translate-y-full/);
  });

  it("browser mode: AppBar hidden", () => {
    mockUseApp.mockReturnValue({ isInstalled: false, isPwaPresentation: false });

    renderAppBar("/home");

    const nav = screen.getByTestId("authenticated-nav");
    // In browser mode, shouldHideBar = true (!isPwaPresentation)
    // The nav gets translate-y-full to slide it off-screen
    expect(nav.className).toMatch(/translate-y-full/);
  });

  it("standalone PWA: /home/garden keeps Garden active and hides the bottom nav", () => {
    mockUseApp.mockReturnValue({ isInstalled: true, isPwaPresentation: true });

    renderAppBar("/home/garden");

    const nav = screen.getByTestId("authenticated-nav");
    expect(nav.className).toMatch(/translate-y-full/);

    expect(screen.getByRole("link", { name: /home/i }).className).not.toContain("tab-active");
    expect(screen.getByRole("link", { name: /garden/i }).className).toContain("tab-active");
  });

  it("standalone PWA: /home/profile keeps Profile active", () => {
    mockUseApp.mockReturnValue({ isInstalled: true, isPwaPresentation: true });

    renderAppBar("/home/profile");

    expect(screen.getByRole("link", { name: /home/i }).className).not.toContain("tab-active");
    expect(screen.getByRole("link", { name: /profile/i }).className).toContain("tab-active");
  });

  it("browser mode + authenticated: SiteHeader renders (top nav, not bottom)", () => {
    mockUseApp.mockReturnValue({ isInstalled: false, isPwaPresentation: false });

    renderSiteHeader("/gardens");

    // SiteHeader should render a <header> with navigation
    const header = document.querySelector("header");
    expect(header).toBeInTheDocument();

    // It should contain nav links
    expect(screen.getAllByText("Gardens").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Fund").length).toBeGreaterThanOrEqual(1);

    // The SiteHeader is a fixed top-0 overlay header, NOT a fixed bottom-0 nav
    expect(header!.className).toMatch(/fixed/);
    expect(header!.className).toMatch(/top-0/);
  });

  it("mobile browser: hamburger nav visible, NO bottom nav", () => {
    mockUseApp.mockReturnValue({ isInstalled: false, isPwaPresentation: false });

    // Render SiteHeader — hamburger is always in DOM (hidden via CSS on desktop)
    renderSiteHeader("/gardens");

    // Hamburger button should be in the DOM
    const hamburger = screen.getByRole("button", { name: /open menu/i });
    expect(hamburger).toBeInTheDocument();

    // No AppBar bottom nav should be present in PublicShell
    // (AppBar is only rendered in AppShell, not PublicShell)
    expect(screen.queryByTestId("authenticated-nav")).not.toBeInTheDocument();
  });
});
