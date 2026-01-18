import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@green-goods/shared/hooks";
import { trackAuthError } from "@green-goods/shared/modules";
import { debugError } from "@green-goods/shared/utils/debug";

import { type LoadingState, Splash } from "@/components/Layout";

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
    return "No passkey found on this device. Please create a new account.";
  }
  if (msg.includes("credential") || msg.includes("passkey")) {
    return "Couldn't verify your passkey. Please try again or use 'Login with wallet'.";
  }
  return "Something went wrong. Please try again or use 'Login with wallet'.";
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
  const [username, setUsername] = useState("");

  // Check if nested route or came from logout
  const isNestedRoute = location.pathname !== "/login";
  const fromLogout = (location.state as { fromLogout?: boolean } | null)?.fromLogout === true;

  // Redirect destination
  const redirectTo = fromLogout
    ? "/home"
    : new URLSearchParams(location.search).get("redirectTo") || "/home";

  // Existing account detection (check localStorage for stored credential)
  const hasExistingAccount = !fromLogout && hasStoredCredential;

  // Handle auth errors
  useEffect(() => {
    if (authError && !isAuthenticating) {
      setLoadingState(null);
      setLoadingMessage(undefined);
      setLoginError(getFriendlyErrorMessage(authError));
    }
  }, [authError, isAuthenticating]);

  const handleAuthError = (err: unknown, operation: "login" | "create") => {
    setLoadingState(null);
    setLoadingMessage(undefined);
    debugError("Authentication failed", err);
    setLoginError(getFriendlyErrorMessage(err));

    // Check if user intentionally cancelled (don't track as error)
    const isUserCancellation =
      err instanceof Error &&
      (err.message.toLowerCase().includes("cancel") ||
        err.message.toLowerCase().includes("abort") ||
        err.message.toLowerCase().includes("user deny"));

    if (!isUserCancellation) {
      trackAuthError(err, {
        source: "Login.handleAuthError",
        userAction:
          operation === "create" ? "creating account with passkey" : "logging in with passkey",
        authMode: "passkey",
        recoverable: true,
        metadata: {
          operation,
          has_stored_credential: hasStoredCredential,
        },
      });
    }
  };

  // Login with existing passkey
  const handlePasskeyLogin = async () => {
    setLoginError(null);
    setLoadingMessage("Authenticating...");
    setLoadingState("welcome");
    try {
      await loginWithPasskey?.();
    } catch (err) {
      handleAuthError(err, "login");
    }
  };

  // Create new passkey account with optional username
  const handleCreateAccount = async () => {
    setLoginError(null);
    setLoadingMessage("Creating your wallet...");
    setLoadingState("welcome");
    try {
      // Pass username if provided, otherwise authServices will generate one
      const finalUsername = username.trim() || undefined;
      await createAccount?.(finalUsername);
    } catch (err) {
      handleAuthError(err, "create");
    }
  };

  // Login with wallet
  const handleWalletLogin = () => {
    setLoginError(null);
    loginWithWallet?.();
  };

  // Render logic
  if (isNestedRoute) return <Outlet />;
  if (!isReady) return <Splash loadingState="welcome" />;
  if (isAuthenticated) return <Navigate to={redirectTo} replace />;
  if (loadingState) return <Splash loadingState={loadingState} message={loadingMessage} />;

  // Determine primary action based on whether user has existing credential
  const primaryAction = hasExistingAccount ? handlePasskeyLogin : handleCreateAccount;
  const buttonLabel = hasExistingAccount ? "Login with Passkey" : "Create Account";

  return (
    <>
      <Helmet>
        <title>Login | Green Goods</title>
        <meta
          name="description"
          content="Sign in to Green Goods to start bringing your community impact onchain."
        />
      </Helmet>
      <Splash
        login={primaryAction}
        isLoggingIn={isAuthenticating}
        buttonLabel={buttonLabel}
        errorMessage={!isAuthenticating ? loginError : null}
        secondaryAction={{
          label: "Login with Wallet",
          onSelect: handleWalletLogin,
        }}
        // Show username input only for new account creation
        usernameInput={
          !hasExistingAccount
            ? {
                value: username,
                onChange: (e) => setUsername(e.target.value),
                placeholder: "Enter a display name (optional)",
                hint: "This name will be shown in your profile",
              }
            : undefined
        }
      />
    </>
  );
}

export default Login;
