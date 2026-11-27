import { useActionsByUID } from "@green-goods/shared/hooks/action/useAction";
import { findActionByUID } from "@green-goods/shared/utils/action/parsers";
import {
  NotificationPanel,
  type NotificationPanelItem,
  type NotificationPanelSection,
} from "@green-goods/shared/components/Canvas/NotificationPanel";
import {
  type AdminWorkspaceSectionTab,
  resolveAdminWorkspaceSectionRoute,
} from "@green-goods/shared/hooks/admin-ui/navigation/workspaceNavigation";
import { useLocalizedEventTime } from "@green-goods/shared/hooks/app/useLocalizedRelativeTime";
import { useAdminGardenWorkspaceSelection } from "@green-goods/shared/hooks/garden/useAdminGardenWorkspaceSelection";
import { useGardenDerivedState } from "@green-goods/shared/hooks/garden/useGardenDerivedState";
import { useGardenDetailData } from "@green-goods/shared/hooks/garden/useGardenDetailData";
import {
  type HubGardenChangeRow,
  useHubGardenChanges,
} from "@green-goods/shared/hooks/garden/useGardenNotifications";
import { useEffectiveToolbarPermissions } from "@green-goods/shared/hooks/roles/useEffectiveToolbarPermissions";
import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { toWorkDisplayTitle } from "@green-goods/shared/utils/work/workTitles";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { localizeWorkActivityTitle } from "@/components/Action/actionDisplay";
import { getRoleLabel } from "@/components/Garden/gardenUtils";
import { MemberNameReaders, withMemberName } from "@/components/Garden/MemberNames";

/** The people a change names, for their shown names. */
function peopleOf(change: HubGardenChangeRow): Address[] {
  if (change.kind === "joinRequested") return [];
  if (change.kind === "workDecided" || change.kind === "promiseDecided") return [change.by];
  return [change.account];
}

function changeTitle(
  change: HubGardenChangeRow,
  nameOf: (address: Address) => string,
  intl: IntlShape,
  actions: ReturnType<typeof useActionsByUID>
): string {
  const { formatMessage } = intl;
  switch (change.kind) {
    case "joinRequested":
      return formatMessage(
        { id: "hub.notifications.change.joinRequested" },
        { count: change.waiting }
      );
    case "joined":
    case "roleGranted":
    case "roleRevoked":
      return formatMessage(
        { id: `hub.notifications.change.${change.kind}` },
        {
          name: nameOf(change.account),
          role: getRoleLabel(change.role, formatMessage).singular,
        }
      );
    case "workDecided":
      return formatMessage(
        { id: "hub.notifications.change.workDecided" },
        {
          name: nameOf(change.by),
          approved: change.approved ? "yes" : "no",
          // The work's own title, or its action's in the reader's language when the title
          // was generated, as Review names it.
          title: localizeWorkActivityTitle(
            toWorkDisplayTitle(change.work.title, "") ||
              findActionByUID(actions, change.work.actionUID)?.title ||
              formatMessage({ id: "hub.garden.calendar.untitled" }),
            findActionByUID(actions, change.work.actionUID),
            intl,
            !toWorkDisplayTitle(change.work.title, "")
          ),
        }
      );
    case "promiseDecided":
      return formatMessage(
        { id: "hub.notifications.change.promiseDecided" },
        { name: nameOf(change.by), decision: change.decision }
      );
  }
}

