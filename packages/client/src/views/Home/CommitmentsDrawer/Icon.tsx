import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiHandHeartLine } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";

import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

export interface CommitmentsDrawerIconProps {
  onClick: () => void;
  /**
   * How many things need an act from this member right now. It is the sum of
   * the sheet's own tab counts, so the header and the tabs are derived from one
   * number and cannot disagree. Never an inventory count.
   */
  actCount?: number;
  className?: string;
}

export const CommitmentsDrawerIcon: React.FC<CommitmentsDrawerIconProps> = ({
  onClick,
  actCount = 0,
  className,
}) => {
  const intl = useIntl();
  const hasActs = actCount > 0;

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
      aria-label={
        hasActs
          ? intl.formatMessage({ id: "app.commitments.openButtonWaiting" }, { count: actCount })
          : intl.formatMessage({ id: "app.commitments.openButton" })
      }
      data-testid="commitments-drawer-button"
    >
      <RiHandHeartLine className="h-4 w-4" />
      {hasActs && (
        <div className="absolute -top-1.5 -right-1.5">
          <div
            className={cn(
              "inline-flex items-center justify-center text-xs font-semibold rounded-full min-w-[18px] h-[18px] px-1",
              pwaStatusStyles.primary.badge,
              "shadow-sm border-2 border-bg-white-0"
            )}
            data-testid="commitments-notification-badge"
          >
            {actCount > 99 ? "99+" : actCount}
          </div>
        </div>
      )}
    </button>
  );
};
