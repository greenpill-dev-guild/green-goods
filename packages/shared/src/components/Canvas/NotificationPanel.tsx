import {
  RiArrowRightSLine,
  RiErrorWarningLine,
  RiInboxLine,
  RiInformationLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { SheetBody } from "./SheetBody";

export type NotificationPanelTone = "info" | "warn" | "critical";

export interface NotificationPanelItem {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  tone?: NotificationPanelTone;
  /** When true, render a small "unread" dot at the top-right of the icon wrapper. */
  unread?: boolean;
  /** Optional explicit label for the action button — e.g. "Review", "View". */
  actionLabel?: string;
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
 * Notification panel — rendered inside the account/notification AdminDialog inspector.
 *
 * Anatomy aligned to handoff `screens/sheet-system.{jsx,css}` NOTIFICATIONS:
 * - 36×36 colored icon wrapper per item
 * - Unread dot at top-right corner when `unread` is true
 * - Title 13/600, body 12/400, meta 11/500
 * - When `onSelect` + `actionLabel` are both set the row renders a labeled
 *   ghost-style action button on the right (handoff "Review" / "View"); if
 *   only `onSelect` is set we keep a quiet chevron affordance.
 */
export function NotificationPanel({ items = [], isLoading = false }: NotificationPanelProps) {
  const { formatMessage } = useIntl();

  if (isLoading) {
    return (
      <SheetBody padded={true}>
        <div className="flex flex-col gap-6">
          <div
            className="flex min-h-40 items-center justify-center text-sm text-text-sub"
            role="status"
            aria-live="polite"
          >
            {formatMessage({ id: "app.common.loading", defaultMessage: "Loading..." })}
          </div>
        </div>
      </SheetBody>
    );
  }

  if (items.length > 0) {
    return (
      <SheetBody padded={true} className="flex flex-col gap-3">
        {items.map((item) => {
          const tone = TONE_CLASSES[item.tone ?? "info"];
          const Icon = tone.icon;
          const showActionButton = Boolean(item.onSelect && item.actionLabel);

          const iconBlock = (
            <span
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone.container}`}
              aria-hidden="true"
            >
              <Icon className={`h-4 w-4 ${tone.iconClassName}`} />
              {item.unread ? (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-bg-white-0"
                  style={{ background: "rgb(var(--tone-action, var(--green-800)))" }}
                  aria-label={formatMessage({
                    id: "cockpit.notifications.unread",
                    defaultMessage: "Unread",
                  })}
                />
              ) : null}
            </span>
          );

          const textBlock = (
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold leading-tight text-text-strong">
                {item.title}
              </span>
              {item.description ? (
                <span className="mt-1 block text-xs font-normal leading-5 text-text-sub">
                  {item.description}
                </span>
              ) : null}
              {item.meta ? (
                <span className="mt-1.5 block text-[11px] font-medium tabular-nums text-text-soft">
                  {item.meta}
                </span>
              ) : null}
            </span>
          );

          const trailing = showActionButton ? (
            <span
              className="ml-auto inline-flex shrink-0 items-center gap-0.5 self-start rounded-full px-2 py-1 text-[11px] font-semibold"
              style={{ color: "rgb(var(--tone-action, var(--green-800)))" }}
            >
              {item.actionLabel}
              <RiArrowRightSLine className="h-3 w-3" />
            </span>
          ) : item.onSelect ? (
            <RiArrowRightSLine className="ml-auto mt-1 h-4 w-4 shrink-0 text-text-soft" />
          ) : null;

          const rowClasses =
            "flex w-full gap-3 rounded-md border border-stroke-soft bg-bg-white-0 p-3 text-left";

          return item.onSelect ? (
            <button
              key={item.id}
              type="button"
              className={`${rowClasses} transition-colors hover:border-primary-base hover:bg-bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-action,var(--green-800)))]`}
              onClick={item.onSelect}
              data-unread={item.unread ? "true" : "false"}
            >
              {iconBlock}
              {textBlock}
              {trailing}
            </button>
          ) : (
            <div key={item.id} className={rowClasses} data-unread={item.unread ? "true" : "false"}>
              {iconBlock}
              {textBlock}
              {trailing}
            </div>
          );
        })}
      </SheetBody>
    );
  }

  return (
    <SheetBody padded={true}>
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
    </SheetBody>
  );
}
