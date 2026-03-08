import { cn, type Garden, useOffline, type Work } from "@green-goods/shared";
import {
  RiArrowLeftFill,
  RiBankLine,
  RiGovernmentLine,
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
  showEndowmentButton?: boolean;
  hasEndowmentDeposits?: boolean;
  onEndowmentClick?: () => void;
  showGovernanceButton?: boolean;
  onGovernanceClick?: () => void;
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
      className="fixed inset-0 z-[1100] m-0 border-0 bg-transparent p-0"
    >
      <div className="pointer-events-none flex min-h-full items-start justify-center px-3 pb-4 pt-[calc(env(safe-area-inset-top)+4.75rem)] sm:justify-end sm:px-4 md:px-6">
        <div className="pointer-events-auto">
          <GardenNotifications garden={garden} notifications={works} />
        </div>
      </div>
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
  button: cn(iconButtonVariants({ size: "md" }), "tap-feedback", BUTTON_VARIANTS[variant].button),
  icon: cn(iconButtonIconVariants({ size: "md" }), BUTTON_VARIANTS[variant].icon),
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

const EndowmentButton: React.FC<{
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

const GovernanceButton: React.FC<{
  onClick: () => void;
  ariaLabel: string;
}> = ({ onClick, ariaLabel }) => {
  const styles = createButtonStyles("work");

  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.button}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <RiGovernmentLine className={styles.icon} />
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
  showEndowmentButton = false,
  hasEndowmentDeposits = false,
  onEndowmentClick,
  showGovernanceButton = false,
  onGovernanceClick,
  ...props
}: TopNavProps) => {
  const { formatMessage } = useIntl();
  const { syncStatus, isOnline } = useOffline();
  const hasOfflineIssues = !navigator.onLine;

  // Get appropriate button styling variant
  const buttonVariant = getButtonVariant(syncStatus, isOnline);
  const backButtonStyles = createButtonStyles(buttonVariant);

  const containerClasses = cn(
    "relative z-[1000] grid w-full grid-cols-[minmax(2.75rem,auto)_minmax(0,1fr)_minmax(2.75rem,auto)] items-center gap-2 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:gap-4 sm:px-4 md:px-6",
    overlay && "fixed inset-x-0 bg-bg-white-0/95 backdrop-blur-sm",
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
        <div className="flex items-center justify-start">
          <button
            type="button"
            aria-label={formatMessage({ id: "app.wizard.back", defaultMessage: "Back" })}
            onClick={(e) => {
              onBackClick?.(e);
              e.currentTarget.blur();
            }}
            className={cn(backButtonStyles.button, "z-1")}
          >
            <RiArrowLeftFill className={backButtonStyles.icon} />
          </button>
        </div>
      )}
      {!onBackClick && <div aria-hidden="true" className="min-h-11 min-w-11" />}

      <div className="flex min-w-0 items-center justify-center">
        <div className="flex min-w-0 flex-row items-center justify-center gap-3">{children}</div>
      </div>

      <div className="flex grow" />
      {garden && showGovernanceButton && onGovernanceClick && (
        <GovernanceButton
          onClick={onGovernanceClick}
          ariaLabel={formatMessage({ id: "app.signal.governance" })}
        />
      )}
      {garden && showEndowmentButton && onEndowmentClick && (
        <EndowmentButton
          hasDeposits={hasEndowmentDeposits}
          onClick={onEndowmentClick}
          ariaLabel={formatMessage({ id: "app.treasury.open" })}
        />
      )}
      {/* Only show notifications for operators - they need to review pending work */}
      {garden && isOperator && <NotificationCenter {...props} garden={garden} />}
    </div>
  );
};
