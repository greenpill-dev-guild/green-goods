import { Button, type ButtonSize } from "@green-goods/shared/components/Button";
import { useWalletModalOpen } from "@green-goods/shared/hooks/auth/useWalletModalOpen";
import { useAuthActions, useAuthState } from "@green-goods/shared/providers/Auth";
import { RiWallet3Line } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { useAccount } from "wagmi";

interface ConnectButtonProps {
  className?: string;
  children?: ReactNode;
  variant?: "primary" | "secondary";
  /** The shared size, which the Hub sets at 28 (compact), 32 (sm) and 40px (lg). */
  size?: ButtonSize;
  disabled?: boolean;
  /** Runs before the wallet modal opens, so a sign-in screen can clear the last attempt's error. */
  onStart?: () => void;
}

export function ConnectButton({
  className,
  children,
  variant = "primary",
  size = "sm",
  disabled = false,
  onStart,
}: ConnectButtonProps) {
  const { formatMessage } = useIntl();
  const { isConnecting } = useAccount();
  const walletModalOpen = useWalletModalOpen();
  const { loginWithWallet } = useAuthActions();
  const { walletReleaseStalled } = useAuthState();
  // wagmi can keep reporting a connection in progress for about a minute after the steward
  // closes the wallet modal (a phone wallet asked over WalletConnect). A loading button
  // ignores taps, so it spins only while the modal is open, as the App's sign-in does.
  const connecting = isConnecting && walletModalOpen && !walletReleaseStalled;

  return (
    <Button
      type="button"
      onClick={() => {
        onStart?.();
        loginWithWallet();
      }}
      loading={connecting}
      disabled={disabled}
      leadingIcon={
        connecting ? undefined : (
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
