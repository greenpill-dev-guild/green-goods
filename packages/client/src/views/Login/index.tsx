import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { type IntlShape, useIntl } from "react-intl";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import {
  copyToClipboard,
  debugError,
  toastService,
  trackAuthError,
  useApp,
  useAuth,
  useInstallGuidance,
  type InstallGuidance,
  type Platform,
} from "@green-goods/shared";

import { Splash, type LoadingState } from "@/components/Layout";
import { LoadingSplash } from "@/views/Login/components/LoadingSplash";

/** Get the browser guidance label based on scenario and platform */
function getBrowserGuidanceLabel(
  guidance: InstallGuidance,
  platform: Platform,
  intl: IntlShape
): string {
  if (guidance.scenario === "in-app-browser") {
    return platform === "android" && guidance.openInBrowserUrl
      ? intl.formatMessage({
          id: "app.login.guidance.openInChrome",
          defaultMessage: "Open in Chrome for best experience",
        })
      : intl.formatMessage({
          id: "app.login.guidance.copyLinkSafari",
          defaultMessage: "Copy link & open in Safari",
        });
  }
  return platform === "ios"
    ? intl.formatMessage({
        id: "app.login.guidance.openInSafari",
        defaultMessage: "For best experience, open in Safari",
      })
    : intl.formatMessage({
        id: "app.login.guidance.openInChrome",
        defaultMessage: "Open in Chrome for best experience",
      });
}

/** Convert technical errors to user-friendly messages */
const getFriendlyErrorMessage = (err: unknown, intl: IntlShape): string => {
  if (!(err instanceof Error))
    return intl.formatMessage({
      id: "app.login.error.generic",
      defaultMessage: "Something went wrong. Please try again or use 'Login with wallet'.",
    });

  const msg = err.message.toLowerCase();
  if (msg.includes("cancel") || msg.includes("abort") || msg.includes("user deny")) {
    return intl.formatMessage({
      id: "app.login.error.cancelled",
      defaultMessage: "Login cancelled. Please try again when ready.",
    });
  }
  if (msg.includes("not support") || msg.includes("unavailable")) {
    return intl.formatMessage({
      id: "app.login.error.passkeyUnavailable",
      defaultMessage:
        "Passkey authentication is not available on this device. Try using 'Login with wallet' instead.",
    });
  }
  if (msg.includes("network") || msg.includes("timeout") || msg.includes("fetch")) {
    return intl.formatMessage({
      id: "app.login.error.network",
      defaultMessage: "Connection issue. Please check your internet and try again.",
    });
  }
  if (msg.includes("no passkey found") || msg.includes("no credentials")) {
    return intl.formatMessage({
      id: "app.login.error.noPasskey",
      defaultMessage: "No passkey found on this device. Please create a new account.",
    });
  }
  if (msg.includes("credential") || msg.includes("passkey")) {
    return intl.formatMessage({
      id: "app.login.error.passkeyVerification",
      defaultMessage: "Couldn't verify your passkey. Please try again or use 'Login with wallet'.",
    });
  }
  if (msg.includes("at least 3 characters")) {
    return intl.formatMessage({
      id: "app.login.error.usernameTooShort",
      defaultMessage: "Please enter a display name with at least 3 characters.",
    });
  }
  return intl.formatMessage({
    id: "app.login.error.generic",
    defaultMessage: "Something went wrong. Please try again or use 'Login with wallet'.",
  });
};

export function Login() {
  const intl = useIntl();
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
  const [username, setUsername] = useState("");

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
          title: intl.formatMessage({
            id: "app.login.toast.linkCopied",
            defaultMessage: "Link copied!",
          }),
          description: intl.formatMessage({
            id: "app.login.toast.linkCopiedDescription",
            defaultMessage: "Now open Safari and paste this link to continue.",
          }),
        });
      } else {
        toastService.show({
          status: "error",
          title: intl.formatMessage({
            id: "app.login.toast.copyFailed",
            defaultMessage: "Couldn't copy link",
          }),
          description: intl.formatMessage({
            id: "app.login.toast.copyFailedDescription",
            defaultMessage: "Please manually copy this URL and open it in Safari.",
          }),
        });
      }
    }
  }, [guidance.openInBrowserUrl, intl]);

  // Check if nested route or came from logout
  const isNestedRoute = location.pathname !== "/login";
  const fromLogout = (location.state as { fromLogout?: boolean } | null)?.fromLogout === true;

  // Redirect destination
  const redirectTo = fromLogout
    ? "/home"
    : new URLSearchParams(location.search).get("redirectTo") || "/home";

  // Existing account detection (check localStorage for stored credential)
  // Always show login option if credential exists - even after logout
  // The credential is preserved during signOut() to allow re-login with same address
  const hasExistingAccount = hasStoredCredential;

  // Handle auth errors
  useEffect(() => {
    if (authError && !isAuthenticating) {
      setLoadingState(null);
      setLoadingMessage(undefined);
      setLoginError(getFriendlyErrorMessage(authError, intl));
    }
  }, [authError, isAuthenticating, intl]);

  const handleAuthError = (err: unknown, operation: "login" | "create") => {
    setLoadingState(null);
    setLoadingMessage(undefined);
    debugError("Authentication failed", err);
    setLoginError(getFriendlyErrorMessage(err, intl));

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
      setLoginError(
        intl.formatMessage({
          id: "app.login.error.usernameTooShort",
          defaultMessage: "Please enter a display name with at least 3 characters.",
        })
      );
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
  if (!isReady) return <LoadingSplash loadingState="welcome" />;
  if (isAuthenticated) return <Navigate to={redirectTo} replace />;
  if (loadingState) return <LoadingSplash loadingState={loadingState} message={loadingMessage} />;

  // Determine primary action based on whether user has existing credential
  const primaryAction = hasExistingAccount ? handlePasskeyLogin : handleCreateAccount;
  const buttonLabel = hasExistingAccount
    ? intl.formatMessage({
        id: "app.login.button.loginPasskey",
        defaultMessage: "Login with Passkey",
      })
    : intl.formatMessage({
        id: "app.login.button.createAccount",
        defaultMessage: "Create Account",
      });

  // Build tertiary action for browser guidance when in wrong browser
  const browserGuidanceTertiaryAction =
    isMobile && (guidance.scenario === "wrong-browser" || guidance.scenario === "in-app-browser")
      ? {
          label: getBrowserGuidanceLabel(guidance, platform, intl),
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
          label: intl.formatMessage({
            id: "app.login.button.loginWallet",
            defaultMessage: "Login with Wallet",
          }),
          onSelect: handleWalletLogin,
        }}
        tertiaryAction={browserGuidanceTertiaryAction}
        // Show username input only for new account creation (required, min 3 chars)
        usernameInput={
          !hasExistingAccount
            ? {
                value: username,
                onChange: (e) => setUsername(e.target.value),
                placeholder: intl.formatMessage({
                  id: "app.login.username.placeholder",
                  defaultMessage: "Enter a display name",
                }),
                hint: intl.formatMessage({
                  id: "app.login.username.hint",
                  defaultMessage: "Required - at least 3 characters",
                }),
                minLength: 3,
              }
            : undefined
        }
        isLoginDisabled={!hasExistingAccount && !isUsernameValid}
      />
    </>
  );
}
