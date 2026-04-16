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
import {
  RiCheckboxCircleLine,
  RiInboxLine,
  RiSearchLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { HubWorkbenchSkeletonRows } from "./HubWorkbenchSkeletonRows";

interface HubWorkQueueProps {
  items: Work[];
  worksLoading: boolean;
  hasDataError: boolean;
  normalizedSearch: string;
  debouncedSearch: string;
  actionsMap: Map<number, { title: string }>;
  selectedGardenName: string | undefined;
  selectedWorkId: string | undefined;
  onOpenWorkDetail: (workId: string) => void;
  onClearSearch: () => void;
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
    return <HubWorkbenchSkeletonRows count={5} />;
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
    <WorkbenchList>
      {items.map((work) => {
        const actionTitle = actionsMap.get(work.actionUID)?.title;
        const gardenerDisplayName = formatAddress(work.gardenerAddress, { variant: "card" });
        return (
          <WorkbenchRow
            key={work.id}
            eyebrow={
              selectedGardenName ??
              formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" })
            }
            title={
              work.title ||
              formatMessage({
                id: "app.admin.work.untitledWork",
                defaultMessage: "Untitled Work",
              })
            }
            description={
              actionTitle ? `${actionTitle} · ${gardenerDisplayName}` : gardenerDisplayName
            }
            meta={[
              formatMessage({ id: "app.admin.work.filter.pending", defaultMessage: "Pending" }),
              formatRelativeTime(work.createdAt),
              `${work.media.length} media`,
            ]}
            statusLabel={formatMessage({
              id: "app.admin.work.filter.pending",
              defaultMessage: "Pending",
            })}
            statusTone="pending"
            leadingIcon={RiInboxLine}
            thumbnailSrc={work.media[0] ? `${resolveIPFSUrl(work.media[0])}?w=160&h=160` : null}
            selected={selectedWorkId === work.id}
            onClick={() => onOpenWorkDetail(work.id)}
          />
        );
      })}
    </WorkbenchList>
  );
}
