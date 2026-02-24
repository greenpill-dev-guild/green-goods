import { cn, useUserCookieJars } from "@green-goods/shared";
import { RiWallet3Line } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";

interface WalletDrawerIconProps {
  onClick: () => void;
  className?: string;
}

export const WalletDrawerIcon: React.FC<WalletDrawerIconProps> = ({ onClick, className }) => {
  const intl = useIntl();
  const { jars } = useUserCookieJars();

  const hasJarBalance = jars.some((jar) => jar.balance > 0n);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative p-1 rounded-lg border transition-all duration-200 tap-feedback",
        "active:scale-95",
        "flex items-center justify-center w-8 h-8 tap-target-lg",
        "focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-600 active:border-emerald-600",
        "border-stroke-soft-200 text-text-sub-600",
        className
      )}
      aria-label={intl.formatMessage({
        id: "app.cookieJar.wallet",
        defaultMessage: "Wallet",
      })}
    >
      <RiWallet3Line className="h-4 w-4" />
      {hasJarBalance && (
        <span
          className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white"
          aria-hidden="true"
        />
      )}
    </button>
  );
};
