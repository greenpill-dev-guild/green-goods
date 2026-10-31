import { useCommitmentMetadata } from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useNavigateToTop } from "@green-goods/shared/hooks/app/useNavigateToTop";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import type {
  GardenNotification,
  GardenNotifications,
} from "@green-goods/shared/hooks/garden/useGardenNotifications";
import { RiHammerLine, RiHandHeartLine, RiNotificationLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AppSheet } from "@/components/Sheets/AppSheet";
import { APP_ROUTES } from "@/config/pwaRouting";
import { NotificationRow } from "./NotificationRow";

export interface NotificationsSheetProps {
  open: boolean;
  onClose: () => void;
  /** The active garden: every row opens inside it. */
  gardenId: string;
  /** Named under the title, once the garden's record has landed. */
  gardenName?: string | null;
  /** The garden's events for the account, newest first (`useGardenNotifications`). */
  notifications: readonly GardenNotification[];
  isLoading: boolean;
  isError: boolean;
  isIncomplete: boolean;
  /** Records that the open tab's events were shown: called as the sheet opens and as they change. */
  markSeen: GardenNotifications["markSeen"];
  /** Hides every listed event on this device: the sheet's Clear All (DL-133). */
  clearAll: () => void;
}

type NotificationsTab = "all" | "work" | "promises";
const TABS: readonly NotificationsTab[] = ["all", "work", "promises"];
const TAB_LABEL_IDS: Record<NotificationsTab, string> = {
  all: "app.home.notifications.tab.all",
  work: "app.home.notifications.tab.work",
  promises: "app.home.notifications.tab.promises",
};
const TAB_ICONS: Record<NotificationsTab, React.ReactNode> = {
  all: <RiNotificationLine aria-hidden="true" />,
  work: <RiHammerLine aria-hidden="true" />,
  promises: <RiHandHeartLine aria-hidden="true" />,
};
/** The events about work; every other event is about a promise. */
const WORK_KINDS: ReadonlySet<GardenNotification["kind"]> = new Set([
  "workApproved",
  "workRejected",
  "workSubmitted",
]);
const inTab = (notification: GardenNotification, tab: NotificationsTab) =>
  tab === "all" || (tab === "work") === WORK_KINDS.has(notification.kind);

/** How many empty frames hold the list's place while the first read runs (DL-056). */
const LOADING_ROWS = 3;

/**
 * The bell's sheet (DL-130, DL-133): a `full` sheet over Home with the garden named beneath its
 * title, listing the garden's events for the member, one item row each, newest first, under All,
 * Work and Promises tabs. A row opens the work or the promise, closing the sheet first so the
 * screen it opens is not under it. Opening the sheet marks the open tab's events seen on this
 * device, as does switching to a tab, while an event under another tab stays new; Clear All in
 * the shared bar hides every listed event here for good. With nothing to list it shows the
 * shared state block, and a read that failed or answered only in part says so in one quiet line
 * while the rows it did find stay. Offline the reads pause rather than fail: with nothing cached
 * the block says the events cannot be checked instead of reporting an empty inbox, and the rows
 * that were cached keep the partial-read line above them.
 */
