/**
 * RequireAuth Route Guard Tests
 *
 * Tests the authentication route guard behavior.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the current shared auth state hook
const mockUseAuthState = vi.fn();

vi.mock("@green-goods/shared", () => ({
  useAuthState: () => mockUseAuthState(),
}));

// Import after mocks
import RequireAuth from "../../routes/RequireAuth";

const ProtectedContent = () => createElement("div", null, "Protected Content");
const LoginPage = () => {
  const location = useLocation();
  return createElement(
    "div",
    { "data-location": `${location.pathname}${location.search}` },
    "Login Page"
  );
};

const renderWithRouter = (initialRoute = "/protected") => {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialRoute] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: "/home/login", element: createElement(LoginPage) }),
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
    mockUseAuthState.mockReturnValue({
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
    mockUseAuthState.mockReturnValue({
      isReady: true,
      isAuthenticated: false,
    });

    renderWithRouter();

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("renders protected content when authenticated", () => {
    mockUseAuthState.mockReturnValue({
      isReady: true,
      isAuthenticated: true,
    });

    renderWithRouter();

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });

  it("preserves redirect path in login URL", () => {
    mockUseAuthState.mockReturnValue({
      isReady: true,
      isAuthenticated: false,
    });

    renderWithRouter("/protected?foo=bar");

    expect(screen.getByText("Login Page")).toHaveAttribute(
      "data-location",
      "/home/login?redirectTo=%2Fprotected%3Ffoo%3Dbar"
    );
  });
});
