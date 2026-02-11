import { type Garden, type Work, cn, useOffline } from "@green-goods/shared";
import {
  RiArrowLeftFill,
  RiBankLine,
  RiNotificationFill,
  RiNotificationLine,
} from "@remixicon/react";
import { useId } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { GardenNotifications } from "@/views/Home/Garden/Notifications";

type TopNavProps = {
  onBackClick?: (e: React.SyntheticEvent<HTMLButtonElement>) => void;
  garden?: Garden;
  works?: Work[];
  overlay?: boolean;
  /** Whether the current user is an operator of this garden */
  isOperator?: boolean;
  showTreasuryButton?: boolean;
  hasTreasuryDeposits?: boolean;
  onTreasuryClick?: () => void;
} & React.HTMLAttributes<HTMLDivElement>;

type NotificationsProps = {
  garden?: Garden;
  works?: Work[];
  popoverId: string;
};

const Notifications: React.FC<NotificationsProps> = ({ garden, works, popoverId }) => {
  if (!garden || !works) return null;

  return (
    <div
      id={popoverId}
      popover="auto"
      className="fixed inset-0 w-full h-full bg-transparent p-6 m-0 border-0"
      style={{
        inset: "unset",
        margin: "unset",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <GardenNotifications garden={garden} notifications={works} />
    </div>
  );
};

Notifications.displayName = "Notifications";

// Styling configuration for different button states
const BUTTON_VARIANTS = {
  work: {
    focus:
      "focus-visible:ring-emerald-200 focus-visible:border-emerald-600 active:border-emerald-600",
    icon: "focus-visible:text-emerald-700 active:text-emerald-700",
  },
  sync: {
    focus: "focus-visible:ring-blue-200 focus-visible:border-blue-600 active:border-blue-600",
    icon: "focus-visible:text-blue-700 active:text-blue-700",
  },
  offline: {
    focus: "focus-visible:ring-orange-200 focus-visible:border-orange-600 active:border-orange-600",
    icon: "focus-visible:text-orange-700 active:text-orange-700",
  },
} as const;

// Base styling for navigation buttons
const NAV_BUTTON_BASE = [
  "relative flex items-center justify-center w-11 h-11 p-1 rounded-lg border",
  "bg-bg-white-0 border-stroke-soft-200 text-text-sub-600",
  "transition-all duration-200 tap-feedback",
  "active:scale-95",
  "focus-visible:outline-none focus-visible:ring-2",
] as const;

// Create complete button styles for a given variant
const createButtonStyles = (variant: keyof typeof BUTTON_VARIANTS = "work") => ({
  button: cn(NAV_BUTTON_BASE, BUTTON_VARIANTS[variant].focus),
  icon: cn("w-4 h-4", BUTTON_VARIANTS[variant].icon),
  focusStyles: BUTTON_VARIANTS[variant].focus,
});

// Reusable notification badge component
const NotificationBadge: React.FC<{ count: number }> = ({ count }) => (
  <div className="absolute -top-1.5 -right-1.5">
    <div
      className={cn(
        "inline-flex items-center justify-center text-xs font-semibold text-white rounded-full",
        "min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-emerald-500 to-emerald-600",
        "shadow-sm border-2 border-white"
      )}
    >
      {count > 99 ? "99+" : count}
    </div>
  </div>
);

const NotificationCenter: React.FC<TopNavProps> = ({ works, ...props }) => {
  const popoverId = useId();

  const workNotifications = works?.filter((work) => work.status === "pending") || [];
  const hasNotifications = workNotifications.length > 0;
  const NotificationIcon = hasNotifications ? RiNotificationFill : RiNotificationLine;

  if (works === undefined) return null;

  const styles = createButtonStyles("work");

  return (
    <>
      <button
        type="button"
        popoverTarget={popoverId}
        className={cn(styles.button, "dropdown dropdown-bottom dropdown-end tap-target-lg")}
        aria-label="View notifications"
      >
        {hasNotifications && <NotificationBadge count={workNotifications.length} />}
        <NotificationIcon className={styles.icon} />
      </button>
      <Notifications {...props} works={works} popoverId={popoverId} />
    </>
  );
};

const TreasuryButton: React.FC<{
  hasDeposits: boolean;
  onClick: () => void;
  ariaLabel: string;
}> = ({ hasDeposits, onClick, ariaLabel }) => {
  const styles = createButtonStyles("work");

  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.button}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {hasDeposits && (
        <span className="absolute -top-1 -right-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 border border-white" />
      )}
      <RiBankLine className={styles.icon} />
    </button>
  );
};

// Determine button variant based on app state
const getButtonVariant = (syncStatus: string, isOnline: boolean): "work" | "sync" | "offline" => {
  if (syncStatus === "syncing") return "sync";
  if (!isOnline) return "offline";
  return "work";
};

export const TopNav: React.FC<TopNavProps> = ({
  children,
  onBackClick,
  garden,
  overlay,
  isOperator = false,
  showTreasuryButton = false,
  hasTreasuryDeposits = false,
  onTreasuryClick,
  ...props
}: TopNavProps) => {
  const { formatMessage } = useIntl();
  const { syncStatus, isOnline } = useOffline();
  const hasOfflineIssues = !navigator.onLine;

  // Get appropriate button styling variant
  const buttonVariant = getButtonVariant(syncStatus, isOnline);
  const backButtonStyles = createButtonStyles(buttonVariant);

  const containerClasses = cn(
    "relative flex z-[1000] flex-row w-full justify-evenly items-center gap-4 p-6 h-20 top-2",
    overlay && "fixed bg-bg-white-0",
    overlay && hasOfflineIssues && "top-2", // Space for offline indicator
    overlay && !hasOfflineIssues && "top-0"
  );

  const backButtonClasses = cn(
    "p-0 px-2 z-1 transition-all duration-200 tap-target-lg tap-feedback",
    "focus-visible:outline-none focus-visible:ring-2 active:scale-95",
    backButtonStyles.focusStyles
  );

  return (
    <div className={containerClasses} {...props}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary-base focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
      {onBackClick && (
        <Button
          variant="neutral"
          mode="stroke"
          type="button"
          shape="regular"
          size="xsmall"
          label=""
          leadingIcon={<RiArrowLeftFill className={backButtonStyles.icon} />}
          onClick={(e) => {
            onBackClick?.(e);
            e.currentTarget.blur();
          }}
          className={backButtonClasses}
        />
      )}

      <div className="absolute left-0 top-0 w-full h-full flex flex-row justify-between items-center py-6">
        <div className="flex flex-row gap-4 justify-center grow">{children}</div>
      </div>

      <div className="flex grow" />
      {garden && showTreasuryButton && onTreasuryClick && (
        <TreasuryButton
          hasDeposits={hasTreasuryDeposits}
          onClick={onTreasuryClick}
          ariaLabel={formatMessage({ id: "app.treasury.open" })}
        />
      )}
      {/* Only show notifications for operators - they need to review pending work */}
      {garden && isOperator && <NotificationCenter {...props} garden={garden} />}
    </div>
  );
};
