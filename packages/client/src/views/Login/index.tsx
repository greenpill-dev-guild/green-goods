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

  // Continue from the separate-account confirmation into create mode, keeping
  // the recovery attempt so the user lands on the separate-account create panel.
  const handleStartCreateAccountFromRecovery = () => {
    const recoveryName = recoveryUsername.trim();
    if (recoveryName.length >= 3 && !username.trim()) {
      setUsername(recoveryName);
    }
    setLoginError(null);
    setNoLocalPasskeyMode("create");
  };

  // Exit recovery back to the first-time create screen. Clearing the recovery
  // attempt lands the user on a clean create panel (not separate-account mode),
  // carrying over a typed name as a convenience.
  const handleExitRecovery = () => {
    const recoveryName = recoveryUsername.trim();
    if (recoveryName.length >= 3 && !username.trim()) {
      setUsername(recoveryName);
    }
    setLoginError(null);
    setRecoveryAttempted(false);
    setForceRecovery(false);
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
  // In-flight passkey attempts no longer swap to LoadingSplash: each state's
  // Splash stays mounted and shows the spinner inside the primary button
  // (loadingState/loadingMessage thread through below), so the geometry test
  // can pin the primary across loading too.

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

  // ─── Slot model: every state fills the same reserved slots ──────────────────
  //
  // Entry screens (returning · create-fresh · local-only pre · bare-create):
  //   Slot B: state's primary   Slot C: Sign in with a wallet
  //   Tertiary: browser guidance, else "Recover with username"
  //
  // Sub-flow screens (recovery · create-separate · confirm-separate):
  //   Wallet is intentionally NOT offered — the Back tertiary returns to an
  //   entry screen where it lives. Slot C stays empty-reserved except the
  //   post-failure "Create separate account" offer on the recovery screen.
  //
  // The shared message zone carries ONE string per state (input hint,
  // explainer, or separate-account warning); errors always win the zone.

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
    // Personalize the one-tap primary with the stored display name. Detection
    // is credential-based, so the stored name can be blank/stale — fall back
    // to the generic label. The pill truncates long/ENS names (Button wraps
    // the label in a truncating span); buttonTitle carries the full text.
    const storedName = getStoredUsername()?.trim();
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
          login={handlePasskeyLogin}
          isLoggingIn={isAuthenticating}
          loadingState={loadingState ?? undefined}
          message={loadingMessage}
          buttonLabel={
            personalizedLabel ??
            intl.formatMessage({
              id: "app.login.button.loginPasskey",
              defaultMessage: "Sign in with passkey",
            })
          }
          buttonTitle={personalizedLabel}
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
          loadingState={loadingState ?? undefined}
          message={loadingMessage}
          buttonLabel={intl.formatMessage({
            id: "app.login.button.confirmSeparateAccount",
            defaultMessage: "Continue to new account",
          })}
          errorMessage={!isAuthenticating ? loginError : null}
          tertiaryAction={{
            label: intl.formatMessage({
              id: "app.login.button.backToRecovery",
              defaultMessage: "Back to recovery",
            }),
            onClick: handleReturnToRecovery,
          }}
          infoMessage={intl.formatMessage({
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
          loadingState={loadingState ?? undefined}
          message={loadingMessage}
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
            // Create-fresh is the new-user front door, so the wallet path stays.
            // Separate-account creation is a sub-flow: no wallet, Back lives in
            // the tertiary slot and slot C stays empty-reserved.
            isSeparateAccountCreation ? undefined : walletAction
          }
          tertiaryAction={
            isSeparateAccountCreation
              ? {
                  label: intl.formatMessage({
                    id: "app.login.button.backToRecovery",
                    defaultMessage: "Back to recovery",
                  }),
                  onClick: handleReturnToRecovery,
                }
              : browserGuidanceTertiaryAction ||
                (passkeyServerEnabled
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
              defaultMessage: "e.g. alice or alice.eth",
            }),
            minLength: 3,
            onCancel: isSeparateAccountCreation ? handleReturnToRecovery : undefined,
          }}
          isLoginDisabled={!isUsernameValid}
          infoMessage={
            isSeparateAccountCreation
              ? intl.formatMessage({
                  id: "app.login.username.newAccountHint",
                  defaultMessage:
                    "This creates a different address. Use recovery if you already made a passkey.",
                })
              : passkeyServerEnabled
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
          loadingState={loadingState ?? undefined}
          message={loadingMessage}
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
        loadingState={loadingState ?? undefined}
        message={loadingMessage}
        buttonLabel={intl.formatMessage({
          id: recoveryAttempted
            ? "app.login.button.retryRecovery"
            : "app.login.button.recoverPasskey",
          defaultMessage: recoveryAttempted ? "Retry recovery" : "Recover with passkey",
        })}
        errorMessage={!isAuthenticating ? loginError : null}
        secondaryAction={
          // Recovery is a sub-flow: slot C stays empty-reserved until a failed
          // attempt unlocks the guarded separate-account offer (never shown to
          // existing-credential users — see block comment above).
          !isExistingAccountRecovery && recoveryAttempted && loginError
            ? {
                label: intl.formatMessage({
                  id: "app.login.button.createSeparateAccount",
                  defaultMessage: "Create separate account",
                }),
                onSelect: handleStartSeparateAccount,
              }
            : undefined
        }
        tertiaryAction={
          // No wallet here: the Back tertiary returns to an entry screen where
          // the wallet path lives one tap away.
          isExistingAccountRecovery
            ? {
                label: intl.formatMessage({
                  id: "app.login.button.backToSignIn",
                  defaultMessage: "Back to sign in",
                }),
                onClick: handleReturnToSignIn,
              }
            : {
                label: intl.formatMessage({
                  id: "app.login.button.back",
                  defaultMessage: "Back",
                }),
                onClick: handleExitRecovery,
              }
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
          minLength: 3,
        }}
        isLoginDisabled={!isRecoveryUsernameValid}
        infoMessage={intl.formatMessage({
          // Keep the info text constant across attempts: swapping to a shorter
          // "retry" message reads as churn. The error banner (which takes over
          // the message zone) + "Retry recovery" button already convey that the
          // attempt failed.
          id: "app.login.recovery.info",
          defaultMessage:
            "Synced passkeys recover on supported providers. Local-only passkeys work on this device.",
        })}
      />
    </>
  );
}
