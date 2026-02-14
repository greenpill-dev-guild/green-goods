/**
 * RequireOperatorOrDeployer Route Guard Tests
 *
 * Tests for the operator-or-deployer route guard.
 * Verifies that only "deployer" and "operator" roles can access protected content.
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the useRole hook
const mockUseRole = vi.fn();

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useRole: () => mockUseRole(),
  };
});

// Mock the DashboardLayoutSkeleton
vi.mock("@/components/Layout/DashboardLayoutSkeleton", () => ({
  DashboardLayoutSkeleton: () => createElement("div", { "data-testid": "skeleton" }, "Loading..."),
}));

import RequireOperatorOrDeployer from "../../routes/RequireOperatorOrDeployer";

const messages: Record<string, string> = {
  "app.admin.auth.unauthorized": "Unauthorized",
  "app.admin.auth.noPermission": "You don't have permission to access this area.",
  "app.admin.auth.requireRole": "To access this area, you need to be:",
  "app.admin.auth.requireDeployer":
    "Added to the deployment registry allowlist for contract management",
  "app.admin.auth.requireOperator": "An operator of at least one garden for garden management",
};

// Test components
const ProtectedContent = () => createElement("div", null, "Protected Content");

const renderWithProviders = (initialRoute = "/protected") => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    createElement(
      IntlProvider,
      { locale: "en", messages },
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
    it("blocks user role and shows unauthorized message", () => {
      mockUseRole.mockReturnValue({
        role: "user",
        loading: false,
      });

      renderWithProviders();

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(screen.getByTestId("unauthorized")).toBeInTheDocument();
      expect(screen.getByText("Unauthorized")).toBeInTheDocument();
      expect(
        screen.getByText("You don't have permission to access this area.")
      ).toBeInTheDocument();
    });
  });
});
