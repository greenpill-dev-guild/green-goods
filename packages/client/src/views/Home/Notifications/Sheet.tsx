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
import { useTimeout } from "@green-goods/shared/hooks/utils/useTimeout";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { getTimeCutoff, normalizeTimestamp } from "@green-goods/shared/utils/time";
import {
  RiFilterOffLine,
  RiHammerLine,
  RiHandHeartLine,
  RiNotificationLine,
} from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { type TimePeriod, TimeFilterControl } from "@/components/Inputs/TimeFilterControl";
import { PWA_SHEET_SCROLL_CLASSNAME } from "@/components/Pwa/sheetScrollStyles";
import { AppSheet } from "@/components/Sheets/AppSheet";
import { SheetListHeader } from "@/components/Sheets/SheetListHeader";
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
  /** Reads the garden's events again: as the sheet opens, and from its Refresh (DL-168). */
  refresh: GardenNotifications["refresh"];
  /** A read is running, which the Refresh shows. */
  isFetching: boolean;
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
/** The events each tab lists besides All, which lists every event, waiting join requests too. */
const TAB_KINDS: Record<
  Exclude<NotificationsTab, "all">,
  ReadonlySet<GardenNotification["kind"]>
> = {
  work: new Set(["workApproved", "workRejected", "workSubmitted"]),
  promises: new Set(["promiseTakenUp", "takeUpRequested"]),
};
const inTab = (notification: GardenNotification, tab: NotificationsTab) =>
  tab === "all" || TAB_KINDS[tab].has(notification.kind);

/** How many empty frames hold the list's place while the first read runs (DL-056). */
const LOADING_ROWS = 3;

type NotificationsPeriod = Extract<TimePeriod, "any" | "day" | "week">;
/**
 * The periods the bell's sources answer in full, in order (DL-168). Its work activity reaches back
 * a week, so a longer span would list only part of it. It opens on any time: everything it lists.
 */
const PERIODS: readonly NotificationsPeriod[] = ["any", "day", "week"];
/** How long after a row leaves the period the sheet filters again, past clock granularity. */
const PERIOD_CUTOFF_MARGIN_MS = 1_000;

