import { useOffline } from "@green-goods/shared/hooks";
import { cn } from "@green-goods/shared/utils";
import { RiArrowLeftFill, RiNotificationFill, RiNotificationLine } from "@remixicon/react";
import { forwardRef, useRef } from "react";
import { createPortal } from "react-dom";
import { GardenNotifications } from "@/views/Home/Garden/Notifications";
import { Button } from "@/components/Actions";

type TopNavProps = {
  onBackClick?: (e: React.SyntheticEvent<HTMLButtonElement>) => void;
  garden?: Garden;
  works?: Work[];
  overlay?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

type NotificationsProps = {
  garden?: Garden;
  works?: Work[];
};

const Notifications = forwardRef<HTMLDialogElement, NotificationsProps>(
  ({ garden, works }, ref) => {
    if (!garden || !works) return null;

    return createPortal(
      <dialog
        ref={ref}
        className="fixed left-0 top-0 inset-0 w-full h-full z-1000000 bg-transparent p-6 pointer-events-auto m-0 max-w-[100%] max-h-[100%] backdrop:bg-black/30 backdrop:backdrop-blur-sm transition-all duration-200"
        onClick={(e) => {
          e.stopPropagation();
          (ref as React.RefObject<HTMLDialogElement>).current?.close();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            (ref as React.RefObject<HTMLDialogElement>).current?.close();
          }
        }}
      >
        <GardenNotifications garden={garden} notifications={works} />
      </dialog>,
      document.body
    );
  }
);

Notifications.displayName = "Notifications";

// Styling configuration for different button states
const BUTTON_VARIANTS = {
  work: {
    focus: "focus:ring-emerald-200 focus:border-emerald-600 active:border-emerald-600",
    icon: "focus:text-emerald-700 active:text-emerald-700",
  },
  sync: {
    focus: "focus:ring-blue-200 focus:border-blue-600 active:border-blue-600",
    icon: "focus:text-blue-700 active:text-blue-700",
  },
  offline: {
    focus: "focus:ring-orange-200 focus:border-orange-600 active:border-orange-600",
    icon: "focus:text-orange-700 active:text-orange-700",
  },
} as const;

// Base styling for navigation buttons
const NAV_BUTTON_BASE = [
  "relative flex items-center justify-center w-8 h-8 p-1 rounded-lg border",
  "bg-white border-slate-200 text-slate-500",
  "transition-all duration-200 tap-feedback",
  "active:scale-95",
  "focus:outline-none focus:ring-2",
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
  const ref = useRef<HTMLDialogElement>(null);

  const workNotifications = works?.filter((work) => work.status === "pending") || [];
  const hasNotifications = workNotifications.length > 0;
  const NotificationIcon = hasNotifications ? RiNotificationFill : RiNotificationLine;

  if (works === undefined) return null;

  const toggleDialog = () => {
    if (ref.current?.open) {
      ref.current.close();
    } else {
      ref.current?.showModal();
    }
  };

  const styles = createButtonStyles("work");

  return (
    <>
      <button
        type="button"
        className={cn(styles.button, "dropdown dropdown-bottom dropdown-end tap-target-lg")}
        onClick={toggleDialog}
      >
        {hasNotifications && <NotificationBadge count={workNotifications.length} />}
        <NotificationIcon className={styles.icon} />
      </button>
      <Notifications {...props} works={works} ref={ref} />
    </>
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
  ...props
}: TopNavProps) => {
  const { syncStatus, isOnline } = useOffline();
  const hasOfflineIssues = !navigator.onLine;

  // Get appropriate button styling variant
  const buttonVariant = getButtonVariant(syncStatus, isOnline);
  const backButtonStyles = createButtonStyles(buttonVariant);

  const containerClasses = cn(
    "relative flex z-[1000] flex-row w-full justify-evenly items-center gap-4 p-6 h-20 top-2",
    overlay && "fixed bg-white",
    overlay && hasOfflineIssues && "top-2", // Space for offline indicator
    overlay && !hasOfflineIssues && "top-0"
  );

  const backButtonClasses = cn(
    "p-0 px-2 z-1 transition-all duration-200 tap-target-lg tap-feedback",
    "focus:outline-none focus:ring-2 active:scale-95",
    backButtonStyles.focusStyles
  );

  return (
    <div className={containerClasses} {...props}>
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
      {garden && <NotificationCenter {...props} garden={garden} />}
    </div>
  );
};
