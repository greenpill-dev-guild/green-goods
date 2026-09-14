import { IconButton } from "@green-goods/shared/components/IconButton";
import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import type { Garden, Work } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  RiArrowLeftFill,
  RiBankLine,
  RiGovernmentLine,
  RiNotificationFill,
  RiNotificationLine,
  RiShareLine,
} from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AppSheet } from "@/components/Sheets";
import { type PwaStatusTone, pwaStatusStyles } from "@/components/Pwa/statusStyles";
import { GardenNotifications } from "@/views/Home/Garden/Notifications";

type TopNavProps = {
  onBackClick?: (e: React.SyntheticEvent<HTMLButtonElement>) => void;
  garden?: Garden;
  works?: Work[];
  overlay?: boolean;
  /** Whether the current user is a steward of this garden */
  isSteward?: boolean;
  showEndowmentButton?: boolean;
  hasEndowmentDeposits?: boolean;
  onEndowmentClick?: () => void;
  showGovernanceButton?: boolean;
  onGovernanceClick?: () => void;
  /** Shares the garden; renders last in the action stack so the other buttons keep their places. */
  onShareClick?: () => void;
} & React.HTMLAttributes<HTMLDivElement>;

type ButtonVariant = "work" | "sync" | "offline";

const BUTTON_VARIANT_TONES = {
  work: "primary",
  sync: "information",
  offline: "warning",
} as const satisfies Record<ButtonVariant, PwaStatusTone>;

// Header actions are compact outlined IconButtons (32px, 48px hit area); the
// icon carries the status tone (DL-023, DL-026).
const iconTone = (variant: ButtonVariant = "work") =>
  pwaStatusStyles[BUTTON_VARIANT_TONES[variant]].icon;

// Reusable notification badge, pinned by the IconButton badge slot
const NotificationBadge: React.FC<{ count: number }> = ({ count }) => (
  <span
    className={cn(
      "inline-flex items-center justify-center text-xs font-semibold rounded-full",
      "min-w-[18px] h-[18px] px-1",
      pwaStatusStyles.primary.badge,
      "shadow-sm border-2 border-bg-white-0"
    )}
  >
    {count > 99 ? "99+" : count}
  </span>
);

const NotificationCenter: React.FC<TopNavProps & { garden: Garden }> = ({ works, garden }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { formatMessage } = useIntl();

  const workNotifications = works?.filter((work) => work.status === "pending") || [];
  const hasNotifications = workNotifications.length > 0;
  const NotificationIcon = hasNotifications ? RiNotificationFill : RiNotificationLine;

  if (works === undefined) return null;

  return (
    <>
      <IconButton
        emphasis="secondary"
        size="compact"
        onClick={() => setIsOpen(true)}
        aria-label="View notifications"
        icon={<NotificationIcon className={iconTone()} aria-hidden="true" />}
        badge={hasNotifications ? <NotificationBadge count={workNotifications.length} /> : null}
      />
      <AppSheet
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
                  defaultMessage: "{count, plural, one {# pending} other {# pending}}",
                },
                { count: workNotifications.length }
              )
            : undefined,
        }}
        size="tall"
      >
        <GardenNotifications
          garden={garden}
          notifications={works}
          onClose={() => setIsOpen(false)}
        />
      </AppSheet>
    </>
  );
};

const EndowmentButton: React.FC<{
  hasDeposits: boolean;
  onClick: () => void;
  ariaLabel: string;
}> = ({ hasDeposits, onClick, ariaLabel }) => (
  <IconButton
    emphasis="secondary"
    size="compact"
    onClick={onClick}
    aria-label={ariaLabel}
    title={ariaLabel}
    icon={<RiBankLine className={iconTone()} aria-hidden="true" />}
    badge={
      hasDeposits ? (
        <span
          className={cn(
            "inline-flex h-2.5 w-2.5 rounded-full border border-bg-white-0",
            pwaStatusStyles.success.dot
          )}
        />
      ) : null
    }
  />
);

const GovernanceButton: React.FC<{
  onClick: () => void;
  ariaLabel: string;
}> = ({ onClick, ariaLabel }) => (
  <IconButton
    emphasis="secondary"
    size="compact"
    onClick={onClick}
    aria-label={ariaLabel}
    title={ariaLabel}
    icon={<RiGovernmentLine className={iconTone()} aria-hidden="true" />}
  />
);

const ShareButton: React.FC<{
  onClick: () => void;
  ariaLabel: string;
}> = ({ onClick, ariaLabel }) => (
  <IconButton
    emphasis="secondary"
    size="compact"
    onClick={onClick}
    aria-label={ariaLabel}
    title={ariaLabel}
    icon={<RiShareLine className={iconTone()} aria-hidden="true" />}
  />
);

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
  isSteward = false,
  showEndowmentButton = false,
  hasEndowmentDeposits = false,
  onEndowmentClick,
  showGovernanceButton = false,
  onGovernanceClick,
  onShareClick,
  ...htmlProps
}: TopNavProps) => {
  const { formatMessage } = useIntl();
  const { syncStatus, isOnline } = useOffline();
  const hasOfflineIssues = !navigator.onLine;

  // The back button's icon follows the sync and connection state
  const buttonVariant = getButtonVariant(syncStatus, isOnline);

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
        <IconButton
          emphasis="secondary"
          size="compact"
          onClick={(e) => {
            onBackClick?.(e);
            e.currentTarget.blur();
          }}
          className="z-1"
          aria-label="Go back"
          icon={<RiArrowLeftFill className={iconTone(buttonVariant)} aria-hidden="true" />}
        />
      )}

      <div className="absolute left-0 top-0 w-full h-full flex flex-row justify-between items-center py-6">
        <div className="flex flex-row gap-4 justify-center grow">{children}</div>
      </div>

      <div className="flex grow" />
      <div className="flex flex-col items-end gap-2 z-1">
        {/* Notifications at top — stewards need quick access to pending reviews */}
        {garden && isSteward && <NotificationCenter works={works} garden={garden} />}
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
        {garden && onShareClick && (
          <ShareButton
            onClick={onShareClick}
            ariaLabel={formatMessage({ id: "app.garden.share", defaultMessage: "Share Garden" })}
          />
        )}
      </div>
    </div>
  );
};
