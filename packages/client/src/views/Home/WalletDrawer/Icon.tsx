import { cn, useAccessibleCookieJars } from "@green-goods/shared";
import { RiWallet3Line } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";

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
              "Garden funds, {count, plural, one {# cookie jar available} other {# cookie jars available}}",
          },
          { count: accessibleJarCount }
        )
      : intl.formatMessage({
          id: "app.cookieJar.wallet",
          defaultMessage: "Garden funds",
        });

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative p-1 rounded-lg border transition-[color,border-color,box-shadow,transform] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] tap-feedback",
        "active:scale-95",
        "flex items-center justify-center w-8 h-8 tap-target-lg",
        "focus:outline-none focus:ring-2",
        pwaStatusStyles.primary.focus,
        pwaStatusStyles.neutral.border,
        pwaStatusStyles.neutral.icon,
        className
      )}
      aria-label={label}
    >
      <RiWallet3Line className="h-4 w-4" />
      {accessibleJarCount > 0 && (
        <span
          className={cn(
            "absolute -top-1.5 -right-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full border-2 border-bg-white-0 px-1 text-[10px] font-semibold leading-none",
            pwaStatusStyles.primary.badge
          )}
          data-testid="wallet-badge"
          aria-hidden="true"
        >
          {accessibleJarCount > 9 ? "9+" : accessibleJarCount}
        </span>
      )}
    </button>
  );
};
