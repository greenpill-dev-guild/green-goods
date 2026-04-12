import { RiLockLine, RiSeedlingLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { ConnectButton } from "@/components/ConnectButton";

interface ConnectShellProps {
  titleId?: string;
  defaultTitle?: string;
  descriptionId?: string;
  defaultDescription?: string;
  action?: ReactNode;
  icon?: ReactNode;
  testId?: string;
}

export function ConnectShell({
  titleId = "cockpit.auth.connectWalletTitle",
  defaultTitle = "Connect your wallet to continue",
  descriptionId = "cockpit.auth.connectWalletDescription",
  defaultDescription = "Sign in to access the admin canvas",
  action,
  icon,
  testId = "connect-shell",
}: ConnectShellProps = {}) {
  const { formatMessage } = useIntl();

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-bg-weak px-6 text-center"
      data-testid={testId}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-white shadow-[var(--edge-rest),_var(--elevation-2)]">
        {icon ?? <RiSeedlingLine className="h-7 w-7 text-primary-base" />}
      </div>
      <h1 className="mt-5 text-xl font-semibold text-text-strong">
        {formatMessage({
          id: titleId,
          defaultMessage: defaultTitle,
        })}
      </h1>
      <p className="mb-6 mt-2 max-w-sm text-sm text-text-sub">
        {formatMessage({
          id: descriptionId,
          defaultMessage: defaultDescription,
        })}
      </p>
      {action ?? <ConnectButton size="lg" />}
    </div>
  );
}

export function WalletRequiredConnectShell(props: { action: ReactNode }) {
  return (
    <ConnectShell
      titleId="app.admin.auth.walletRequired"
      defaultTitle="Wallet required"
      descriptionId="app.admin.auth.walletRequiredPrompt"
      defaultDescription="The admin panel requires a wallet connection. Email and social logins are not supported here."
      icon={<RiLockLine className="h-7 w-7 text-warning-dark" />}
      action={props.action}
      testId="wallet-required-shell"
    />
  );
}
