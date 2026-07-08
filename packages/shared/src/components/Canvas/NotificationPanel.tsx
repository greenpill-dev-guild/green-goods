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

export interface NotificationPanelSection {
  id: string;
  title: string;
  items: NotificationPanelItem[];
}

export interface NotificationPanelProps {
  items?: NotificationPanelItem[];
  /**
   * Grouped rendering — actionable alerts vs. passive activity read as
   * different work, so the feed separates them ("Needs attention" / "Recent
   * activity"). Empty sections are skipped; when every section is empty the
   * panel falls back to the empty state.
   */
  sections?: NotificationPanelSection[];
  /**
   * Names the garden the feed is scoped to. The feed follows the selected
   * garden, and switching gardens silently changes it — the label keeps that
   * scoping honest.
   */
  scopeLabel?: string;
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

const ROW_CLASSES =
  "flex w-full gap-3 rounded-md border border-stroke-soft bg-bg-white-0 p-3 text-left";

function NotificationRow({ item }: { item: NotificationPanelItem }) {
  const { formatMessage } = useIntl();
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

  return item.onSelect ? (
    <button
      type="button"
      className={`${ROW_CLASSES} transition-colors hover:border-primary-base hover:bg-bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--tone-action,var(--green-800))))]`}
      onClick={item.onSelect}
      data-unread={item.unread ? "true" : "false"}
    >
      {iconBlock}
      {textBlock}
      {trailing}
    </button>
  ) : (
    <div className={ROW_CLASSES} data-unread={item.unread ? "true" : "false"}>
      {iconBlock}
      {textBlock}
      {trailing}
    </div>
  );
}

// Sentence-case label role per the admin dialog interior grammar (admin.mdx):
// section labels ride the label utilities, never ad-hoc uppercase tracking.
function SectionHeading({ title }: { title: string }) {
  return <h3 className="text-label-sm font-medium text-text-soft">{title}</h3>;
}

function SkeletonRow() {
  return (
    <div className={`${ROW_CLASSES} animate-pulse`} aria-hidden="true">
      <span className="flex h-9 w-9 shrink-0 rounded-full bg-bg-soft" />
      <span className="min-w-0 flex-1">
        <span className="block h-3 rounded bg-bg-soft" style={{ width: "60%" }} />
        <span className="mt-2 block h-3 rounded bg-bg-soft" style={{ width: "40%" }} />
      </span>
    </div>
  );
}

/**
 * Notification panel — rendered inside the notifications side sheet (desktop)
 * and its bottom-sheet presentation (mobile bell).
 *
 * Anatomy aligned to handoff `screens/sheet-system.{jsx,css}` NOTIFICATIONS:
 * - 36×36 colored icon wrapper per item
 * - Unread dot at top-right corner when `unread` is true
 * - Title 13/600, body 12/400, meta 11/500
 * - When `onSelect` + `actionLabel` are both set the row renders a labeled
 *   ghost-style action button on the right (handoff "Review" / "View"); if
 *   only `onSelect` is set we keep a quiet chevron affordance.
 * - Optional grouped sections with quiet sentence-case label headings, and an
 *   optional scope line naming the garden the feed follows.
 */
export function NotificationPanel({
  items = [],
  sections,
  scopeLabel,
  isLoading = false,
}: NotificationPanelProps) {
  const { formatMessage } = useIntl();

  const populatedSections = (sections ?? []).filter((section) => section.items.length > 0);
  const hasContent = populatedSections.length > 0 || items.length > 0;

  if (isLoading) {
    return (
      <SheetBody padded={true}>
        <div
          className="flex flex-col gap-3"
          role="status"
          aria-live="polite"
          aria-label={formatMessage({ id: "app.common.loading", defaultMessage: "Loading..." })}
        >
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </SheetBody>
    );
  }

  if (hasContent) {
    return (
      <SheetBody padded={true} className="flex flex-col gap-4">
        {scopeLabel ? <p className="text-xs text-text-sub">{scopeLabel}</p> : null}

        {populatedSections.length > 0
          ? populatedSections.map((section) => (
              <section key={section.id} className="flex flex-col gap-2">
                <SectionHeading title={section.title} />
                {section.items.map((item) => (
                  <NotificationRow key={item.id} item={item} />
                ))}
              </section>
            ))
          : items.map((item) => <NotificationRow key={item.id} item={item} />)}
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
