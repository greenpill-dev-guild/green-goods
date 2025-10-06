/**
 * Login View Test Suite
 *
 * Tests the passkey login/signup view
 */

import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Login } from "../../views/Login";

// Mock useAuth hook
const mockCreatePasskey = vi.fn();
const mockUseAuth = vi.fn(() => ({
  credential: null,
  smartAccountAddress: null,
  createPasskey: mockCreatePasskey,
  isCreating: false,
  error: null,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Navigate: ({ to }: { to: string }) => <div>Navigate to {to}</div>,
  };
});

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render login view", () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByText("Green Goods")).toBeInTheDocument();
    expect(screen.getByText("Welcome! 🌱")).toBeInTheDocument();
  });

  it("should show create passkey button", () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByText("Create Passkey Wallet")).toBeInTheDocument();
  });

  it("should show benefits of passkey auth", () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByText(/Secure biometric authentication/i)).toBeInTheDocument();
    expect(screen.getByText(/No passwords or seed phrases/i)).toBeInTheDocument();
    expect(screen.getByText(/Sponsored transactions/i)).toBeInTheDocument();
  });

  it("should show loading state when creating passkey", () => {
    mockUseAuth.mockReturnValue({
      credential: null,
      smartAccountAddress: null,
      createPasskey: mockCreatePasskey,
      isCreating: true,
      error: null,
    });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByText("Creating Wallet...")).toBeInTheDocument();
  });

  it("should show error message when there is an error", () => {
    mockUseAuth.mockReturnValue({
      credential: null,
      smartAccountAddress: null,
      createPasskey: mockCreatePasskey,
      isCreating: false,
      error: new Error("Test error message"),
    });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByText(/Test error message/i)).toBeInTheDocument();
  });
});
