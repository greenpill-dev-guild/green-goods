/**
 * Login View Test Suite
 *
 * Tests for the Login view component, focusing on button labels
 * and user flow states.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock shared package hooks
vi.mock("@green-goods/shared/hooks", () => ({
  useAuth: vi.fn(),
  useAutoJoinRootGarden: vi.fn(),
  checkMembership: vi.fn(),
}));

// Mock shared package modules
vi.mock("@green-goods/shared/modules", () => ({
  hasStoredUsername: vi.fn(),
  getStoredUsername: vi.fn(),
}));

// Mock shared package config
vi.mock("@green-goods/shared/config", () => ({
  APP_NAME: "Green Goods",
}));

// Mock toast service
vi.mock("@green-goods/shared", () => ({
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Import mocked modules to control their behavior
import { useAuth, useAutoJoinRootGarden } from "@green-goods/shared/hooks";
import { getStoredUsername, hasStoredUsername } from "@green-goods/shared/modules";
import { Login } from "../../views/Login";

// Type the mocked functions
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockUseAutoJoinRootGarden = useAutoJoinRootGarden as ReturnType<typeof vi.fn>;
const mockHasStoredUsername = hasStoredUsername as ReturnType<typeof vi.fn>;
const mockGetStoredUsername = getStoredUsername as ReturnType<typeof vi.fn>;

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default auth state: unauthenticated new user
    mockUseAuth.mockReturnValue({
      loginWithPasskey: vi.fn(),
      createAccount: vi.fn(),
      loginWithWallet: vi.fn(),
      isAuthenticating: false,
      isAuthenticated: false,
      isReady: true,
      smartAccountAddress: null,
      hasStoredCredential: false,
      error: null,
    });

    mockUseAutoJoinRootGarden.mockReturnValue({
      joinGarden: vi.fn(),
      isLoading: false,
    });

    // No stored credentials (new user)
    mockHasStoredUsername.mockReturnValue(false);
    mockGetStoredUsername.mockReturnValue(null);
  });

  describe("Button Labels (BUG-001)", () => {
    it('should display "Sign Up" as the primary button for new users', () => {
      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Login />
        </MemoryRouter>
      );

      const loginButton = screen.getByTestId("login-button");
      expect(loginButton).toHaveTextContent("Sign Up");
    });

    it('should display "Login" as the secondary action for new users', () => {
      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Login />
        </MemoryRouter>
      );

      // Secondary action button shows "Login" for returning users
      expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
    });

    it('should display "Login with wallet" as tertiary action', () => {
      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Login />
        </MemoryRouter>
      );

      expect(screen.getByRole("button", { name: /login with wallet/i })).toBeInTheDocument();
    });

    it('should display "Create Account" when in registration flow', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Login />
        </MemoryRouter>
      );

      // Click "Sign Up" to enter registration flow
      const signUpButton = screen.getByTestId("login-button");
      await user.click(signUpButton);

      // Button should now show "Create Account"
      expect(screen.getByTestId("login-button")).toHaveTextContent("Create Account");
    });

    it('should display "Login as {username}" for returning users with stored credentials', () => {
      // Simulate returning user
      mockUseAuth.mockReturnValue({
        loginWithPasskey: vi.fn(),
        createAccount: vi.fn(),
        loginWithWallet: vi.fn(),
        isAuthenticating: false,
        isAuthenticated: false,
        isReady: true,
        smartAccountAddress: null,
        hasStoredCredential: true,
        error: null,
      });
      mockHasStoredUsername.mockReturnValue(true);
      mockGetStoredUsername.mockReturnValue("testuser");

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Login />
        </MemoryRouter>
      );

      const loginButton = screen.getByTestId("login-button");
      expect(loginButton).toHaveTextContent("Login as testuser");
    });

    it('should show "Login" button label when in login flow (returning users entering username)', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Login />
        </MemoryRouter>
      );

      // Click "Login" secondary action to enter login flow
      const loginSecondary = screen.getByRole("button", { name: "Login" });
      await user.click(loginSecondary);

      // Primary button should show "Login"
      expect(screen.getByTestId("login-button")).toHaveTextContent("Login");
    });
  });

  describe("User Interactions", () => {
    it("should show username input when Sign Up is clicked", async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Login />
        </MemoryRouter>
      );

      await user.click(screen.getByTestId("login-button"));

      // Username input should be visible
      expect(screen.getByPlaceholderText("Choose a username")).toBeInTheDocument();
    });

    it("should show Cancel button when in registration flow", async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Login />
        </MemoryRouter>
      );

      await user.click(screen.getByTestId("login-button"));

      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("should return to initial state when Cancel is clicked", async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Login />
        </MemoryRouter>
      );

      // Enter registration flow
      await user.click(screen.getByTestId("login-button"));
      expect(screen.getByTestId("login-button")).toHaveTextContent("Create Account");

      // Cancel
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      // Should be back to initial state with "Sign Up"
      expect(screen.getByTestId("login-button")).toHaveTextContent("Sign Up");
    });
  });
});
