import { cn } from "@green-goods/shared";
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
  const label = intl.formatMessage({ id: "app.wallet.title" });

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
    </button>
  );
};
