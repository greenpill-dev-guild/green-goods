import { useGardenNotifications } from "@green-goods/shared/hooks/garden/useGardenNotifications";
import { useExitPresence } from "@green-goods/shared/hooks/utils/useExitPresence";
import { getPwaSheetExitMs } from "@/components/Pwa/sheetStyles";
import { NotificationsIcon } from "./Icon";
import { NotificationsSheet } from "./Sheet";

export interface NotificationsLauncherProps {
  /** The active garden, whose events the bell reads. */
  gardenId: string;
  /** Its name, under the sheet's title, once the garden's record has landed. */
  gardenName?: string | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

/**
 * The bell with its read model (DL-130): one `useGardenNotifications` serves the badge and the
 * sheet, so the count and the rows never disagree. Home owns whether the sheet is open, as it
 * owns its other drawers, and closes it when a child screen opens under it.
 */
export function NotificationsLauncher({
  gardenId,
  gardenName,
  open,
  onOpen,
  onClose,
}: NotificationsLauncherProps) {
  const bell = useGardenNotifications(gardenId);
  // The sheet stays mounted until its exit has played; unmounting it on close would remove it
  // before the slide-out could run.
  const isPresent = useExitPresence(open, getPwaSheetExitMs);

  return (
    <>
      <NotificationsIcon onClick={onOpen} newCount={bell.newCount} />
      {isPresent ? (
        <NotificationsSheet
          open={open}
          onClose={onClose}
          gardenId={gardenId}
          gardenName={gardenName}
          notifications={bell.notifications}
          isLoading={bell.isLoading}
          isError={bell.isError}
          isIncomplete={bell.isIncomplete}
          markAllSeen={bell.markAllSeen}
        />
      ) : null}
    </>
  );
}
