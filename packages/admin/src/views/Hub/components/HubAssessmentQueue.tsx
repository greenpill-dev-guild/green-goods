import {
  Alert,
  EmptyState,
  EmptyStateShell,
  type HubActionSummary,
  type Work,
  useEnsName,
} from "@green-goods/shared";
import { RiFileList3Line } from "@remixicon/react";
import { useIntl } from "react-intl";
import { formatEnsAddressName } from "@/components/EnsAddressText";
import { HubWorkCard } from "./HubWorkCard";
import { HubWorkbenchSkeletonRows } from "./HubWorkbenchSkeletonRows";

interface HubAssessmentQueueProps {
  items: Work[];
  worksLoading: boolean;
  hasDataError: boolean;
  actionsMap: Map<number, HubActionSummary>;
  selectedGardenName?: string;
  selectedWorkId: string | undefined;
  onOpenWorkDetail: (workId: string) => void;
}

interface HubAssessmentQueueItemProps {
  work: Work;
  actionSummary?: HubActionSummary;
  selectedGardenName?: string;
  selected: boolean;
  eagerImages?: boolean;
  onOpenWorkDetail: (workId: string) => void;
}

function HubAssessmentQueueItem({
  work,
  actionSummary,
  selectedGardenName,
  selected,
  eagerImages,
  onOpenWorkDetail,
}: HubAssessmentQueueItemProps) {
  const { formatMessage } = useIntl();
  const { data: ensName } = useEnsName(work.gardenerAddress);
  const gardenerDisplayName = formatEnsAddressName(work.gardenerAddress, ensName);

  return (
    <HubWorkCard
      work={work}
      actionDomain={actionSummary?.domain}
      actionTitle={actionSummary?.title}
      gardenName={
        selectedGardenName ?? formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" })
      }
      gardenerDisplayName={gardenerDisplayName}
      statusLabel={formatMessage({
        id: "app.admin.work.filter.approved",
        defaultMessage: "Approved",
      })}
      selected={selected}
      eagerImages={eagerImages}
      onClick={() => onOpenWorkDetail(work.id)}
    />
  );
}

export function HubAssessmentQueue({
  items,
  worksLoading,
  hasDataError,
  actionsMap,
  selectedGardenName,
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
    return <HubWorkbenchSkeletonRows count={5} variant="media-card" />;
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
    <ul className="hub-workbench-grid" role="list">
      {items.map((work, index) => {
        const actionSummary = actionsMap.get(work.actionUID);
        return (
          <li key={work.id} className="min-w-0">
            <HubAssessmentQueueItem
              work={work}
              actionSummary={actionSummary}
              selectedGardenName={selectedGardenName}
              selected={selectedWorkId === work.id}
              eagerImages={index < 6}
              onOpenWorkDetail={onOpenWorkDetail}
            />
          </li>
        );
      })}
    </ul>
  );
}
