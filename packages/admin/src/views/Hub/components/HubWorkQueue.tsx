import {
  Alert,
  EmptyState,
  EmptyStateShell,
  type HubActionSummary,
  type Work,
  useEnsName,
} from "@green-goods/shared";
import { RiCheckboxCircleLine, RiSearchLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { formatEnsAddressName } from "@/components/EnsAddressText";
import { HubWorkCard } from "./HubWorkCard";
import { HubWorkbenchSkeletonRows } from "./HubWorkbenchSkeletonRows";

interface HubWorkQueueProps {
  items: Work[];
  worksLoading: boolean;
  hasDataError: boolean;
  normalizedSearch: string;
  debouncedSearch: string;
  actionsMap: Map<number, HubActionSummary>;
  selectedGardenName?: string;
  selectedWorkId: string | undefined;
  onOpenWorkDetail: (workId: string) => void;
  onClearSearch: () => void;
}

interface HubWorkQueueItemProps {
  work: Work;
  actionSummary?: HubActionSummary;
  selectedGardenName?: string;
  selected: boolean;
  eagerImages?: boolean;
  onOpenWorkDetail: (workId: string) => void;
}

function HubWorkQueueItem({
  work,
  actionSummary,
  selectedGardenName,
  selected,
  eagerImages,
  onOpenWorkDetail,
}: HubWorkQueueItemProps) {
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
        id: "app.admin.work.filter.pending",
        defaultMessage: "Pending",
      })}
      selected={selected}
      eagerImages={eagerImages}
      onClick={() => onOpenWorkDetail(work.id)}
    />
  );
}

export function HubWorkQueue({
  items,
  worksLoading,
  hasDataError,
  normalizedSearch,
  debouncedSearch,
  actionsMap,
  selectedGardenName,
  selectedWorkId,
  onOpenWorkDetail,
  onClearSearch,
}: HubWorkQueueProps) {
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

  if (normalizedSearch && items.length === 0) {
    return (
      <EmptyStateShell>
        <EmptyState
          icon={<RiSearchLine className="h-6 w-6" />}
          title={formatMessage(
            {
              id: "cockpit.hub.noResults",
              defaultMessage: 'No submissions matching "{query}"',
            },
            { query: debouncedSearch }
          )}
          action={{
            label: formatMessage({
              id: "cockpit.hub.clearSearch",
              defaultMessage: "Clear search",
            }),
            variant: "ghost",
            size: "sm",
            onClick: onClearSearch,
          }}
        />
      </EmptyStateShell>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyStateShell>
        <EmptyState
          icon={<RiCheckboxCircleLine className="h-6 w-6" />}
          title={formatMessage({
            id: "cockpit.work.allCaughtUp",
            defaultMessage: "All caught up",
          })}
          description={formatMessage({
            id: "cockpit.work.allCaughtUpDescription",
            defaultMessage: "No pending work items across your gardens.",
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
            <HubWorkQueueItem
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
