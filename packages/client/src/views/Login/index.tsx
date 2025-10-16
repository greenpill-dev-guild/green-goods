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

import { useState } from "react";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Splash, type LoadingState } from "@/components/Layout/Splash";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAutoJoinRootGarden } from "@/hooks/garden/useAutoJoinRootGarden";
import { appKit } from "@/config/appkit";

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
  const { createPasskey, isAuthenticating, error, isAuthenticated } = useAuth();
  const { joinGarden, isPending: isJoiningGarden } = useAutoJoinRootGarden(false);

  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState(
    () => localStorage.getItem(ONBOARDED_STORAGE_KEY) === "true"
  );

  const handleCreatePasskey = async () => {
    const firstTime = !hasOnboarded;

    try {
      setLoadingState(firstTime ? "creating-account" : "welcome-back");

      await createPasskey();

      if (firstTime) {
        setLoadingState("joining-garden");

        try {
          await joinGarden();
        } catch (joinError) {
          toast("Welcome! You can join the community garden from your profile.", {
            icon: "ℹ️",
          });
        }

        localStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
        setHasOnboarded(true);
      }

      setLoadingState(null);
    } catch (err) {
      setLoadingState(null);
      const message =
        err instanceof Error ? err.message : "Failed to create passkey. Please try again.";
      toast.error(message);
    }
  };

  /**
   * Handle wallet login via AppKit modal.
   * Opens the wallet selection bottom sheet.
   */
  const handleWalletLogin = () => {
    appKit.open();
  };

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  const isBusy = isAuthenticating || isJoiningGarden;
  const splashState = loadingState ?? undefined;

  // Main splash screen with login button
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white">
      <Splash
        login={handleCreatePasskey}
        isLoggingIn={isBusy}
        buttonLabel="Login"
        loadingState={splashState}
      />

      {/* Secondary wallet login option */}
      {!isBusy && (
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
