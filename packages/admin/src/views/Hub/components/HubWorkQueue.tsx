import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { Alert } from "@green-goods/shared/components/Alert";
import { EmptyStateShell } from "@green-goods/shared/components/Canvas/EmptyStateShell";
import { WorkCard } from "@green-goods/shared/components/Cards/WorkCard/WorkCard";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { HubWorkScope } from "@green-goods/shared/hooks/admin-ui/hub/hub.utils";
import type { HubActionSummary } from "@green-goods/shared/hooks/admin-ui/hub/hub.workbenchModel";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useMediaQuery } from "@green-goods/shared/hooks/ui/useMediaQuery";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import type { Work } from "@green-goods/shared/types/domain";
import { RiCheckboxCircleLine, RiSearchLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { formatEnsAddressName } from "@/components/EnsAddressText";
import { HubWorkbenchSkeletonRows } from "./HubWorkbenchSkeletonRows";
import { HubWorkCard } from "./HubWorkCard";
import { hubWorkTitle } from "./hubWorkTitle";

/**
 * A phone lists the queue as work rows (F7): it only chooses which work to open, and
 * about six 88px rows fit where two photo-grid cards would. From 600px it is the grid.
 */
const PHONE_QUERY = "(max-width: 599px)";
/** The phone's list: one column, 12px between rows. */
const PHONE_LIST_CLASS = "flex flex-col gap-(--gg-list-gap)";

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
  selected: boolean;
  eagerImages?: boolean;
  /** The phone's work row in place of the photo-grid card. */
  asRow: boolean;
  onOpenWorkDetail: (workId: string) => void;
}

function HubWorkQueueItem({
  work,
  actionSummary,
  selectedGardenName,
  selected,
  eagerImages,
  asRow,
  onOpenWorkDetail,
}: HubWorkQueueItemProps) {
  const { formatMessage } = useIntl();
  const { data: ensName } = useEnsName(work.gardenerAddress);
  const { data: protocolName } = useGreenGoodsEnsName(work.gardenerAddress);
  const gardenerDisplayName = formatEnsAddressName(work.gardenerAddress, protocolName || ensName);

  if (asRow) {
    const approved = work.status === "approved";
    const media = work.media ?? [];
    return (
      <WorkCard
        work={{
          id: work.id,
          title: hubWorkTitle(work.title, actionSummary?.title, formatMessage),
          status: work.status,
          createdAt: work.createdAt,
          mediaPreview: media.map((url) => resolveIPFSUrl(url)),
          gardenerDisplayName,
          imageCount: media.length,
        }}
        showGardener
        // As on the card: a waiting work is a neutral Pending, since its age is
        // metadata and never an alarm (DL-044); an approved one says Approved.
        statusLabel={
          approved
            ? formatMessage({ id: "app.admin.work.filter.approved", defaultMessage: "Approved" })
            : formatMessage({ id: "app.admin.work.filter.pending", defaultMessage: "Pending" })
        }
        statusTone={approved ? "success" : "neutral"}
        selected={selected}
        onClick={() => onOpenWorkDetail(work.id)}
      />
    );
  }

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
  const isPhone = useMediaQuery(PHONE_QUERY);

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
    // Loading keeps the loaded layout: rows on a phone, cards from 600px (DL-056).
    return isPhone ? (
      // eslint-disable-next-line jsx-a11y/no-redundant-roles -- list-style:none drops implicit list semantics in Safari; the explicit role restores them
      <ul className={PHONE_LIST_CLASS} role="list" aria-busy="true">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index}>
            <ItemRowSkeleton edge="neutral" />
          </li>
        ))}
      </ul>
    ) : (
      <HubWorkbenchSkeletonRows count={5} variant="media-card" />
    );
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
    <ul className={isPhone ? PHONE_LIST_CLASS : "hub-workbench-grid"} role="list">
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
              asRow={isPhone}
              onOpenWorkDetail={onOpenWorkDetail}
            />
          </li>
        );
      })}
    </ul>
  );
}
