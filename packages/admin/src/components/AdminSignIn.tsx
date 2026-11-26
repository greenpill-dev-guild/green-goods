import { Button } from "@green-goods/shared/components/Button";
import {
  type AdminLoginController,
  type AdminLoginMode,
  useAdminLoginController,
} from "@green-goods/shared/hooks/admin-ui/auth/useAdminLoginController";
import {
  useWalletModal,
  type WalletModalResult,
} from "@green-goods/shared/hooks/auth/useWalletModalOpen";
import { useAuthState } from "@green-goods/shared/providers/Auth";
import { RiKey2Line } from "@remixicon/react";
import { useEffect, useId, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminCodeSignIn } from "./AdminCodeSignIn";
import { AdminTextField } from "./AdminTextField";
import {
  clearPasskeyRequestAtBoot,
  isOtherWaysRequestedAtBoot,
  isPasskeyRequestedAtBoot,
} from "./Boot/bootPasskeyRequest";
import { ConnectButton } from "./ConnectButton";
import { SignInSlots } from "./SignInSlots";

/**
 * Command surface: the App's sign-in at the Hub's density. The entry offers a passkey
 * first and a wallet second; the name step signs in to an existing account or creates
 * one. Every slot keeps its height in every state, so an error, a hint or a pending
 * ceremony never moves a control.
 */
export function AdminSignIn({
  controller,
  onOtherWays,
  signingInWithEmail,
}: {
  controller: AdminLoginController;
  onOtherWays?: () => void;
  signingInWithEmail?: boolean;
}) {
  if (
    controller.codeSignIn.enabled &&
    (controller.mode === "otherWays" || controller.mode === "code")
  ) {
    return <AdminCodeSignIn controller={controller} />;
  }
  if (controller.mode === "confirmNewAccount") {
    return <AdminConfirmNewAccount controller={controller} />;
  }
  return (
    <AdminPasskeySignIn
      controller={controller}
      onOtherWays={onOtherWays ?? (() => controller.changeMode("otherWays"))}
      signingInWithEmail={signingInWithEmail}
    />
  );
}

/**
 * The typed name belongs to nobody, and this device already has an account: a typo must not
 * quietly become a second account, so the steward says it is a new one (PRD-1611).
 */
function AdminConfirmNewAccount({ controller }: { controller: AdminLoginController }) {
  const { formatMessage } = useIntl();
  const questionRef = useRef<HTMLParagraphElement>(null);
  // The pressed button unmounted: focus the question so a screen reader reads it first.
  useEffect(() => questionRef.current?.focus(), []);
  const name = controller.username.trim();
  return (
    <SignInSlots
      onSubmit={() => void controller.createNamedAccount()}
      slotOne={
        <Button
          className="w-full"
          type="submit"
          size="lg"
          leadingIcon={<RiKey2Line className="h-[18px] w-[18px]" aria-hidden="true" />}
          loading={controller.isPasskeySigningIn}
          disabled={controller.isSigningIn}
        >
          {formatMessage({
            id: "app.login.newAccount.create",
            defaultMessage: "Create New Account",
          })}
        </Button>
      }
      slotTwo={
        <Button
          className="w-full"
          type="button"
          size="lg"
          emphasis="secondary"
          disabled={controller.isSigningIn}
          onClick={() => controller.changeMode("username")}
        >
          {formatMessage({
            id: "app.login.newAccount.checkName",
            defaultMessage: "Check the Name",
          })}
        </Button>
      }
      feedback={
        <>
          <p role="alert" className="type-body text-error-dark">
            {controller.error && !controller.isSigningIn ? controller.error : null}
          </p>
          <p ref={questionRef} tabIndex={-1} className="type-body text-text-sub outline-none">
            {controller.savedAccountName
              ? formatMessage(
                  {
                    id: "app.admin.login.newAccount.infoSaved",
                    defaultMessage:
                      "No account is named {name}. This device has the account {saved}. Create a new account?",
                  },
                  { name, saved: controller.savedAccountName }
                )
              : formatMessage(
                  {
                    id: "app.admin.login.newAccount.info",
                    defaultMessage:
                      "No account is named {name}. Another account is saved on this device. Create a new account?",
                  },
                  { name }
                )}
          </p>
        </>
      }
    />
  );
}

