import {
  type AdminLoginController,
  useAdminLoginController,
} from "@green-goods/shared/hooks/admin-ui/auth/useAdminLoginController";
import { RiKey2Line } from "@remixicon/react";
import { useId } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "./AdminButton";
import { AdminTextField } from "./AdminTextField";
import { ConnectButton } from "./ConnectButton";

/** Command surface: the PWA's entry → form flow, using the admin control palette. */
export function AdminSignIn({ controller }: { controller: AdminLoginController }) {
  const { formatMessage } = useIntl();
  const feedbackId = useId();
  const hintId = feedbackId + "-hint";
  const isForm = controller.mode !== "entry";
  const isCreating = controller.mode === "create";
  const showError = Boolean(controller.error) && !controller.isSigningIn;
  const showHint = isForm && !showError && !controller.isSigningIn;
  const createLabel = formatMessage({
    id: "app.login.button.createAccount",
    defaultMessage: "Create Account",
  });
  const storedLabel = controller.storedUsername
    ? formatMessage(
        { id: "app.login.button.continueAs", defaultMessage: "Continue as {name}" },
        { name: controller.storedUsername }
      )
    : formatMessage({
        id: "app.admin.auth.storedPasskey",
        defaultMessage: "Use This Device’s Passkey",
      });

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-2"
      data-component="AdminSignIn"
      onSubmit={(event) => {
        event.preventDefault();
        if (isForm) {
          void (isCreating ? controller.createAccountByName() : controller.signInByName());
        }
      }}
    >
      {/* AdminTextField includes its reserved supporting line; this slot accommodates it
          on desktop and touch widths. Both slots and feedback stay mounted in every state. */}
      <div className="flex h-16 w-full items-center" data-testid="admin-auth-slot-one">
        {isForm ? (
          <AdminTextField
            className="w-full text-left"
            label={formatMessage(
              isCreating
                ? {
                    id: "app.login.username.newAccountLabel",
                    defaultMessage: "Display name for new account",
                  }
                : { id: "app.admin.auth.passkeyName", defaultMessage: "Passkey account name" }
            )}
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
          <AdminButton
            className="w-full"
            type="button"
            size="lg"
            leadingIcon={<RiKey2Line />}
            disabled={controller.isSigningIn}
            title={createLabel}
            onClick={() => controller.changeMode("create")}
          >
            <span className="min-w-0 truncate">{createLabel}</span>
          </AdminButton>
        )}
      </div>
      <div className="flex h-11 w-full items-center" data-testid="admin-auth-slot-two">
        {isForm ? (
          <AdminButton
            className="w-full"
            type="submit"
            size="lg"
            leadingIcon={<RiKey2Line />}
            loading={controller.isSigningIn}
            disabled={controller.isSigningIn || !controller.username.trim()}
          >
            {isCreating
              ? createLabel
              : formatMessage({
                  id: "app.login.button.loginPasskey",
                  defaultMessage: "Sign in with Passkey",
                })}
          </AdminButton>
        ) : (
          <ConnectButton
            className="w-full"
            size="lg"
            variant="secondary"
            disabled={controller.isSigningIn}
          />
        )}
      </div>
      <div className="h-20 overflow-y-auto" data-testid="admin-sign-in-feedback">
        {controller.mode === "signin" && controller.hasStoredCredential ? (
          <div className="flex h-11 shrink-0 items-center">
            <AdminButton
              className="w-full"
              type="button"
              variant="text"
              size="lg"
              disabled={controller.isSigningIn}
              title={storedLabel}
              onClick={() => void controller.signInWithStoredPasskey()}
            >
              <span className="min-w-0 truncate">{storedLabel}</span>
            </AdminButton>
          </div>
        ) : null}
        <div>
          <p id={feedbackId} role="alert" className="body-sm text-error-dark">
            {showError ? controller.error : null}
          </p>
          {controller.isSigningIn ? (
            <p role="status" className="body-sm text-text-sub">
              {formatMessage(
                isCreating
                  ? {
                      id: "app.login.loading.creatingWallet",
                      defaultMessage: "Setting up your account...",
                    }
                  : { id: "app.login.loading.authenticating", defaultMessage: "Signing you in..." }
              )}
            </p>
          ) : showHint ? (
            <p id={hintId} className="body-sm text-text-sub">
              {formatMessage(
                isCreating && !controller.canSignInByName
                  ? {
                      id: "app.login.passkey.localExplainer",
                      defaultMessage:
                        "Keeps same-device sign-in. May need re-enrollment if browser storage is cleared.",
                    }
                  : isCreating
                    ? {
                        id: "app.login.username.hint",
                        defaultMessage:
                          "Keep this name somewhere safe. You'll use it to sign in on another device.",
                      }
                    : {
                        id: "app.admin.auth.passkeyNameHint",
                        defaultMessage:
                          "Use the name you chose when you created your passkey account.",
                      }
              )}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex h-11 items-center justify-center" data-testid="admin-auth-navigation">
        <AdminButton
          type="button"
          variant="text"
          size="lg"
          disabled={controller.isSigningIn}
          onClick={() => controller.changeMode(isForm ? "entry" : "signin")}
        >
          {formatMessage(
            isForm
              ? { id: "app.login.button.back", defaultMessage: "Back" }
              : {
                  id: "app.login.button.haveAccount",
                  defaultMessage: "Already have an account?",
                }
          )}
        </AdminButton>
      </div>
    </form>
  );
}

export function AdminSignInContainer() {
  const controller = useAdminLoginController();
  return <AdminSignIn controller={controller} />;
}
