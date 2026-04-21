import { RiInboxLine } from "@remixicon/react";
import { useIntl } from "react-intl";

/**
 * Notification panel — rendered inside the RightSheet.
 *
 * Groups notifications by type: work submissions, assessments, system alerts.
 * Currently a placeholder skeleton — notification data source TBD.
 *
 * Desktop: opens in right sheet via bell icon → orchestrator.openSheet("right", "notifications")
 * Mobile: the AppBar bell icon uses a Popover fallback (max 5 items).
 */
export function NotificationPanel() {
  const { formatMessage } = useIntl();

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Empty state — placeholder until notification system is wired */}
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-soft">
          <RiInboxLine className="h-6 w-6 text-text-soft" />
        </div>
        <h3 className="text-sm font-semibold text-text-strong">
          {formatMessage({
            id: "cockpit.notifications.empty.title",
            defaultMessage: "No notifications",
          })}
        </h3>
        <p className="max-w-[240px] text-xs text-text-sub">
          {formatMessage({
            id: "cockpit.notifications.empty.description",
            defaultMessage: "Work submissions, assessments, and system alerts will appear here.",
          })}
        </p>
      </div>
    </div>
  );
}
