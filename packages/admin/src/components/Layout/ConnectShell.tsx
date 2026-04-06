import { RiSeedlingLine } from "@remixicon/react";
import { useIntl } from "react-intl";

export function ConnectShell() {
  const { formatMessage } = useIntl();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-weak px-6 text-center">
      <RiSeedlingLine className="h-12 w-12 text-primary-base" />
      <h1 className="mt-4 text-lg font-semibold text-text-strong">
        {formatMessage({
          id: "cockpit.auth.connectWalletTitle",
          defaultMessage: "Connect your wallet to continue",
        })}
      </h1>
      <p className="mt-2 mb-6 text-sm text-text-sub">
        {formatMessage({
          id: "cockpit.auth.connectWalletDescription",
          defaultMessage: "Sign in to access the admin cockpit",
        })}
      </p>
      <appkit-button />
    </div>
  );
}
