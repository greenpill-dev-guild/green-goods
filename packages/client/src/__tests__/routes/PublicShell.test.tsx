/**
 * PublicShell Layout Tests
 *
 * Verifies the public layout wrapper:
 * - Renders SiteHeader above route outlet content
 * - /fund route renders within PublicShell
 * - /gardens route renders within PublicShell
 * - /vaults route renders within PublicShell
 * - No bottom nav (AppBar) visible in browser mode
 *
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { Link, MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

vi.mock("@green-goods/shared/config/app", () => ({
  APP_NAME: "Green Goods",
}));

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/hooks/app/useTunnelUrl", () => ({
  useTunnelUrl: () => null,
}));

vi.mock("@green-goods/shared/providers/App", () => ({
  useApp: () => ({
    isMobile: false,
    isInstalled: false,
    platform: "unknown",
    deferredPrompt: null,
    promptInstall: vi.fn(),
  }),
}));

vi.mock("@green-goods/shared/hooks/app/useIsBraveBrowser", () => ({
  useIsBraveBrowser: () => false,
}));

vi.mock("@green-goods/shared/hooks/app/useInstallGuidance", () => ({
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
}));

vi.mock("@green-goods/shared/hooks/app/usePublicInstallHandler", () => ({
  usePublicInstallHandler: () => vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/utils/useEventListener", () => ({
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
  "public.nav.vaults": "Vaults",
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
    createElement(Link, { to: "/gardens" }, "Open gardens"),
    createElement(Link, { to: "/fund?manage=endowments" }, "Open endowments")
  );
const GardensContent = () => {
  const navigate = useNavigate();
  return createElement(
    "div",
    { "data-testid": "gardens-content" },
    "Gardens Page Content",
    createElement("button", { type: "button", onClick: () => navigate(-1) }, "Go back")
  );
};
const VaultsContent = () =>
  createElement("div", { "data-testid": "vaults-content" }, "Vaults Page Content");

function renderShellWithRoute(initialRoute: string, priorEntries: string[] = []) {
  const entries = [...priorEntries, initialRoute];
  return render(
    createElement(
      "div",
      { id: "client-scroll-root" },
      createElement(
        MemoryRouter,
        { initialEntries: entries, initialIndex: entries.length - 1 },
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
              createElement(Route, { path: "gardens", element: createElement(GardensContent) }),
              createElement(Route, { path: "vaults", element: createElement(VaultsContent) })
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

  it("/vaults route renders within PublicShell", () => {
    renderShellWithRoute("/vaults");

    expect(document.querySelector("header")).toBeInTheDocument();
    expect(screen.getByTestId("vaults-content")).toBeInTheDocument();
    expect(screen.getByText("Vaults Page Content")).toBeInTheDocument();
    expect(screen.queryByTestId("authenticated-nav")).not.toBeInTheDocument();
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

  it("restores the public scroll container on back navigation", () => {
    // <ScrollRestoration> restores `window`; this shell scrolls
    // `#client-scroll-root`, so it has to bank and restore that itself. Before
    // `/gardens/:id` became a route, going back to the archive cost nothing
    // because the grid never unmounted. Now a reader who opened a Garden from
    // deep in the list has to come back to where they were.
    renderShellWithRoute("/fund");

    const scrollRoot = document.getElementById("client-scroll-root");
    expect(scrollRoot).toBeInTheDocument();

    scrollRoot!.scrollTop = 1850;
    fireEvent.scroll(scrollRoot!);

    fireEvent.click(screen.getByRole("link", { name: "Open gardens" }));
    expect(screen.getByTestId("gardens-content")).toBeInTheDocument();
    // Forward navigation still starts at the top.
    expect(scrollRoot!.scrollTop).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(screen.getByTestId("fund-content")).toBeInTheDocument();
    expect(scrollRoot!.scrollTop).toBe(1850);
  });

  it("resets to the top on back navigation with no banked position", () => {
    // A hard reload mid-history, or a shell remount, leaves the map empty for
    // an entry the reader can still go Back to. Keeping the outgoing route's
    // offset would drop them into the middle of a page they have not seen.
    // /fund is already in history but was never visited in this mount, so
    // nothing is banked for it — exactly the state after a hard reload.
    renderShellWithRoute("/gardens", ["/fund"]);

    const scrollRoot = document.getElementById("client-scroll-root");
    expect(scrollRoot).toBeInTheDocument();

    scrollRoot!.scrollTop = 900;
    fireEvent.scroll(scrollRoot!);
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(screen.getByTestId("fund-content")).toBeInTheDocument();
    expect(scrollRoot!.scrollTop).toBe(0);
  });

  it("preserves the public scroll container on search-only route changes", () => {
    renderShellWithRoute("/fund");

    const scrollRoot = document.getElementById("client-scroll-root");
    expect(scrollRoot).toBeInTheDocument();
    scrollRoot!.scrollTop = 720;
    fireEvent.scroll(scrollRoot!);

    fireEvent.click(screen.getByRole("link", { name: "Open endowments" }));

    expect(screen.getByTestId("fund-content")).toBeInTheDocument();
    expect(scrollRoot!.scrollTop).toBe(720);
  });

  it("preserves the public scroll container when opening management from receipt search params", () => {
    renderShellWithRoute("/fund?intent=receipt_123");

    const scrollRoot = document.getElementById("client-scroll-root");
    expect(scrollRoot).toBeInTheDocument();
    scrollRoot!.scrollTop = 720;
    fireEvent.scroll(scrollRoot!);

    fireEvent.click(screen.getByRole("link", { name: "Open endowments" }));

    expect(screen.getByTestId("fund-content")).toBeInTheDocument();
    expect(scrollRoot!.scrollTop).toBe(720);
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
