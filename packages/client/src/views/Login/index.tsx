import { useLoginScreenController } from "@green-goods/shared/hooks/client-ui/auth/useLoginScreenController";
import { Helmet } from "react-helmet-async";
import { Navigate, Outlet } from "react-router-dom";
import { Button } from "@green-goods/shared/components/Button";
import { formatUnits } from "viem";

import { Splash } from "@/components/Layout";
import { APP_ROUTES } from "@/config/pwaRouting";

export function Login() {
  const {
    auth,
    pilotInvitation,
    originalAccountAddress,
    loginWithOriginalAccount,
    pilotPreview,
    pilotQuote,
    pilotBusy,
    pilotError,
    showPilotEnrollment,
    reviewPilotAccount,
    quotePilotProof,
    confirmPilotAccount,
    reconcilePilotProof,
    keepOriginalAccount,
    browserGuidanceAction,
    createAccount,
    goTo,
    intl,
    isNestedRoute,
    isRecoveryUsernameValid,
    isUsernameValid,
    loadingMessage,
    loadingState,
    loginError,
    loginWithPasskey,
    passkeyServerEnabled,
    personalizedLabel,
    recoverWithPasskey,
    recoveryUsername,
    redirectTo,
    screen,
    setRecoveryUsername,
    setUsername,
    username,
    walletLogin,
  } = useLoginScreenController({ login: APP_ROUTES.login, home: APP_ROUTES.home });
  const {
    hasStoredCredential: hasExistingAccount,
    isAuthenticated,
    isAuthenticating,
    isReady,
  } = auth;
  const goToEntry = () => goTo("entry");
  const goToCreate = () => goTo("create");
  const goToRecover = () => goTo("recover");

  if (isNestedRoute) return <Outlet />;
  // The pre-React PWA surface stays mounted until auth restoration resolves.
  // Rendering another full-screen loader here creates a visible second scene.
  if (!isReady) return null;
  if (showPilotEnrollment) {
    const action = !pilotPreview
      ? reviewPilotAccount
      : pilotPreview.pending
        ? reconcilePilotProof
        : pilotPreview.enrolled || pilotQuote
          ? confirmPilotAccount
          : quotePilotProof;
    const label = !pilotPreview
      ? "prepare"
      : pilotPreview.pending
        ? "reconcile"
        : pilotPreview.enrolled
          ? "select"
          : pilotQuote
            ? "sign"
            : "quote";
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-white-0 px-4 py-8">
        <div className="w-full max-w-sm space-y-5">
          <h1 className="text-xl font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.login.pilot.title", defaultMessage: "Pilot Account" })}
          </h1>
          <p className="text-sm text-text-sub-600">
            {intl.formatMessage({
              id: "app.login.pilot.intro",
              defaultMessage:
                "Use your existing passkey and login name to review a new participating address.",
            })}
          </p>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-semibold">
                {intl.formatMessage({
                  id: "app.login.pilot.previousAddress",
                  defaultMessage: "Original Account",
                })}
              </dt>
              <dd className="break-all font-mono">
                {pilotPreview?.previousAddress ?? auth.smartAccountAddress}
              </dd>
            </div>
            {pilotPreview && (
              <div>
                <dt className="font-semibold">
                  {intl.formatMessage({
                    id: "app.login.pilot.newAddress",
                    defaultMessage: "New Pilot Account",
                  })}
                </dt>
                <dd className="break-all font-mono">{pilotPreview.address}</dd>
              </div>
            )}
          </dl>
          <p className="text-sm text-text-sub-600">
            {intl.formatMessage({
              id: "app.login.pilot.notice",
              defaultMessage:
                "Balances, promises, permissions and your ENS name stay with your original address. Your login name can stay the same.",
            })}
          </p>
          {pilotPreview && !pilotPreview.enrolled && (
            <p className="text-sm">
              {intl.formatMessage({
                id: pilotPreview.pending ? "app.login.pilot.pending" : "app.login.pilot.proofInfo",
              })}
            </p>
          )}
          {pilotQuote && (
            <div className="space-y-2 text-sm">
              <p>
                {intl.formatMessage(
                  { id: "app.login.pilot.quoteInfo" },
                  { cost: formatUnits(BigInt(pilotQuote.maxCostWei), 18), nonce: pilotQuote.nonce }
                )}
              </p>
              <p className="break-all font-mono">{pilotQuote.operationHash}</p>
            </div>
          )}
          {pilotError && (
            <p role="alert" className="text-sm text-error-dark">
              {pilotError}
            </p>
          )}
          <Button className="w-full" onClick={action} loading={pilotBusy} disabled={pilotBusy}>
            {intl.formatMessage({ id: `app.login.pilot.${label}` })}
          </Button>
          <Button
            className="w-full"
            emphasis="secondary"
            onClick={keepOriginalAccount}
            disabled={pilotBusy}
          >
            {intl.formatMessage({
              id: "app.login.pilot.keepOriginal",
              defaultMessage: "Keep Original Account",
            })}
          </Button>
        </div>
      </main>
    );
  }
  if (isAuthenticated) return <Navigate to={redirectTo} replace />;
  // In-flight passkey attempts never swap the tree: each screen's Splash stays
  // mounted and shows the spinner inside the primary button (loadingState and
  // loadingMessage thread through below).

  // Build tertiary action for browser guidance when in wrong browser
  // Browser guidance takes priority over the recover link when present
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
          login={createAccount}
          isLoggingIn={isAuthenticating}
          loadingState={loadingState ?? undefined}
          message={loadingMessage}
          buttonLabel={intl.formatMessage({
            id: "app.login.button.createAccount",
            defaultMessage: "Create Account",
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
                  defaultMessage:
                    "Keep this name somewhere safe. You'll use it to sign in on another device.",
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

  // ─── Recover form: input (slot 1) · Sign in with passkey (slot 2) · Back ────
  // Flat flow: it succeeds, or the error shows and the user retries or goes
  // Back. A fresh account is created through the normal create flow instead of
  // an in-recovery fork; the passkey server still rejects registered names.
  if (screen === "recover" && passkeyServerEnabled) {
    return (
      <>
        {helmet}
        <Splash
          login={recoverWithPasskey}
          isLoggingIn={isAuthenticating}
          loadingState={loadingState ?? undefined}
          message={loadingMessage}
          buttonLabel={intl.formatMessage({
            id: "app.login.button.loginPasskey",
            defaultMessage: "Sign in with Passkey",
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
              "Your passkey needs to be on this device or on a phone nearby. It usually arrives with your Apple or Google account.",
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
  return (
    <>
      {helmet}
      <Splash
        login={hasExistingAccount ? loginWithPasskey : goToCreate}
        isLoggingIn={isAuthenticating}
        loadingState={loadingState ?? undefined}
        message={loadingMessage}
        buttonLabel={
          hasExistingAccount
            ? (personalizedLabel ??
              intl.formatMessage({
                id: "app.login.button.loginPasskey",
                defaultMessage: "Sign in with Passkey",
              }))
            : intl.formatMessage({
                id: "app.login.button.createAccount",
                defaultMessage: "Create Account",
              })
        }
        buttonTitle={personalizedLabel}
        errorMessage={!isAuthenticating ? loginError : null}
        infoMessage={
          pilotInvitation
            ? intl.formatMessage({
                id: "app.login.pilot.invitation",
                defaultMessage:
                  "Pilot participants: sign in with your existing passkey, then review your new pilot account.",
              })
            : originalAccountAddress
              ? intl.formatMessage(
                  {
                    id: "app.login.pilot.originalRecovery",
                    defaultMessage:
                      "If your pilot account cannot be verified, retry passkey sign-in or use your original account: {address}.",
                  },
                  { address: originalAccountAddress }
                )
              : undefined
        }
        secondaryAction={{
          label: intl.formatMessage({
            id: "app.login.button.connectWallet",
            defaultMessage: "Sign in with a Wallet",
          }),
          onSelect: walletLogin,
        }}
        tertiaryAction={
          browserGuidanceAction ||
          (originalAccountAddress
            ? {
                label: intl.formatMessage({
                  id: "app.login.pilot.loginOriginal",
                  defaultMessage: "Use Original Account",
                }),
                onClick: loginWithOriginalAccount,
              }
            : passkeyServerEnabled
              ? {
                  // Returning users (a local passkey exists) can "recover" — a
                  // broken/rotated credential. First-time-on-this-device users
                  // haven't lost anything to recover, but the bucket includes an
                  // existing user on a new device/browser, whose only way in is
                  // this same username lookup — so the door stays, reframed as
                  // signing into an existing account rather than recovery.
                  label: hasExistingAccount
                    ? intl.formatMessage({
                        id: "app.login.button.recoverWithUsername",
                        defaultMessage: "Recover with Username",
                      })
                    : intl.formatMessage({
                        id: "app.login.button.haveAccount",
                        defaultMessage: "Already have an account?",
                      }),
                  onClick: goToRecover,
                }
              : undefined)
        }
      />
    </>
  );
}
