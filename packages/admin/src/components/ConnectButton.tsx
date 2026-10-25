import { Button, type ButtonSize } from "@green-goods/shared/components/Button";
import { useAuthActions, useAuthState } from "@green-goods/shared/providers/Auth";
import { RiWallet3Line } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { useAccount } from "wagmi";

interface ConnectButtonProps {
  className?: string;
  children?: ReactNode;
  variant?: "primary" | "secondary";
  /** The shared size, which the cockpit sets at 28 (compact), 32 (sm) and 40px (lg). */
  size?: ButtonSize;
  disabled?: boolean;
}

export function ConnectButton({
  className,
  children,
  variant = "primary",
  size = "sm",
  disabled = false,
}: ConnectButtonProps) {
  const { formatMessage } = useIntl();
  const { isConnecting } = useAccount();
  const { loginWithWallet } = useAuthActions();
  const { walletReleaseStalled } = useAuthState();

  return (
    <Button
      type="button"
      onClick={() => loginWithWallet()}
      loading={isConnecting && !walletReleaseStalled}
      disabled={disabled}
      leadingIcon={
        children || isConnecting ? undefined : (
          <RiWallet3Line
            className={size === "compact" ? "h-4 w-4" : "h-[18px] w-[18px]"}
            aria-hidden="true"
          />
        )
      }
      emphasis={variant}
      size={size}
      data-testid="connect-wallet-button"
      className={className}
    >
      {walletReleaseStalled
        ? formatMessage({
            id: "app.login.walletReload",
            defaultMessage: "Reload to retry wallet",
          })
        : children ||
          formatMessage({
            id: "admin.connectButton.connect",
            defaultMessage: "Connect Wallet",
          })}
    </Button>
  );
}
