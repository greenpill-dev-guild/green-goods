import type { useLoginScreenController } from "@green-goods/shared/hooks/client-ui/auth/useLoginScreenController";
import type { ReactNode } from "react";

import { Splash } from "@/components/Layout";

type Controller = ReturnType<typeof useLoginScreenController>;

interface CodeSignInScreenProps {
  helmet: ReactNode;
  intl: Controller["intl"];
  codeSignIn: Controller["codeSignIn"];
  goTo: Controller["goTo"];
  walletLogin: Controller["walletLogin"];
  loginError: Controller["loginError"];
  isAuthenticating: boolean;
  backTertiaryAction: { label: string; onClick: () => void };
}

/**
 * Email sign-in's screens, with the switch on: the other ways to sign in (email beside a wallet),
 * then the email and the code it received. The flow's state lives in Shared's `useCodeSignIn`;
 * these only draw it in the sign-in slots.
 */
export function OtherWaysScreen({
  helmet,
  intl,
  goTo,
  walletLogin,
  loginError,
  isAuthenticating,
  backTertiaryAction,
}: CodeSignInScreenProps) {
  return (
    <>
      {helmet}
      <Splash
        login={() => goTo("code")}
        isLoggingIn={isAuthenticating}
        buttonLabel={intl.formatMessage({
          id: "app.login.button.email",
          defaultMessage: "Sign in with Email",
        })}
        errorMessage={!isAuthenticating ? loginError : null}
        infoMessage={intl.formatMessage({
          id: "app.login.otherWays.info",
          defaultMessage: "Sharing this phone? Each person signs in with their own email.",
        })}
        secondaryAction={{
          label: intl.formatMessage({
            id: "app.login.button.connectWallet",
            defaultMessage: "Sign in with a Wallet",
          }),
          onSelect: walletLogin,
        }}
        tertiaryAction={backTertiaryAction}
      />
    </>
  );
}

export function CodeScreen({
  helmet,
  intl,
  codeSignIn,
  goTo,
  backTertiaryAction,
}: CodeSignInScreenProps) {
  const goToOtherWays = () => goTo("otherWays");
  const onCodeStep = codeSignIn.step === "code";
  const busy = codeSignIn.sending || codeSignIn.signingIn;
  return (
    <>
      {helmet}
      <Splash
        login={onCodeStep ? codeSignIn.signIn : codeSignIn.sendCode}
        isLoggingIn={busy}
        loadingState={busy ? "welcome" : undefined}
        message={
          codeSignIn.signingIn
            ? intl.formatMessage({
                id: "app.login.loading.authenticating",
                defaultMessage: "Signing you in...",
              })
            : intl.formatMessage({
                id: "app.login.code.loading.sending",
                defaultMessage: "Sending your code...",
              })
        }
        buttonLabel={intl.formatMessage(
          onCodeStep
            ? { id: "app.login.code.button.signIn", defaultMessage: "Sign In" }
            : { id: "app.login.code.button.send", defaultMessage: "Send Code" }
        )}
        isLoginDisabled={onCodeStep ? codeSignIn.code.length < 4 : !codeSignIn.emailValid}
        errorMessage={busy ? null : codeSignIn.error}
        usernameInput={
          onCodeStep
            ? {
                value: codeSignIn.code,
                onChange: (e) => codeSignIn.setCode(e.target.value),
                label: intl.formatMessage({
                  id: "app.login.code.codeLabel",
                  defaultMessage: "Sign-in code",
                }),
                placeholder: intl.formatMessage({
                  id: "app.login.code.codePlaceholder",
                  defaultMessage: "Enter the code",
                }),
                autoComplete: "one-time-code",
                inputMode: "numeric",
                onCancel: codeSignIn.changeEmail,
              }
            : {
                value: codeSignIn.email,
                onChange: (e) => codeSignIn.setEmail(e.target.value),
                label: intl.formatMessage({
                  id: "app.login.code.emailLabel",
                  defaultMessage: "Email",
                }),
                placeholder: intl.formatMessage({
                  id: "app.login.code.emailPlaceholder",
                  defaultMessage: "Your email",
                }),
                autoComplete: "email",
                type: "email",
                inputMode: "email",
                onCancel: goToOtherWays,
              }
        }
        infoMessage={
          onCodeStep
            ? intl.formatMessage(
                {
                  id: "app.login.code.sentInfo",
                  defaultMessage: "Enter the code we sent to {email}. It can take a minute.",
                },
                { email: codeSignIn.email.trim() }
              )
            : intl.formatMessage({
                id: "app.login.code.emailInfo",
                defaultMessage:
                  "We'll email you a code to sign in. A new email starts a new account.",
              })
        }
        tertiaryAction={
          onCodeStep
            ? // Back keeps the address, so Send Code there sends a new code.
              { ...backTertiaryAction, onClick: codeSignIn.changeEmail }
            : { ...backTertiaryAction, onClick: goToOtherWays }
        }
      />
    </>
  );
}
