/**
 * Login View
 *
 * Handles user authentication via passkey (primary) or wallet (fallback).
 * Features:
 * - Passkey authentication with biometric WebAuthn
 * - AppKit wallet connection for operators/admins
 * - Auto-join root garden on first passkey login
 * - Mobile-first splash screen UI
 *
 * @module views/Login
 */

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { Splash } from "@/components/Layout/Splash";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAutoJoinRootGarden } from "@/hooks/garden/useAutoJoinRootGarden";
import { createLogger } from "@/utils/app/logger";
import { getAccount } from "@wagmi/core";
import { wagmiConfig, appKit } from "@/config/appkit";

const logger = createLogger("Login");

/**
 * Loading states for the passkey creation and garden join flow
 */
type LoadingState = "idle" | "creating" | "joining" | "complete";

/**
 * Login component - Primary entry point for user authentication
 *
 * Flow:
 * 1. Show splash screen with "Login" button (passkey)
 * 2. Show "Login with wallet" text link (AppKit)
 * 3. On passkey: Create WebAuthn credential → Initialize smart account → Auto-join root garden
 * 4. On wallet: Open AppKit modal → Connect wallet → Navigate to home
 *
 * @returns {JSX.Element} Login view with authentication options
 */
export function Login() {
  const {
    walletAddress,
    createPasskey,
    connectWallet,
    isCreating,
    smartAccountClient,
    error,
    isAuthenticated,
  } = useAuth();

  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const { joinGarden, isPending: isJoiningGarden } = useAutoJoinRootGarden(false);

  // Use wagmi's useAccount hook to detect wallet connection
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();

  // Redirect if already authenticated
  if (isAuthenticated && loadingState === "idle") {
    return <Navigate to="/home" replace />;
  }

  // Watch wagmi connection and sync to auth provider
  useEffect(() => {
    if (wagmiConnected && wagmiAddress && !walletAddress) {
      // Sync wallet connection to our auth provider
      const connector = getAccount(wagmiConfig).connector;
      if (connector) {
        logger.log("Syncing wallet connection to auth provider", { address: wagmiAddress });
        connectWallet(connector).catch((err) => {
          logger.error("Failed to sync wallet connection", err);
        });
      }
    }
  }, [wagmiConnected, wagmiAddress, walletAddress, connectWallet]);

  /**
   * Wait for smart account client to be initialized after passkey creation.
   * Polls for up to 10 seconds with 100ms intervals.
   *
   * @throws {Error} If smart account client is not ready within timeout
   */
  const waitForSmartAccountReady = async (): Promise<void> => {
    const maxAttempts = 100; // 10 seconds
    const interval = 100; // 100ms

    for (let i = 0; i < maxAttempts; i++) {
      if (smartAccountClient) {
        logger.log("Smart account client ready", { attempt: i });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error("Smart account client not ready after timeout");
  };

  /**
   * Handle passkey creation and auto-join root garden.
   * Shows loading states during each phase of the process.
   *
   * Error handling:
   * - Passkey creation failure: Show error, stay on login screen
   * - Garden join failure: Continue to home, show info toast for manual join
   */
  const handleCreatePasskey = async () => {
    try {
      setLoadingState("creating");
      logger.log("Starting passkey creation");

      await createPasskey();
      logger.log("Passkey created successfully");

      // Wait for smart account client to be ready
      await waitForSmartAccountReady();
      logger.log("Smart account ready, starting garden join");

      setLoadingState("joining");
      try {
        await joinGarden();
        logger.log("Garden join successful");
        setLoadingState("complete");
      } catch (joinErr) {
        // Garden join failed - continue to home anyway
        logger.error("Garden join failed during onboarding", joinErr);
        toast("Welcome! You can join the community garden from your profile.", {
          icon: "ℹ️",
        });
        setLoadingState("complete");
        // Navigate will happen automatically via the Navigate component
      }
    } catch (err) {
      setLoadingState("idle");
      logger.error("Passkey creation failed", err);
      toast.error("Failed to create passkey. Please try again.");
    }
  };

  /**
   * Handle wallet login via AppKit modal.
   * Opens the wallet selection bottom sheet.
   */
  const handleWalletLogin = () => {
    logger.log("Opening AppKit wallet modal");
    appKit.open();
  };

  // Loading screen during passkey creation and garden join
  if (loadingState !== "idle") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-4">
        <img src="/icon.png" alt="Green Goods" width={120} className="mb-8 animate-pulse" />
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">
            {loadingState === "creating" && "Creating your wallet..."}
            {loadingState === "joining" && "Joining Green Goods community..."}
            {loadingState === "complete" && "Welcome! 🌱"}
          </h2>
          <p className="text-gray-600">
            {loadingState === "creating" && "Setting up your secure passkey wallet"}
            {loadingState === "joining" && "Adding you to the community garden"}
            {loadingState === "complete" && "Taking you to your dashboard"}
          </p>
        </div>
      </div>
    );
  }

  // Main splash screen
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white">
      <Splash
        login={handleCreatePasskey}
        isLoggingIn={isCreating || isJoiningGarden}
        buttonLabel={loadingState !== "idle" ? "Creating Wallet..." : "Login"}
      />

      {/* Secondary wallet login option */}
      {!isCreating && !isJoiningGarden && (
        <button
          onClick={handleWalletLogin}
          className="mt-4 text-sm text-gray-600 hover:text-green-600 transition-colors underline"
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
