import { cn } from "@green-goods/shared/utils";
import { useAppKit } from "@reown/appkit/react";
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
      data-testid="connect-wallet-button"
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
    >
      <div className="flex items-center">
        {isConnecting ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Connecting...
          </>
        ) : (
          <>
            {children || (
              <>
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Connect Wallet
              </>
            )}
          </>
        )}
      </div>
    </button>
  );
}
