/**
 * RequireAuth Test Suite
 *
 * Tests authentication guard component
 */

import { render, screen } from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RequireAuth from "../../routes/RequireAuth";

// Mock useAuth hook
const mockUseAuth = vi.fn(() => ({
  smartAccountAddress: null,
  isReady: false,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("RequireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render nothing when not ready", () => {
    mockUseAuth.mockReturnValue({
      smartAccountAddress: null,
      isReady: false,
    });

    const { container } = render(
      <BrowserRouter>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="*" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it("should redirect to login when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      smartAccountAddress: null,
      isReady: true,
    });

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<RequireAuth />}>
            <Route path="*" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("should render children when authenticated", () => {
    mockUseAuth.mockReturnValue({
      smartAccountAddress: "0x1234567890123456789012345678901234567890",
      isReady: true,
    });

    render(
      <BrowserRouter>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="*" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});
