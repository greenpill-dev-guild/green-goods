import { toastService } from "@green-goods/shared";
import { checkMembership, useAutoJoinRootGarden } from "@green-goods/shared/hooks";
import { PASSKEY_STORAGE_KEY, type PasskeySession } from "@green-goods/shared/modules";
import { useAppKit, useClientAuth } from "@green-goods/shared/providers";
import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { type LoadingState, Splash } from "@/components/Layout/Splash";

export function Login() {
  const location = useLocation();
  const {
    signInWithPasskey,
    isAuthenticating,
    smartAccountClient,
    authMode,
    error,
    isAuthenticated,
    setPasskeySession,
  } = useClientAuth();

  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>(undefined);
  const { open: openAppKit } = useAppKit();

  // Check if DevConnect is enabled via environment variable
  const isDevConnectEnabled = import.meta.env.VITE_DEVCONNECT === "true";

  const {
    joinGarden,
    isLoading: isJoiningGarden,
    isGardener: _isGardener,
    devConnect,
  } = useAutoJoinRootGarden();

  // Check if we're on a nested route (like /login/recover)
  const isNestedRoute = location.pathname !== "/login";

  // Extract redirectTo parameter from URL query string
  const redirectTo = new URLSearchParams(location.search).get("redirectTo") || "/home";

  // Note: Wallet connection is automatically synced by PasskeyAuthProvider's watchAccount effect
  // No manual sync needed here
  const handleCreatePasskey = async () => {
    setLoadingMessage("Preparing your Green Goods wallet…");
    try {
      setLoadingState("welcome");

      // Check if user has existing passkey credential
      const hasExistingCredential = !!localStorage.getItem(PASSKEY_STORAGE_KEY);

      setLoadingMessage(hasExistingCredential ? "Authenticating with your passkey…" : undefined);
      const session: PasskeySession = await signInWithPasskey();
      setPasskeySession(session);

      // Check membership BEFORE showing any toast
      const membershipStatus = await checkMembership(session.address);
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
          await joinGarden(session);
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
          const onboardingKey = `greengoods_onboarded:${session.address.toLowerCase()}`;
          localStorage.setItem(onboardingKey, "true");
        }
      }

      // 2. DevConnect Join (New)
      if (isDevConnectEnabled && devConnect.isEnabled && !devConnect.isMember) {
        // Check local storage to avoid re-prompting if they skipped or are pending
        const dcKey = `greengoods_devconnect_onboarded:${session.address.toLowerCase()}`;
        const isDcOnboarded = localStorage.getItem(dcKey) === "true";

        if (!isDcOnboarded) {
          setLoadingState("joining-garden"); // Re-use loading state
          setLoadingMessage("Joining DevConnect Garden...");
          try {
            await devConnect.join(session);
            toastService.success({ title: "Joined DevConnect!", context: "devconnect" });
          } catch (e) {
            console.error("DevConnect join failed", e);
            // Non-blocking failure
          }
        }
      }
    } catch (err) {
      setLoadingState(null);
      console.error("Passkey authentication failed", err);
      toastService.error({
        title: "Authentication failed",
        message: err instanceof Error ? err.message : "Please try again.",
        context: "passkey setup",
        error: err,
      });
    } finally {
      setLoadingState(null);
      setLoadingMessage(undefined);
    }
  };

  const handleWalletLogin = () => {
    openAppKit();
  };

  // If on a nested route (like /login/recover), render the child route
  if (isNestedRoute) {
    return <Outlet />;
  }

  if (isAuthenticated && (authMode === "wallet" || smartAccountClient)) {
    return <Navigate to={redirectTo} replace />;
  }

  // Loading screen during passkey creation, garden join, or welcome back
  if (loadingState) {
    return <Splash loadingState={loadingState} message={loadingMessage} />;
  }

  const errorMessage = !isAuthenticating && !isJoiningGarden && error ? error.message : null;

  // Main splash screen with login button
  return (
    <Splash
      login={handleCreatePasskey}
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
