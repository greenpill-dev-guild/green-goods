/**
 * SiteHeader Component Tests
 *
 * Tests the public website header:
 * - Desktop: renders nav links (Gardens, Actions, Impact, Fund) + Connect Wallet
 * - Mobile: renders hamburger button, hides nav links
 * - Hamburger click opens drawer
 * - Escape key closes drawer
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const mockOpenWalletModal = vi.fn();

vi.mock("@green-goods/shared", () => ({
  APP_NAME: "Green Goods",
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
  useAppKit: () => ({ open: mockOpenWalletModal }),
}));

import { SiteHeader } from "../../components/Navigation/SiteHeader";

const messages: Record<string, string> = {
  "public.nav.gardens": "Gardens",
  "public.nav.actions": "Actions",
  "public.nav.impact": "Impact",
  "public.nav.fund": "Fund",
  "public.nav.connectWallet": "Connect Wallet",
  "public.nav.openMenu": "Open menu",
  "public.nav.closeMenu": "Close menu",
};

function renderHeader(initialRoute = "/gardens") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialRoute] },
      createElement(IntlProvider, { locale: "en", messages }, createElement(SiteHeader))
    )
  );
}

describe("SiteHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("desktop: renders Gardens, Actions, Impact, Fund, Connect Wallet nav items", () => {
    renderHeader();

    // Nav items — these are rendered in the DOM regardless of viewport,
    // just hidden via CSS classes (md:flex / md:block)
    expect(screen.getAllByText("Gardens").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Actions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Impact").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Fund").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Connect Wallet").length).toBeGreaterThanOrEqual(1);
  });

  it("mobile: renders hamburger button with correct aria-label", () => {
    renderHeader();

    // Hamburger is always in DOM, shown/hidden via CSS (md:hidden)
    const hamburger = screen.getByRole("button", { name: /open menu/i });
    expect(hamburger).toBeInTheDocument();
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");
  });

  it("hamburger click opens drawer", () => {
    renderHeader();

    const hamburger = screen.getByRole("button", { name: /open menu/i });
    fireEvent.click(hamburger);

    // Drawer should now be open — look for the mobile nav dialog
    const drawer = screen.getByRole("dialog");
    expect(drawer).toBeInTheDocument();
    expect(drawer.getAttribute("aria-modal")).toBe("true");

    // Close buttons should be visible in the drawer (backdrop + explicit close button)
    const closeButtons = screen.getAllByRole("button", { name: /close menu/i });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("Escape key closes drawer", () => {
    renderHeader();

    // Open the drawer first
    const hamburger = screen.getByRole("button", { name: /open menu/i });
    fireEvent.click(hamburger);

    // Verify drawer is open
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: "Escape" });

    // Drawer should be closed
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
