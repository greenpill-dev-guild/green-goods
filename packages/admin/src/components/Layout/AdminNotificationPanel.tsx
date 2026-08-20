import {
  NotificationPanel,
  resolveAdminWorkspaceSectionRoute,
  useAdminGardenWorkspaceSelection,
  useGardenDerivedState,
  useGardenDetailData,
  type AdminWorkspaceSectionTab,
  type NotificationPanelItem,
  type NotificationPanelSection,
} from "@green-goods/shared";
import { useLocalizedRelativeTime } from "@green-goods/shared/hooks";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";

export function AdminNotificationPanel({ onCloseSheet }: { onCloseSheet: () => void }) {
  const { formatMessage } = useIntl();
  const formatEventAge = useLocalizedRelativeTime();
  const navigate = useNavigate();
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const selectedGardenAddress = selectedGarden?.id;
  const workspace = useGardenDetailData(selectedGarden?.id);

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
    assessments: workspace.assessments,
    hypercerts: workspace.hypercerts,
    allocations: workspace.allocations,
    gardenVaults: workspace.gardenVaults,
    vaultNetDeposited: workspace.vaultNetDeposited,
    roleMembers: workspace.roleMembers,
    selectedRange: "30d",
    activityFilter: "all",
    memberSearch: "",
    section: undefined,
    formatMessage,
    openSection,
  });

  const sections = useMemo<NotificationPanelSection[]>(() => {
    if (!workspace.garden) return [];

    const alertItems: NotificationPanelItem[] = derived.overviewAlerts.map((alert) => ({
      id: `alert-${alert.key}`,
      title: alert.label,
      tone: alert.severity,
      onSelect: alert.onAction,
    }));

    const activityItems: NotificationPanelItem[] = derived.activityEvents
      .slice(0, 8)
      .map((event) => {
        const href = event.href;
        return {
          id: event.id,
          title: event.title,
          description: event.description,
          meta: formatEventAge(event.timestamp),
          tone: "info" as const,
          onSelect: href ? () => navigateFromNotification(href) : undefined,
        };
      });

    return [
      {
        id: "needs-attention",
        title: formatMessage({
          id: "cockpit.notifications.needsAttention",
          defaultMessage: "Needs attention",
        }),
        items: alertItems,
      },
      {
        id: "recent-activity",
        title: formatMessage({
          id: "cockpit.notifications.recentActivity",
          defaultMessage: "Recent activity",
        }),
        items: activityItems,
      },
    ];
  }, [
    derived.activityEvents,
    derived.overviewAlerts,
    formatEventAge,
    formatMessage,
    navigateFromNotification,
    workspace.garden,
  ]);

  const scopeLabel = selectedGarden
    ? formatMessage(
        { id: "cockpit.notifications.scope", defaultMessage: "Updates for {garden}" },
        { garden: selectedGarden.name }
      )
    : undefined;

  return (
    <NotificationPanel
      sections={sections}
      scopeLabel={scopeLabel}
      isLoading={
        workspace.fetching ||
        workspace.fetchingAssessments ||
        workspace.worksLoading ||
        workspace.hypercertsLoading ||
        workspace.allocationsLoading ||
        workspace.vaultsLoading
      }
    />
  );
}
