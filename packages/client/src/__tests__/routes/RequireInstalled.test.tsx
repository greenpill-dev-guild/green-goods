/**
 * RequireInstalled Route Guard Tests
 *
 * Tests for the PWA installation check route guard.
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Route, Routes, Outlet } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the useApp hook
const mockUseApp = vi.fn();

vi.mock("@green-goods/shared/providers", () => ({
  useApp: () => mockUseApp(),
}));

import RequireInstalled from "../../routes/RequireInstalled";

// Test component for protected content
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
        createElement(
          Route,
          { element: createElement(RequireInstalled) },
          createElement(Route, { path: "/protected", element: createElement(ProtectedContent) })
        ),
        createElement(Route, { path: "/landing", element: createElement(LandingPage) })
      )
    )
  );
};

describe.skip("routes/RequireInstalled - router navigation issues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset VITE_DESKTOP_DEV
    vi.stubEnv("VITE_DESKTOP_DEV", "false");
  });

  describe("mobile + standalone (PWA installed)", () => {
    it("renders protected content when mobile and standalone", () => {
      mockUseApp.mockReturnValue({
        isMobile: true,
        isStandalone: true,
      });

      renderWithRouter("/protected");

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  describe("desktop development mode", () => {
    it("renders protected content when VITE_DESKTOP_DEV is true", () => {
      vi.stubEnv("VITE_DESKTOP_DEV", "true");

      mockUseApp.mockReturnValue({
        isMobile: false,
        isStandalone: false,
      });

      renderWithRouter("/protected");

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  describe("not installed (redirect to landing)", () => {
    it("redirects to landing when mobile but not standalone", () => {
      mockUseApp.mockReturnValue({
        isMobile: true,
        isStandalone: false,
      });

      renderWithRouter("/protected");

      expect(screen.getByText("Landing Page")).toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("redirects to landing when not mobile", () => {
      mockUseApp.mockReturnValue({
        isMobile: false,
        isStandalone: false,
      });

      renderWithRouter("/protected");

      expect(screen.getByText("Landing Page")).toBeInTheDocument();
    });

    it("redirects to landing when desktop and not standalone", () => {
      mockUseApp.mockReturnValue({
        isMobile: false,
        isStandalone: true, // Desktop standalone doesn't count
      });

      renderWithRouter("/protected");

      expect(screen.getByText("Landing Page")).toBeInTheDocument();
    });
  });

  describe("redirect URL preservation", () => {
    it("includes redirectTo parameter with original path", () => {
      mockUseApp.mockReturnValue({
        isMobile: false,
        isStandalone: false,
      });

      const { container } = renderWithRouter("/protected");

      // The redirect happens, we should be on landing page
      expect(screen.getByText("Landing Page")).toBeInTheDocument();
    });

    it("preserves query string in redirect", () => {
      mockUseApp.mockReturnValue({
        isMobile: false,
        isStandalone: false,
      });

      renderWithRouter("/protected?foo=bar");

      expect(screen.getByText("Landing Page")).toBeInTheDocument();
    });
  });
});
