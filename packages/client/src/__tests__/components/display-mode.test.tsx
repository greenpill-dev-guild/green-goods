/**
 * Display Mode Tests — AppBar visibility based on display-mode
 *
 * Verifies the browser vs. PWA distinction (D6 rule):
 * - Browser = website (SiteHeader top nav, no bottom nav)
 * - Installed PWA = app (AppBar bottom nav)
 *
 * The AppBar component checks `isInstalled` from `useApp()` and hides
 * itself in browser mode via `shouldHideBar = !isInstalled || ...`.
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
  "public.nav.connectWallet": "Connect Wallet",
  "public.nav.openMenu": "Open menu",
  "public.nav.closeMenu": "Close menu",
};

function renderAppBar(initialRoute = "/home") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialRoute] },
      createElement(
        IntlProvider,
        { locale: "en", messages: appBarMessages },
        createElement(AppBar)
      )
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
    mockUseApp.mockReturnValue({ isInstalled: true });

    renderAppBar("/home");

    const nav = screen.getByTestId("authenticated-nav");
    expect(nav).toBeInTheDocument();

    // When installed and on /home (not garden), shouldHideBar = false
    // The nav should NOT have the translate-y-full class that hides it
    expect(nav.className).not.toMatch(/translate-y-full/);
  });

  it("browser mode: AppBar hidden", () => {
    mockUseApp.mockReturnValue({ isInstalled: false });

    renderAppBar("/home");

    const nav = screen.getByTestId("authenticated-nav");
    // In browser mode, shouldHideBar = true (!isInstalled)
    // The nav gets translate-y-full to slide it off-screen
    expect(nav.className).toMatch(/translate-y-full/);
  });

  it("browser mode + authenticated: SiteHeader renders (top nav, not bottom)", () => {
    mockUseApp.mockReturnValue({ isInstalled: false });

    renderSiteHeader("/gardens");

    // SiteHeader should render a <header> with navigation
    const header = document.querySelector("header");
    expect(header).toBeInTheDocument();

    // It should contain nav links
    expect(screen.getAllByText("Gardens").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Fund").length).toBeGreaterThanOrEqual(1);

    // The SiteHeader has a sticky top-0 header, NOT a fixed bottom-0 nav
    expect(header!.className).toMatch(/sticky/);
    expect(header!.className).toMatch(/top-0/);
  });

  it("mobile browser: hamburger nav visible, NO bottom nav", () => {
    mockUseApp.mockReturnValue({ isInstalled: false });

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
