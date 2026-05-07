/**
 * PublicShell Layout Tests
 *
 * Verifies the public layout wrapper:
 * - Renders SiteHeader above route outlet content
 * - /fund route renders within PublicShell
 * - /gardens route renders within PublicShell
 * - No bottom nav (AppBar) visible in browser mode
 *
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const mockOpenWalletModal = vi.fn();

vi.mock("@green-goods/shared", () => ({
  APP_NAME: "Green Goods",
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
  useAppKit: () => ({ open: mockOpenWalletModal }),
  useApp: () => ({
    isMobile: false,
    isInstalled: false,
    platform: "unknown",
    deferredPrompt: null,
    promptInstall: vi.fn(),
  }),
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

// ScrollRestoration requires a data router (createBrowserRouter) which is
// not available in MemoryRouter. Mock it to avoid the invariant error.
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    ScrollRestoration: () => null,
  };
});

import PublicShell from "../../routes/PublicShell";

const messages: Record<string, string> = {
  "public.nav.gardens": "Gardens",
  "public.nav.actions": "Actions",
  "public.nav.impact": "Impact",
  "public.nav.fund": "Fund",
  "public.nav.installApp": "Install App",
  "public.nav.openApp": "Open App",
  "public.nav.openMenu": "Open menu",
  "public.nav.closeMenu": "Close menu",
};

const FundContent = () =>
  createElement(
    "div",
    { "data-testid": "fund-content" },
    "Fund Page Content",
    createElement(Link, { to: "/gardens" }, "Open gardens")
  );
const GardensContent = () =>
  createElement("div", { "data-testid": "gardens-content" }, "Gardens Page Content");

function renderShellWithRoute(initialRoute: string) {
  return render(
    createElement(
      "div",
      { id: "client-scroll-root" },
      createElement(
        MemoryRouter,
        { initialEntries: [initialRoute] },
        createElement(
          IntlProvider,
          { locale: "en", messages },
          createElement(
            Routes,
            null,
            createElement(
              Route,
              { element: createElement(PublicShell) },
              createElement(Route, { path: "fund", element: createElement(FundContent) }),
              createElement(Route, { path: "gardens", element: createElement(GardensContent) })
            )
          )
        )
      )
    )
  );
}

describe("PublicShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders SiteHeader above route outlet content", () => {
    renderShellWithRoute("/gardens");

    // SiteHeader should be present (look for the header element)
    const header = document.querySelector("header");
    expect(header).toBeInTheDocument();

    // Outlet content should also be present
    expect(screen.getByTestId("gardens-content")).toBeInTheDocument();

    // Header should come before main content in DOM order
    const main = document.querySelector("main");
    expect(main).toBeInTheDocument();
    expect(header!.compareDocumentPosition(main!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("/fund route renders within PublicShell", () => {
    renderShellWithRoute("/fund");

    // SiteHeader present
    expect(document.querySelector("header")).toBeInTheDocument();

    // Fund content rendered via Outlet
    expect(screen.getByTestId("fund-content")).toBeInTheDocument();
    expect(screen.getByText("Fund Page Content")).toBeInTheDocument();
  });

  it("/gardens route renders within PublicShell", () => {
    renderShellWithRoute("/gardens");

    // SiteHeader present
    expect(document.querySelector("header")).toBeInTheDocument();

    // Gardens content rendered via Outlet
    expect(screen.getByTestId("gardens-content")).toBeInTheDocument();
    expect(screen.getByText("Gardens Page Content")).toBeInTheDocument();
  });

  it("resets the public scroll container on route changes", () => {
    renderShellWithRoute("/fund");

    const scrollRoot = document.getElementById("client-scroll-root");
    expect(scrollRoot).toBeInTheDocument();
    scrollRoot!.scrollTop = 720;

    fireEvent.click(screen.getByRole("link", { name: "Open gardens" }));

    expect(screen.getByTestId("gardens-content")).toBeInTheDocument();
    expect(scrollRoot!.scrollTop).toBe(0);
  });

  it("no bottom nav (AppBar) visible in browser mode", () => {
    renderShellWithRoute("/gardens");

    // PublicShell should NOT render AppBar (which has data-testid="authenticated-nav")
    expect(screen.queryByTestId("authenticated-nav")).not.toBeInTheDocument();

    // Also verify no <nav> with bottom nav characteristics
    // The only <nav> should be the SiteHeader's navigation, not a bottom bar
    const navElements = document.querySelectorAll("nav");
    for (const nav of navElements) {
      // AppBar uses "fixed bottom-0" class pattern
      expect(nav.className).not.toMatch(/fixed.*bottom-0/);
    }
  });
});
