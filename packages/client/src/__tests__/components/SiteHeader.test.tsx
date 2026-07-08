/**
 * SiteHeader Component Tests
 *
 * Tests the public website header for the editorial public browser:
 * - Desktop: nav order Gardens / Impact / Vaults / Fund / Actions + Install/Open App CTA
 * - Mobile: hamburger button (aria-expanded toggling)
 * - Drawer: opens, closes on Escape, mirrors nav + Install/Open App
 * - Wallet connect is intentionally absent from public header chrome
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ComponentProps, createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseApp, mockUseInstallGuidance, mockUsePublicInstallHandler, mockInstallHandler } =
  vi.hoisted(() => ({
    mockUseApp: vi.fn(),
    mockUseInstallGuidance: vi.fn(),
    mockUsePublicInstallHandler: vi.fn(),
    mockInstallHandler: vi.fn(),
  }));

vi.mock("@green-goods/shared", () => ({
  APP_NAME: "Green Goods",
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
  useApp: mockUseApp,
  useIsBraveBrowser: () => false,
  useInstallGuidance: mockUseInstallGuidance,
  usePublicInstallHandler: mockUsePublicInstallHandler,
  useTunnelUrl: () => null,
  useEventListener: vi.fn(),
}));

import { SiteHeader } from "../../components/Navigation/SiteHeader";

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

function renderHeader(initialRoute = "/gardens", props: ComponentProps<typeof SiteHeader> = {}) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialRoute] },
      createElement(IntlProvider, { locale: "en", messages }, createElement(SiteHeader, props))
    )
  );
}

describe("SiteHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApp.mockReturnValue({
      isMobile: false,
      isInstalled: false,
      isInstalling: false,
      wasInstalled: false,
      platform: "unknown",
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });
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
  });

  afterEach(() => {
    cleanup();
  });

  it("desktop: renders Gardens / Impact / Fund / Actions and the Install App CTA", () => {
    renderHeader();
    // Nav links and CTA render regardless of viewport (visibility toggled by CSS).
    expect(screen.getAllByText("Gardens").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Impact").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Fund").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Actions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Install App").length).toBeGreaterThanOrEqual(1);
    // Vaults is intentionally not in the header nav.
    expect(screen.queryByText("Vaults")).toBeNull();
    expect(mockUseInstallGuidance).toHaveBeenCalledWith(
      "unknown",
      false,
      false,
      null,
      false,
      false
    );
    // No wallet CTA in public header.
    expect(screen.queryByText("Connect Wallet")).toBeNull();
  });

  it("nav order is Gardens / Impact / Fund / Actions", () => {
    renderHeader();
    const navs = screen.getAllByRole("navigation");
    const desktopNav = navs[0];
    const links = Array.from(desktopNav.querySelectorAll("a")).map(
      (link) => link.textContent ?? ""
    );
    const navOrder = links.filter((label) =>
      ["Gardens", "Impact", "Fund", "Actions"].includes(label)
    );
    expect(navOrder).toEqual(["Gardens", "Impact", "Fund", "Actions"]);
  });

  it("renders Open App when the PWA is already installed", () => {
    // PublicInstallAction gates the "Open App" label on isMobile + isInstalled
    // (desktop always shows "Install App" + QR). Force mobile here so the
    // already-installed scenario actually renders "Open App".
    mockUseApp.mockReturnValue({
      isMobile: true,
      isInstalled: true,
      isInstalling: false,
      wasInstalled: true,
      platform: "unknown",
      deferredPrompt: null,
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
    renderHeader();
    expect(screen.getAllByText("Open App").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Install App when mobile history says installed but the PWA is gone", () => {
    mockUseApp.mockReturnValue({
      isMobile: true,
      isInstalled: false,
      isInstalling: false,
      wasInstalled: true,
      platform: "unknown",
      deferredPrompt: null,
      promptInstall: vi.fn(),
    });
    mockUseInstallGuidance.mockReturnValue({
      scenario: "manual-install-available",
      primaryAction: { type: "show-manual-steps", label: "Install App" },
      secondaryAction: { type: "continue-in-browser", label: "Continue in Browser" },
      browserInfo: { browser: "unknown" },
      showBrowserOption: true,
      manualInstructions: [
        {
          stepNumber: 1,
          icon: "menu",
          title: "Step 1",
          description: "Open the browser menu.",
        },
      ],
      browserSwitchReason: null,
      openInBrowserUrl: null,
    });

    renderHeader();

    expect(screen.getAllByText("Install App").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Open App")).not.toBeInTheDocument();
  });

  it("desktop install CTA opens the QR handoff dialog", () => {
    renderHeader();
    const desktopCta = screen.getByRole("button", { name: "Install App" });
    expect(desktopCta.getAttribute("data-install-action")).toBe("continue-in-browser");
    expect(desktopCta.className).toMatch(/cursor-pointer/);
    fireEvent.click(desktopCta);
    expect(mockInstallHandler).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Bring Green Goods into the field" })
    ).toBeInTheDocument();
  });

  it("mobile: hamburger button is in the DOM with aria-expanded false", () => {
    renderHeader();
    const hamburger = screen.getByRole("button", { name: /open menu/i });
    expect(hamburger).toBeInTheDocument();
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");
  });

  it("hamburger click opens the drawer with the same nav + install CTA", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    const drawer = screen.getByRole("dialog");
    expect(drawer).toBeInTheDocument();
    expect(drawer.getAttribute("aria-modal")).toBe("true");
    // Drawer mirrors the install CTA, not Connect Wallet.
    expect(screen.getAllByText("Install App").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Connect Wallet")).toBeNull();
  });

  it("Escape key closes the drawer", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders transparent on home (`/`) so the header floats over the hero image", () => {
    renderHeader("/");
    const header = document.querySelector("header");
    expect(header).not.toBeNull();
    expect(header!.getAttribute("data-variant")).toBe("transparent");
    expect(header!.className).toMatch(/bg-transparent/);
    expect(header!.className).not.toMatch(/backdrop-blur/);
  });

  it("renders transparent on every public route (not just home)", () => {
    for (const route of ["/", "/gardens", "/impact", "/vaults", "/fund", "/actions"]) {
      cleanup();
      renderHeader(route);
      const header = document.querySelector("header");
      expect(header, `header missing on ${route}`).not.toBeNull();
      expect(header!.getAttribute("data-variant"), `expected transparent variant on ${route}`).toBe(
        "transparent"
      );
      expect(header!.className, `expected bg-transparent on ${route}`).toMatch(/bg-transparent/);
    }
  });

  it("starts at full opacity (header fully visible at the top of the page)", () => {
    renderHeader("/");
    const header = document.querySelector("header");
    expect(header).not.toBeNull();
    expect((header as HTMLElement).style.opacity).toBe("1");
  });
});
