/**
 * Display Mode Tests — AppBar visibility based on display-mode
 *
 * Verifies the browser vs. PWA distinction (D6 rule):
 * - Browser = website (AppBar hidden)
 * - Installed PWA = app (AppBar bottom nav)
 *
 * The AppBar component checks `isPwaPresentation` from `useApp()` and hides
 * itself in browser mode via `shouldHideBar = !isPwaPresentation || ...`.
 *
 * @vitest-environment happy-dom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const mockUseApp = vi.fn();
const mockUseYourWorkCount = vi.fn();
const mockUseUIStore = vi.fn();

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/providers/App", () => ({
  useApp: () => mockUseApp(),
}));

vi.mock("@green-goods/shared/hooks/work/useYourWorkCount", () => ({
  useYourWorkCount: () => mockUseYourWorkCount(),
}));

vi.mock("@green-goods/shared/stores/useUIStore", () => ({
  useUIStore: (selector: (s: any) => any) => mockUseUIStore(selector),
}));

import { AppBar } from "../../components/Layout/AppBar";

const appBarMessages: Record<string, string> = {
  "app.home": "Home",
  "app.garden": "Garden",
  "app.profile": "Profile",
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

describe("Display mode — AppBar visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseYourWorkCount.mockReturnValue({ count: 0 });
    // Default: no sheets open
    mockUseUIStore.mockImplementation((selector: (s: any) => any) =>
      selector({ openSheetCount: 0 })
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

  it("standalone PWA: a commitment detail or composer hides the bottom nav under its action bar", () => {
    mockUseApp.mockReturnValue({ isInstalled: true, isPwaPresentation: true });

    renderAppBar("/home/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/commitments/9");
    expect(screen.getByTestId("authenticated-nav").className).toMatch(/translate-y-full/);
  });

  it("standalone PWA: a garden's own page hides the bottom nav, since it owns its chrome", () => {
    mockUseApp.mockReturnValue({ isInstalled: true, isPwaPresentation: true });

    renderAppBar("/home/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const nav = screen.getByTestId("authenticated-nav");
    expect(nav.className).toMatch(/translate-y-full/);
    // Off screen is out of reach: no tab stops or screen-reader links.
    expect(nav).toHaveAttribute("inert");
  });

  it("standalone PWA: any open sheet or dialog hides the bottom nav (DL-015)", () => {
    mockUseApp.mockReturnValue({ isInstalled: true, isPwaPresentation: true });
    mockUseUIStore.mockImplementation((selector: (s: any) => any) =>
      selector({ openSheetCount: 1 })
    );

    renderAppBar("/home");
    expect(screen.getByTestId("authenticated-nav").className).toMatch(/translate-y-full/);
  });

  it("standalone PWA: /home/profile keeps Profile active", () => {
    mockUseApp.mockReturnValue({ isInstalled: true, isPwaPresentation: true });

    renderAppBar("/home/profile");

    expect(screen.getByTestId("authenticated-nav").className).not.toMatch(/translate-y-full/);
    expect(screen.getByTestId("authenticated-nav")).not.toHaveAttribute("inert");
    expect(screen.getByRole("link", { name: /home/i }).className).not.toContain("tab-active");
    expect(screen.getByRole("link", { name: /profile/i }).className).toContain("tab-active");
  });
});
