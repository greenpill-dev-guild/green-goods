import { CountBadge } from "@green-goods/shared/components/Badge/Badge";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { RiNotificationLine } from "@remixicon/react";
import { useIntl } from "react-intl";

export interface NotificationsIconProps {
  onClick?: () => void;
  /** How many of the garden's events this device has not shown yet. Never a standing count. */
  newCount?: number;
  /** With no garden to list events for, the bell keeps its place and does nothing. */
  disabled?: boolean;
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
  className,
}: NotificationsIconProps) {
  const { formatMessage } = useIntl();
  const hasNew = newCount > 0;

  return (
    <IconButton
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
