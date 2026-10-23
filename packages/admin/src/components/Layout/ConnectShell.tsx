import { RiLockLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { ConnectButton } from "@/components/ConnectButton";
import { ConnectPrompt } from "./ConnectPrompt";

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
    <ConnectPrompt
      title={formatMessage({
        id: titleId,
        defaultMessage: defaultTitle,
      })}
      description={formatMessage({
        id: descriptionId,
        defaultMessage: defaultDescription,
      })}
      icon={icon}
      testId={testId}
      action={action ?? <ConnectButton size="lg" />}
    />
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
