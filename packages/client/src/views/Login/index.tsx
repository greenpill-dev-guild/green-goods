import { useAuth } from "@green-goods/shared/hooks";
import { getStoredUsername, hasStoredUsername } from "@green-goods/shared/modules";
import { debugError } from "@green-goods/shared/utils/debug";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { type LoadingState, Splash } from "@/components/Layout";

type AuthFlow = "none" | "register" | "login";

/** Convert technical errors to user-friendly messages */
const getFriendlyErrorMessage = (err: unknown): string => {
  if (!(err instanceof Error))
    return "Something went wrong. Please try again or use 'Login with wallet'.";

  const msg = err.message.toLowerCase();
  if (msg.includes("cancel") || msg.includes("abort") || msg.includes("user deny")) {
    return "Login cancelled. Please try again when ready.";
  }
  if (msg.includes("not support") || msg.includes("unavailable")) {
    return "Passkey authentication is not available on this device. Try using 'Login with wallet' instead.";
  }
  if (msg.includes("network") || msg.includes("timeout") || msg.includes("fetch")) {
    return "Connection issue. Please check your internet and try again.";
  }
  if (msg.includes("no passkey found") || msg.includes("no credentials")) {
    return "No account found with this username. Please check your username or create a new account.";
  }
  if (msg.includes("credential") || msg.includes("passkey")) {
    return "Couldn't verify your passkey. Please try again or use 'Login with wallet'.";
  }
  return "Something went wrong. Please try again or use 'Login with wallet'.";
};

/** Validate username format */
const validateUsername = (name: string): string | null => {
  if (!name.trim()) return "Please enter a username";
  if (name.length < 3) return "Username must be at least 3 characters";
  if (name.length > 30) return "Username must be less than 30 characters";
  if (!/^[a-zA-Z0-9_-]+$/.test(name))
    return "Username can only contain letters, numbers, underscores and hyphens";
  return null;
};

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
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeFlow, setActiveFlow] = useState<AuthFlow>("none");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Check if nested route or came from logout
  const isNestedRoute = location.pathname !== "/login";
  const fromLogout = (location.state as { fromLogout?: boolean } | null)?.fromLogout === true;

  // Redirect destination
  const redirectTo = fromLogout
    ? "/home"
    : new URLSearchParams(location.search).get("redirectTo") || "/home";

  // Existing account detection
  const hasExistingAccount = !fromLogout && (hasStoredCredential || hasStoredUsername());
  const storedUsername = fromLogout ? null : getStoredUsername();

  // Reset username when flow changes
  useEffect(() => {
    if (activeFlow === "none") {
      setUsername("");
      setUsernameError(null);
    }
  }, [activeFlow]);

  // Handle auth errors
  useEffect(() => {
    if (authError && !isAuthenticating) {
      setLoadingState(null);
      setLoadingMessage(undefined);
      setLoginError(getFriendlyErrorMessage(authError));
    }
  }, [authError, isAuthenticating]);

  const handleAuthError = (err: unknown) => {
    setLoadingState(null);
    setLoadingMessage(undefined);
    debugError("Authentication failed", err);
    setLoginError(getFriendlyErrorMessage(err));
  };

  const handleCancel = () => {
    setActiveFlow("none");
    setUsername("");
    setUsernameError(null);
    setLoginError(null);
  };

  // Auth handlers
  const handleExistingUserLogin = async () => {
    setLoginError(null);
    setLoadingMessage("Authenticating...");
    setLoadingState("welcome");
    try {
      await loginWithPasskey?.(storedUsername || undefined);
    } catch (err) {
      handleAuthError(err);
    }
  };

  const handleCreateAccount = async () => {
    const error = validateUsername(username);
    if (error) {
      setUsernameError(error);
      return;
    }
    setUsernameError(null);
    setLoginError(null);
    setLoadingMessage("Creating your wallet...");
    setLoadingState("welcome");
    try {
      await createAccount?.(username.trim());
    } catch (err) {
      handleAuthError(err);
    }
  };

  const handleRecoveryLogin = async () => {
    const error = validateUsername(username);
    if (error) {
      setUsernameError(error);
      return;
    }
    setUsernameError(null);
    setLoginError(null);
    setLoadingMessage("Authenticating...");
    setLoadingState("welcome");
    try {
      await loginWithPasskey?.(username.trim());
    } catch (err) {
      handleAuthError(err);
    }
  };

  // Determine primary action based on state
  const getPrimaryAction = () => {
    if (hasExistingAccount && activeFlow === "none") return handleExistingUserLogin;
    if (activeFlow === "register") return handleCreateAccount;
    if (activeFlow === "login") return handleRecoveryLogin;
    return () => {
      setLoginError(null);
      setActiveFlow("register");
    };
  };

  const getButtonLabel = () => {
    if (activeFlow === "register") return "Create Account";
    if (activeFlow === "login") return "Login";
    if (hasExistingAccount) return `Login${storedUsername ? ` as ${storedUsername}` : ""}`;
    return "Sign Up";
  };

  // Render logic
  if (isNestedRoute) return <Outlet />;
  if (!isReady) return <Splash loadingState="welcome" />;
  if (isAuthenticated) return <Navigate to={redirectTo} replace />;
  if (loadingState) return <Splash loadingState={loadingState} message={loadingMessage} />;

  const showUsernameInput = activeFlow !== "none" && !hasExistingAccount;
  const errorMessage = !isAuthenticating ? loginError || usernameError : null;

  return (
    <Splash
      login={getPrimaryAction()}
      isLoggingIn={isAuthenticating}
      buttonLabel={getButtonLabel()}
      errorMessage={errorMessage}
      usernameInput={
        showUsernameInput
          ? {
              value: username,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                setUsername(e.target.value);
                if (usernameError) setUsernameError(validateUsername(e.target.value));
              },
              placeholder: activeFlow === "register" ? "Choose a username" : "Enter your username",
              hint:
                activeFlow === "register"
                  ? "Choose a username for your new account"
                  : "Enter the username you registered with",
              onCancel: handleCancel,
            }
          : undefined
      }
      secondaryAction={
        !isAuthenticating
          ? activeFlow !== "none"
            ? { label: "Cancel", onSelect: handleCancel }
            : !hasExistingAccount
              ? {
                  label: "Login",
                  onSelect: () => {
                    setLoginError(null);
                    setActiveFlow("login");
                  },
                }
              : undefined
          : undefined
      }
      tertiaryAction={
        activeFlow === "none"
          ? { label: "Login with wallet", onClick: () => loginWithWallet?.() }
          : undefined
      }
    />
  );
}

export default Login;
