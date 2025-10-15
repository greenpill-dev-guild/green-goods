/**
 * Login View Test Suite
 *
 * Tests the passkey-first login view with Splash UI and AppKit integration
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Login } from "../../views/Login";

// Mock useAuth hook
const mockCreatePasskey = vi.fn();
const mockConnectWallet = vi.fn();
const mockUseAuth = vi.fn(() => ({
  walletAddress: null,
  smartAccountClient: null,
  createPasskey: mockCreatePasskey,
  connectWallet: mockConnectWallet,
  isCreating: false,
  isAuthenticated: false,
  error: null,
}));

vi.mock("@/hooks/auth/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useAutoJoinRootGarden hook
const mockJoinGarden = vi.fn();
const mockUseAutoJoinRootGarden = vi.fn(() => ({
  joinGarden: mockJoinGarden,
  isPending: false,
  isGardener: false,
  isLoading: false,
  hasPrompted: false,
  showPrompt: false,
  dismissPrompt: vi.fn(),
}));

vi.mock("@/hooks/garden/useAutoJoinRootGarden", () => ({
  useAutoJoinRootGarden: () => mockUseAutoJoinRootGarden(),
}));

// Mock AppKit hooks
const mockOpenWalletModal = vi.fn();
const mockUseAppKit = vi.fn(() => ({
  open: mockOpenWalletModal,
}));

const mockUseAppKitAccount = vi.fn(() => ({
  address: null,
  isConnected: false,
}));

vi.mock("@reown/appkit/react", () => ({
  useAppKit: () => mockUseAppKit(),
  useAppKitAccount: () => mockUseAppKitAccount(),
}));

// Mock wagmi
vi.mock("@wagmi/core", () => ({
  getAccount: vi.fn(() => ({ connector: null })),
}));

// Mock toast
vi.mock("react-hot-toast", () => ({
  default: vi.fn(),
  error: vi.fn(),
}));

// Mock logger
vi.mock("@/utils/app/logger", () => ({
  createLogger: () => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
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
  beforeEach(() => {
    vi.clearAllMocks();
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

    const walletLink = screen.getByText(/Login with wallet/i);
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
    mockUseAuth.mockReturnValue({
      walletAddress: null,
      smartAccountClient: null,
      createPasskey: mockCreatePasskey,
      connectWallet: mockConnectWallet,
      isCreating: false,
      isAuthenticated: false,
      error: new Error("Test error message"),
    });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByText(/Test error message/i)).toBeInTheDocument();
  });

  it("should redirect to home when authenticated", () => {
    mockUseAuth.mockReturnValue({
      walletAddress: null,
      smartAccountClient: { account: {} },
      createPasskey: mockCreatePasskey,
      connectWallet: mockConnectWallet,
      isCreating: false,
      isAuthenticated: true,
      error: null,
    });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByTestId("navigate")).toHaveTextContent("Navigate to /home");
  });
});
