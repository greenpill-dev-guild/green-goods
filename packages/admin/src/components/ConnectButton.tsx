import { useAuthActions } from "@green-goods/shared";
import { RiWallet3Line } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { useAccount } from "wagmi";
import { AdminButton, type AdminButtonProps } from "./AdminButton";

interface ConnectButtonProps {
  className?: string;
  children?: ReactNode;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
}

export function ConnectButton({
  className,
  children,
  variant = "primary",
  size = "md",
}: ConnectButtonProps) {
  const { formatMessage } = useIntl();
  const { isConnecting } = useAccount();
  const { loginWithWallet } = useAuthActions();

  const adminVariant: AdminButtonProps["variant"] = variant === "secondary" ? "outlined" : "filled";

  return (
    <AdminButton
      type="button"
      onClick={() => loginWithWallet()}
      loading={isConnecting}
      leadingIcon={children || isConnecting ? undefined : <RiWallet3Line />}
      variant={adminVariant}
      size={size}
      data-testid="connect-wallet-button"
      className={className}
    >
      {isConnecting
        ? formatMessage({
            id: "admin.connectButton.connecting",
            defaultMessage: "Connecting...",
          })
        : children ||
          formatMessage({
            id: "admin.connectButton.connect",
            defaultMessage: "Connect Wallet",
          })}
    </AdminButton>
  );
}
