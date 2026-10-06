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

/** Command surface: existing-account passkey sign-in beside the wallet entry point. */
export function AdminSignIn({ controller }: { controller: AdminLoginController }) {
  const { formatMessage } = useIntl();
  const errorId = useId();
  const hasPasskeyEntry = controller.hasStoredCredential || controller.canSignInByName;
  return (
    <div className="flex w-full max-w-sm flex-col gap-4" data-component="AdminSignIn">
      {controller.hasStoredCredential ? (
        <AdminButton
          type="button"
          size="lg"
          leadingIcon={<RiKey2Line />}
          disabled={controller.isSigningIn}
          onClick={() => void controller.signInWithStoredPasskey()}
          data-testid="admin-stored-passkey"
        >
          {controller.storedUsername
            ? formatMessage(
                { id: "app.login.button.continueAs", defaultMessage: "Continue as {name}" },
                { name: controller.storedUsername }
              )
            : formatMessage({
                id: "app.admin.auth.storedPasskey",
                defaultMessage: "Use This Device’s Passkey",
              })}
        </AdminButton>
      ) : null}
      {controller.canSignInByName ? (
        <form
          className="flex flex-col gap-3 text-left"
          onSubmit={(event) => {
            event.preventDefault();
            void controller.signInByName();
          }}
        >
          <AdminTextField
            label={formatMessage({
              id: "app.admin.auth.passkeyName",
              defaultMessage: "Passkey account name",
            })}
            helperText={formatMessage({
              id: "app.admin.auth.passkeyNameHint",
              defaultMessage: "Use the name you chose when you created your passkey account.",
            })}
            value={controller.username}
            onChange={(event) => controller.setUsername(event.target.value)}
            disabled={controller.isSigningIn}
            inputProps={{
              autoComplete: "username",
              "aria-describedby": controller.error ? errorId : undefined,
            }}
          />
          <AdminButton
            type="submit"
            size="lg"
            variant={controller.hasStoredCredential ? "outlined" : "filled"}
            leadingIcon={<RiKey2Line />}
            loading={controller.isSigningIn}
            disabled={controller.isSigningIn || !controller.username.trim()}
          >
            {formatMessage({
              id: "app.login.button.loginPasskey",
              defaultMessage: "Sign in with Passkey",
            })}
          </AdminButton>
        </form>
      ) : null}
      {controller.error ? (
        <p id={errorId} role="alert" className="body-sm text-error-base">
          {controller.error}
        </p>
      ) : null}
      {controller.isSigningIn ? (
        <p role="status" className="body-sm text-text-sub">
          {formatMessage({
            id: "app.login.loading.authenticating",
            defaultMessage: "Signing you in...",
          })}
        </p>
      ) : null}
      <ConnectButton
        size="lg"
        variant={hasPasskeyEntry ? "secondary" : "primary"}
        disabled={controller.isSigningIn}
      />
    </div>
  );
}

export function AdminSignInContainer() {
  const controller = useAdminLoginController();
  return <AdminSignIn controller={controller} />;
}
