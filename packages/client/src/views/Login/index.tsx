import { getAccount } from "@wagmi/core";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Navigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { type LoadingState, Splash } from "@/components/Layout/Splash";
import { ONBOARDED_STORAGE_KEY } from "@/config/app";
import { appKit, wagmiConfig } from "@/config/appkit";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAutoJoinRootGarden } from "@/hooks/garden/useAutoJoinRootGarden";

export function Login() {
  const {
    walletAddress,
    createPasskey,
    connectWallet,
    isAuthenticating,
    smartAccountClient,
    authMode,
    error,
    isAuthenticated,
  } = useAuth();

  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState(
    () => localStorage.getItem(ONBOARDED_STORAGE_KEY) === "true"
  );
  const { joinGarden, isPending: isJoiningGarden } = useAutoJoinRootGarden(false);

  // Use wagmi's useAccount hook to detect wallet connection
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();

  const isFirstTime = !hasOnboarded;

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
  const handleCreatePasskey = async () => {
    try {
      const initialState = "welcome";
      setLoadingState(initialState);

      const session = await createPasskey();

      const joinLabel = "joining-garden";
      if (isFirstTime) {
        setLoadingState("joining-garden");
      }

      try {
        await joinGarden(session);
      } catch (joinErr) {
        const message =
          joinErr instanceof Error ? joinErr.message : String(joinErr ?? "failed to join");

        // Ignore AlreadyGardener (0x42375a1e) to keep the flow simple
        if (!message.includes("AlreadyGardener") && !message.includes("0x42375a1e")) {
          console.error("Garden join failed", joinErr);
          toast("Welcome! You can join the community garden from your profile.", {
            icon: "ℹ️",
          });
        }
      }

      localStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
      setHasOnboarded(true);

      if (!isFirstTime) {
        setLoadingState(null);
      } else {
        setLoadingState(joinLabel);
      }
    } catch (err) {
      setLoadingState(null);
      console.error("Passkey creation failed", err);
      toast.error("Failed to create passkey. Please try again.");
    }
  };

  const handleWalletLogin = () => {
    console.log("Opening AppKit wallet modal");
    appKit.open();
  };

  if (isAuthenticated && (authMode === "wallet" || smartAccountClient)) {
    return <Navigate to="/home" replace />;
  }

  // Loading screen during passkey creation, garden join, or welcome back
  if (loadingState) {
    return <Splash loadingState={loadingState} />;
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
