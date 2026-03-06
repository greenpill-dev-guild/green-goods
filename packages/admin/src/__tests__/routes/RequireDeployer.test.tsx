/**
 * RequireDeployer Route Guard Tests
 *
 * Tests for the deployer-only route guard.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the useRole hook
const mockUseRole = vi.fn();

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useRole: () => mockUseRole(),
  };
});

// Mock the DashboardLayoutSkeleton (used by RequireRole default fallback)
vi.mock("@/components/Layout/DashboardLayoutSkeleton", () => ({
  DashboardLayoutSkeleton: () => createElement("div", { "data-testid": "skeleton" }, "Loading..."),
}));

// Mock the Skeleton components (used by RequireDeployer content-only fallback)
vi.mock("@/components/ui/Skeleton", () => ({
  SkeletonGrid: () => createElement("div", { "data-testid": "skeleton-grid" }, "Loading grid..."),
}));

import RequireDeployer from "../../routes/RequireDeployer";

const messages: Record<string, string> = {
  "app.admin.auth.unauthorized": "Unauthorized",
  "app.admin.auth.noPermission": "You don't have permission to access this area.",
  "app.admin.auth.requireRole": "To access this area, you need to be:",
  "app.admin.auth.requireDeployer":
    "Added to the deployment registry allowlist for contract management",
  "app.admin.auth.requireOperator": "An operator of at least one garden for garden management",
};

// Test components
const ProtectedContent = () => createElement("div", null, "Deployer Only Content");

const renderWithProviders = (initialRoute = "/deployer") => {
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
              { element: createElement(RequireDeployer) },
              createElement(Route, { path: "/deployer", element: createElement(ProtectedContent) })
            )
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
    it("shows content-only skeleton while loading (no sidebar)", () => {
      mockUseRole.mockReturnValue({
        role: "user",
        loading: true,
      });

      renderWithProviders();

      expect(screen.getByTestId("content-skeleton")).toBeInTheDocument();
      expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
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
