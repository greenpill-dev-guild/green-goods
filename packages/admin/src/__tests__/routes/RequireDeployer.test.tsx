/**
 * RequireDeployer Route Guard Tests
 *
 * Tests for the deployer-only route guard.
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the useRole hook
const mockUseRole = vi.fn();

vi.mock("@green-goods/shared/hooks", () => ({
  useRole: () => mockUseRole(),
}));

// Mock the DashboardLayoutSkeleton
vi.mock("@/components/Layout/DashboardLayoutSkeleton", () => ({
  DashboardLayoutSkeleton: () => createElement("div", { "data-testid": "skeleton" }, "Loading..."),
}));

import RequireDeployer from "../../routes/RequireDeployer";

// Test components
const ProtectedContent = () => createElement("div", null, "Deployer Only Content");

const renderWithProviders = (initialRoute = "/deployer") => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        MemoryRouter,
        { initialEntries: [initialRoute] },
        createElement(
          Routes,
          null,
          createElement(
            Route,
            { element: createElement(RequireDeployer) },
            createElement(Route, { path: "/deployer", element: createElement(ProtectedContent) })
          )
        )
      )
    )
  );
};

describe("routes/RequireDeployer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("shows skeleton while loading", () => {
      mockUseRole.mockReturnValue({
        role: "user",
        loading: true,
      });

      renderWithProviders();

      expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    });
  });

  describe("deployer access", () => {
    it("renders protected content for deployer role", () => {
      mockUseRole.mockReturnValue({
        role: "deployer",
        loading: false,
      });

      renderWithProviders();

      expect(screen.getByText("Deployer Only Content")).toBeInTheDocument();
    });
  });

  describe("unauthorized access", () => {
    it("shows unauthorized message for user role", () => {
      mockUseRole.mockReturnValue({
        role: "user",
        loading: false,
      });

      renderWithProviders();

      expect(screen.getByText("Unauthorized")).toBeInTheDocument();
      expect(screen.getByText(/don't have permission/)).toBeInTheDocument();
    });

    it("shows unauthorized message for operator role", () => {
      mockUseRole.mockReturnValue({
        role: "operator",
        loading: false,
      });

      renderWithProviders();

      expect(screen.getByText("Unauthorized")).toBeInTheDocument();
    });

    it("shows deployer-specific hint for user role", () => {
      mockUseRole.mockReturnValue({
        role: "user",
        loading: false,
      });

      renderWithProviders();

      expect(screen.getByText(/deployment registry allowlist/)).toBeInTheDocument();
    });
  });
});
