import {
  classifyPasskeyCeremonyContext,
  copyToClipboard,
  debugError,
  getStoredUsername,
  type InstallGuidance,
  isPasskeyServerEnabled,
  normalizePasskeyAccountIdentifier,
  type Platform,
  toastService,
  trackAuthError,
  useApp,
  useAuth,
  useInstallGuidance,
} from "@green-goods/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { type IntlShape, useIntl } from "react-intl";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { type LoadingState, Splash } from "@/components/Layout";
import { APP_ROUTES } from "@/config/pwa-routing";
import { LoadingSplash } from "@/views/Login/components/LoadingSplash";

/**
 * The login surface is three screens on one scaffold:
 *   entry   — primary (Create account / Continue as <name>) · wallet · Recover link
 *   create  — username input · Create account · Back link
 *   recover — username input · Recover with passkey · Back link
 * Form screens are reached only by deliberate navigation from entry; Back
 * always returns to entry. Recovery is flat: it either succeeds or the user
 * goes Back — creating a fresh account happens through the normal create flow
 * (the passkey server still rejects already-registered names).
 */
type LoginScreen = "entry" | "create" | "recover";

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
  // "not allowed" covers WebAuthn NotAllowedError messages ("The operation
  // either timed out or was not allowed.") raised when the user dismisses
  // the platform passkey prompt.
  if (
    msg.includes("cancel") ||
    msg.includes("abort") ||
    msg.includes("user deny") ||
    msg.includes("not allowed")
  ) {
    return intl.formatMessage({
      id: "app.login.error.cancelled",
      defaultMessage: "Sign in was cancelled.",
    });
  }
  if (
    msg.includes("expected account address") ||
    msg.includes("address mismatch") ||
    msg.includes("did not match the expected account")
  ) {
    return intl.formatMessage({
      id: "app.login.error.addressMismatch",
      defaultMessage: "That passkey is for a different account.",
    });
  }
  if (msg.includes("already registered") || msg.includes("recovery name")) {
    return intl.formatMessage({
      id: "app.login.error.recoveryNameTaken",
      defaultMessage: "That name is already registered.",
    });
  }
  if (msg.includes("network") || msg.includes("timeout") || msg.includes("fetch")) {
    return intl.formatMessage({
      id: "app.login.error.network",
      defaultMessage: "Passkey recovery is temporarily unavailable.",
    });
  }
  if (
    msg.includes("not support") ||
    msg.includes("unsupported browser") ||
    msg.includes("passkey unavailable") ||
    msg.includes("passkeys aren't available") ||
    msg.includes("passkeys are not available") ||
    msg.includes("webauthn unavailable")
  ) {
    return intl.formatMessage({
      id: "app.login.error.passkeyUnavailable",
      defaultMessage: "Passkeys aren't available in this browser.",
    });
  }
  if (
    msg.includes("no passkey found") ||
    msg.includes("no passkey credential") ||
    msg.includes("no credential")
  ) {
    return intl.formatMessage({
      id: "app.login.error.noPasskey",
      defaultMessage: "No passkey found for that username.",
    });
  }
  if (msg.includes("credential") || msg.includes("passkey")) {
    return intl.formatMessage({
      id: "app.login.error.passkeyVerification",
      defaultMessage: "We couldn't verify your passkey.",
    });
  }
  if (msg.includes("at least 3 characters")) {
    return intl.formatMessage({
      id: "app.login.error.usernameTooShort",
      defaultMessage: "Display name must be at least 3 characters.",
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
    userName: authenticatedUserName,
    error: authError,
  } = useAuth();

  // Get platform/browser info for installation guidance
  const { platform, isMobile, isInstalled, isInstalling, wasInstalled, deferredPrompt } = useApp();
  const guidance = useInstallGuidance(
    platform,
    isInstalled,
    wasInstalled,
    deferredPrompt,
    isMobile,
    isInstalling
  );

  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [recoveryUsername, setRecoveryUsername] = useState("");
  const [screen, setScreen] = useState<LoginScreen>("entry");
  const passkeyServerEnabled = isPasskeyServerEnabled();

  // Name typed into the last username-recovery attempt. When the server has
  // no credential for it (or is unreachable) the auth service deliberately
  // falls back to the credential cached on this device, which can belong to a
  // different name — surface that on success instead of letting the session
  // silently land on another account.
  const recoveryAttemptNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const attempted = recoveryAttemptNameRef.current;
    recoveryAttemptNameRef.current = null;
    if (!attempted || !authenticatedUserName) return;
    if (
      normalizePasskeyAccountIdentifier(authenticatedUserName) ===
      normalizePasskeyAccountIdentifier(attempted)
    ) {
      return;
    }
    toastService.show({
      status: "info",
      title: intl.formatMessage({
        id: "app.login.toast.fallbackAccountTitle",
        defaultMessage: "Signed in with this device's passkey",
      }),
      description: intl.formatMessage(
        {
          id: "app.login.toast.fallbackAccountDescription",
          defaultMessage:
            "No passkey matched “{requested}”, so you're signed in as {actual} — the account saved on this device.",
        },
        { requested: attempted, actual: authenticatedUserName }
      ),
    });
  }, [isAuthenticated, authenticatedUserName, intl]);

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
        defaultMessage: "Open Green Goods in the recommended browser.",
      })
    );
    return true;
  }, [intl, unsupportedPasskeyContext]);

  const handleAuthError = (err: unknown, operation: "login" | "recover" | "create") => {
    setLoadingState(null);
    setLoadingMessage(undefined);
    debugError("Authentication failed", err);
    setLoginError(getFriendlyErrorMessage(err, intl));

    // Check if user intentionally cancelled (don't track as error).
    // "not allowed" covers WebAuthn NotAllowedError prompt dismissals.
    const isUserCancellation =
      err instanceof Error &&
      (err.message.toLowerCase().includes("cancel") ||
        err.message.toLowerCase().includes("abort") ||
        err.message.toLowerCase().includes("user deny") ||
        err.message.toLowerCase().includes("not allowed"));

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
    recoveryAttemptNameRef.current = null;
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
          defaultMessage: "Display name must be at least 3 characters.",
        })
      );
      return;
    }

    setLoginError(null);
    recoveryAttemptNameRef.current = trimmedUsername;
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
          defaultMessage: "Display name must be at least 3 characters.",
        })
      );
      return;
    }
    setLoginError(null);
    recoveryAttemptNameRef.current = null;
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

  // Screen navigation — deliberate, error-clearing. Back always lands on entry.
  const goToEntry = () => {
    setLoginError(null);
    setScreen("entry");
  };
  const goToCreate = () => {
    setLoginError(null);
    setScreen("create");
  };
  const goToRecover = () => {
    setLoginError(null);
    setScreen("recover");
  };

  // Validation: username must be at least 3 characters for new accounts
  const isUsernameValid = username.trim().length >= 3;
  const isRecoveryUsernameValid = recoveryUsername.trim().length >= 3;

  // Login with wallet
  const handleWalletLogin = () => {
    setLoginError(null);
    recoveryAttemptNameRef.current = null;
    loginWithWallet?.();
  };

  if (isNestedRoute) return <Outlet />;
  if (!isReady) return <LoadingSplash loadingState="welcome" />;
  if (isAuthenticated) return <Navigate to={redirectTo} replace />;
  // In-flight passkey attempts never swap the tree: each screen's Splash stays
  // mounted and shows the spinner inside the primary button (loadingState and
  // loadingMessage thread through below).

  // Build tertiary action for browser guidance when in wrong browser
  // Browser guidance takes priority over the recover link when present
  const browserGuidanceTertiaryAction =
    isMobile && (guidance.scenario === "wrong-browser" || guidance.scenario === "in-app-browser")
      ? {
          label: getBrowserGuidanceLabel(guidance, platform, intl),
          onClick: handleBrowserSwitch,
        }
      : undefined;

  const backTertiaryAction = {
    label: intl.formatMessage({
      id: "app.login.button.back",
      defaultMessage: "Back",
    }),
    onClick: goToEntry,
  };

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

  // ─── Create form: input (slot 1) · Create account (slot 2) · Back ───────────
  if (screen === "create" && !hasExistingAccount) {
    return (
      <>
        {helmet}
        <Splash
          login={handleCreateAccount}
          isLoggingIn={isAuthenticating}
          loadingState={loadingState ?? undefined}
          message={loadingMessage}
          buttonLabel={intl.formatMessage({
            id: "app.login.button.createAccount",
            defaultMessage: "Create account",
          })}
          errorMessage={!isAuthenticating ? loginError : null}
          usernameInput={{
            value: username,
            onChange: (e) => setUsername(e.target.value),
            label: intl.formatMessage({
              id: "app.login.username.newAccountLabel",
              defaultMessage: "Display name for new account",
            }),
            placeholder: intl.formatMessage({
              id: "app.login.username.placeholder",
              defaultMessage: "e.g. alice or alice.eth",
            }),
            minLength: 3,
            onCancel: goToEntry,
          }}
          isLoginDisabled={!isUsernameValid}
          infoMessage={
            passkeyServerEnabled
              ? intl.formatMessage({
                  id: "app.login.username.hint",
                  defaultMessage: "Use this name later with a synced passkey on another device.",
                })
              : intl.formatMessage({
                  // Local-only mode keeps the re-enrollment explainer instead
                  // of the generic cross-device hint.
                  id: "app.login.passkey.localExplainer",
                  defaultMessage:
                    "Keeps same-device sign-in. May need re-enrollment if browser storage is cleared.",
                })
          }
          tertiaryAction={backTertiaryAction}
        />
      </>
    );
  }

  // ─── Recover form: input (slot 1) · Recover with passkey (slot 2) · Back ────
  // Flat flow: it succeeds, or the error shows and the user retries or goes
  // Back. A fresh account is created through the normal create flow instead of
  // an in-recovery fork; the passkey server still rejects registered names.
  if (screen === "recover" && passkeyServerEnabled) {
    return (
      <>
        {helmet}
        <Splash
          login={handlePasskeyRecovery}
          isLoggingIn={isAuthenticating}
          loadingState={loadingState ?? undefined}
          message={loadingMessage}
          buttonLabel={intl.formatMessage({
            id: "app.login.button.recoverPasskey",
            defaultMessage: "Recover with passkey",
          })}
          errorMessage={!isAuthenticating ? loginError : null}
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
            minLength: 3,
            onCancel: goToEntry,
          }}
          isLoginDisabled={!isRecoveryUsernameValid}
          infoMessage={intl.formatMessage({
            id: "app.login.recovery.info",
            defaultMessage:
              "Synced passkeys recover on supported providers. Local-only passkeys work on this device.",
          })}
          tertiaryAction={backTertiaryAction}
        />
      </>
    );
  }

  // ─── Entry: primary (slot 1) · wallet (slot 2) · Recover link ───────────────
  // Returning users get the personalized one-tap sign-in; new users get Create
  // account, which navigates to the create form. Detection is credential-based,
  // so the stored name can be blank/stale — fall back to the generic label. The
  // pill truncates long/ENS names (Button wraps the label in a truncating
  // span); buttonTitle carries the full text.
  const storedName = hasExistingAccount ? getStoredUsername()?.trim() : undefined;
  const personalizedLabel = storedName
    ? intl.formatMessage(
        { id: "app.login.button.continueAs", defaultMessage: "Continue as {name}" },
        { name: storedName }
      )
    : undefined;

  return (
    <>
      {helmet}
      <Splash
        login={hasExistingAccount ? handlePasskeyLogin : goToCreate}
        isLoggingIn={isAuthenticating}
        loadingState={loadingState ?? undefined}
        message={loadingMessage}
        buttonLabel={
          hasExistingAccount
            ? (personalizedLabel ??
              intl.formatMessage({
                id: "app.login.button.loginPasskey",
                defaultMessage: "Sign in with passkey",
              }))
            : intl.formatMessage({
                id: "app.login.button.createAccount",
                defaultMessage: "Create account",
              })
        }
        buttonTitle={personalizedLabel}
        errorMessage={!isAuthenticating ? loginError : null}
        secondaryAction={{
          label: intl.formatMessage({
            id: "app.login.button.connectWallet",
            defaultMessage: "Sign in with a wallet",
          }),
          onSelect: handleWalletLogin,
        }}
        tertiaryAction={
          browserGuidanceTertiaryAction ||
          (passkeyServerEnabled
            ? {
                label: intl.formatMessage({
                  id: "app.login.button.recoverWithUsername",
                  defaultMessage: "Recover with username",
                }),
                onClick: goToRecover,
              }
            : undefined)
        }
      />
    </>
  );
}
