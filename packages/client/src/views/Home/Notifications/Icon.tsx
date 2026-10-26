import { CountBadge } from "@green-goods/shared/components/Badge/Badge";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { RiNotificationLine } from "@remixicon/react";
import { useLayoutEffect, useRef } from "react";
import { useIntl } from "react-intl";

export interface NotificationsIconProps {
  onClick?: () => void;
  /** How many of the garden's events this device has not shown yet. Never a standing count. */
  newCount?: number;
  /**
   * With no garden to list events for, or without its launcher's code, the bell keeps its place
   * and does nothing.
   */
  disabled?: boolean;
  /**
   * Take focus as it mounts: the bell replaced the one that was tapped, and its sheet is opening
   * beside it.
   */
  focusOnMount?: boolean;
  className?: string;
}

/**
 * Home's bell (DL-130): the last launcher at the far right of the header cluster, a compact
 * outlined icon button like the ones before it (DL-023, DL-026). Its badge is the shared count
 * badge (DL-099) and counts only what is new; its name says the same for a screen reader.
 */
export function NotificationsIcon({
  onClick,
  newCount = 0,
  disabled = false,
  focusOnMount = false,
  className,
}: NotificationsIconProps) {
  const { formatMessage } = useIntl();
  const hasNew = newCount > 0;
  const buttonRef = useRef<HTMLButtonElement>(null);

  // A layout effect, and the bell renders before its sheet, so it holds focus by the time the
  // sheet's own layout effect records who opened it, and closing the sheet comes back here.
  useLayoutEffect(() => {
    if (focusOnMount) buttonRef.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  return (
    <IconButton
      ref={buttonRef}
      emphasis="secondary"
      size="compact"
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={
        hasNew
          ? formatMessage({ id: "app.home.notifications.openButtonNew" }, { count: newCount })
          : formatMessage({ id: "app.home.notifications.title" })
      }
      data-testid="notifications-button"
      icon={<RiNotificationLine aria-hidden="true" />}
      badge={
        hasNew ? <CountBadge count={newCount} ring data-testid="notifications-badge" /> : undefined
      }
    />
  );
}
