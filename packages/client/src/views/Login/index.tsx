import {
  classifyPasskeyCeremonyContext,
  copyToClipboard,
  debugError,
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
      defaultMessage: "Sign in was cancelled. Try again when you're ready.",
    });
  }
  if (
    msg.includes("expected account address") ||
    msg.includes("address mismatch") ||
    msg.includes("did not match the expected account")
  ) {
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
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  const [noLocalPasskeyMode, setNoLocalPasskeyMode] = useState<NoLocalPasskeyMode>("create");
  // Returning users keep one-tap sign-in as primary; this opt-in flag opens
  // the username recovery prompt for them (e.g. provider-side passkey lost
  // or stale local cache) without requiring a site-data wipe first.
  const [forceRecovery, setForceRecovery] = useState(false);
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
          defaultMessage: "Please enter a display name with at least 3 characters.",
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
    setRecoveryAttempted(true);
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
          defaultMessage: "Please enter a display name with at least 3 characters.",
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

  const handleStartUsernameRecovery = () => {
    setLoginError(null);
    setForceRecovery(true);
  };

  const handleReturnToSignIn = () => {
    setLoginError(null);
    setForceRecovery(false);
  };

  const handleStartSeparateAccount = () => {
    setLoginError(null);
    setNoLocalPasskeyMode("confirm-new-account");
  };

  const handleStartCreateAccountFromRecovery = () => {
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
    recoveryAttemptNameRef.current = null;
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
  //   Primary: Create account (passkey-first; username required)
  //   Secondary: Sign in with a wallet
  //   Tertiary: Recover with username (explicit returning-user path)
  //
  // Recovery path:
  //   Primary: Recover with username/ENS (hosted passkey server lookup)
  //   Secondary: Create account before failure, or guarded separate-account
  //   confirmation after failure.

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
  if (hasExistingAccount && !forceRecovery) {
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
          tertiaryAction={
            browserGuidanceTertiaryAction ||
            (passkeyServerEnabled
              ? {
                  label: intl.formatMessage({
                    id: "app.login.button.recoverWithUsername",
                    defaultMessage: "Recover with username",
                  }),
                  onClick: handleStartUsernameRecovery,
                }
              : undefined)
          }
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
          login={handleStartCreateAccountFromRecovery}
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
    const isSeparateAccountCreation = passkeyServerEnabled && recoveryAttempted;

    return (
      <>
        {helmet}
        <Splash
          login={handleCreateAccount}
          isLoggingIn={isAuthenticating}
          buttonLabel={intl.formatMessage({
            id: isSeparateAccountCreation
              ? "app.login.button.createSeparateAccount"
              : "app.login.button.createAccount",
            defaultMessage: isSeparateAccountCreation
              ? "Create separate account"
              : "Create account",
          })}
          errorMessage={!isAuthenticating ? loginError : null}
          secondaryAction={
            isSeparateAccountCreation
              ? {
                  label: intl.formatMessage({
                    id: "app.login.button.backToRecovery",
                    defaultMessage: "Back to recovery",
                  }),
                  onSelect: handleReturnToRecovery,
                }
              : walletAction
          }
          tertiaryAction={
            browserGuidanceTertiaryAction ||
            (passkeyServerEnabled && !isSeparateAccountCreation
              ? {
                  label: intl.formatMessage({
                    id: "app.login.button.recoverWithUsername",
                    defaultMessage: "Recover with username",
                  }),
                  onClick: handleReturnToRecovery,
                }
              : undefined)
          }
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
              id: isSeparateAccountCreation
                ? "app.login.username.newAccountHint"
                : "app.login.username.hint",
              defaultMessage: isSeparateAccountCreation
                ? "This creates a different address. Use recovery if you already made a passkey."
                : "Use this name later with a synced passkey on another device.",
            }),
            minLength: 3,
            onCancel: isSeparateAccountCreation ? handleReturnToRecovery : undefined,
          }}
          isLoginDisabled={!isUsernameValid}
          notice={isSeparateAccountCreation ? addressContinuityNotice : undefined}
          infoCallout={intl.formatMessage({
            id: passkeyServerEnabled
              ? "app.login.passkey.explainer"
              : "app.login.passkey.localExplainer",
            defaultMessage: passkeyServerEnabled
              ? "Passkeys keep sign-in passwordless. Your username helps find this passkey again on another device when your provider syncs passkeys."
              : "This local passkey keeps same-device login available. It may need re-enrollment if browser storage is cleared.",
          })}
        />
      </>
    );
  }

  if (!hasExistingAccount && !passkeyServerEnabled) {
    return (
      <>
        {helmet}
        <Splash
          login={() => setNoLocalPasskeyMode("create")}
          isLoggingIn={isAuthenticating}
          buttonLabel={intl.formatMessage({
            id: "app.login.button.createPasskeyAccount",
            defaultMessage: "Create your account",
          })}
          errorMessage={!isAuthenticating ? loginError : null}
          secondaryAction={walletAction}
          tertiaryAction={browserGuidanceTertiaryAction}
        />
      </>
    );
  }

  // ─── Recovery prompt ─────────────────────────────────────────────────────────
  // Reached when the local cache is missing (recover before creating a new
  // account) or when a returning user explicitly opts into username recovery.
  // Existing-account recovery never exposes separate-account creation: the
  // user still has a working local credential, and replacing it from this
  // screen would overwrite the same-device fallback.
  const isExistingAccountRecovery = hasExistingAccount && forceRecovery;

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
          isExistingAccountRecovery
            ? {
                label: intl.formatMessage({
                  id: "app.login.button.backToSignIn",
                  defaultMessage: "Back to sign in",
                }),
                onSelect: handleReturnToSignIn,
              }
            : recoveryAttempted && loginError
              ? {
                  label: intl.formatMessage({
                    id: "app.login.button.createSeparateAccount",
                    defaultMessage: "Create separate account",
                  }),
                  onSelect: handleStartSeparateAccount,
                }
              : {
                  label: intl.formatMessage({
                    id: "app.login.button.createAccount",
                    defaultMessage: "Create account",
                  }),
                  onSelect: handleStartCreateAccountFromRecovery,
                }
        }
        tertiaryAction={
          browserGuidanceTertiaryAction ||
          (isExistingAccountRecovery || !recoveryAttempted || (recoveryAttempted && loginError)
            ? {
                label: intl.formatMessage({
                  id: "app.login.button.connectWallet",
                  defaultMessage: "Sign in with a wallet",
                }),
                onClick: handleWalletLogin,
              }
            : undefined)
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
          // The retry copy mentions separate-account creation, which is not
          // offered during existing-account recovery — keep the base info there.
          id:
            !isExistingAccountRecovery && recoveryAttempted && loginError
              ? "app.login.recovery.retryInfo"
              : "app.login.recovery.info",
          defaultMessage:
            !isExistingAccountRecovery && recoveryAttempted && loginError
              ? "Recovery did not complete. Retry, use a same-device fallback if available, or confirm before creating a separate account."
              : "Synced passkeys can recover where your provider supports sync. Legacy local-only passkeys still work on the same device and may need re-enrollment after storage loss.",
        })}
      />
    </>
  );
}