export function AdminNotificationPanel({ onCloseSheet }: { onCloseSheet: () => void }) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const formatEventTime = useLocalizedEventTime();
  const navigate = useNavigate();
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const selectedGardenAddress = selectedGarden?.id;
  const workspace = useGardenDetailData(selectedGarden?.id);
  const { showCommunity, isLoading: permissionsLoading } = useEffectiveToolbarPermissions();
  const hub = useHubGardenChanges(workspace.garden ?? undefined);

  const navigateFromNotification = useCallback(
    (path: string) => {
      navigate(path);
      onCloseSheet();
    },
    [navigate, onCloseSheet]
  );

  const openSection = useCallback(
    (tab: AdminWorkspaceSectionTab, section: string, itemId?: string) => {
      navigateFromNotification(
        resolveAdminWorkspaceSectionRoute({
          tab,
          section,
          itemId,
          gardenAddress: selectedGardenAddress,
        })
      );
    },
    [navigateFromNotification, selectedGardenAddress]
  );

  const derived = useGardenDerivedState({
    garden: workspace.garden ?? {
      id: selectedGarden?.id ?? "",
      domainMask: undefined,
      name: selectedGarden?.name ?? "",
      chainId: selectedGarden?.chainId ?? 0,
    },
    works: workspace.works,
    worksComplete: workspace.worksComplete,
    gardenReviewQueue: workspace.gardenReviewQueue,
    assessments: workspace.assessments,
    hypercerts: workspace.hypercerts,
    allocations: workspace.allocations,
    gardenVaults: workspace.gardenVaults,
    hasEndowment: workspace.hasEndowment,
    cookieJars: workspace.cookieJars,
    roleMembers: workspace.roleMembers,
    selectedRange: "30d",
    activityFilter: "all",
    section: undefined,
    canAccessCommunity: showCommunity && !permissionsLoading,
    formatMessage,
    openSection,
  });

  // What changed is listed until this device has shown it: what the sheet opened with stays
  // on screen while it is open, and counts as shown once it closes (PRD-1536).
  const changes = useMemo(() => hub.changes.filter((change) => change.isNew), [hub.changes]);
  const loading =
    workspace.fetching ||
    workspace.fetchingAssessments ||
    workspace.worksLoading ||
    workspace.hypercertsLoading ||
    workspace.allocationsLoading ||
    workspace.vaultsLoading ||
    hub.isLoading;
  // Only what the sheet showed counts as seen, and in the scope it was shown in: a garden
  // switched while the sheet is open marks nothing of the new garden in the old one.
  const shown = useRef({ markSeen: hub.markSeen, items: [] as typeof changes });
  if (!loading) shown.current = { markSeen: hub.markSeen, items: changes };
  useEffect(() => () => shown.current.markSeen(shown.current.items), []);

  const [names, setNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  const onName = useCallback(
    (address: Address, name: string | null) =>
      setNames((current) => withMemberName(current, address, name)),
    []
  );
  const actions = useActionsByUID(
    changes.flatMap((change) => (change.kind === "workDecided" ? [change.work.actionUID] : [])),
    workspace.garden?.chainId ?? selectedGarden?.chainId
  );
  const people = useMemo(
    () => [...new Set(changes.flatMap(peopleOf).map((address) => address.toLowerCase()))],
    [changes]
  ) as Address[];

  const sections = useMemo<NotificationPanelSection[]>(() => {
    if (!workspace.garden) return [];
    const gardenId = workspace.garden.id;
    const { reviewQueue } = derived;

    // Each count opens the list it counts, filtered as it counted (PRD-1536). Work and join
    // requests are for whoever may answer them; the garden's other alerts keep their gates.
    const attention: NotificationPanelItem[] = [];
    if (hub.canManage && hub.joinRequestsWaiting) {
      attention.push({
        id: "attention-join-requests",
        title: formatMessage(
          { id: "hub.notifications.attention.joinRequests" },
          { count: hub.joinRequestsWaiting }
        ),
        tone: "info",
        onSelect: () => navigateFromNotification(adminRoutes.communityMembers({ gardenId })),
      });
    }
    if (hub.canManage) {
      for (const band of ["weeks1to2", "over2w"] as const) {
        const count = reviewQueue.waitingByBand[band];
        if (count === 0) continue;
        attention.push({
          id: `attention-waiting-${band}`,
          title: formatMessage(
            { id: `hub.notifications.attention.waiting.${band}` },
            { count, plus: reviewQueue.waitingByBandComplete ? "no" : "yes" }
          ),
          tone: "info",
          onSelect: () =>
            navigateFromNotification(adminRoutes.reviewWork({ gardenId, waiting: band })),
        });
      }
    }
    for (const alert of derived.overviewAlerts) {
      // Waiting work is counted by its band above, each opening its own filtered list.
      // Past the queue read's floor the bands miss older work, so the week alert stays then.
      const counted = reviewQueue.waitingByBand.weeks1to2 + reviewQueue.waitingByBand.over2w;
      if (
        alert.key === "work-warning" &&
        (reviewQueue.waitingByBandComplete || counted >= reviewQueue.waitingOverWeekCount)
      ) {
        continue;
      }
      if (alert.key === "work-warning" && !hub.canManage) continue;
      if (alert.key === "work-critical" && !hub.canManage) continue;
      attention.push({
        id: `alert-${alert.key}`,
        title: alert.label,
        description: alert.description,
        tone: alert.severity,
        onSelect: alert.onAction,
      });
    }

    const nameOf = (address: Address) =>
      names.get(address.toLowerCase()) ?? formatAddress(address, { variant: "card" });
    const changeItems: NotificationPanelItem[] = changes.map((change) => ({
      id: change.id,
      title: changeTitle(change, nameOf, intl, actions),
      meta: formatEventTime(change.at * 1000),
      tone: "info" as const,
      unread: true,
      onSelect: () =>
        navigateFromNotification(
          change.kind === "workDecided"
            ? adminRoutes.reviewWorkDetail(change.work.id, { gardenId })
            : change.kind === "promiseDecided"
              ? adminRoutes.gardenPoolCommitment(change.commitmentId.toString(), { gardenId })
              : adminRoutes.communityMembers({ gardenId })
        ),
    }));

    // A read that failed is said, so a short or empty list is never taken for a quiet week.
    if (hub.isError) {
      changeItems.push({
        id: "changes-unread",
        title: formatMessage({ id: "hub.notifications.changesUnread.title" }),
        description: formatMessage({ id: "hub.notifications.changesUnread.description" }),
        tone: "warn",
        onSelect: hub.retry,
      });
    }

    return [
      {
        id: "needs-attention",
        title: formatMessage({ id: "hub.notifications.needsAttention" }),
        items: attention,
      },
      {
        id: "since-last-visit",
        title: formatMessage({ id: "hub.notifications.sinceLastVisit" }),
        items: changeItems,
      },
    ];
  }, [
    actions,
    changes,
    derived,
    formatEventTime,
    formatMessage,
    hub.canManage,
    hub.isError,
    hub.joinRequestsWaiting,
    hub.retry,
    intl,
    names,
    navigateFromNotification,
    workspace.garden,
  ]);

  const scopeLabel = selectedGarden
    ? formatMessage({ id: "hub.notifications.scope" }, { garden: selectedGarden.name })
    : undefined;

  return (
    <>
      <NotificationPanel sections={sections} scopeLabel={scopeLabel} isLoading={loading} />
      <MemberNameReaders addresses={people} onName={onName} />
    </>
  );
}
