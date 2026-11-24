import { IconButton } from "@green-goods/shared/components/IconButton";
import { useAsyncEffect } from "@green-goods/shared/hooks/utils/useAsyncEffect";
import { logger } from "@green-goods/shared/modules/app/logger";
import { RiWallet3Line } from "@remixicon/react";
import React, { useState } from "react";
import { useIntl } from "react-intl";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";
import { preloadWalletSheet } from "../DeferredSurfaces";

interface WalletSheetIconProps {
  onClick: () => void;
  className?: string;
}

/**
 * Header launcher for the wallet sheet: a compact outlined icon button (DL-023, DL-026) whose
 * glyph is green at rest, like the garden banner's buttons (DL-133). It fetches the sheet's code
 * as it mounts and waits for it, disabled and busy, so its first tap opens a sheet with something
 * to show (DL-132). A fetch that fails is logged and frees it: the sheet's own lazy import
 * reports the failure through the route's error frame when the launcher opens it.
 */
export const WalletSheetIcon: React.FC<WalletSheetIconProps> = ({ onClick, className }) => {
  const intl = useIntl();
  const label = intl.formatMessage({ id: "app.wallet.title" });
  const [isReady, setIsReady] = useState(false);

  useAsyncEffect(async ({ isMounted }) => {
    await preloadWalletSheet().catch((error: unknown) =>
      logger.warn("Could not preload the wallet sheet", { source: "WalletSheetIcon", error })
    );
    if (isMounted()) setIsReady(true);
  }, []);

  return (
    <IconButton
      emphasis="secondary"
      size="compact"
      onClick={onClick}
      disabled={!isReady}
      aria-busy={!isReady}
      className={className}
      aria-label={label}
      icon={<RiWallet3Line className={pwaStatusStyles.primary.icon} aria-hidden="true" />}
    />
  );
};
