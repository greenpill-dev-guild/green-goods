import { CountBadge } from "@green-goods/shared/components/Badge/Badge";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useAsyncEffect } from "@green-goods/shared/hooks/utils/useAsyncEffect";
import { RiHandHeartLine } from "@remixicon/react";
import React, { useState } from "react";
import { useIntl } from "react-intl";
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
 * The Promises launcher. It fetches the sheet's code as it mounts and waits for it, disabled and
 * busy, so its first tap opens a sheet with something to show (DL-132).
 */
export const CommitmentsSheetIcon: React.FC<CommitmentsSheetIconProps> = ({
  onClick,
  actCount = 0,
  className,
}) => {
  const intl = useIntl();
  const hasActs = actCount > 0;
  const isOnline = useOnlineStatus();
  const [isReady, setIsReady] = useState(false);

  useAsyncEffect(
    async ({ isMounted }) => {
      try {
        await preloadCommitmentsSheet();
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
      aria-label={
        hasActs
          ? intl.formatMessage({ id: "app.commitments.openButtonWaiting" }, { count: actCount })
          : intl.formatMessage({ id: "app.commitments.openButton" })
      }
      data-testid="commitments-sheet-button"
      icon={<RiHandHeartLine aria-hidden="true" />}
      badge={
        hasActs ? (
          <CountBadge count={actCount} ring data-testid="commitments-notification-badge" />
        ) : undefined
      }
    />
  );
};
