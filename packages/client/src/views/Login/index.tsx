import { ONBOARDED_STORAGE_KEY, wagmiConfig } from "@green-goods/shared/config";
import { usePasskeyAuth as useAuth, useAutoJoinRootGarden } from "@green-goods/shared/hooks";
import { useAppKit } from "@green-goods/shared/providers";
import { getAccount } from "@wagmi/core";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAccount } from "wagmi";
import { type LoadingState, Splash } from "@/components/Layout/Splash";

const buildOnboardedKey = (address?: string | null) =>
  address ? `${ONBOARDED_STORAGE_KEY}:${address.toLowerCase()}` : ONBOARDED_STORAGE_KEY;

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
  } = useAuth();

  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>(undefined);
  const { open: openAppKit } = useAppKit();
  const {
    joinGarden,
    isPending: isJoiningGarden,
    isGardener,
    checkMembership,
  } = useAutoJoinRootGarden(false);

  // Use wagmi's useAccount hook to detect wallet connection
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();

  // Check if we're on a nested route (like /login/recover)
  const isNestedRoute = location.pathname !== "/login";

  // Onboarding status is tracked in localStorage directly via buildOnboardedKey

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

      const session = await createPasskey();
      const onboardingKey = buildOnboardedKey(session.address);
      const alreadyOnboarded =
        localStorage.getItem(onboardingKey) === "true" ||
        localStorage.getItem(ONBOARDED_STORAGE_KEY) === "true";

      let alreadyGardener = isGardener;
      if (!alreadyOnboarded || !alreadyGardener) {
        alreadyGardener = await checkMembership(session.address);
      }

      if (alreadyGardener || alreadyOnboarded) {
        localStorage.setItem(onboardingKey, "true");
        setLoadingState(null);
        setLoadingMessage(undefined);
        return;
      }

      setLoadingState("joining-garden");
      setLoadingMessage("Approve the next passkey prompt to join the community garden.");
      toast("Please approve the next passkey prompt to join the community garden.", {
        icon: "🪴",
      });

      try {
        await joinGarden(session);
        localStorage.setItem(onboardingKey, "true");
        toast.success("Welcome! You're now part of the Green Goods community garden.");
      } catch (joinErr) {
        const message =
          joinErr instanceof Error ? joinErr.message : String(joinErr ?? "failed to join");

        // Ignore AlreadyGardener (0x42375a1e) to keep the flow simple
        if (!message.includes("AlreadyGardener") && !message.includes("0x42375a1e")) {
          console.error("Garden join failed", joinErr);
          toast("Welcome! You can join the community garden from your profile.", {
            icon: "ℹ️",
          });
        } else {
          localStorage.setItem(onboardingKey, "true");
        }
      }
    } catch (err) {
      setLoadingState(null);
      console.error("Passkey creation failed", err);
      toast.error("Failed to create passkey. Please try again.");
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
      tertiaryAction={
        !isAuthenticating && !isJoiningGarden
          ? {
              label: "Recover account",
              href: "/login/recover",
            }
          : undefined
      }
    />
  );
}

export default Login;
