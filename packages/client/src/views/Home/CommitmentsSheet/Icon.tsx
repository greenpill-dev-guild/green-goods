import { CountBadge } from "@green-goods/shared/components/Badge/Badge";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { useAsyncEffect } from "@green-goods/shared/hooks/utils/useAsyncEffect";
import { logger } from "@green-goods/shared/modules/app/logger";
import { RiHandHeartLine } from "@remixicon/react";
import React, { useState } from "react";
import { useIntl } from "react-intl";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";
import { preloadCommitmentsSheet } from "../DeferredSurfaces";

export interface CommitmentsSheetIconProps {
  onClick: () => void;
  /**
   * How many things need an act from this member right now. It is the sum of
   * the sheet's own tab counts, so the header and the tabs are derived from one
   * number and cannot disagree. Never an inventory count.
   */
  actCount?: number;
  className?: string;
}

/**
 * The Promises launcher, its glyph green at rest (DL-133). It fetches the sheet's code as it
 * mounts and waits for it, disabled and busy, so its first tap opens a sheet with something to
 * show (DL-132). A fetch that fails is logged and frees it: the sheet's own lazy import reports
 * the failure through the route's error frame on open.
 */
export const CommitmentsSheetIcon: React.FC<CommitmentsSheetIconProps> = ({
  onClick,
  actCount = 0,
  className,
}) => {
  const intl = useIntl();
  const hasActs = actCount > 0;
  const [isReady, setIsReady] = useState(false);

  useAsyncEffect(async ({ isMounted }) => {
    await preloadCommitmentsSheet().catch((error: unknown) =>
      logger.warn("Could not preload the promises sheet", { source: "CommitmentsSheetIcon", error })
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
      aria-label={
        hasActs
          ? intl.formatMessage({ id: "app.commitments.openButtonWaiting" }, { count: actCount })
          : intl.formatMessage({ id: "app.commitments.openButton" })
      }
      data-testid="commitments-sheet-button"
      icon={<RiHandHeartLine className={pwaStatusStyles.primary.icon} aria-hidden="true" />}
      badge={
        hasActs ? (
          <CountBadge count={actCount} ring data-testid="commitments-notification-badge" />
        ) : undefined
      }
    />
  );
};
