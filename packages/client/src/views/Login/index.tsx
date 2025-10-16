/**
 * Login View
 *
 * Handles user authentication via passkey (primary) or wallet (fallback).
 * Features:
 * - Passkey authentication with biometric WebAuthn
 * - AppKit wallet connection for operators/admins
 * - Auto-join root garden on first passkey login
 * - Enhanced loading states for onboarding flow
 * - Mobile-first splash screen UI
 *
 * @module views/Login
 */

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { Splash, type LoadingState } from "@/components/Layout/Splash";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAutoJoinRootGarden } from "@/hooks/garden/useAutoJoinRootGarden";
import { getAccount } from "@wagmi/core";
import { wagmiConfig, appKit } from "@/config/appkit";

const ONBOARDED_STORAGE_KEY = "greengoods_user_onboarded";

/**
 * Login component - Primary entry point for user authentication
 *
 * Flow:
 * 1. Check if user is onboarded (returning user)
 * 2. Show splash screen with "Login" button (passkey) or "Login with wallet" link
 * 3. On passkey first-time:
 *    - Create WebAuthn credential → Show "Creating your garden account..."
 *    - Initialize smart account → Show "Joining community garden..."
 *    - Auto-join root garden (sponsored) → Set onboarded flag → Navigate to home
 * 4. On passkey returning:
 *    - Authenticate → Show "Welcome back..." → Navigate to home
 * 5. On wallet: Open AppKit modal → Connect wallet → Navigate to home
 *
 * @returns {JSX.Element} Login view with authentication options
 */
export function Login() {
  const {
    walletAddress,
    createPasskey,
    connectWallet,
    isAuthenticating,
    smartAccountClient,
    error,
    isAuthenticated,
  } = useAuth();

  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  const [isFirstTime, setIsFirstTime] = useState<boolean>(false);
  const { joinGarden, isPending: isJoiningGarden } = useAutoJoinRootGarden(false);

  // Use wagmi's useAccount hook to detect wallet connection
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();

  // Check if user is onboarded on mount
  useEffect(() => {
    const isOnboarded = localStorage.getItem(ONBOARDED_STORAGE_KEY) === "true";
    setIsFirstTime(!isOnboarded);
    console.log("User onboarding status", { isOnboarded, isFirstTime: !isOnboarded });
  }, []);

  // Handle redirects when authentication is complete
  useEffect(() => {
    // Only redirect when fully authenticated and not in loading state
    if (isAuthenticated && !loadingState && smartAccountClient) {
      // Show welcome back briefly for returning users
      if (!isFirstTime) {
        setLoadingState("welcome-back");
        setTimeout(() => {
          // Navigate will happen automatically
        }, 1500);
      } else {
        // Navigate immediately for first-time users
      }
    }
  }, [isAuthenticated, loadingState, smartAccountClient, isFirstTime]);

  // Watch wagmi connection and sync to auth provider
  useEffect(() => {
    if (wagmiConnected && wagmiAddress && !walletAddress) {
      // Sync wallet connection to our auth provider
      const connector = getAccount(wagmiConfig).connector;
      if (connector) {
        console.log("Syncing wallet connection to auth provider", { address: wagmiAddress });
        connectWallet(connector).catch((err) => {
          console.error("Failed to sync wallet connection", err);
        });
      }
    }
  }, [wagmiConnected, wagmiAddress, walletAddress, connectWallet]);

  /**
   * Wait for authentication to be fully ready after passkey creation.
   * Polls for up to 10 seconds with 100ms intervals.
   *
   * @throws {Error} If authentication is not ready within timeout
   */
  const waitForAuthenticationReady = async (): Promise<void> => {
    const maxAttempts = 100; // 10 seconds
    const interval = 100; // 100ms

    for (let i = 0; i < maxAttempts; i++) {
      if (isAuthenticated && smartAccountClient) {
        console.log("Authentication ready", { attempt: i });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error("Authentication not ready after timeout");
  };

  /**
   * Handle passkey creation and auto-join root garden.
   * Shows appropriate loading states during each phase.
   *
   * First-time users:
   * 1. Create passkey → "Creating your garden account..."
   * 2. Initialize smart account
   * 3. Join root garden (sponsored) → "Joining community garden..."
   * 4. Set onboarded flag → Navigate to home
   *
   * Error handling:
   * - Passkey creation failure: Show error, stay on login screen
   * - Garden join failure: Continue to home, show info toast for manual join
   */
  const handleCreatePasskey = async () => {
    try {
      // First-time users: Show account creation state
      if (isFirstTime) {
        setLoadingState("creating-account");
      }

      console.log("Starting passkey creation", { isFirstTime });

      await createPasskey();
      console.log("Passkey created successfully");

      // Wait for authentication to be ready
      // await waitForAuthenticationReady();
      console.log("Authentication ready");

      // First-time users: Auto-join root garden with sponsored transaction
      if (isFirstTime) {
        setLoadingState("joining-garden");
        console.log("Starting root garden join for first-time user");

        try {
          await joinGarden();
          console.log("Garden join successful");

          // Mark user as onboarded
          localStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
          console.log("User marked as onboarded");

          // Brief success state before navigation
          setTimeout(() => {
            // Navigate will happen automatically via the Navigate component
          }, 1000);
        } catch (joinErr) {
          // Garden join failed - continue to home anyway
          console.error("Garden join failed during onboarding", joinErr);
          toast("Welcome! You can join the community garden from your profile.", {
            icon: "ℹ️",
          });
          // Still mark as onboarded so they don't see the flow again
          localStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
        }
      } else {
        // Returning user: Show welcome back
        setLoadingState("welcome-back");
        setTimeout(() => {
          // Navigate will happen automatically
        }, 1000);
      }
    } catch (err) {
      setLoadingState(null);
      console.error("Passkey creation failed", err);
      toast.error("Failed to create passkey. Please try again.");
    }
  };

  /**
   * Handle wallet login via AppKit modal.
   * Opens the wallet selection bottom sheet.
   */
  const handleWalletLogin = () => {
    console.log("Opening AppKit wallet modal");
    appKit.open();
  };

  // Loading screen during passkey creation, garden join, or welcome back
  if (loadingState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white">
        <Splash loadingState={loadingState} />
      </div>
    );
  }

  // Main splash screen with login button
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white">
      <Splash
        login={handleCreatePasskey}
        isLoggingIn={isAuthenticating || isJoiningGarden}
        buttonLabel="Login"
      />

      {/* Secondary wallet login option */}
      {!isAuthenticating && !isJoiningGarden && (
        <button
          onClick={handleWalletLogin}
          className="my-4 text-sm text-gray-600 hover:text-green-600 transition-colors underline"
        >
          Login with wallet
        </button>
      )}

      {/* Error display */}
      {error && (
        <div className="mt-6 max-w-md mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              <strong>Error:</strong> {error.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
