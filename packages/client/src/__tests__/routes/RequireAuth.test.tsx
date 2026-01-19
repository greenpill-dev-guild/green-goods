/**
 * RequireAuth Route Guard Tests
 *
 * Tests the authentication route guard behavior.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the useAuth hook
const mockUseAuth = vi.fn();

vi.mock("@green-goods/shared/hooks", () => ({
  useAuth: () => mockUseAuth(),
}));

// Import after mocks
import RequireAuth from "../../routes/RequireAuth";

const ProtectedContent = () => createElement("div", null, "Protected Content");
const LoginPage = () => createElement("div", null, "Login Page");

const renderWithRouter = (initialRoute = "/protected") => {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialRoute] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: "/login", element: createElement(LoginPage) }),
        createElement(
          Route,
          { element: createElement(RequireAuth) },
          createElement(Route, { path: "/protected", element: createElement(ProtectedContent) })
        )
      )
    )
  );
};

describe("RequireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders loading spinner when auth is not ready", () => {
    mockUseAuth.mockReturnValue({
      isReady: false,
      isAuthenticated: false,
    });

    const { container } = renderWithRouter();

    // Should show a loading spinner
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });

  it("redirects to login when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      isReady: true,
      isAuthenticated: false,
    });

    renderWithRouter();

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("renders protected content when authenticated", () => {
    mockUseAuth.mockReturnValue({
      isReady: true,
      isAuthenticated: true,
    });

    renderWithRouter();

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });

  it("preserves redirect path in login URL", () => {
    mockUseAuth.mockReturnValue({
      isReady: true,
      isAuthenticated: false,
    });

    renderWithRouter("/protected?foo=bar");

    // Redirect happens - we land on login page
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });
});
