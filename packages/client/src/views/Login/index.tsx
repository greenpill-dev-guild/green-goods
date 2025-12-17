import { toastService } from "@green-goods/shared";
import { checkMembership, useAutoJoinRootGarden, useAuth } from "@green-goods/shared/hooks";
import { hasStoredPasskey } from "@green-goods/shared/modules";
import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { type LoadingState, Splash } from "@/components/Layout";

export function Login() {
  const location = useLocation();
  const {
    loginWithPasskey,
    createAccount,
    loginWithWallet,
    isAuthenticating,
    isAuthenticated,
    isReady,
    smartAccountAddress,
    hasStoredCredential,
  } = useAuth();

  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>(undefined);
  const [loginError, setLoginError] = useState<string | null>(null);

  const { joinGarden, isLoading: isJoiningGarden } = useAutoJoinRootGarden();

  // Check if we're on a nested route (like /login/recover)
  const isNestedRoute = location.pathname !== "/login";

  // Check if user came from explicit logout - ignore redirectTo in that case
  const locationState = location.state as { fromLogout?: boolean } | null;
  const fromLogout = locationState?.fromLogout === true;

  // Extract redirectTo parameter from URL query string, default to /home
  // If coming from explicit logout, always go to /home
  const redirectTo = fromLogout
    ? "/home"
    : new URLSearchParams(location.search).get("redirectTo") || "/home";

  const handlePasskeyLogin = async () => {
    setLoginError(null);
    setLoadingMessage("Preparing your wallet…");
    try {
      setLoadingState("welcome");

      // Check if user has existing passkey
      const hasExistingCredential = hasStoredCredential || hasStoredPasskey();
      setLoadingMessage(hasExistingCredential ? "Authenticating..." : "Creating your wallet...");

      // Use the appropriate flow based on whether user has stored credential
      if (hasExistingCredential && loginWithPasskey) {
        await loginWithPasskey();
      } else if (createAccount) {
        await createAccount();
      } else if (loginWithPasskey) {
        // Fallback to loginWithPasskey which will create if needed
        await loginWithPasskey();
      }

      // Wait briefly for state to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get the smart account address from the auth state
      const address = smartAccountAddress;
      if (!address) {
        throw new Error("Authentication succeeded but no address available");
      }

      // Check membership BEFORE showing any toast
      const membershipStatus = await checkMembership(address);
      const isAlreadyGardener = membershipStatus.isGardener || membershipStatus.hasBeenOnboarded;

      // Only show join flow if user is NOT already a gardener
      if (!isAlreadyGardener) {
        setLoadingState("joining-garden");
        setLoadingMessage("Approve the next passkey prompt to join the community garden.");
        toastService.info({
          title: "Approve passkey prompt",
          message: "Confirm the next passkey request to join the community garden.",
          icon: "🪴",
          context: "garden join",
          suppressLogging: true,
        });

        try {
          // Create a minimal session object for joinGarden
          const session = { address, client: null as unknown };
          await joinGarden(session as Parameters<typeof joinGarden>[0]);
          toastService.success({
            title: "Welcome to Green Goods",
            message: "You're now part of the community garden.",
            icon: "🪴",
            context: "garden join",
            suppressLogging: true,
          });
        } catch (joinErr) {
          console.error("Garden join failed", joinErr);
          toastService.info({
            title: "Welcome!",
            message: "You can join the community garden anytime from your profile.",
            icon: "ℹ️",
            context: "garden join",
            suppressLogging: true,
          });
        }
      } else {
        // Already a gardener, just mark as onboarded (if not already)
        if (!membershipStatus.hasBeenOnboarded) {
          const onboardingKey = `greengoods_onboarded:${address.toLowerCase()}`;
          localStorage.setItem(onboardingKey, "true");
        }
      }
    } catch (err) {
      setLoadingState(null);
      console.error("Passkey authentication failed", err);

      // Set user-friendly error message without toast
      const friendlyMessage = getFriendlyErrorMessage(err);
      setLoginError(friendlyMessage);
    } finally {
      setLoadingState(null);
      setLoadingMessage(undefined);
    }
  };

  // Convert technical errors to user-friendly messages
  const getFriendlyErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
      const message = err.message.toLowerCase();

      // User cancelled passkey prompt
      if (
        message.includes("cancel") ||
        message.includes("abort") ||
        message.includes("user deny")
      ) {
        return "Login cancelled. Please try again when ready.";
      }

      // Passkey not supported or available
      if (message.includes("not support") || message.includes("unavailable")) {
        return "Passkey authentication is not available on this device. Try using 'Login with wallet' instead.";
      }

      // Network or timeout issues
      if (message.includes("network") || message.includes("timeout") || message.includes("fetch")) {
        return "Connection issue. Please check your internet and try again.";
      }

      // Generic passkey errors
      if (message.includes("credential") || message.includes("passkey")) {
        return "Couldn't verify your passkey. Please try again or use 'Login with wallet'.";
      }
    }

    // Fallback for unknown errors
    return "Something went wrong. Please try again or use 'Login with wallet'.";
  };

  const handleWalletLogin = () => {
    loginWithWallet?.();
  };

  // If on a nested route (like /login/recover), render the child route
  if (isNestedRoute) {
    return <Outlet />;
  }

  // Wait for auth to be ready before showing login or redirecting
  // This prevents the login screen flash during auth restoration on page refresh
  if (!isReady) {
    return <Splash loadingState="welcome" />;
  }

  // Redirect to app once authenticated (both passkey and wallet)
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // Loading screen during passkey creation, garden join, or welcome back
  if (loadingState) {
    return <Splash loadingState={loadingState} message={loadingMessage} />;
  }

  // Use local error state instead of provider error for better control
  const errorMessage = !isAuthenticating && !isJoiningGarden ? loginError : null;

  // Main splash screen with login button
  return (
    <Splash
      login={handlePasskeyLogin}
      isLoggingIn={isAuthenticating || isJoiningGarden}
      buttonLabel="Login"
      errorMessage={errorMessage}
      secondaryAction={
        !isAuthenticating && !isJoiningGarden
          ? {
              label: "Login with wallet",
              onSelect: handleWalletLogin,
            }
          : undefined
      }
    />
  );
}

export default Login;
