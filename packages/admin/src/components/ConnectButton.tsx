import { cn } from "@green-goods/shared";
import { RiLoader4Line, RiWallet3Line } from "@remixicon/react";
import { useAppKit } from "@reown/appkit/react";
import { useIntl } from "react-intl";
import { useAccount } from "wagmi";

interface ConnectButtonProps {
  className?: string;
  children?: React.ReactNode;
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
  const { open } = useAppKit();

  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantStyles = {
    primary:
      "border border-transparent text-primary-foreground bg-primary-base hover:bg-primary-darker shadow-sm hover:shadow-md focus:ring-primary-base",
    secondary:
      "border border-stroke-sub text-text-sub bg-bg-white hover:bg-bg-weak focus:ring-primary-base",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      onClick={() => open()}
      disabled={isConnecting}
      aria-busy={isConnecting}
      data-testid="connect-wallet-button"
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
    >
      <div className="flex items-center">
        {isConnecting ? (
          <>
            <RiLoader4Line className="animate-spin -ml-1 mr-2 h-4 w-4" aria-hidden="true" />
            {formatMessage({ id: "admin.connectButton.connecting", defaultMessage: "Connecting..." })}
          </>
        ) : (
          <>
            {children || (
              <>
                <RiWallet3Line className="mr-2 h-4 w-4" aria-hidden="true" />
                {formatMessage({ id: "admin.connectButton.connect", defaultMessage: "Connect Wallet" })}
              </>
            )}
          </>
        )}
      </div>
    </button>
  );
}
