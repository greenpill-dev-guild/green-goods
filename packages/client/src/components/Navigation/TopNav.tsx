import { cn, type Garden, useOffline, type Work } from "@green-goods/shared";
import {
  RiArrowLeftFill,
  RiBankLine,
  RiGovernmentLine,
  RiNotificationFill,
  RiNotificationLine,
} from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { ModalDrawer } from "@/components/Dialogs";
import { pwaStatusStyles, type PwaStatusTone } from "@/styles/pwaStatusStyles";
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

type ButtonVariant = "work" | "sync" | "offline";

const BUTTON_VARIANT_TONES = {
  work: "primary",
  sync: "information",
  offline: "warning",
} as const satisfies Record<ButtonVariant, PwaStatusTone>;

// Base styling for navigation buttons — visually compact (w-8 h-8 = 32px)
// with tap-target-lg for a larger invisible touch area (matches Home view buttons)
const NAV_BUTTON_BASE = [
  "relative flex items-center justify-center w-8 h-8 p-1 rounded-lg border",
  "bg-bg-white-0 border-stroke-soft-200 text-text-sub-600",
  "transition-[color,border-color,box-shadow,transform] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] tap-feedback tap-target-lg",
  "active:scale-95",
  "focus-visible:outline-none focus-visible:ring-2",
] as const;

// Create complete button styles for a given variant
const createButtonStyles = (variant: ButtonVariant = "work") => {
  const status = pwaStatusStyles[BUTTON_VARIANT_TONES[variant]];

  return {
    button: cn(NAV_BUTTON_BASE, status.focus),
    icon: cn("w-4 h-4", status.icon),
    focusStyles: status.focus,
  };
};

// Reusable notification badge component
const NotificationBadge: React.FC<{ count: number }> = ({ count }) => (
  <div className="absolute -top-1.5 -right-1.5">
    <div
      className={cn(
        "inline-flex items-center justify-center text-xs font-semibold rounded-full",
        "min-w-[18px] h-[18px] px-1",
        pwaStatusStyles.primary.badge,
        "shadow-sm border-2 border-bg-white-0"
      )}
    >
      {count > 99 ? "99+" : count}
    </div>
  </div>
);

const NotificationCenter: React.FC<TopNavProps & { garden: Garden }> = ({ works, garden }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { formatMessage } = useIntl();

  const workNotifications = works?.filter((work) => work.status === "pending") || [];
  const hasNotifications = workNotifications.length > 0;
  const NotificationIcon = hasNotifications ? RiNotificationFill : RiNotificationLine;

  if (works === undefined) return null;

  const styles = createButtonStyles("work");

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={styles.button}
        aria-label={formatMessage({
          id: "app.home.topNav.notifications.ariaLabel",
          defaultMessage: "View notifications",
        })}
      >
        {hasNotifications && <NotificationBadge count={workNotifications.length} />}
        <NotificationIcon className={styles.icon} />
      </button>
      <ModalDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        header={{
          title: formatMessage({
            id: "app.home.notifications.drawerTitle",
            defaultMessage: "Notifications",
          }),
          description: hasNotifications
            ? formatMessage(
                {
                  id: "app.home.notifications.pendingCount",
                  defaultMessage:
                    "{count, plural, one {# pending review} other {# pending reviews}}",
                },
                { count: workNotifications.length }
              )
            : undefined,
        }}
        maxHeight="60vh"
      >
        <GardenNotifications
          garden={garden}
          notifications={works}
          onClose={() => setIsOpen(false)}
        />
      </ModalDrawer>
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
        <span
          className={cn(
            "absolute -top-1 -right-1 inline-flex h-2.5 w-2.5 rounded-full border border-bg-white-0",
            pwaStatusStyles.success.dot
          )}
        />
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
  works,
  overlay,
  isOperator = false,
  showEndowmentButton = false,
  hasEndowmentDeposits = false,
  onEndowmentClick,
  showGovernanceButton = false,
  onGovernanceClick,
  ...htmlProps
}: TopNavProps) => {
  const { formatMessage } = useIntl();
  const { syncStatus, isOnline } = useOffline();
  const hasOfflineIssues = !navigator.onLine;

  // Get appropriate button styling variant
  const buttonVariant = getButtonVariant(syncStatus, isOnline);
  const backButtonStyles = createButtonStyles(buttonVariant);

  const containerClasses = cn(
    "relative flex z-nav flex-row w-full justify-evenly items-start gap-4 p-6 h-20 top-2",
    overlay && "fixed bg-bg-white-0",
    overlay && hasOfflineIssues && "top-2", // Space for offline indicator
    overlay && !hasOfflineIssues && "top-0"
  );

  return (
    <div className={containerClasses} {...htmlProps}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-toast focus:px-4 focus:py-2 focus:bg-primary-action focus:text-primary-action-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
      {onBackClick && (
        <button
          type="button"
          onClick={(e) => {
            onBackClick?.(e);
            e.currentTarget.blur();
          }}
          className={cn(backButtonStyles.button, "z-1")}
          aria-label={formatMessage({
            id: "app.home.topNav.back.ariaLabel",
            defaultMessage: "Go back",
          })}
        >
          <RiArrowLeftFill className={backButtonStyles.icon} />
        </button>
      )}

      <div className="absolute left-0 top-0 w-full h-full flex flex-row justify-between items-center py-6">
        <div className="flex flex-row gap-4 justify-center grow">{children}</div>
      </div>

      <div className="flex grow" />
      <div className="flex flex-col items-end gap-2 z-1">
        {/* Notifications at top — operators need quick access to pending reviews */}
        {garden && isOperator && <NotificationCenter works={works} garden={garden} />}
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
      </div>
    </div>
  );
};