/**
 * The bell's sheet (DL-130, DL-133): a `full` sheet over Home with the garden named beneath its
 * title, listing the garden's events for the member, one item row each, newest first, under All,
 * Work and Promises tabs. Each tab scrolls in a container of its own, so a tab opens at its top
 * however far the last one was scrolled; the sheet's body hands it scrolling, as the Wallet and
 * Promises sheets do. A row opens the work, the promise or, for waiting join requests, the
 * Gardeners sheet, closing this sheet first so what it opens is not under it. Join requests are
 * about neither work nor a promise, so only All lists them. Opening the sheet marks the open
 * tab's events seen on this device, as does switching to a tab, while an event under another tab
 * stays new; Clear All in the shared bar hides every listed event here for good. Each tab's list
 * starts under the header row Your Work's tabs share (DL-168): how many events it shows, a
 * compact Refresh, and a period filter that narrows the list to the past day or week, as far
 * back as its sources answer in full; a row leaves the period as it ages past it, while the sheet
 * stays open. Opening the sheet reads the events again. With nothing to
 * list it shows the shared state block, which says so when the period hides every event, and a
 * read that failed or answered only in part says so in one quiet line while the rows it did find
 * stay, the period's state included. Offline the reads pause
 * rather than fail: a tab with nothing cached says the events cannot be checked instead of
 * reporting an empty inbox, and the rows that were cached keep the partial-read line above them.
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
  refresh,
  isFetching,
}: NotificationsSheetProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigateToTop();
  const openGardenSheet = useUIStore((state) => state.openGardenSheet);
  const isOnline = useOnlineStatus();
  const [tab, setTab] = useState<NotificationsTab>("all");
  const [period, setPeriod] = useState<NotificationsPeriod>("any");
  // A period counts back from now, so its cutoff moves on while the sheet stays open; each move
  // filters the list again.
  const [cutoffMoves, setCutoffMoves] = useState(0);
  // The open tab's events, then those of them inside the period: the rows the sheet shows, and
  // how long until the oldest of them leaves the period.
  const { inTabCount, shown, leavesPeriodInMs } = useMemo(() => {
    const listed = notifications.filter((notification) => inTab(notification, tab));
    if (period === "any") {
      return { inTabCount: listed.length, shown: listed, leavesPeriodInMs: null };
    }
    const cutoff = getTimeCutoff(period);
    const inPeriod = listed.filter((notification) => normalizeTimestamp(notification.at) >= cutoff);
    return {
      inTabCount: listed.length,
      shown: inPeriod,
      leavesPeriodInMs:
        inPeriod.length > 0
          ? Math.min(...inPeriod.map((notification) => normalizeTimestamp(notification.at))) -
            cutoff
          : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cutoffMoves is a deliberate cache-buster: each move of the cutoff filters again, so the compiler must keep it (shared.md § Optimistic-UI Memos)
  }, [notifications, tab, period, cutoffMoves]);

  // While the sheet is open, the oldest row in the period leaves it when the cutoff passes it.
  const { set: scheduleCutoffMove } = useTimeout();
  useEffect(() => {
    if (!open || leavesPeriodInMs === null) return;
    return scheduleCutoffMove(
      () => setCutoffMoves((moves) => moves + 1),
      leavesPeriodInMs + PERIOD_CUTOFF_MARGIN_MS
    );
  }, [open, leavesPeriodInMs, scheduleCutoffMove]);

  // Opening shows the member the open tab's events, so the sheet marks those seen as it opens,
  // and again as the tab, the period or the list changes. An event that lands under another tab
  // or outside the period is not shown, so it stays new until it is.
  useEffect(() => {
    if (open) markSeen(shown);
  }, [open, markSeen, shown]);

  // Each opening reads the events again, once, so the sheet never opens on an old answer.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) refresh();
    wasOpen.current = open;
  }, [open, refresh]);

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
          {
            state: {
              from: "home",
              commitmentGarden: gardenId,
              commitment: notification.commitment,
            },
          }
        );
        return;
      case "joinRequested":
        // Join requests are answered in the Gardeners sheet over Home, its queue first.
        openGardenSheet("gardeners");
        return;
    }
  };

  // Offline, React Query pauses the online reads: nothing loads, nothing errs, nothing is known.
  // Rows that were cached may still show, but the reads with no cache never answered, so what is
  // listed is only part of the garden's events.
  const partial = isError || isIncomplete || !isOnline;
  const partialNotice = formatMessage({ id: "app.home.notifications.partial" });
  // An open tab with no cached rows cannot tell an empty inbox from a paused read, so it says the
  // events cannot be checked, whatever the other tab holds.
  const unavailableOffline = !isOnline && inTabCount === 0 && !isLoading && !isError;
  // A read still running speaks only while the open tab has nothing to show. The work and
  // promise reads answer apart, so an empty tab stays busy until every read has settled instead
  // of reporting an empty inbox its own read has not answered yet.
  const holdsFrame = isLoading && inTabCount === 0;
  // The tab has events, none of them inside the period.
  const periodHidesAll = shown.length === 0 && inTabCount > 0;

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
  } else if (periodHidesAll) {
    // A partial read cannot promise the period is empty, so it says what it could not read.
    body = (
      <EmptyState
        placement="sheet"
        tone={partial ? "warning" : "neutral"}
        icon={<RiFilterOffLine />}
        title={formatMessage({ id: "app.home.notifications.periodEmpty.title" })}
        description={
          partial
            ? partialNotice
            : formatMessage({ id: "app.home.notifications.periodEmpty.description" })
        }
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
      // The body stops scrolling and padding: the open tab's scroller below takes both over.
      contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
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
      {/* Keyed by tab, so a tab change mounts a fresh scroller at its top. It keeps the body's
          scroll containment and both edge hairlines, so nothing else moves; the header row
          starts the list 16px under the rail, as Your Work's does. */}
      <div
        key={tab}
        className={cn(PWA_SHEET_SCROLL_CLASSNAME, "overscroll-contain")}
        data-scroll-edge="both"
      >
        <SheetListHeader
          statusText={
            shown.length > 0
              ? formatMessage({ id: "app.home.notifications.count" }, { count: shown.length })
              : null
          }
          // Offline the reads are paused, and during the first read there is nothing to redo.
          onRefresh={isOnline && !holdsFrame ? refresh : undefined}
          isFetching={isFetching}
        >
          <TimeFilterControl value={period} onChange={setPeriod} periods={PERIODS} />
        </SheetListHeader>
        <div className="px-4 pb-4">{body}</div>
      </div>
    </AppSheet>
  );
}
