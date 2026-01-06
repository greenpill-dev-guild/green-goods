/**
 * RequireOperatorOrDeployer Route Guard Tests
 *
 * Tests for the operator-or-deployer route guard.
 * Note: Currently this guard allows all roles including "user" - verify if intentional.
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

import RequireOperatorOrDeployer from "../../routes/RequireOperatorOrDeployer";

// Test components
const ProtectedContent = () => createElement("div", null, "Protected Content");

const renderWithProviders = (initialRoute = "/protected") => {
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
            { element: createElement(RequireOperatorOrDeployer) },
            createElement(Route, { path: "/protected", element: createElement(ProtectedContent) })
          )
        )
      )
    )
  );
};

describe("routes/RequireOperatorOrDeployer", () => {
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

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  describe("operator access", () => {
    it("renders protected content for operator role", () => {
      mockUseRole.mockReturnValue({
        role: "operator",
        loading: false,
      });

      renderWithProviders();

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  describe("user access", () => {
    // Note: Current implementation allows "user" role - verify if this is intentional
    it("renders protected content for user role (current behavior)", () => {
      mockUseRole.mockReturnValue({
        role: "user",
        loading: false,
      });

      renderWithProviders();

      // Current implementation allows all roles including "user"
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });
});
