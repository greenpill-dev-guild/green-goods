import { IconButton } from "@green-goods/shared/components/IconButton";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useAsyncEffect } from "@green-goods/shared/hooks/utils/useAsyncEffect";
import { RiWallet3Line } from "@remixicon/react";
import React, { useState } from "react";
import { useIntl } from "react-intl";
import { preloadWalletSheet } from "../DeferredSurfaces";

interface WalletSheetIconProps {
  onClick: () => void;
  className?: string;
}

/**
 * Header launcher for the wallet sheet: a compact outlined icon button (DL-023, DL-026). It
 * fetches the sheet's code as it mounts and waits for it, disabled and busy, so its first tap
 * opens a sheet with something to show (DL-132).
 */
export const WalletSheetIcon: React.FC<WalletSheetIconProps> = ({ onClick, className }) => {
  const intl = useIntl();
  const label = intl.formatMessage({ id: "app.wallet.title" });
  const isOnline = useOnlineStatus();
  const [isReady, setIsReady] = useState(false);

  useAsyncEffect(
    async ({ isMounted }) => {
      try {
        await preloadWalletSheet();
      } catch {
        // A reconnect changes isOnline and asks for the chunk again.
        return;
      }
      if (isMounted()) setIsReady(true);
    },
    [isOnline]
  );

  return (
    <IconButton
      emphasis="secondary"
      size="compact"
      onClick={onClick}
      disabled={!isReady}
      aria-busy={!isReady}
      className={className}
      aria-label={label}
      icon={<RiWallet3Line aria-hidden="true" />}
    />
  );
};
