/**
 * RequireInstalled Route Guard Tests
 *
 * Tests the PWA installation check route guard.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the useApp hook
const mockUseApp = vi.fn();

vi.mock("@green-goods/shared/providers", () => ({
  useApp: () => mockUseApp(),
}));

// Import after mocks
import RequireInstalled from "../../routes/RequireInstalled";

const ProtectedContent = () => createElement("div", null, "Protected Content");
const LandingPage = () => createElement("div", null, "Landing Page");

const renderWithRouter = (initialRoute = "/protected") => {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialRoute] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: "/landing", element: createElement(LandingPage) }),
        createElement(
          Route,
          { element: createElement(RequireInstalled) },
          createElement(Route, { path: "/protected", element: createElement(ProtectedContent) })
        )
      )
    )
  );
};

describe("RequireInstalled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset VITE_DESKTOP_DEV to false
    vi.stubEnv("VITE_DESKTOP_DEV", "false");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  describe("PWA installed (mobile + standalone)", () => {
    it("renders protected content when mobile and standalone", () => {
      mockUseApp.mockReturnValue({
        isMobile: true,
        isStandalone: true,
      });

      renderWithRouter();

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
      expect(screen.queryByText("Landing Page")).not.toBeInTheDocument();
    });
  });

  describe("Desktop development mode", () => {
    it("renders protected content when VITE_DESKTOP_DEV is true", () => {
      vi.stubEnv("VITE_DESKTOP_DEV", "true");

      mockUseApp.mockReturnValue({
        isMobile: false,
        isStandalone: false,
      });

      renderWithRouter();

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  describe("Not installed (redirect to landing)", () => {
    it("redirects to landing when mobile but not standalone", () => {
      mockUseApp.mockReturnValue({
        isMobile: true,
        isStandalone: false,
      });

      renderWithRouter();

      expect(screen.getByText("Landing Page")).toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("redirects to landing when not mobile and not desktop dev", () => {
      mockUseApp.mockReturnValue({
        isMobile: false,
        isStandalone: false,
      });

      renderWithRouter();

      expect(screen.getByText("Landing Page")).toBeInTheDocument();
    });

    it("redirects to landing when desktop standalone (not mobile PWA)", () => {
      mockUseApp.mockReturnValue({
        isMobile: false,
        isStandalone: true,
      });

      renderWithRouter();

      expect(screen.getByText("Landing Page")).toBeInTheDocument();
    });
  });
});
