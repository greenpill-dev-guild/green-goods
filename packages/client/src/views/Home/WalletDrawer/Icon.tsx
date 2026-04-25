import { cn, useAccessibleCookieJars } from "@green-goods/shared";
import { RiWallet3Line } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";

interface WalletDrawerIconProps {
  onClick: () => void;
  className?: string;
}

export const WalletDrawerIcon: React.FC<WalletDrawerIconProps> = ({ onClick, className }) => {
  const intl = useIntl();
  const { jars } = useAccessibleCookieJars();
  const accessibleJarCount = jars.length;
  const label =
    accessibleJarCount > 0
      ? intl.formatMessage(
          {
            id: "app.cookieJar.walletWithCount",
            defaultMessage:
              "Wallet, {count, plural, one {# accessible cookie jar} other {# accessible cookie jars}}",
          },
          { count: accessibleJarCount }
        )
      : intl.formatMessage({
          id: "app.cookieJar.wallet",
          defaultMessage: "Wallet",
        });

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
      aria-label={label}
    >
      <RiWallet3Line className="h-4 w-4" />
      {accessibleJarCount > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-primary px-1 text-[10px] font-semibold leading-none text-primary-accent-foreground"
          data-testid="wallet-badge"
          aria-hidden="true"
        >
          {accessibleJarCount > 9 ? "9+" : accessibleJarCount}
        </span>
      )}
    </button>
  );
};
