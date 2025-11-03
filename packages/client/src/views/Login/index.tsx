import { toastService } from "@green-goods/shared";
import { wagmiConfig } from "@green-goods/shared/config";
import { usePasskeyAuth as useAuth, useAutoJoinRootGarden } from "@green-goods/shared/hooks";
import {
  authenticatePasskey,
  PASSKEY_STORAGE_KEY,
  type PasskeySession,
} from "@green-goods/shared/modules";
import { useAppKit } from "@green-goods/shared/providers";
import { getAccount } from "@wagmi/core";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAccount } from "wagmi";
import { type LoadingState, Splash } from "@/components/Layout/Splash";
import { checkMembership } from "@/hooks/garden/useAutoJoinRootGarden";

export function Login() {
  const location = useLocation();
  const {
    walletAddress,
    createPasskey,
    connectWallet,
    isAuthenticating,
    smartAccountClient,
    authMode,
    error,
    isAuthenticated,
    setPasskeySession,
  } = useAuth();

  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>(undefined);
  const { open: openAppKit } = useAppKit();
  const {
    joinGarden,
    isLoading: isJoiningGarden,
    isGardener: _isGardener,
  } = useAutoJoinRootGarden();

  // Use wagmi's useAccount hook to detect wallet connection
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();

  // Check if we're on a nested route (like /login/recover)
  const isNestedRoute = location.pathname !== "/login";

  // Watch wagmi connection and sync to auth provider
  useEffect(() => {
    if (!wagmiConnected || !wagmiAddress || walletAddress || isAuthenticating) {
      return;
    }

    const account = getAccount(wagmiConfig);
    const connector = account.connector;
    if (connector) {
      console.log("Syncing wallet connection to auth provider", { address: wagmiAddress });
      connectWallet(connector).catch((err) => {
        console.error("Failed to sync wallet connection", err);
      });
    }
  }, [wagmiConnected, wagmiAddress, walletAddress, connectWallet, isAuthenticating]);
  const handleCreatePasskey = async () => {
    setLoadingMessage("Preparing your Green Goods wallet…");
    try {
      setLoadingState("welcome");

      // Check if user has existing passkey credential
      const hasExistingCredential = !!localStorage.getItem(PASSKEY_STORAGE_KEY);

      let session: PasskeySession;

      if (hasExistingCredential) {
        // Returning user: prompt for passkey authentication
        setLoadingMessage("Authenticating with your passkey…");
        session = await authenticatePasskey();
        // Set the session in the auth provider
        setPasskeySession(session);
      } else {
        // New user: create passkey
        session = await createPasskey();
      }

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
    console.log("Opening AppKit wallet modal");
    openAppKit();
  };

  // If on a nested route (like /login/recover), render the child route
  if (isNestedRoute) {
    return <Outlet />;
  }

  if (isAuthenticated && (authMode === "wallet" || smartAccountClient)) {
    return <Navigate to="/home" replace />;
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
