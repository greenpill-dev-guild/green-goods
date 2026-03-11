import { useAuth } from "@green-goods/shared";
import { RiLockLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Outlet } from "react-router-dom";
import { ConnectButton } from "@/components/ConnectButton";

export default function RequireAuth() {
  const { isAuthenticated, eoaAddress, isReady, authMode, signOut } = useAuth();
  const { formatMessage } = useIntl();

  if (!isReady) {
    return (
      <div
        className="flex items-center justify-center py-24"
        role="status"
        aria-label={formatMessage({
          id: "app.admin.auth.checking",
          defaultMessage: "Checking authentication...",
        })}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stroke-sub border-t-primary-base" />
      </div>
    );
  }

  // Admin requires wallet auth — email/social (embedded) users cannot access admin.
  // Show a specific message if they authenticated via embedded wallet.
  if (authMode === "embedded") {
    return (
      <div className="flex items-center justify-center py-24" data-testid="wallet-required-prompt">
        <div className="max-w-sm w-full bg-bg-soft rounded-lg border border-stroke-sub p-8 text-center">
          <div className="mx-auto h-12 w-12 bg-warning-lighter rounded-lg flex items-center justify-center mb-4">
            <RiLockLine className="h-6 w-6 text-warning-dark" />
          </div>
          <h2 className="text-lg font-semibold text-text-strong mb-2">
            {formatMessage({
              id: "app.admin.auth.walletRequired",
              defaultMessage: "Wallet required",
            })}
          </h2>
          <p className="text-sm text-text-sub mb-6">
            {formatMessage({
              id: "app.admin.auth.walletRequiredPrompt",
              defaultMessage:
                "The admin panel requires a wallet connection. Email and social logins are not supported here.",
            })}
          </p>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full rounded-lg bg-primary-base px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
          >
            {formatMessage({
              id: "app.admin.auth.signOutAndReconnect",
              defaultMessage: "Sign out & connect wallet",
            })}
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !eoaAddress) {
    return (
      <div className="flex items-center justify-center py-24" data-testid="connect-prompt">
        <div className="max-w-sm w-full bg-bg-soft rounded-lg border border-stroke-sub p-8 text-center">
          <div className="mx-auto h-12 w-12 bg-warning-lighter rounded-lg flex items-center justify-center mb-4">
            <RiLockLine className="h-6 w-6 text-warning-dark" />
          </div>
          <h2 className="text-lg font-semibold text-text-strong mb-2">
            {formatMessage({
              id: "app.admin.auth.connectRequired",
              defaultMessage: "Connect to continue",
            })}
          </h2>
          <p className="text-sm text-text-sub mb-6">
            {formatMessage({
              id: "app.admin.auth.connectPrompt",
              defaultMessage: "Connect your wallet to access this feature.",
            })}
          </p>
          <ConnectButton className="w-full" />
        </div>
      </div>
    );
  }

  return <Outlet />;
}
