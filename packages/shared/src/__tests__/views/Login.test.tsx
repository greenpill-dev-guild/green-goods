/**
 * Login View Test Suite
 *
 * Tests the passkey-first login view with Splash UI and AppKit integration
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Login } from "../../../../client/src/views/Login";
import { toastService } from "@green-goods/shared";

// Mock useAuth hook
const mockCreatePasskey = vi.fn();
const mockConnectWallet = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/hooks/auth/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useAutoJoinRootGarden hook
const mockJoinGarden = vi.fn();
const mockUseAutoJoinRootGarden = vi.fn();

vi.mock("@/hooks/garden/useAutoJoinRootGarden", () => ({
  useAutoJoinRootGarden: () => mockUseAutoJoinRootGarden(),
}));

// Mock AppKit hooks
const { mockOpenWalletModal } = vi.hoisted(() => ({
  mockOpenWalletModal: vi.fn(),
}));

vi.mock("@/config/appkit", () => ({
  appKit: { open: mockOpenWalletModal },
  wagmiConfig: {},
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: null, isConnected: false }),
}));

// Mock wagmi
vi.mock("@wagmi/core", () => ({
  getAccount: vi.fn(() => ({ connector: null })),
}));

// Mock Navigate component
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate">Navigate to {to}</div>,
  };
});

describe("Login", () => {
  const toastInfoSpy = vi.spyOn(toastService, "info").mockImplementation(vi.fn());
  const toastSuccessSpy = vi.spyOn(toastService, "success").mockImplementation(vi.fn());
  const toastErrorSpy = vi.spyOn(toastService, "error").mockImplementation(vi.fn());

  beforeEach(() => {
    vi.clearAllMocks();
    toastInfoSpy.mockClear();
    toastSuccessSpy.mockClear();
    toastErrorSpy.mockClear();

    const baseAuthState = {
      walletAddress: null,
      smartAccountClient: null,
      createPasskey: mockCreatePasskey,
      connectWallet: mockConnectWallet,
      authMode: null as "passkey" | "wallet" | null,
      isAuthenticated: false,
      error: null as Error | null,
      isAuthenticating: false,
    };

    mockUseAuth.mockImplementation(() => ({ ...baseAuthState }));

    mockUseAutoJoinRootGarden.mockImplementation(() => ({
      joinGarden: mockJoinGarden,
      isPending: false,
      isGardener: false,
      isLoading: false,
      hasPrompted: false,
      showPrompt: false,
      dismissPrompt: vi.fn(),
    }));
  });

  it("should render Splash component with primary login button", () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText(/Login with wallet/i)).toBeInTheDocument();
  });

  it("should show wallet login link as secondary option", () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    const walletLink = screen.getByRole("button", { name: /Login with wallet/i });
    expect(walletLink).toBeInTheDocument();
    expect(walletLink).toHaveClass("underline");
  });

  it("should trigger AppKit modal on wallet login click", async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    const walletLink = screen.getByText(/Login with wallet/i);
    await user.click(walletLink);

    expect(mockOpenWalletModal).toHaveBeenCalled();
  });

  it("should show error message when there is an error", () => {
    mockUseAuth.mockImplementation(() => ({
      walletAddress: null,
      smartAccountClient: null,
      createPasskey: mockCreatePasskey,
      connectWallet: mockConnectWallet,
      authMode: null as "passkey" | "wallet" | null,
      isAuthenticated: false,
      error: new Error("Test error message"),
      isAuthenticating: false,
    }));

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByText(/Test error message/i)).toBeInTheDocument();
  });

  it("should hide error message while authenticating (cleared on retry)", () => {
    mockUseAuth.mockImplementation(() => ({
      walletAddress: null,
      smartAccountClient: null,
      createPasskey: mockCreatePasskey,
      connectWallet: mockConnectWallet,
      authMode: null as "passkey" | "wallet" | null,
      isAuthenticated: false,
      error: new Error("Test error message"),
      isAuthenticating: true,
    }));

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.queryByText(/Test error message/i)).not.toBeInTheDocument();
  });

  it("should redirect to home when authenticated", () => {
    mockUseAuth.mockReturnValue({
      walletAddress: null,
      smartAccountClient: { account: {} } as any,
      createPasskey: mockCreatePasskey,
      connectWallet: mockConnectWallet,
      authMode: "passkey" as "passkey" | "wallet" | null,
      isAuthenticated: true,
      error: null,
      isAuthenticating: false,
    });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByTestId("navigate")).toHaveTextContent("Navigate to /home");
  });
});
