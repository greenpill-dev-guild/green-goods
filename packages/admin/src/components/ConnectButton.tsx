import { useAuthActions } from "@green-goods/shared/providers/Auth";
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
  disabled?: boolean;
}

export function ConnectButton({
  className,
  children,
  variant = "primary",
  size = "md",
  disabled = false,
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
      disabled={disabled}
      leadingIcon={children || isConnecting ? undefined : <RiWallet3Line />}
      variant={adminVariant}
      size={size}
      data-testid="connect-wallet-button"
      className={className}
    >
      {children ||
        formatMessage({
          id: "admin.connectButton.connect",
          defaultMessage: "Connect Wallet",
        })}
    </AdminButton>
  );
}
