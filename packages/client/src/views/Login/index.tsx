import { toastService } from "@green-goods/shared";
import { checkMembership, useAutoJoinRootGarden, useAuth } from "@green-goods/shared/hooks";
import { hasStoredUsername, getStoredUsername } from "@green-goods/shared/modules";
import { useState, useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { type LoadingState, Splash } from "@/components/Layout";

type AuthFlow = "none" | "register" | "login";

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
    error: authError,
  } = useAuth();

  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>(undefined);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Auth flow state - replaces showUsernameInput and isRecoveryMode
  const [activeFlow, setActiveFlow] = useState<AuthFlow>("none");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Track if we're in the middle of a login attempt (to trigger post-auth flow)
  const [pendingPostAuth, setPendingPostAuth] = useState(false);
  const hasRunPostAuth = useRef(false);

  const { joinGarden, isLoading: isJoiningGarden } = useAutoJoinRootGarden();

  // Check if we're on a nested route (like /login/recover)
  const isNestedRoute = location.pathname !== "/login";

  // Check if user came from explicit logout - ignore redirectTo and stored credentials
  const locationState = location.state as { fromLogout?: boolean } | null;
  const fromLogout = locationState?.fromLogout === true;

  // Extract redirectTo parameter from URL query string, default to /home
  // If coming from explicit logout, always go to /home
  const redirectTo = fromLogout
    ? "/home"
    : new URLSearchParams(location.search).get("redirectTo") || "/home";

  // Check if user has existing credentials
  // When coming from logout, treat as new user (show all 3 options)
  const hasExistingAccount = fromLogout ? false : hasStoredCredential || hasStoredUsername();
  const storedUsername = fromLogout ? null : getStoredUsername();

  // Reset username input when returning to initial state
  useEffect(() => {
    if (activeFlow === "none") {
      setUsername("");
      setUsernameError(null);
    }
  }, [activeFlow]);

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

  // Clear stuck loading state on auth errors
  useEffect(() => {
    if (pendingPostAuth && authError && !isAuthenticating && !isJoiningGarden) {
      setPendingPostAuth(false);
      setLoadingState(null);
      setLoadingMessage(undefined);
      setLoginError(getFriendlyErrorMessage(authError));
    }
  }, [pendingPostAuth, authError, isAuthenticating, isJoiningGarden]);

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

  // ============================================================================
  // FLOW HANDLERS
  // ============================================================================

  // 1. Sign Up -> Shows registration flow (new users)
  const handleSignUp = () => {
    setLoginError(null);
    setActiveFlow("register");
  };

  // 2. Login -> Shows login flow (returning users without stored username)
  const handleLoginFlow = () => {
    setLoginError(null);
    setActiveFlow("login");
  };

  // 3. Wallet Login -> Opens wallet modal
  const handleWalletLogin = () => {
    loginWithWallet?.();
  };

  // 4. Cancel -> Returns to initial state
  const handleCancel = () => {
    setActiveFlow("none");
    setUsername("");
    setUsernameError(null);
    setLoginError(null);
  };

  // Handle login for existing users (with stored username)
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

  // Handle account creation for new users (register flow)
  const handleCreateAccount = async () => {
    // Validate username before creating
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

  // Handle login for returning users (login flow - entering username)
  const handleRecoveryLogin = async () => {
    // Validate username before authenticating
    if (!validateUsername(username)) {
      return;
    }

    setLoginError(null);
    setLoadingMessage("Authenticating...");
    try {
      setLoadingState("welcome");
      setPendingPostAuth(true);

      if (loginWithPasskey) {
        await loginWithPasskey(username.trim());
      }

      // Post-auth flow will be triggered by useEffect when isAuthenticated becomes true
    } catch (err) {
      setPendingPostAuth(false);
      handleAuthError(err);
    }
  };

  // Main submit handler - dispatches based on state
  const handleSubmit = async () => {
    if (hasExistingAccount && activeFlow === "none") {
      // Auto-login with stored username
      await handleExistingUserLogin();
    } else if (activeFlow === "register") {
      await handleCreateAccount();
    } else if (activeFlow === "login") {
      await handleRecoveryLogin();
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
        return "No account found with this username. Please check your username or create a new account.";
      }

      // Generic passkey errors
      if (message.includes("credential") || message.includes("passkey")) {
        return "Couldn't verify your passkey. Please try again or use 'Login with wallet'.";
      }
    }

    // Fallback for unknown errors
    return "Something went wrong. Please try again or use 'Login with wallet'.";
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  // Username input shown when in register or login flow (and no stored account)
  const shouldShowUsernameInput = activeFlow !== "none" && !hasExistingAccount;

  // Determine button label based on state
  const getButtonLabel = () => {
    // When in username input mode
    if (shouldShowUsernameInput) {
      return activeFlow === "register" ? "Create Account" : "Login";
    }
    // When user has existing account (auto-login)
    if (hasExistingAccount && activeFlow === "none") {
      return `Login${storedUsername ? ` as ${storedUsername}` : ""}`;
    }
    // Initial state for new users
    return "Sign Up";
  };

  // Determine username hint based on flow
  const getUsernameHint = () => {
    if (activeFlow === "register") {
      return "Choose a username for your new account";
    }
    if (activeFlow === "login") {
      return "Enter the username you registered with";
    }
    return "";
  };

  // Determine primary action handler
  const getPrimaryAction = () => {
    // Existing user with stored credentials - auto-login
    if (hasExistingAccount && activeFlow === "none") {
      return handleExistingUserLogin;
    }
    // In username input mode - submit the form
    if (activeFlow !== "none") {
      return handleSubmit;
    }
    // New user, initial state - show registration flow
    return handleSignUp;
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

  // Use local error state instead of provider error for better control
  const errorMessage = !isAuthenticating && !isJoiningGarden ? loginError || usernameError : null;

  // Main splash screen with login button
  return (
    <Splash
      login={getPrimaryAction()}
      isLoggingIn={isAuthenticating || isJoiningGarden}
      buttonLabel={getButtonLabel()}
      errorMessage={errorMessage}
      // Username input for registration or login flow
      usernameInput={
        shouldShowUsernameInput
          ? {
              value: username,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                setUsername(e.target.value);
                if (usernameError) {
                  validateUsername(e.target.value);
                }
              },
              placeholder: activeFlow === "register" ? "Choose a username" : "Enter your username",
              hint: getUsernameHint(),
              onCancel: handleCancel,
            }
          : undefined
      }
      // Secondary action: Cancel (when in flow) or Login (when showing initial buttons)
      secondaryAction={
        !isAuthenticating && !isJoiningGarden
          ? activeFlow !== "none"
            ? { label: "Cancel", onSelect: handleCancel }
            : !hasExistingAccount
              ? { label: "Login", onSelect: handleLoginFlow }
              : undefined
          : undefined
      }
      // Tertiary action: Login with wallet (only on initial screen)
      tertiaryAction={
        activeFlow === "none"
          ? { label: "Login with wallet", onClick: handleWalletLogin }
          : undefined
      }
    />
  );
}

export default Login;
