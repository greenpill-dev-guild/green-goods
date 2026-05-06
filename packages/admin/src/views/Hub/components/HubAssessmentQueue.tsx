import {
  Alert,
  EmptyState,
  EmptyStateShell,
  formatAddress,
  formatRelativeTime,
  resolveIPFSUrl,
  type Work,
  WorkbenchList,
  WorkbenchRow,
} from "@green-goods/shared";
import { RiFileList3Line } from "@remixicon/react";
import { useIntl } from "react-intl";
import { HubWorkbenchSkeletonRows } from "./HubWorkbenchSkeletonRows";

interface HubAssessmentQueueProps {
  items: Work[];
  worksLoading: boolean;
  hasDataError: boolean;
  actionsMap: Map<number, { title: string }>;
  selectedWorkId: string | undefined;
  onOpenWorkDetail: (workId: string) => void;
}

export function HubAssessmentQueue({
  items,
  worksLoading,
  hasDataError,
  actionsMap,
  selectedWorkId,
  onOpenWorkDetail,
}: HubAssessmentQueueProps) {
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

  if (worksLoading) {
    return <HubWorkbenchSkeletonRows count={5} />;
  }

  if (items.length === 0) {
    return (
      <EmptyStateShell>
        <EmptyState
          icon={<RiFileList3Line className="h-6 w-6" />}
          title={formatMessage({
            id: "cockpit.hub.assess.placeholder.title",
            defaultMessage: "Assessment pipeline",
          })}
          description={formatMessage({
            id: "cockpit.hub.assess.placeholder.description",
            defaultMessage: "Approved work will appear here for bundling into assessments.",
          })}
        />
      </EmptyStateShell>
    );
  }

  return (
    <WorkbenchList>
      {items.map((work) => {
        const actionTitle = actionsMap.get(work.actionUID)?.title;
        return (
          <WorkbenchRow
            key={work.id}
            eyebrow={formatMessage({ id: "cockpit.hub.tab.assess", defaultMessage: "Assess" })}
            title={
              work.title ||
              formatMessage({
                id: "app.admin.work.untitledWork",
                defaultMessage: "Untitled Work",
              })
            }
            description={
              actionTitle
                ? `${actionTitle} · ${formatAddress(work.gardenerAddress, { variant: "card" })}`
                : formatAddress(work.gardenerAddress, { variant: "card" })
            }
            // Garden name removed from meta — chrome already shows it (Rule 17).
            meta={[
              formatMessage({ id: "app.admin.work.filter.approved", defaultMessage: "Approved" }),
              formatRelativeTime(work.createdAt),
            ]}
            statusLabel={formatMessage({
              id: "app.admin.work.filter.approved",
              defaultMessage: "Approved",
            })}
            statusTone="approved"
            leadingIcon={RiFileList3Line}
            thumbnailSrc={work.media[0] ? `${resolveIPFSUrl(work.media[0])}?w=160&h=160` : null}
            selected={selectedWorkId === work.id}
            onClick={() => onOpenWorkDetail(work.id)}
          />
        );
      })}
    </WorkbenchList>
  );
}
