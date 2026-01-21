<<<<<<< HEAD
import { useAuth, useAutoJoinRootGarden } from "@green-goods/shared/hooks";
import { getStoredUsername, hasStoredUsername } from "@green-goods/shared/modules";
import { useEffect, useRef, useState } from "react";
=======
import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
>>>>>>> dd9ace50c09ee19a814d3a577a020a847e5f9430
import { Navigate, Outlet, useLocation } from "react-router-dom";

import {
  copyToClipboard,
  toastService,
  useInstallGuidance,
  type InstallGuidance,
} from "@green-goods/shared";
import { debugError, type Platform } from "@green-goods/shared/utils";
import { useAuth } from "@green-goods/shared/hooks";
import { trackAuthError } from "@green-goods/shared/modules";
import { useApp } from "@green-goods/shared/providers";

import { type LoadingState, Splash } from "@/components/Layout";

/** Get the browser guidance label based on scenario and platform */
function getBrowserGuidanceLabel(guidance: InstallGuidance, platform: Platform): string {
  if (guidance.scenario === "in-app-browser") {
    return platform === "android" && guidance.openInBrowserUrl
      ? "Open in Chrome for best experience"
      : "Copy link & open in Safari";
  }
  return platform === "ios"
    ? "For best experience, open in Safari"
    : "Open in Chrome for best experience";
}

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
  if (msg.includes("at least 3 characters")) {
    return "Please enter a display name with at least 3 characters.";
  }
  return "Something went wrong. Please try again or use 'Login with wallet'.";
};

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

  // Get platform/browser info for installation guidance
  const { platform, isMobile, isInstalled, wasInstalled, deferredPrompt } = useApp();
  const guidance = useInstallGuidance(
    platform,
    isInstalled,
    wasInstalled,
    deferredPrompt,
    isMobile
  );

  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>();
  const [loginError, setLoginError] = useState<string | null>(null);
<<<<<<< HEAD
  const [activeFlow, setActiveFlow] = useState<AuthFlow>("none");
=======
>>>>>>> dd9ace50c09ee19a814d3a577a020a847e5f9430
  const [username, setUsername] = useState("");

<<<<<<< HEAD
  const { promptToJoin } = useAutoJoinRootGarden();
  const hasPromptedJoinRef = useRef(false);
=======
  // Handle browser switch action (for wrong browser/in-app browser scenarios)
  const handleBrowserSwitch = useCallback(async () => {
    if (guidance.openInBrowserUrl) {
      // Android: Use intent URL to open in Chrome
      window.location.href = guidance.openInBrowserUrl;
    } else {
      // iOS: Copy URL since we can't programmatically switch browsers
      const success = await copyToClipboard(window.location.href);
      if (success) {
        toastService.show({
          status: "success",
          title: "Link copied!",
          description: "Now open Safari and paste this link to continue.",
        });
      } else {
        toastService.show({
          status: "error",
          title: "Couldn't copy link",
          description: "Please manually copy this URL and open it in Safari.",
        });
      }
    }
  }, [guidance.openInBrowserUrl]);
>>>>>>> dd9ace50c09ee19a814d3a577a020a847e5f9430

  // Check if nested route or came from logout
  const isNestedRoute = location.pathname !== "/login";
  const fromLogout = (location.state as { fromLogout?: boolean } | null)?.fromLogout === true;

  // Redirect destination
  const redirectTo = fromLogout
    ? "/home"
    : new URLSearchParams(location.search).get("redirectTo") || "/home";

<<<<<<< HEAD
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

  // Prompt garden join after auth
  useEffect(() => {
    if (isAuthenticated && !hasPromptedJoinRef.current) {
      hasPromptedJoinRef.current = true;
      setTimeout(() => promptToJoin(), 500);
    }
  }, [isAuthenticated, promptToJoin]);

  // Handle auth errors
  useEffect(() => {
=======
  // Existing account detection (check localStorage for stored credential)
  // Always show login option if credential exists - even after logout
  // The credential is preserved during signOut() to allow re-login with same address
  const hasExistingAccount = hasStoredCredential;

  // Handle auth errors
  useEffect(() => {
>>>>>>> dd9ace50c09ee19a814d3a577a020a847e5f9430
    if (authError && !isAuthenticating) {
      setLoadingState(null);
      setLoadingMessage(undefined);
      setLoginError(getFriendlyErrorMessage(authError));
    }
  }, [authError, isAuthenticating]);

<<<<<<< HEAD
  const handleAuthError = (err: unknown) => {
    setLoadingState(null);
    setLoadingMessage(undefined);
    console.error("Authentication failed", err);
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
=======
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

  // Create new passkey account with required username (minimum 3 characters)
  const handleCreateAccount = async () => {
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      setLoginError("Please enter a display name with at least 3 characters.");
      return;
    }
    setLoginError(null);
    setLoadingMessage("Creating your wallet...");
    setLoadingState("welcome");
    try {
      await createAccount?.(trimmedUsername);
    } catch (err) {
      handleAuthError(err, "create");
    }
  };

  // Validation: username must be at least 3 characters for new accounts
  const isUsernameValid = username.trim().length >= 3;

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

  // Build tertiary action for browser guidance when in wrong browser
  const browserGuidanceTertiaryAction =
    isMobile && (guidance.scenario === "wrong-browser" || guidance.scenario === "in-app-browser")
      ? {
          label: getBrowserGuidanceLabel(guidance, platform),
          onClick: handleBrowserSwitch,
        }
      : undefined;

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
        tertiaryAction={browserGuidanceTertiaryAction}
        // Show username input only for new account creation (required, min 3 chars)
        usernameInput={
          !hasExistingAccount
            ? {
                value: username,
                onChange: (e) => setUsername(e.target.value),
                placeholder: "Enter a display name",
                hint: "Required - at least 3 characters",
                minLength: 3,
              }
            : undefined
        }
        isLoginDisabled={!hasExistingAccount && !isUsernameValid}
      />
    </>
>>>>>>> dd9ace50c09ee19a814d3a577a020a847e5f9430
  );
}

export default Login;
