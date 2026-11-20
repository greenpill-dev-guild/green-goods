import { Button } from "@green-goods/shared/components/Button";
import {
  type AdminLoginController,
  type AdminLoginMode,
  useAdminLoginController,
} from "@green-goods/shared/hooks/admin-ui/auth/useAdminLoginController";
import { RiKey2Line } from "@remixicon/react";
import { useEffect, useId, useState } from "react";
import { useIntl } from "react-intl";
import { AdminTextField } from "./AdminTextField";
import { clearPasskeyRequestAtBoot, isPasskeyRequestedAtBoot } from "./Boot/bootPasskeyRequest";
import { ConnectButton } from "./ConnectButton";
import { SignInSlots } from "./SignInSlots";

/**
 * Command surface: the App's sign-in at the Hub's density. The entry offers a passkey
 * first and a wallet second; the name step signs in to an existing account or creates
 * one. Every slot keeps its height in every state, so an error, a hint or a pending
 * ceremony never moves a control.
 */
export function AdminSignIn({ controller }: { controller: AdminLoginController }) {
  const { formatMessage } = useIntl();
  const feedbackId = useId();
  const hintId = feedbackId + "-hint";
  const isForm = controller.mode === "username";
  const remembered = controller.hasStoredCredential;
  const showError = Boolean(controller.error) && !controller.isSigningIn;
  const showHint = isForm && !showError && !controller.isSigningIn;
  const createLabel = formatMessage({
    id: "app.login.button.createAccount",
    defaultMessage: "Create Account",
  });
  // Without the passkey server a name cannot be looked up, so the name step only creates.
  const nameStepLabel = controller.canSignInByName
    ? formatMessage({ id: "app.login.button.continue", defaultMessage: "Continue" })
    : createLabel;
  const entryLabel = remembered
    ? controller.storedUsername
      ? formatMessage(
          { id: "app.login.button.continueAs", defaultMessage: "Continue as {name}" },
          { name: controller.storedUsername }
        )
      : formatMessage({
          id: "app.login.button.loginPasskey",
          defaultMessage: "Sign in with Passkey",
        })
    : controller.canSignInByName
      ? formatMessage({
          id: "app.login.button.continuePasskey",
          defaultMessage: "Continue with Passkey",
        })
      : createLabel;
  // A remembered passkey signs in at once, so another account needs its own way to the name step.
  const showOtherAccount = !isForm && remembered && controller.canSignInByName;

  return (
    <SignInSlots
      onSubmit={() => {
        if (isForm) void controller.continueByName();
      }}
      slotOne={
        isForm ? (
          // The field's hints and errors live in the feedback zone, so it reserves no
          // message line, and the slot holds its label and box at every width.
          <AdminTextField
            className="w-full text-left [--gg-field-message-lines:0]"
            label={formatMessage({
              id: "app.login.username.label",
              defaultMessage: "Username or ENS handle",
            })}
            value={controller.username}
            onChange={(event) => controller.setUsername(event.target.value)}
            disabled={controller.isSigningIn}
            inputProps={{
              autoFocus: true,
              autoComplete: "username",
              "aria-invalid": showError,
              "aria-describedby": showError ? feedbackId : showHint ? hintId : undefined,
              onKeyDown: (event) => {
                if (event.key === "Escape") controller.changeMode("entry");
              },
            }}
          />
        ) : (
          <Button
            className="w-full"
            type="button"
            size="lg"
            leadingIcon={<RiKey2Line className="h-[18px] w-[18px]" aria-hidden="true" />}
            loading={controller.isSigningIn && remembered}
            disabled={controller.isSigningIn}
            title={entryLabel}
            data-testid="passkey-start-button"
            onClick={() =>
              remembered
                ? void controller.signInWithStoredPasskey()
                : controller.changeMode("username")
            }
          >
            <span className="min-w-0 truncate">{entryLabel}</span>
          </Button>
        )
      }
      slotTwo={
        isForm ? (
          <Button
            className="w-full"
            type="submit"
            size="lg"
            leadingIcon={<RiKey2Line className="h-[18px] w-[18px]" aria-hidden="true" />}
            loading={controller.isSigningIn}
            disabled={controller.isSigningIn || !controller.username.trim()}
          >
            {nameStepLabel}
          </Button>
        ) : (
          <ConnectButton
            className="w-full"
            size="lg"
            variant="secondary"
            disabled={controller.isSigningIn}
          >
            {formatMessage({
              id: "app.login.button.connectWallet",
              defaultMessage: "Sign in with a Wallet",
            })}
          </ConnectButton>
        )
      }
      feedback={
        <>
          <p id={feedbackId} role="alert" className="type-body text-error-dark">
            {showError ? controller.error : null}
          </p>
          {controller.isSigningIn && (isForm || remembered) ? (
            <p role="status" className="type-body text-text-sub">
              {formatMessage(
                isForm
                  ? { id: "app.login.loading.continuing", defaultMessage: "Continuing..." }
                  : { id: "app.login.loading.authenticating", defaultMessage: "Signing you in..." }
              )}
            </p>
          ) : showHint ? (
            <p id={hintId} className="type-body text-text-sub">
              {formatMessage(
                controller.canSignInByName
                  ? {
                      id: "app.login.username.signInOrCreateInfo",
                      defaultMessage:
                        "Enter your username to sign in, or choose a new one to create an account.",
                    }
                  : {
                      id: "app.login.passkey.localExplainer",
                      defaultMessage:
                        "Keeps same-device sign-in. May need re-enrollment if browser storage is cleared.",
                    }
              )}
            </p>
          ) : null}
        </>
      }
      navigation={
        isForm || showOtherAccount ? (
          <Button
            type="button"
            emphasis="tertiary"
            size="lg"
            disabled={controller.isSigningIn}
            onClick={() => controller.changeMode(isForm ? "entry" : "username")}
          >
            {formatMessage(
              isForm
                ? { id: "app.login.button.back", defaultMessage: "Back" }
                : {
                    id: "app.login.button.useDifferentUsername",
                    defaultMessage: "Use Different Username",
                  }
            )}
          </Button>
        ) : null
      }
    />
  );
}

export function AdminSignInContainer() {
  // A passkey chosen on the boot screen opens the name step; read once, then let go.
  const [initialMode] = useState<AdminLoginMode>(() =>
    isPasskeyRequestedAtBoot() ? "username" : "entry"
  );
  useEffect(() => clearPasskeyRequestAtBoot(), []);
  const controller = useAdminLoginController({ initialMode });
  return <AdminSignIn controller={controller} />;
}
