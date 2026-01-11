import { useAutoJoinRootGarden, useAuth } from "@green-goods/shared/hooks";
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
    hasStoredCredential,
    error: authError,
  } = useAuth();

  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>(undefined);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Auth flow state
  const [activeFlow, setActiveFlow] = useState<AuthFlow>("none");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Garden join prompt - called once after first login
  const { promptToJoin } = useAutoJoinRootGarden();
  const hasPromptedJoinRef = useRef(false);

  // Check if we're on a nested route (like /login/recover)
  const isNestedRoute = location.pathname !== "/login";

  // Check if user came from explicit logout
  const locationState = location.state as { fromLogout?: boolean } | null;
  const fromLogout = locationState?.fromLogout === true;

  // Extract redirectTo parameter, default to /home
  const redirectTo = fromLogout
    ? "/home"
    : new URLSearchParams(location.search).get("redirectTo") || "/home";

  // Check if user has existing credentials
  const hasExistingAccount = fromLogout ? false : hasStoredCredential || hasStoredUsername();
  const storedUsername = fromLogout ? null : getStoredUsername();

  // Reset username input when returning to initial state
  useEffect(() => {
    if (activeFlow === "none") {
      setUsername("");
      setUsernameError(null);
    }
  }, [activeFlow]);

  // Prompt to join garden after successful authentication (once)
  useEffect(() => {
    if (isAuthenticated && !hasPromptedJoinRef.current) {
      hasPromptedJoinRef.current = true;
      // Small delay to let the redirect happen first
      setTimeout(() => {
        promptToJoin();
      }, 500);
    }
  }, [isAuthenticated, promptToJoin]);

  // Clear loading state on auth errors
  useEffect(() => {
    if (authError && !isAuthenticating) {
      setLoadingState(null);
      setLoadingMessage(undefined);
      setLoginError(getFriendlyErrorMessage(authError));
    }
  }, [authError, isAuthenticating]);

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

  const handleSignUp = () => {
    setLoginError(null);
    setActiveFlow("register");
  };

  const handleLoginFlow = () => {
    setLoginError(null);
    setActiveFlow("login");
  };

  const handleWalletLogin = () => {
    loginWithWallet?.();
  };

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
      if (loginWithPasskey) {
        await loginWithPasskey(storedUsername || undefined);
      }
    } catch (err) {
      handleAuthError(err);
    }
  };

  // Handle account creation for new users
  const handleCreateAccount = async () => {
    if (!validateUsername(username)) return;

    setLoginError(null);
    setLoadingMessage("Creating your wallet...");
    try {
      setLoadingState("welcome");
      if (createAccount) {
        await createAccount(username.trim());
      }
    } catch (err) {
      handleAuthError(err);
    }
  };

  // Handle login for returning users (entering username)
  const handleRecoveryLogin = async () => {
    if (!validateUsername(username)) return;

    setLoginError(null);
    setLoadingMessage("Authenticating...");
    try {
      setLoadingState("welcome");
      if (loginWithPasskey) {
        await loginWithPasskey(username.trim());
      }
    } catch (err) {
      handleAuthError(err);
    }
  };

  // Main submit handler
  const handleSubmit = async () => {
    if (hasExistingAccount && activeFlow === "none") {
      await handleExistingUserLogin();
    } else if (activeFlow === "register") {
      await handleCreateAccount();
    } else if (activeFlow === "login") {
      await handleRecoveryLogin();
    }
  };

  // Handle authentication errors
  const handleAuthError = (err: unknown) => {
    setLoadingState(null);
    setLoadingMessage(undefined);
    console.error("Authentication failed", err);
    setLoginError(getFriendlyErrorMessage(err));
  };

  // Convert technical errors to user-friendly messages
  const getFriendlyErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
      const message = err.message.toLowerCase();

      if (
        message.includes("cancel") ||
        message.includes("abort") ||
        message.includes("user deny")
      ) {
        return "Login cancelled. Please try again when ready.";
      }
      if (message.includes("not support") || message.includes("unavailable")) {
        return "Passkey authentication is not available on this device. Try using 'Login with wallet' instead.";
      }
      if (message.includes("network") || message.includes("timeout") || message.includes("fetch")) {
        return "Connection issue. Please check your internet and try again.";
      }
      if (message.includes("no passkey found") || message.includes("no credentials")) {
        return "No account found with this username. Please check your username or create a new account.";
      }
      if (message.includes("credential") || message.includes("passkey")) {
        return "Couldn't verify your passkey. Please try again or use 'Login with wallet'.";
      }
    }
    return "Something went wrong. Please try again or use 'Login with wallet'.";
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const shouldShowUsernameInput = activeFlow !== "none" && !hasExistingAccount;

  const getButtonLabel = () => {
    if (shouldShowUsernameInput) {
      return activeFlow === "register" ? "Create Account" : "Login";
    }
    if (hasExistingAccount && activeFlow === "none") {
      return `Login${storedUsername ? ` as ${storedUsername}` : ""}`;
    }
    return "Sign Up";
  };

  const getUsernameHint = () => {
    if (activeFlow === "register") return "Choose a username for your new account";
    if (activeFlow === "login") return "Enter the username you registered with";
    return "";
  };

  const getPrimaryAction = () => {
    if (hasExistingAccount && activeFlow === "none") return handleExistingUserLogin;
    if (activeFlow !== "none") return handleSubmit;
    return handleSignUp;
  };

  // Nested route handling
  if (isNestedRoute) {
    return <Outlet />;
  }

  // Wait for auth to be ready
  if (!isReady) {
    return <Splash loadingState="welcome" />;
  }

  // Redirect once authenticated
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // Loading screen during authentication
  if (loadingState) {
    return <Splash loadingState={loadingState} message={loadingMessage} />;
  }

  const errorMessage = !isAuthenticating ? loginError || usernameError : null;

  return (
    <Splash
      login={getPrimaryAction()}
      isLoggingIn={isAuthenticating}
      buttonLabel={getButtonLabel()}
      errorMessage={errorMessage}
      usernameInput={
        shouldShowUsernameInput
          ? {
              value: username,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                setUsername(e.target.value);
                if (usernameError) validateUsername(e.target.value);
              },
              placeholder: activeFlow === "register" ? "Choose a username" : "Enter your username",
              hint: getUsernameHint(),
              onCancel: handleCancel,
            }
          : undefined
      }
      secondaryAction={
        !isAuthenticating
          ? activeFlow !== "none"
            ? { label: "Cancel", onSelect: handleCancel }
            : !hasExistingAccount
              ? { label: "Login", onSelect: handleLoginFlow }
              : undefined
          : undefined
      }
      tertiaryAction={
        activeFlow === "none"
          ? { label: "Login with wallet", onClick: handleWalletLogin }
          : undefined
      }
    />
  );
}

export default Login;