function AdminPasskeySignIn({
  controller,
  onOtherWays,
  signingInWithEmail,
}: {
  controller: AdminLoginController;
  onOtherWays: () => void;
  signingInWithEmail?: boolean;
}) {
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
  // A remembered passkey signs in at once, so another account needs its own way to the name
  // step. Without the passkey server that step can only create, so it says so.
  const showOtherAccount = !isForm && remembered;
  // Back unmounts the field and, with no remembered passkey, the navigation slot too, so focus
  // returns to the entry's first action instead of falling to the page.
  const entryActionRef = useRef<HTMLButtonElement>(null);
  const previousMode = useRef(controller.mode);
  useEffect(() => {
    if (previousMode.current === "username" && controller.mode === "entry") {
      entryActionRef.current?.focus();
    }
    previousMode.current = controller.mode;
  }, [controller.mode]);

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
            ref={entryActionRef}
            className="w-full"
            type="button"
            size="lg"
            leadingIcon={<RiKey2Line className="h-[18px] w-[18px]" aria-hidden="true" />}
            loading={controller.isPasskeySigningIn && remembered}
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
        ) : controller.codeSignIn.enabled && !controller.walletReleaseStalled ? (
          // With email sign-in on, the wallet moves one screen in, beside email.
          <Button
            className="w-full"
            type="button"
            size="lg"
            emphasis="secondary"
            disabled={controller.isSigningIn}
            onClick={onOtherWays}
          >
            {formatMessage({
              id: "app.login.button.otherWays",
              defaultMessage: "Other Ways to Sign In",
            })}
          </Button>
        ) : (
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
        )
      }
      feedback={
        <>
          <p id={feedbackId} role="alert" className="type-body text-error-dark">
            {showError ? controller.error : null}
          </p>
          {signingInWithEmail || (controller.isPasskeySigningIn && (isForm || remembered)) ? (
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
            {isForm
              ? formatMessage({ id: "app.login.button.back", defaultMessage: "Back" })
              : controller.canSignInByName
                ? formatMessage({
                    id: "app.login.button.useDifferentUsername",
                    defaultMessage: "Use Different Username",
                  })
                : createLabel}
          </Button>
        ) : null
      }
    />
  );
}

export function AdminSignInContainer() {
  const intl = useIntl();
  const auth = useAuthState();
  const { openProviders } = useWalletModal();
  const [result, setResult] = useState<WalletModalResult | null>(null);
  const [initialRequest] = useState(() => ({
    passkey: isPasskeyRequestedAtBoot(),
    alternatives: isOtherWaysRequestedAtBoot(),
  }));
  const initialMode: AdminLoginMode = initialRequest.passkey
    ? "username"
    : initialRequest.alternatives && !openProviders
      ? "otherWays"
      : "entry";
  useEffect(() => {
    clearPasskeyRequestAtBoot();
    if (initialRequest.alternatives && !initialRequest.passkey) openProviders?.(setResult);
  }, [initialRequest, openProviders]);
  const controller = useAdminLoginController({ initialMode });
  const sheetError =
    result === "wallet-error"
      ? intl.formatMessage({
          id: "app.login.error.walletConnectFailed",
          defaultMessage: "We couldn't connect your wallet. Try again, or sign in with a passkey.",
        })
      : result === "email-error" || (result === "email" && auth.openfortMethod && auth.error)
        ? intl.formatMessage({
            id: "app.login.code.error.setup",
            defaultMessage: "We couldn't open your account just now. Try again in a minute.",
          })
        : null;

  return (
    <AdminSignIn
      controller={{ ...controller, error: controller.error ?? sheetError }}
      signingInWithEmail={result === "email" && auth.isAuthenticating}
      onOtherWays={() => {
        setResult(null);
        controller.beginWalletSignIn();
        if (openProviders) openProviders(setResult);
        else controller.changeMode("otherWays");
      }}
    />
  );
}
