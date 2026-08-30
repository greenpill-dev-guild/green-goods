import { useLoginScreenController } from "@green-goods/shared/hooks/client-ui/auth/useLoginScreenController";
import { Helmet } from "react-helmet-async";
import { Navigate, Outlet } from "react-router-dom";

import { Splash } from "@/components/Layout";
import { APP_ROUTES } from "@/config/pwaRouting";
import { LoadingSplash } from "@/views/Login/components/LoadingSplash";

export function Login() {
  const {
    auth,
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
  if (!isReady) return <LoadingSplash loadingState="welcome" />;
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
          login={recoverWithPasskey}
          isLoggingIn={isAuthenticating}
          loadingState={loadingState ?? undefined}
          message={loadingMessage}
          buttonLabel={intl.formatMessage({
            id: "app.login.button.recoverPasskey",
            defaultMessage: "Recover with Passkey",
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
        secondaryAction={{
          label: intl.formatMessage({
            id: "app.login.button.connectWallet",
            defaultMessage: "Sign in with a Wallet",
          }),
          onSelect: walletLogin,
        }}
        tertiaryAction={
          browserGuidanceAction ||
          (passkeyServerEnabled
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
