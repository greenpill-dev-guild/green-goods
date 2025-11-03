/**
 * RequireAuth Test Suite
 *
 * Tests authentication guard component
 */

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RequireAuth from "../../routes/RequireAuth";

// Mock useAuth hook from shared package
const mockUseAuth = vi.fn(() => ({
  isReady: false,
  isAuthenticated: false,
}));

vi.mock("@green-goods/shared/hooks", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared/hooks")>(
    "@green-goods/shared/hooks"
  );
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});

describe("RequireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render nothing when not ready", () => {
    mockUseAuth.mockReturnValue({
      isReady: false,
      isAuthenticated: false,
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="*" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it("should redirect to login when not authenticated", async () => {
    mockUseAuth.mockReturnValue({
      isReady: true,
      isAuthenticated: false,
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<RequireAuth />}>
            <Route path="*" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
  });

  it("should render children when authenticated", () => {
    mockUseAuth.mockReturnValue({
      isReady: true,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="*" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});
