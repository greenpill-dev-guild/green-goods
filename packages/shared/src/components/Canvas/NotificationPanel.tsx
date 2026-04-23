import {
  RiArrowRightSLine,
  RiErrorWarningLine,
  RiInboxLine,
  RiInformationLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";

export type NotificationPanelTone = "info" | "warn" | "critical";

export interface NotificationPanelItem {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  tone?: NotificationPanelTone;
  onSelect?: () => void;
}

export interface NotificationPanelProps {
  items?: NotificationPanelItem[];
  isLoading?: boolean;
}

const TONE_CLASSES: Record<
  NotificationPanelTone,
  {
    icon: typeof RiInformationLine;
    container: string;
    iconClassName: string;
  }
> = {
  info: {
    icon: RiInformationLine,
    container: "bg-bg-soft",
    iconClassName: "text-text-soft",
  },
  warn: {
    icon: RiErrorWarningLine,
    container: "bg-warning-lighter",
    iconClassName: "text-warning-dark",
  },
  critical: {
    icon: RiErrorWarningLine,
    container: "bg-error-lighter",
    iconClassName: "text-error-dark",
  },
};

/**
 * Notification panel — rendered inside the RightSheet.
 *
 * Groups notifications by type: work submissions, assessments, system alerts.
 *
 * Desktop: opens in the registered admin right-sheet notifications panel.
 * Mobile: the AppBar bell icon uses a Popover fallback (max 5 items).
 */
export function NotificationPanel({ items = [], isLoading = false }: NotificationPanelProps) {
  const { formatMessage } = useIntl();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-4">
        <div
          className="flex min-h-40 items-center justify-center text-sm text-text-sub"
          role="status"
          aria-live="polite"
        >
          {formatMessage({ id: "app.common.loading", defaultMessage: "Loading..." })}
        </div>
      </div>
    );
  }

  if (items.length > 0) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {items.map((item) => {
          const tone = TONE_CLASSES[item.tone ?? "info"];
          const Icon = tone.icon;
          const content = (
            <>
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.container}`}
                aria-hidden="true"
              >
                <Icon className={`h-4 w-4 ${tone.iconClassName}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-5 text-text-strong">
                  {item.title}
                </span>
                {item.description ? (
                  <span className="mt-1 block text-xs leading-5 text-text-sub">
                    {item.description}
                  </span>
                ) : null}
                {item.meta ? (
                  <span className="mt-2 block text-[11px] font-medium uppercase text-text-soft">
                    {item.meta}
                  </span>
                ) : null}
              </span>
              {item.onSelect ? (
                <RiArrowRightSLine className="mt-1 h-4 w-4 shrink-0 text-text-soft" />
              ) : null}
            </>
          );

          return item.onSelect ? (
            <button
              key={item.id}
              type="button"
              className="flex w-full gap-3 rounded-md border border-stroke-soft bg-bg-white p-3 text-left transition-colors hover:border-primary-base hover:bg-bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
              onClick={item.onSelect}
            >
              {content}
            </button>
          ) : (
            <div
              key={item.id}
              className="flex gap-3 rounded-md border border-stroke-soft bg-bg-white p-3"
            >
              {content}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
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
