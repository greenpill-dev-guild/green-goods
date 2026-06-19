import { useCallback, useMemo, type ReactNode } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import {
  NotificationPanel,
  type NotificationPanelItem,
} from "../../../components/Canvas/NotificationPanel";
import { useSheetOrchestratorStore } from "../../../stores/useSheetOrchestratorStore";
import { formatRelativeTime } from "../../../utils/time";
import { useAdminGardenWorkspaceSelection } from "../../garden/useAdminGardenWorkspaceSelection";
import { useGardenDerivedState } from "../../garden/useGardenDerivedState";
import { useGardenDetailData } from "../../garden/useGardenDetailData";
import {
  getRightSheetRegistryEntry,
  isRightSheetContentId,
  NOTIFICATIONS_SHEET_CONTENT_ID,
  PROFILE_SHEET_CONTENT_ID,
  SETTINGS_SHEET_CONTENT_ID,
  type AdminRightSheetContentId,
} from "../navigation/sheetRegistry";
import {
  resolveAdminWorkspaceSectionRoute,
  type AdminWorkspaceSectionTab,
} from "../navigation/workspaceNavigation";
import type { AccountSheetTab } from "./accountSheet.events";

export interface AdminRightSheetDescriptor {
  title: string;
  content: ReactNode;
  /** Width hint for the right sheet — wider for form-heavy panels. */
  width?: "default" | "wide";
}

export interface UseAdminRightSheetDescriptorOptions {
  contentId: string | null;
  renderAccountProfile: () => ReactNode;
  renderAccountSettings: () => ReactNode;
  renderNotifications?: () => ReactNode;
}

function AdminNotificationPanel() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const closeSheet = useSheetOrchestratorStore((state) => state.closeSheet);
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const selectedGardenAddress = selectedGarden?.id;
  const workspace = useGardenDetailData(selectedGarden?.id);

  const navigateFromNotification = useCallback(
    (path: string) => {
      navigate(path);
      closeSheet();
    },
    [closeSheet, navigate]
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

  const items = useMemo<NotificationPanelItem[]>(() => {
    if (!workspace.garden) return [];

    const alertItems = derived.overviewAlerts.map((alert) => ({
      id: `alert-${alert.key}`,
      title: alert.label,
      description: selectedGarden?.name,
      tone: alert.severity,
      onSelect: alert.onAction,
    }));

    const activityItems = derived.activityEvents.slice(0, 5).map((event) => {
      const href = event.href;
      return {
        id: event.id,
        title: event.title,
        description: event.description,
        meta: formatRelativeTime(event.timestamp),
        tone: "info" as const,
        onSelect: href ? () => navigateFromNotification(href) : undefined,
      };
    });

    return [...alertItems, ...activityItems].slice(0, 8);
  }, [
    derived.activityEvents,
    derived.overviewAlerts,
    navigateFromNotification,
    selectedGarden,
    workspace.garden,
  ]);

  return (
    <NotificationPanel
      items={items}
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

export function useAdminRightSheetDescriptor({
  contentId,
  renderAccountProfile,
  renderAccountSettings,
  renderNotifications,
}: UseAdminRightSheetDescriptorOptions): AdminRightSheetDescriptor | null {
  const { formatMessage } = useIntl();

  return useMemo(() => {
    const entry = getRightSheetRegistryEntry(contentId);
    if (!entry) return null;

    if (entry.id === NOTIFICATIONS_SHEET_CONTENT_ID) {
      return {
        title: formatMessage(entry.title),
        content: renderNotifications ? renderNotifications() : <AdminNotificationPanel />,
      };
    }

    const activeTab: AccountSheetTab =
      entry.id === SETTINGS_SHEET_CONTENT_ID ? "settings" : "profile";
    return {
      title: formatMessage(entry.title),
      content: activeTab === "settings" ? renderAccountSettings() : renderAccountProfile(),
      // One width for every right sheet — per-content widths made the chrome
      // feel inconsistent across notifications/profile/settings opens (QA
      // refinement pass). The shared default token sizes all of them.
    };
  }, [contentId, formatMessage, renderAccountProfile, renderAccountSettings, renderNotifications]);
}

export function toAccountSheetContentId(tab: AccountSheetTab): AdminRightSheetContentId {
  return tab === "settings" ? SETTINGS_SHEET_CONTENT_ID : PROFILE_SHEET_CONTENT_ID;
}

export function isAdminRightSheetContentId(
  contentId: string | null
): contentId is AdminRightSheetContentId {
  return isRightSheetContentId(contentId);
}
