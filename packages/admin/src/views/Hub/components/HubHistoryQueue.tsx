import {
  Alert,
  cn,
  EmptyState,
  EmptyStateShell,
  formatDateTime,
  type ActivityEvent,
} from "@green-goods/shared";
import { useLocalizedRelativeTime } from "@green-goods/shared/hooks";
import {
  RiArrowRightLine,
  RiCheckboxCircleLine,
  RiFileList3Line,
  RiInboxLine,
  RiMedalLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { adminCardVariants } from "@/components/AdminCard";
import { localizeCanonicalActionTitle } from "../actionDisplay";
import { HubWorkbenchSkeletonRows } from "./HubWorkbenchSkeletonRows";

interface HubHistoryQueueProps {
  items: ActivityEvent[];
  worksLoading: boolean;
  fetchingAssessments: boolean;
  hypercertsLoading: boolean;
  allocationsLoading: boolean;
  hasDataError: boolean;
  selectedHistoryEventId: string | undefined;
  selectedWorkId: string | undefined;
  onOpenHistoryEvent: (event: ActivityEvent) => void;
}

export function HubHistoryQueue({
  items,
  worksLoading,
  fetchingAssessments,
  hypercertsLoading,
  allocationsLoading,
  hasDataError,
  selectedHistoryEventId,
  selectedWorkId,
  onOpenHistoryEvent,
}: HubHistoryQueueProps) {
  const { formatMessage } = useIntl();
  const formatEventAge = useLocalizedRelativeTime();

  if (hasDataError) {
    return (
      <EmptyStateShell>
        <Alert variant="error">
          {formatMessage({
            id: "cockpit.hub.error",
            defaultMessage: "Hub data could not be loaded. Refresh the workspace and try again.",
          })}
        </Alert>
      </EmptyStateShell>
    );
  }

  if (worksLoading || fetchingAssessments || hypercertsLoading || allocationsLoading) {
    return <HubWorkbenchSkeletonRows count={4} variant="card" />;
  }

  if (items.length === 0) {
    return (
      <EmptyStateShell>
        <EmptyState
          icon={<RiInboxLine className="h-6 w-6" />}
          title={formatMessage({
            id: "cockpit.work.section.history",
            defaultMessage: "Submission history",
          })}
          description={formatMessage({
            id: "cockpit.hub.history.description",
            defaultMessage:
              "Audit the recent work, impact, and community decisions tied to this garden.",
          })}
        />
      </EmptyStateShell>
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- hub-history-feed sets list-style:none + display:flex, which drop implicit list semantics; the explicit role restores them
    <ul className="hub-history-feed" role="list">
      {items.map((event) => {
        const LeadingIcon =
          event.category === "work"
            ? RiCheckboxCircleLine
            : event.category === "impact"
              ? RiFileList3Line
              : RiMedalLine;

        const categoryLabel =
          event.category === "work"
            ? formatMessage({ id: "cockpit.hub.tab.work", defaultMessage: "Work" })
            : event.category === "impact"
              ? formatMessage({ id: "cockpit.garden.impact", defaultMessage: "Impact" })
              : formatMessage({ id: "cockpit.nav.community", defaultMessage: "Community" });

        const selected =
          selectedHistoryEventId === event.id ||
          (selectedWorkId !== undefined && event.itemId === selectedWorkId);
        const exactTimestamp = formatDateTime(event.timestamp, {
          dateStyle: "medium",
          timeStyle: "short",
        });
        const localizedTitle = localizeCanonicalActionTitle(event.title, formatMessage);

        return (
          <li key={event.id} className="min-w-0">
            <button
              type="button"
              data-selected={selected ? "true" : "false"}
              onClick={() => onOpenHistoryEvent(event)}
              className={cn(
                adminCardVariants({ variant: "elevated", density: "none", interactive: true }),
                "hub-history-card group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 p-3 text-left",
                "outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--tone-primary,var(--primary-base))))] focus-visible:ring-offset-2"
              )}
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--m3-shape-md)] bg-bg-soft text-text-sub shadow-[var(--edge-rest)]">
                <LeadingIcon className="h-5 w-5" aria-hidden="true" />
              </span>

              <span className="hub-history-copy min-w-0 space-y-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex rounded-full bg-bg-soft px-2 py-0.5 text-label-sm font-medium text-text-sub shadow-[var(--edge-rest)]">
                    {categoryLabel}
                  </span>
                  <time
                    dateTime={new Date(event.timestamp).toISOString()}
                    title={exactTimestamp}
                    className="text-label-sm text-text-soft"
                  >
                    {formatEventAge(event.timestamp)}
                  </time>
                </span>

                <span className="block text-title-sm font-semibold leading-5 text-text-strong">
                  {localizedTitle}
                </span>
                <span className="block text-body-sm leading-5 text-text-sub">
                  {event.description}
                </span>
              </span>

              <span className="inline-flex shrink-0 pt-1 text-text-soft transition-colors group-hover:text-primary-dark">
                <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
