import { RiArrowLeftLine, RiNotificationFill } from "@remixicon/react";
import { Button } from "../Button";
import { GardenNotifications } from "@/views/Home/Notifications";
import { createPortal } from "react-dom";
import { useRef, forwardRef } from "react";
import { cn } from "@/utils/cn";

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
        className="fixed left-0 top-0 inset-0 w-full h-full z-1000000 bg-black/10 p-6 pointer-events-auto m-0 max-w-[100%] max-h-[100%]"
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

const NotificationCenter: React.FC<TopNavProps> = ({ works, ...props }) => {
  const ref = useRef<HTMLDialogElement>(null);

  const workNotifications =
    works?.filter((work) => work.status === "pending") || [];

  if (works === undefined) return null;

  const toggleDialog = () => {
    if (ref.current?.open) {
      ref.current.close();
    } else {
      ref.current?.showModal();
    }
  };

  return (
    <>
      <button
        type="button"
        className="relative dropdown dropdown-bottom dropdown-end flex items-center gap-1 bg-white rounded-lg z-1"
        onClick={toggleDialog}
      >
        {workNotifications.length ? (
          <span className="absolute -top-2 -right-2 w-5 h-5 bg-teal-500 rounded-full flex-col justify-center items-center gap-2.5 inline-flex">
            <p className="text-xs self-stretch text-center text-white font-medium leading-3 tracking-tight">
              {workNotifications.length}
            </p>
          </span>
        ) : null}
        <RiNotificationFill />
      </button>
      <Notifications {...props} works={works} ref={ref} />
    </>
  );
};

export const TopNav: React.FC<TopNavProps> = ({
  children,
  onBackClick,
  garden,
  overlay = false,
  ...props
}: TopNavProps) => {
  return (
    <div
      className={cn(
        "relative flex flex-row w-full justify-evenly items-center gap-4 p-4 h-14",
        overlay && "fixed z-1000"
      )}
      {...props}
    >
      {onBackClick && (
        <Button
          variant="neutral"
          mode="stroke"
          type="button"
          shape="pilled"
          size="xsmall"
          label=""
          leadingIcon={<RiArrowLeftLine className="w-4 h-4 text-black" />}
          onClick={(e) => {
            onBackClick?.(e);
            e.currentTarget.blur();
          }}
          className="p-0 px-2 z-1"
        />
      )}
      <div className="absolute left-0 top-0 w-full h-full flex flex-row justify-between items-center">
        {/* absolute space children / progress */}
        <div className="flex flex-row gap-4 justify-center grow">
          {children}
        </div>
      </div>
      {/* Spacer */}
      <div className="flex grow" />
      {garden && <NotificationCenter {...props} garden={garden} />}
    </div>
  );
};
