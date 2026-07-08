import { useMemo, type ReactNode } from "react";
import { useIntl } from "react-intl";
import {
  getRightSheetRegistryEntry,
  isRightSheetContentId,
  NOTIFICATIONS_SHEET_CONTENT_ID,
  PROFILE_SHEET_CONTENT_ID,
  SETTINGS_SHEET_CONTENT_ID,
  type AdminRightSheetContentId,
} from "../navigation/sheetRegistry";
import type { AccountSheetTab } from "./accountSheet.events";

export interface AdminRightSheetDescriptor {
  title: string;
  content: ReactNode;
}

export interface UseAdminRightSheetDescriptorOptions {
  contentId: string | null;
  renderAccountProfile: () => ReactNode;
  renderAccountSettings: () => ReactNode;
  /**
   * Renders the notifications feed. Injected by the consumer (CanvasLayout
   * owns the garden-scoped data wiring) so this hook stays a pure
   * contentId → descriptor mapping.
   */
  renderNotifications: () => ReactNode;
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
        content: renderNotifications(),
      };
    }

    const activeTab: AccountSheetTab =
      entry.id === SETTINGS_SHEET_CONTENT_ID ? "settings" : "profile";
    return {
      title: formatMessage(entry.title),
      content: activeTab === "settings" ? renderAccountSettings() : renderAccountProfile(),
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
