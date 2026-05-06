import {
  Alert,
  EmptyState,
  EmptyStateShell,
  formatRelativeTime,
  WorkbenchList,
  WorkbenchRow,
  type ActivityEvent,
} from "@green-goods/shared";
import { RiCheckboxCircleLine, RiFileList3Line, RiInboxLine, RiMedalLine } from "@remixicon/react";
import { useIntl } from "react-intl";
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
    return <HubWorkbenchSkeletonRows count={4} />;
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
    <WorkbenchList>
      {items.map((event) => {
        const leadingIcon =
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

        return (
          <WorkbenchRow
            key={event.id}
            eyebrow={categoryLabel}
            title={event.title}
            description={event.description}
            meta={[formatRelativeTime(event.timestamp)]}
            statusLabel={categoryLabel}
            statusTone="history"
            leadingIcon={leadingIcon}
            selected={selectedHistoryEventId === event.id || selectedWorkId === event.itemId}
            onClick={() => onOpenHistoryEvent(event)}
          />
        );
      })}
    </WorkbenchList>
  );
}
