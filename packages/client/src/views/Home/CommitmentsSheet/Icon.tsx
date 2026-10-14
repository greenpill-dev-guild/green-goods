import { IconButton } from "@green-goods/shared/components/IconButton";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiHandHeartLine } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";

import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

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

export const CommitmentsSheetIcon: React.FC<CommitmentsSheetIconProps> = ({
  onClick,
  actCount = 0,
  className,
}) => {
  const intl = useIntl();
  const hasActs = actCount > 0;

  return (
    <IconButton
      emphasis="secondary"
      size="compact"
      onClick={onClick}
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
          <span
            className={cn(
              "inline-flex items-center justify-center text-xs font-semibold rounded-full min-w-[18px] h-[18px] px-1",
              pwaStatusStyles.primary.badge,
              "shadow-sm border-2 border-bg-white-0"
            )}
            data-testid="commitments-notification-badge"
          >
            {actCount > 99 ? "99+" : actCount}
          </span>
        ) : undefined
      }
    />
  );
};
