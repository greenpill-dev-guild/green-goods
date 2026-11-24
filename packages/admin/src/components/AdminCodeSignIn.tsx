import { Button } from "@green-goods/shared/components/Button";
import type { AdminLoginController } from "@green-goods/shared/hooks/admin-ui/auth/useAdminLoginController";
import { RiMailLine } from "@remixicon/react";
import { useId } from "react";
import { useIntl } from "react-intl";
import { AdminTextField } from "./AdminTextField";
import { ConnectButton } from "./ConnectButton";
import { SignInSlots } from "./SignInSlots";

/**
 * The Hub's other ways to sign in, with email sign-in on: email and a wallet, then the email
 * and the code it received, in the same slots as the passkey screens so nothing moves.
 */
export function AdminCodeSignIn({ controller }: { controller: AdminLoginController }) {
  const { formatMessage } = useIntl();
  const hintId = useId();
  const errorId = `${hintId}-error`;
  const code = controller.codeSignIn;
  const back = formatMessage({ id: "app.login.button.back", defaultMessage: "Back" });

  if (controller.mode === "otherWays") {
    return (
      <SignInSlots
        onSubmit={() => controller.changeMode("code")}
        slotOne={
          <Button
            className="w-full"
            type="button"
            size="lg"
            leadingIcon={<RiMailLine className="h-[18px] w-[18px]" aria-hidden="true" />}
            onClick={() => controller.changeMode("code")}
          >
            {formatMessage({ id: "app.login.button.email", defaultMessage: "Sign in with Email" })}
          </Button>
        }
        slotTwo={
          <ConnectButton
            className="w-full"
            size="lg"
            variant="secondary"
            disabled={controller.isSigningIn}
            onStart={controller.beginWalletSignIn}
          >
            {formatMessage({
              id: "app.login.button.connectWallet",
              defaultMessage: "Sign in with a Wallet",
            })}
          </ConnectButton>
        }
        feedback={
          <>
            <p role="alert" className="type-body text-error-dark">
              {controller.error && !controller.isSigningIn ? controller.error : null}
            </p>
            <p className="type-body text-text-sub">
              {formatMessage({
                id: "app.login.otherWays.info",
                defaultMessage: "Sharing this phone? Each person signs in with their own email.",
              })}
            </p>
          </>
        }
        navigation={
          <Button
            type="button"
            emphasis="tertiary"
            size="lg"
            onClick={() => controller.changeMode("entry")}
          >
            {back}
          </Button>
        }
      />
    );
  }

  const onCodeStep = code.step === "code";
  const busy = code.sending || code.signingIn;
  const showError = Boolean(code.error) && !busy;
  const submit = () => void (onCodeStep ? code.signIn() : code.sendCode());
  return (
    <SignInSlots
      onSubmit={submit}
      slotOne={
        <AdminTextField
          key={code.step}
          className="w-full text-left [--gg-field-message-lines:0]"
          label={formatMessage(
            onCodeStep
              ? { id: "app.login.code.codeLabel", defaultMessage: "Sign-in code" }
              : { id: "app.login.code.emailLabel", defaultMessage: "Email" }
          )}
          type={onCodeStep ? "text" : "email"}
          value={onCodeStep ? code.code : code.email}
          onChange={(event) =>
            onCodeStep ? code.setCode(event.target.value) : code.setEmail(event.target.value)
          }
          disabled={busy}
          inputProps={{
            autoFocus: true,
            autoComplete: onCodeStep ? "one-time-code" : "email",
            inputMode: onCodeStep ? "numeric" : "email",
            "aria-invalid": showError,
            // The field is described by what the zone shows: the error, or else the hint.
            "aria-describedby": showError ? errorId : hintId,
          }}
        />
      }
      slotTwo={
        <Button
          className="w-full"
          type="submit"
          size="lg"
          loading={busy}
          disabled={busy || (onCodeStep ? code.code.length < 4 : !code.emailValid)}
        >
          {formatMessage(
            onCodeStep
              ? { id: "app.login.code.button.signIn", defaultMessage: "Sign In" }
              : { id: "app.login.code.button.send", defaultMessage: "Send Code" }
          )}
        </Button>
      }
      feedback={
        <>
          <p id={errorId} role="alert" className="type-body text-error-dark">
            {showError ? code.error : null}
          </p>
          {busy ? (
            <p role="status" className="type-body text-text-sub">
              {formatMessage(
                code.signingIn
                  ? { id: "app.login.loading.authenticating", defaultMessage: "Signing you in..." }
                  : { id: "app.login.code.loading.sending", defaultMessage: "Sending your code..." }
              )}
            </p>
          ) : !showError ? (
            <p id={hintId} className="type-body text-text-sub">
              {onCodeStep
                ? formatMessage(
                    {
                      id: "app.login.code.sentInfo",
                      defaultMessage: "Enter the code we sent to {email}. It can take a minute.",
                    },
                    { email: code.email.trim() }
                  )
                : formatMessage({
                    id: "app.login.code.emailInfo",
                    defaultMessage:
                      "We'll email you a code to sign in. A new email starts a new account.",
                  })}
            </p>
          ) : null}
        </>
      }
      navigation={
        <Button
          type="button"
          emphasis="tertiary"
          size="lg"
          disabled={busy}
          // Back from the code keeps the email, so Send Code there sends a new code.
          onClick={() => (onCodeStep ? code.changeEmail() : controller.changeMode("otherWays"))}
        >
          {back}
        </Button>
      }
    />
  );
}