export function NotificationsSheet({
  open,
  onClose,
  gardenId,
  gardenName,
  notifications,
  isLoading,
  isError,
  isIncomplete,
  markSeen,
  clearAll,
}: NotificationsSheetProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigateToTop();
  const isOnline = useOnlineStatus();
  const [tab, setTab] = useState<NotificationsTab>("all");
  const shown = useMemo(
    () => notifications.filter((notification) => inTab(notification, tab)),
    [notifications, tab]
  );

  // Opening shows the member the open tab's events, so the sheet marks those seen as it opens,
  // and again as the tab or the list changes. An event that lands under another tab is not
  // shown, so it stays new until that tab is opened.
  useEffect(() => {
    if (open) markSeen(shown);
  }, [open, markSeen, shown]);

  // A promise's words live at its metadata CID; one read names every promise row.
  const commitments = useMemo(
    () =>
      notifications.flatMap((notification) =>
        "commitment" in notification ? [notification.commitment] : []
      ),
    [notifications]
  );
  const { byCID } = useCommitmentMetadata(commitments);

  const openNotification = (notification: GardenNotification) => {
    // The sheet sits over Home, so it goes before the screen it opens would show under it.
    onClose();
    switch (notification.kind) {
      case "workApproved":
      case "workRejected":
      case "workSubmitted":
        navigate(`/home/${gardenId}/work/${notification.work.id}`, {
          // The row's record goes with it: a work outside the garden's loaded page has no other
          // copy on the device, and offline the work page's own read of it is paused.
          state: { from: "home", returnTo: APP_ROUTES.home, work: notification.work },
        });
        return;
      case "promiseTakenUp":
      case "takeUpRequested":
        // A take-up request is decided on its promise's page.
        navigate(
          `/home/${gardenId}/commitments/${notification.commitment.commitmentId.toString()}`,
          { state: { from: "home" } }
        );
        return;
    }
  };

  // Offline, React Query pauses the online reads: nothing loads, nothing errs, nothing is known.
  // Rows that were cached may still show, but the reads with no cache never answered, so what is
  // listed is only part of the garden's events.
  const partial = isError || isIncomplete || !isOnline;
  const partialNotice = formatMessage({ id: "app.home.notifications.partial" });
  const unavailableOffline = !isOnline && notifications.length === 0 && !isLoading && !isError;
  // A read still running speaks only while the open tab has nothing to show. The work and
  // promise reads answer apart, so an empty tab stays busy until every read has settled instead
  // of reporting an empty inbox its own read has not answered yet.
  const holdsFrame = isLoading && shown.length === 0;

  let body: React.ReactNode;
  if (holdsFrame) {
    body = (
      <ul className="flex flex-col gap-(--gg-list-gap)" aria-busy="true">
        {Array.from({ length: LOADING_ROWS }, (_, index) => (
          <li key={index}>
            <ItemRowSkeleton edge="neutral" />
          </li>
        ))}
      </ul>
    );
  } else if (unavailableOffline) {
    body = (
      <EmptyState
        placement="sheet"
        tone="warning"
        icon={<RiNotificationLine />}
        title={formatMessage({ id: "app.home.notifications.offline.title" })}
        description={formatMessage({ id: "app.home.notifications.offline.description" })}
      />
    );
  } else if (shown.length === 0) {
    body = (
      <EmptyState
        placement="sheet"
        tone={partial ? "warning" : "neutral"}
        icon={<RiNotificationLine />}
        title={formatMessage({ id: "app.home.notifications.empty.title" })}
        description={
          partial
            ? partialNotice
            : formatMessage({ id: "app.home.notifications.empty.description" })
        }
      />
    );
  } else {
    body = (
      <div className="flex flex-col gap-3">
        {partial ? <Alert variant="warning">{partialNotice}</Alert> : null}
        <ul className="flex flex-col gap-(--gg-list-gap)">
          {shown.map((notification) => (
            <li key={notification.id}>
              <NotificationRow
                notification={notification}
                promiseTitle={
                  "commitment" in notification && notification.commitment.metadataCID
                    ? (byCID.get(notification.commitment.metadataCID)?.title ?? null)
                    : null
                }
                onOpen={() => openNotification(notification)}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <AppSheet
      isOpen={open}
      onClose={onClose}
      size="full"
      tabs={TABS.map((id) => ({
        id,
        label: formatMessage({ id: TAB_LABEL_IDS[id] }),
        icon: TAB_ICONS[id],
      }))}
      activeTab={tab}
      onTabChange={(id) => setTab(id as NotificationsTab)}
      actions={{
        secondary: {
          label: formatMessage({ id: "app.home.notifications.clearAll" }),
          onClick: clearAll,
          disabled: notifications.length === 0,
        },
      }}
      header={{
        title: formatMessage({ id: "app.home.notifications.title" }),
        // The garden is named under the title, as the other sheets over Home name it (DL-128).
        description: gardenName
          ? formatMessage({ id: "app.common.inGarden" }, { garden: gardenName })
          : undefined,
      }}
    >
      {body}
    </AppSheet>
  );
}
