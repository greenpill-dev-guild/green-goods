import {
  classifyPasskeyCeremonyContext,
  copyToClipboard,
  debugError,
  type InstallGuidance,
  type Platform,
  toastService,
  trackAuthError,
  useApp,
  useAuth,
  useInstallGuidance,
} from "@green-goods/shared";
import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { type IntlShape, useIntl } from "react-intl";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { type LoadingState, Splash } from "@/components/Layout";
import { APP_ROUTES } from "@/config/pwa-routing";
import { LoadingSplash } from "@/views/Login/components/LoadingSplash";

type NoLocalPasskeyMode = "recover" | "confirm-new-account" | "create";

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
      defaultMessage: "Something went wrong. Please try again.",
    });

  const msg = err.message.toLowerCase();
  if (msg.includes("cancel") || msg.includes("abort") || msg.includes("user deny")) {
    return intl.formatMessage({
      id: "app.login.error.cancelled",
      defaultMessage: "Sign in was cancelled. Try again when you're ready.",
    });
  }
  if (msg.includes("expected account") || msg.includes("address")) {
    return intl.formatMessage({
      id: "app.login.error.addressMismatch",
      defaultMessage:
        "That passkey points to a different account address. Retry recovery or use another sign-in method.",
    });
  }
  if (msg.includes("already registered") || msg.includes("recovery name")) {
    return intl.formatMessage({
      id: "app.login.error.recoveryNameTaken",
      defaultMessage:
        "That recovery name is already registered. Use recovery or choose another name for a separate account.",
    });
  }
  if (msg.includes("network") || msg.includes("timeout") || msg.includes("fetch")) {
    return intl.formatMessage({
      id: "app.login.error.network",
      defaultMessage:
        "Passkey recovery is temporarily unavailable. Retry later or use a same-device passkey if you still have one.",
    });
  }
  if (msg.includes("not support") || msg.includes("unavailable")) {
    return intl.formatMessage({
      id: "app.login.error.passkeyUnavailable",
      defaultMessage:
        "Passkeys aren't available in this browser. Open Green Goods in a supported browser before starting passkey sign-in.",
    });
  }
  if (
    msg.includes("no passkey found") ||
    msg.includes("no passkey credential") ||
    msg.includes("no credential")
  ) {
    return intl.formatMessage({
      id: "app.login.error.noPasskey",
      defaultMessage:
        "We couldn't find a passkey for that username. Retry, use a same-device fallback if you have one, or confirm before creating a separate account.",
    });
  }
  if (msg.includes("credential") || msg.includes("passkey")) {
    return intl.formatMessage({
      id: "app.login.error.passkeyVerification",
      defaultMessage: "We couldn't verify your passkey. Try again or sign in with a wallet.",
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
    defaultMessage: "Something went wrong. Please try again.",
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
  const [recoveryUsername, setRecoveryUsername] = useState("");
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  const [noLocalPasskeyMode, setNoLocalPasskeyMode] = useState<NoLocalPasskeyMode>("recover");

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
  const isNestedRoute = location.pathname !== APP_ROUTES.login;
  const fromLogout = (location.state as { fromLogout?: boolean } | null)?.fromLogout === true;

  // Redirect destination
  const redirectTo = fromLogout
    ? APP_ROUTES.home
    : new URLSearchParams(location.search).get("redirectTo") || APP_ROUTES.home;

  // Existing account detection (check localStorage for stored credential)
  // Always show login option if credential exists - even after logout
  // The credential is preserved during signOut() to allow re-login with same address
  const hasExistingAccount = hasStoredCredential;

  useEffect(() => {
    if (authError && !isAuthenticating) {
      setLoadingState(null);
      setLoadingMessage(undefined);
      setLoginError(getFriendlyErrorMessage(authError, intl));
    }
  }, [authError, isAuthenticating, intl]);

  const unsupportedPasskeyContext =
    isMobile && (guidance.scenario === "wrong-browser" || guidance.scenario === "in-app-browser");

  const blockUnsupportedPasskeyCeremony = useCallback(() => {
    const ceremonyContext = classifyPasskeyCeremonyContext();

    if (!unsupportedPasskeyContext && ceremonyContext.supported) {
      return false;
    }

    setLoadingState(null);
    setLoadingMessage(undefined);
    setLoginError(
      intl.formatMessage({
        id: "app.login.error.unsupportedBrowser",
        defaultMessage:
          "Open Green Goods in the recommended browser before starting passkey sign-in.",
      })
    );
    return true;
  }, [intl, unsupportedPasskeyContext]);

  const handleAuthError = (err: unknown, operation: "login" | "recover" | "create") => {
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
        userAction: `${operation} with passkey`,
        authMode: "passkey",
        recoverable: true,
        metadata: {
          operation,
          has_stored_credential: hasStoredCredential,
          guidance_scenario: guidance.scenario || "none",
        },
      });
    }
  };

  // Login with existing passkey
  const handlePasskeyLogin = async () => {
    if (blockUnsupportedPasskeyCeremony()) return;

    setLoginError(null);
    setLoadingMessage(
      intl.formatMessage({
        id: "app.login.loading.authenticating",
        defaultMessage: "Signing you in...",
      })
    );
    setLoadingState("welcome");
    try {
      await loginWithPasskey?.();
    } catch (err) {
      handleAuthError(err, "login");
    }
  };

  const handlePasskeyRecovery = async () => {
    if (blockUnsupportedPasskeyCeremony()) return;

    const trimmedUsername = recoveryUsername.trim();
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
    setLoadingMessage(
      intl.formatMessage({
        id: "app.login.loading.recovering",
        defaultMessage: "Looking up your passkey...",
      })
    );
    setLoadingState("welcome");
    try {
      await loginWithPasskey?.(trimmedUsername);
    } catch (err) {
      setRecoveryAttempted(true);
      handleAuthError(err, "recover");
    }
  };

  // Create new passkey account with required username (minimum 3 characters)
  const handleCreateAccount = async () => {
    if (blockUnsupportedPasskeyCeremony()) return;

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
    setLoadingMessage(
      intl.formatMessage({
        id: "app.login.loading.creatingWallet",
        defaultMessage: "Setting up your account...",
      })
    );
    setLoadingState("welcome");
    try {
      await createAccount?.(trimmedUsername);
    } catch (err) {
      handleAuthError(err, "create");
    }
  };

  const handleStartSeparateAccount = () => {
    setLoginError(null);
    setNoLocalPasskeyMode("confirm-new-account");
  };

  const handleConfirmSeparateAccount = () => {
    const recoveryName = recoveryUsername.trim();
    if (recoveryName.length >= 3 && !username.trim()) {
      setUsername(recoveryName);
    }
    setLoginError(null);
    setNoLocalPasskeyMode("create");
  };

  const handleReturnToRecovery = () => {
    setLoginError(null);
    setNoLocalPasskeyMode("recover");
  };

  // Validation: username must be at least 3 characters for new accounts
  const isUsernameValid = username.trim().length >= 3;
  const isRecoveryUsernameValid = recoveryUsername.trim().length >= 3;

  // Login with wallet
  const handleWalletLogin = () => {
    setLoginError(null);
    loginWithWallet?.();
  };

  if (isNestedRoute) return <Outlet />;
  if (!isReady) return <LoadingSplash loadingState="welcome" />;
  if (isAuthenticated) return <Navigate to={redirectTo} replace />;
  if (loadingState) return <LoadingSplash loadingState={loadingState} message={loadingMessage} />;

  // Build tertiary action for browser guidance when in wrong browser
  // Browser guidance takes priority over wallet tertiary when present
  const browserGuidanceTertiaryAction =
    isMobile && (guidance.scenario === "wrong-browser" || guidance.scenario === "in-app-browser")
      ? {
          label: getBrowserGuidanceLabel(guidance, platform, intl),
          onClick: handleBrowserSwitch,
        }
      : undefined;

  // Wallet action reused as the secondary path when passkey is primary
  const walletAction = {
    label: intl.formatMessage({
      id: "app.login.button.connectWallet",
      defaultMessage: "Sign in with a wallet",
    }),
    onSelect: handleWalletLogin,
  };

  // Address continuity notice shown across all login modes
  const addressContinuityNotice = intl.formatMessage({
    id: "app.login.notice.addressContinuity",
    defaultMessage: "Creating a separate account gives you a different address.",
  });

  // ─── Progressive disclosure: action hierarchy depends on user state ─────────
  //
  // Returning user (has stored passkey):
  //   Primary: Login with Passkey (muscle memory)
  //   Secondary: Connect Wallet
  //
  // New user (no credential), default mode:
  //   Primary: Create your account (passkey-first; gardener-clear default)
  //   Secondary: Sign in with a wallet
  //
  // Missing local cache:
  //   Primary: Recover with username/ENS (hosted passkey server lookup)
  //   Secondary: Wallet or guarded separate-account confirmation after failure
  //   Separate account creation is a two-step confirmation flow.

  const helmet = (
    <Helmet>
      <title>
        {intl.formatMessage({
          id: "app.login.title",
          defaultMessage: "Sign in | Green Goods",
        })}
      </title>
      <meta
        name="description"
        content={intl.formatMessage({
          id: "app.login.metaDescription",
          defaultMessage:
            "Sign in to Green Goods to start documenting regenerative work in your community.",
        })}
      />
    </Helmet>
  );

  // ─── Returning user: passkey primary ────────────────────────────────────────
  if (hasExistingAccount) {
    return (
      <>
        {helmet}
        <Splash
          login={handlePasskeyLogin}
          isLoggingIn={isAuthenticating}
          buttonLabel={intl.formatMessage({
            id: "app.login.button.loginPasskey",
            defaultMessage: "Sign in with passkey",
          })}
          errorMessage={!isAuthenticating ? loginError : null}
          secondaryAction={walletAction}
          tertiaryAction={browserGuidanceTertiaryAction}
          notice={addressContinuityNotice}
        />
      </>
    );
  }

  if (!hasExistingAccount && noLocalPasskeyMode === "confirm-new-account") {
    return (
      <>
        {helmet}
        <Splash
          login={handleConfirmSeparateAccount}
          isLoggingIn={isAuthenticating}
          buttonLabel={intl.formatMessage({
            id: "app.login.button.confirmSeparateAccount",
            defaultMessage: "Continue to new account",
          })}
          errorMessage={!isAuthenticating ? loginError : null}
          secondaryAction={{
            label: intl.formatMessage({
              id: "app.login.button.backToRecovery",
              defaultMessage: "Back to recovery",
            }),
            onSelect: handleReturnToRecovery,
          }}
          tertiaryAction={browserGuidanceTertiaryAction}
          notice={addressContinuityNotice}
          infoCallout={intl.formatMessage({
            id: "app.login.recovery.separateAccountConfirmation",
            defaultMessage:
              "Creating a separate account gives you a different address. It will not recover access tied to the previous passkey.",
          })}
        />
      </>
    );
  }

  if (!hasExistingAccount && noLocalPasskeyMode === "create") {
    return (
      <>
        {helmet}
        <Splash
          login={handleCreateAccount}
          isLoggingIn={isAuthenticating}
          buttonLabel={intl.formatMessage({
            id: "app.login.button.createSeparateAccount",
            defaultMessage: "Create separate account",
          })}
          errorMessage={!isAuthenticating ? loginError : null}
          secondaryAction={{
            label: intl.formatMessage({
              id: "app.login.button.backToRecovery",
              defaultMessage: "Back to recovery",
            }),
            onSelect: handleReturnToRecovery,
          }}
          tertiaryAction={browserGuidanceTertiaryAction}
          usernameInput={{
            value: username,
            onChange: (e) => setUsername(e.target.value),
            label: intl.formatMessage({
              id: "app.login.username.newAccountLabel",
              defaultMessage: "Display name for new account",
            }),
            placeholder: intl.formatMessage({
              id: "app.login.username.placeholder",
              defaultMessage: "Enter a display name",
            }),
            hint: intl.formatMessage({
              id: "app.login.username.newAccountHint",
              defaultMessage:
                "This creates a different address. Use recovery if you already made a passkey.",
            }),
            minLength: 3,
            onCancel: handleReturnToRecovery,
          }}
          isLoginDisabled={!isUsernameValid}
          notice={addressContinuityNotice}
          infoCallout={intl.formatMessage({
            id: "app.login.passkey.explainer",
            defaultMessage:
              "Passkeys keep sign-in passwordless. Synced passkeys can recover where your provider supports passkey sync.",
          })}
        />
      </>
    );
  }

  // ─── Missing local cache: recover before creating a new account ─────────────
  return (
    <>
      {helmet}
      <Splash
        login={handlePasskeyRecovery}
        isLoggingIn={isAuthenticating}
        buttonLabel={intl.formatMessage({
          id: recoveryAttempted
            ? "app.login.button.retryRecovery"
            : "app.login.button.recoverPasskey",
          defaultMessage: recoveryAttempted ? "Retry recovery" : "Recover with passkey",
        })}
        errorMessage={!isAuthenticating ? loginError : null}
        secondaryAction={
          recoveryAttempted && loginError
            ? {
                label: intl.formatMessage({
                  id: "app.login.button.createSeparateAccount",
                  defaultMessage: "Create separate account",
                }),
                onSelect: handleStartSeparateAccount,
              }
            : walletAction
        }
        tertiaryAction={
          browserGuidanceTertiaryAction ||
          (recoveryAttempted && loginError
            ? {
                label: intl.formatMessage({
                  id: "app.login.button.connectWallet",
                  defaultMessage: "Sign in with a wallet",
                }),
                onClick: handleWalletLogin,
              }
            : {
                label: intl.formatMessage({
                  id: "app.login.button.createSeparateAccount",
                  defaultMessage: "Create separate account",
                }),
                onClick: handleStartSeparateAccount,
              })
        }
        usernameInput={{
          value: recoveryUsername,
          onChange: (e) => setRecoveryUsername(e.target.value),
          label: intl.formatMessage({
            id: "app.login.recovery.label",
            defaultMessage: "Username or ENS handle",
          }),
          placeholder: intl.formatMessage({
            id: "app.login.recovery.placeholder",
            defaultMessage: "Enter your username or ENS handle",
          }),
          hint: intl.formatMessage({
            id: "app.login.recovery.hint",
            defaultMessage: "Use the same name you chose when setting up your passkey.",
          }),
          minLength: 3,
        }}
        isLoginDisabled={!isRecoveryUsernameValid}
        notice={addressContinuityNotice}
        infoCallout={intl.formatMessage({
          id:
            recoveryAttempted && loginError
              ? "app.login.recovery.retryInfo"
              : "app.login.recovery.info",
          defaultMessage:
            recoveryAttempted && loginError
              ? "Recovery did not complete. Retry, use a same-device fallback if available, or confirm before creating a separate account."
              : "Synced passkeys can recover where your provider supports sync. Legacy local-only passkeys still work on the same device and may need re-enrollment after storage loss.",
        })}
      />
    </>
  );
}
