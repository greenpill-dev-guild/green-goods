/**
 * TopNav Component Tests
 *
 * The garden page's bar: its back button, its banner actions in their order, and no bell of its
 * own, since Home's bell carries the garden's events (DL-130).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock shared barrel (TopNav imports cn, useOffline, Garden from @green-goods/shared)
vi.mock("@green-goods/shared/hooks/app/useOffline", () => ({
  useOffline: vi.fn(() => ({
    syncStatus: "idle",
    isOnline: true,
  })),
}));

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/hooks/utils/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/utils/useTimeout", () => ({
  useTimeout: vi.fn(() => ({
    set: vi.fn(),
    clear: vi.fn(),
  })),
}));

import { TopNav } from "../../components/Navigation/TopNav";

const renderWithIntl = (element: React.ReactElement) =>
  render(createElement(IntlProvider, { locale: "en", messages: {} }, element));

// ============================================================================
// Test Data
// ============================================================================

const mockGarden = {
  id: "0xGarden123",
  chainId: 11155111,
  tokenAddress: "0xToken456",
  tokenID: 1n,
  name: "Test Garden",
  description: "A test garden",
  location: "Test Location",
  bannerImage: "https://example.com/banner.jpg",
  gardeners: ["0xGardener1", "0xGardener2"],
  stewards: ["0xSteward1"],
  createdAt: Date.now(),
};

// ============================================================================
// Tests
// ============================================================================

describe("components/Navigation/TopNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Back button", () => {
    it("renders back button when onBackClick is provided", () => {
      const handleBack = vi.fn();

      renderWithIntl(
        createElement(TopNav, {
          onBackClick: handleBack,
        })
      );

      // Back button should be present
      const buttons = document.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("does not render back button when onBackClick is not provided", () => {
      const { container } = renderWithIntl(createElement(TopNav, {}));

      // Should not have any buttons when no back click and no garden
      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBe(0);
    });
  });

  describe("Banner actions (DL-020, DL-130)", () => {
    it("keeps Share last and draws no bell of its own", () => {
      const handleShare = vi.fn();

      renderWithIntl(
        createElement(TopNav, {
          garden: mockGarden as any,
          showEndowmentButton: true,
          onEndowmentClick: vi.fn(),
          onShareClick: handleShare,
        })
      );

      const share = screen.getByRole("button", { name: "Share Garden" });
      const labels = screen
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"));
      expect(labels[labels.length - 1]).toBe("Share Garden");
      expect(labels).not.toContain("Garden Actions");
      // Home's bell counts the garden's events; a second count of pending work here disagreed.
      expect(screen.queryByRole("button", { name: /notifications/i })).not.toBeInTheDocument();

      fireEvent.click(share);
      expect(handleShare).toHaveBeenCalledTimes(1);
    });

    it("renders no Share button without a garden or a share handler", () => {
      renderWithIntl(createElement(TopNav, { garden: mockGarden as any }));
      expect(screen.queryByRole("button", { name: "Share Garden" })).not.toBeInTheDocument();

      renderWithIntl(createElement(TopNav, { onShareClick: vi.fn() }));
      expect(screen.queryByRole("button", { name: "Share Garden" })).not.toBeInTheDocument();
    });
  });

  describe("Children rendering", () => {
    it("renders children in the center area", () => {
      renderWithIntl(
        createElement(
          TopNav,
          {},
          createElement("span", { "data-testid": "child-content" }, "Child Content")
        )
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });
  });
});
