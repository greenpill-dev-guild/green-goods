import {
  Alert,
  EmptyState,
  EmptyStateShell,
  formatRelativeTime,
  resolveIPFSUrl,
  type Work,
  useEnsName,
  WorkbenchList,
  WorkbenchRow,
} from "@green-goods/shared";
import { RiFileList3Line } from "@remixicon/react";
import { useIntl } from "react-intl";
import { formatEnsAddressName } from "@/components/EnsAddressText";
import { HubWorkbenchSkeletonRows } from "./HubWorkbenchSkeletonRows";

interface HubAssessmentQueueProps {
  items: Work[];
  worksLoading: boolean;
  hasDataError: boolean;
  actionsMap: Map<number, { title: string }>;
  selectedWorkId: string | undefined;
  onOpenWorkDetail: (workId: string) => void;
}

interface HubAssessmentQueueItemProps {
  work: Work;
  actionTitle?: string;
  selected: boolean;
  onOpenWorkDetail: (workId: string) => void;
}

function HubAssessmentQueueItem({
  work,
  actionTitle,
  selected,
  onOpenWorkDetail,
}: HubAssessmentQueueItemProps) {
  const { formatMessage } = useIntl();
  const { data: ensName } = useEnsName(work.gardenerAddress);
  const gardenerDisplayName = formatEnsAddressName(work.gardenerAddress, ensName);

  return (
    <WorkbenchRow
      eyebrow={formatMessage({ id: "cockpit.hub.tab.assess", defaultMessage: "Assess" })}
      title={
        work.title ||
        formatMessage({
          id: "app.admin.work.untitledWork",
          defaultMessage: "Untitled Work",
        })
      }
      description={actionTitle ? `${actionTitle} · ${gardenerDisplayName}` : gardenerDisplayName}
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
      selected={selected}
      onClick={() => onOpenWorkDetail(work.id)}
    />
  );
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
          <HubAssessmentQueueItem
            key={work.id}
            work={work}
            actionTitle={actionTitle}
            selected={selectedWorkId === work.id}
            onOpenWorkDetail={onOpenWorkDetail}
          />
        );
      })}
    </WorkbenchList>
  );
}
