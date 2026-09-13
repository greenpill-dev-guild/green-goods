import { IconButton } from "@green-goods/shared/components/IconButton";
import { RiWallet3Line } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";

interface WalletSheetIconProps {
  onClick: () => void;
  className?: string;
}

/** Header launcher for the wallet sheet: a compact outlined icon button (DL-021, DL-023). */
export const WalletSheetIcon: React.FC<WalletSheetIconProps> = ({ onClick, className }) => {
  const intl = useIntl();
  const label = intl.formatMessage({ id: "app.wallet.title" });

  return (
    <IconButton
      emphasis="secondary"
      size="compact"
      onClick={onClick}
      className={className}
      aria-label={label}
      icon={<RiWallet3Line aria-hidden="true" />}
    />
  );
};
