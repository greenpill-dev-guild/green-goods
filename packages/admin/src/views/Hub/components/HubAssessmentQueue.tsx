import { Alert } from "@green-goods/shared/components/Alert";
import { EmptyStateShell } from "@green-goods/shared/components/Canvas/EmptyStateShell";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { HubActionSummary } from "@green-goods/shared/hooks/admin-ui/hub/hub.workbenchModel";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import type { Work } from "@green-goods/shared/types/domain";
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
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- hub-workbench-grid sets list-style:none + display:grid, which drop implicit list semantics; the explicit role restores them
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
