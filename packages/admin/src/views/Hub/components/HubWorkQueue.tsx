import type { MediaCardLayout } from "@green-goods/shared/components/Cards/MediaCard";
import { Alert } from "@green-goods/shared/components/Alert";
import { EmptyStateShell } from "@green-goods/shared/components/Canvas/EmptyStateShell";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { HubWorkScope } from "@green-goods/shared/hooks/admin-ui/hub/hub.utils";
import type { HubActionSummary } from "@green-goods/shared/hooks/admin-ui/hub/hub.workbenchModel";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useMediaQuery } from "@green-goods/shared/hooks/ui/useMediaQuery";
import type { Work } from "@green-goods/shared/types/domain";
import { RiCheckboxCircleLine, RiSearchLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { formatEnsAddressName } from "@/components/EnsAddressText";
import { HubWorkbenchSkeletonRows } from "./HubWorkbenchSkeletonRows";
import { HubWorkCard } from "./HubWorkCard";

// What each scope says when it holds nothing. Pending empties as work gets
// reviewed; Approved fills from it.
const EMPTY_SCOPE_COPY: Record<
  HubWorkScope,
  {
    title: { id: string; defaultMessage: string };
    description: { id: string; defaultMessage: string };
  }
> = {
  pending: {
    title: { id: "cockpit.work.allCaughtUp", defaultMessage: "All caught up" },
    description: {
      id: "cockpit.work.allCaughtUpDescription",
      defaultMessage: "Work submitted to this garden waits here for review.",
    },
  },
  approved: {
    title: { id: "cockpit.work.noApproved", defaultMessage: "No approved work yet" },
    description: {
      id: "cockpit.work.noApprovedDescription",
      defaultMessage: "Work you approve moves here from Pending.",
    },
  },
};

interface HubWorkQueueProps {
  items: Work[];
  /** Which of the Work tab's scopes `items` holds: it decides the empty state. */
  scope: HubWorkScope;
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
  layout: MediaCardLayout;
  selected: boolean;
  eagerImages?: boolean;
  onOpenWorkDetail: (workId: string) => void;
}

function HubWorkQueueItem({
  work,
  actionSummary,
  selectedGardenName,
  layout,
  selected,
  eagerImages,
  onOpenWorkDetail,
}: HubWorkQueueItemProps) {
  const { formatMessage } = useIntl();
  const { data: ensName } = useEnsName(work.gardenerAddress);
  const { data: protocolName } = useGreenGoodsEnsName(work.gardenerAddress);
  const gardenerDisplayName = formatEnsAddressName(work.gardenerAddress, protocolName || ensName);

  return (
    <HubWorkCard
      work={work}
      actionDomain={actionSummary?.domain}
      actionTitle={actionSummary?.title}
      gardenName={
        selectedGardenName ?? formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" })
      }
      gardenerDisplayName={gardenerDisplayName}
      // The card reads its own state: a waiting card is a neutral Pending with
      // its age, since age is metadata and never an alarm (DL-044); an
      // approved card says Approved.
      layout={layout}
      selected={selected}
      eagerImages={eagerImages}
      onClick={() => onOpenWorkDetail(work.id)}
    />
  );
}

export function HubWorkQueue({
  items,
  scope,
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
  // From the cockpit's desktop breakpoint each card lies wide, its mosaic on
  // the left, and the grid holds two to a row at 1280px (F12).
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const cardLayout: MediaCardLayout = isDesktop ? "wide" : "stacked";

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
    return <HubWorkbenchSkeletonRows count={5} variant="media-card" layout={cardLayout} />;
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
          action={
            <AdminButton variant="text" size="sm" onClick={onClearSearch}>
              {formatMessage({
                id: "cockpit.hub.clearSearch",
                defaultMessage: "Clear Search",
              })}
            </AdminButton>
          }
        />
      </EmptyStateShell>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyStateShell>
        <EmptyState
          icon={<RiCheckboxCircleLine className="h-6 w-6" />}
          title={formatMessage(EMPTY_SCOPE_COPY[scope].title)}
          description={formatMessage(EMPTY_SCOPE_COPY[scope].description)}
        />
      </EmptyStateShell>
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- hub-workbench-grid sets list-style:none + display:grid, which drop implicit list semantics; the explicit role restores them
    <ul className="hub-workbench-grid" data-card-layout={cardLayout} role="list">
      {items.map((work, index) => {
        const actionSummary = actionsMap.get(work.actionUID);
        return (
          <li key={work.id} className="min-w-0">
            <HubWorkQueueItem
              work={work}
              actionSummary={actionSummary}
              selectedGardenName={selectedGardenName}
              layout={cardLayout}
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
