import { toastService } from "@green-goods/shared";
import { checkMembership, useAutoJoinRootGarden, useAuth } from "@green-goods/shared/hooks";
import { hasStoredUsername, getStoredUsername } from "@green-goods/shared/modules";
import { useState, useEffect, useRef } from "react";
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

  // Username state for new account creation
  const [showUsernameInput, setShowUsernameInput] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Track if we're in the middle of a login attempt (to trigger post-auth flow)
  const [pendingPostAuth, setPendingPostAuth] = useState(false);
  const hasRunPostAuth = useRef(false);

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

  // Check on mount if user has existing credentials
  const hasExistingAccount = hasStoredCredential || hasStoredUsername();
  const storedUsername = getStoredUsername();

  // Reset username input when returning to login screen
  useEffect(() => {
    if (!showUsernameInput) {
      setUsername("");
      setUsernameError(null);
    }
  }, [showUsernameInput]);

  // Handle post-authentication flow when isAuthenticated becomes true
  useEffect(() => {
    if (pendingPostAuth && isAuthenticated && smartAccountAddress && !hasRunPostAuth.current) {
      hasRunPostAuth.current = true;
      completeAuthentication(smartAccountAddress);
    }
  }, [pendingPostAuth, isAuthenticated, smartAccountAddress]);

  // Reset the post-auth flag when we start a new login attempt
  useEffect(() => {
    if (isAuthenticating) {
      hasRunPostAuth.current = false;
    }
  }, [isAuthenticating]);

  // Validate username
  const validateUsername = (name: string): boolean => {
    if (!name.trim()) {
      setUsernameError("Please enter a username");
      return false;
    }
    if (name.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return false;
    }
    if (name.length > 30) {
      setUsernameError("Username must be less than 30 characters");
      return false;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      setUsernameError("Username can only contain letters, numbers, underscores and hyphens");
      return false;
    }
    setUsernameError(null);
    return true;
  };

  // Handle login for existing users
  const handleExistingUserLogin = async () => {
    setLoginError(null);
    setLoadingMessage("Authenticating...");
    try {
      setLoadingState("welcome");
      setPendingPostAuth(true);

      // Use stored username for existing user authentication
      if (loginWithPasskey) {
        await loginWithPasskey(storedUsername || undefined);
      }

      // Post-auth flow will be triggered by useEffect when isAuthenticated becomes true
    } catch (err) {
      setPendingPostAuth(false);
      handleAuthError(err);
    }
  };

  // Handle account creation for new users
  const handleCreateAccount = async () => {
    if (!showUsernameInput) {
      // First click - show username input
      setShowUsernameInput(true);
      return;
    }

    // Second click - validate and create account
    if (!validateUsername(username)) {
      return;
    }

    setLoginError(null);
    setLoadingMessage("Creating your wallet...");
    try {
      setLoadingState("welcome");
      setPendingPostAuth(true);

      if (createAccount) {
        await createAccount(username.trim());
      }

      // Post-auth flow will be triggered by useEffect when isAuthenticated becomes true
    } catch (err) {
      setPendingPostAuth(false);
      handleAuthError(err);
    }
  };

  // Main login handler - dispatches to appropriate flow
  const handlePasskeyLogin = async () => {
    if (hasExistingAccount) {
      await handleExistingUserLogin();
    } else {
      await handleCreateAccount();
    }
  };

  // Complete authentication and join garden if needed
  // Called from useEffect when isAuthenticated becomes true
  const completeAuthentication = async (address: `0x${string}`) => {
    try {
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
      console.error("Post-auth flow error", err);
    } finally {
      setLoadingState(null);
      setLoadingMessage(undefined);
      setPendingPostAuth(false);
    }
  };

  // Handle authentication errors
  const handleAuthError = (err: unknown) => {
    setLoadingState(null);
    setLoadingMessage(undefined);
    console.error("Authentication failed", err);

    // Set user-friendly error message without toast
    const friendlyMessage = getFriendlyErrorMessage(err);
    setLoginError(friendlyMessage);
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

      // No passkey found on server
      if (message.includes("no passkey found") || message.includes("no credentials")) {
        return "No account found. Please create a new account or use 'Login with wallet'.";
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

  // Cancel username input
  const handleCancelUsername = () => {
    setShowUsernameInput(false);
    setUsername("");
    setUsernameError(null);
    setLoginError(null);
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

  // Redirect to app once authenticated and post-auth flow is complete
  if (isAuthenticated && !pendingPostAuth) {
    return <Navigate to={redirectTo} replace />;
  }

  // Loading screen during passkey creation, garden join, or welcome back
  if (loadingState) {
    return <Splash loadingState={loadingState} message={loadingMessage} />;
  }

  // Determine button label based on state
  const getButtonLabel = () => {
    if (showUsernameInput) {
      return "Create Account";
    }
    if (hasExistingAccount) {
      return `Login${storedUsername ? ` as ${storedUsername}` : ""}`;
    }
    return "Get Started";
  };

  // Use local error state instead of provider error for better control
  const errorMessage = !isAuthenticating && !isJoiningGarden ? loginError || usernameError : null;

  // Main splash screen with login button
  return (
    <Splash
      login={handlePasskeyLogin}
      isLoggingIn={isAuthenticating || isJoiningGarden}
      buttonLabel={getButtonLabel()}
      errorMessage={errorMessage}
      // Username input for new account creation
      usernameInput={
        showUsernameInput && !hasExistingAccount
          ? {
              value: username,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                setUsername(e.target.value);
                if (usernameError) {
                  validateUsername(e.target.value);
                }
              },
              placeholder: "Choose a username",
              onCancel: handleCancelUsername,
            }
          : undefined
      }
      secondaryAction={
        !isAuthenticating && !isJoiningGarden
          ? {
              label: showUsernameInput ? "Cancel" : "Login with wallet",
              onSelect: showUsernameInput ? handleCancelUsername : handleWalletLogin,
            }
          : undefined
      }
    />
  );
}

export default Login;
