import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { EmptyStateShell } from "@green-goods/shared/components/Canvas/EmptyStateShell";
import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import type { MediaCardLayout } from "@green-goods/shared/components/Cards/MediaCard";
import { WorkCard } from "@green-goods/shared/components/Cards/WorkCard/WorkCard";
import { TxHoldFeedback } from "@green-goods/shared/components/feedback/TxInlineFeedback";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { HubWorkScope } from "@green-goods/shared/hooks/admin-ui/hub/hub.utils";
import type {
  HubActionSummary,
  HubOlderRecords,
} from "@green-goods/shared/hooks/admin-ui/hub/hub.workbenchModel";
import { useAddressDisplayName } from "@green-goods/shared/hooks/ens/useAddressDisplayName";
import { useMediaQuery } from "@green-goods/shared/hooks/ui/useMediaQuery";
import type { ReviewBatch } from "@green-goods/shared/hooks/work/useWorkApproval";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import type { Work } from "@green-goods/shared/types/domain";
import { RiCheckboxCircleLine, RiErrorWarningLine, RiSearchLine } from "@remixicon/react";
import { type IntlShape, useIntl } from "react-intl";
import { HubReviewBatchBar } from "./HubReviewBatchBar";
import { HubShowOlder, HubShowOlderButton } from "./HubShowOlder";
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

// While older work is not loaded, a scope that finds nothing in the newest page
// cannot say the garden has none, so it names where it looked instead.
const EMPTY_RECENT_SCOPE_TITLE: Record<HubWorkScope, { id: string; defaultMessage: string }> = {
  pending: { id: "cockpit.work.noRecentPending", defaultMessage: "Nothing pending in recent work" },
  approved: {
    id: "cockpit.work.noRecentApproved",
    defaultMessage: "Nothing approved in recent work",
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
  /** The steward's unsent decisions for this garden: chips on the list, a bar beneath it. */
  reviewBatch?: ReviewBatch;
  /** The garden's next page of older work, while it has more than the list holds. */
  older?: HubOlderRecords;
}

/** What a decision waiting on this work says in place of its status. Always a word and a color. */
interface ReviewChip {
  label: string;
  tone: "success" | "warning" | "error";
}

function reviewChipFor(
  reviewBatch: ReviewBatch | undefined,
  workId: string,
  formatMessage: IntlShape["formatMessage"]
): ReviewChip | undefined {
  if (reviewBatch?.isHeld(workId)) {
    return { label: formatMessage({ id: "app.work.batch.chip.checking" }), tone: "warning" };
  }
  const staged = reviewBatch?.reviewFor(workId);
  if (!staged) return undefined;
  if (staged.confirmed) {
    return {
      label: formatMessage({
        id: staged.draft.approved ? "app.admin.work.filter.approved" : "app.work.status.rejected",
      }),
      tone: staged.draft.approved ? "success" : "error",
    };
  }
  if (staged.refusal) {
    return { label: formatMessage({ id: "app.work.batch.chip.blocked" }), tone: "error" };
  }
  return staged.draft.approved
    ? { label: formatMessage({ id: "app.work.batch.chip.approve" }), tone: "success" }
    : { label: formatMessage({ id: "app.work.batch.chip.reject" }), tone: "error" };
}

interface HubWorkQueueItemProps {
  work: Work;
  actionSummary?: HubActionSummary;
  selectedGardenName?: string;
  layout: MediaCardLayout;
  selected: boolean;
  eagerImages?: boolean;
  /** The phone's work row in place of the photo-grid card. */
  asRow: boolean;
  reviewChip?: ReviewChip;
  onOpenWorkDetail: (workId: string) => void;
}

function HubWorkQueueItem({
  work,
  actionSummary,
  selectedGardenName,
  layout,
  selected,
  eagerImages,
  asRow,
  reviewChip,
  onOpenWorkDetail,
}: HubWorkQueueItemProps) {
  const { formatMessage } = useIntl();
  const { display: gardenerDisplayName } = useAddressDisplayName(work.gardenerAddress, {
    list: true,
  });

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
          reviewChip?.label ??
          (approved
            ? formatMessage({ id: "app.admin.work.filter.approved", defaultMessage: "Approved" })
            : formatMessage({ id: "app.admin.work.filter.pending", defaultMessage: "Pending" }))
        }
        statusTone={reviewChip?.tone ?? (approved ? "success" : "neutral")}
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
        selectedGardenName ?? formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Review" })
      }
      gardenerDisplayName={gardenerDisplayName}
      // The card reads its own state: a waiting card is a neutral Pending with
      // its age, since age is metadata and never an alarm (DL-044); an
      // approved card says Approved. A decision waiting on it says so instead.
      statusLabel={reviewChip?.label}
      statusTone={reviewChip?.tone}
      layout={layout}
      selected={selected}
      eagerImages={eagerImages}
      onClick={() => onOpenWorkDetail(work.id)}
    />
  );
}

export function HubWorkQueue(props: HubWorkQueueProps) {
  const { reviewBatch } = props;
  const { formatMessage } = useIntl();
  return (
    <>
      {reviewBatch?.holdFeedback ? <TxHoldFeedback {...reviewBatch.holdFeedback} /> : null}
      {props.hasDataError && props.items.length > 0 ? (
        <Alert variant="error" title={formatMessage({ id: "cockpit.hub.error.title" })}>
          {formatMessage({ id: "cockpit.hub.error.description" })}
        </Alert>
      ) : null}
      <HubWorkQueueList {...props} />
      {reviewBatch ? (
        <HubReviewBatchBar batch={reviewBatch} gardenName={props.selectedGardenName} />
      ) : null}
    </>
  );
}

function HubWorkQueueList({
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
  reviewBatch,
  older,
}: HubWorkQueueProps) {
  const { formatMessage } = useIntl();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const olderLabel = formatMessage({
    id: "cockpit.hub.work.showOlder",
    defaultMessage: "Show Older Work",
  });
  const olderNotLoaded = formatMessage({
    id: "cockpit.hub.work.olderNotLoaded",
    defaultMessage: "Older work isn't loaded yet.",
  });
  // From the cockpit's desktop breakpoint each card lies wide, its mosaic on
  // the left, and the grid holds two to a row at 1280px (F12).
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const cardLayout: MediaCardLayout = isDesktop ? "wide" : "stacked";

  if (hasDataError && items.length === 0) {
    return (
      <EmptyStateShell>
        <EmptyState
          tone="error"
          icon={<RiErrorWarningLine />}
          title={formatMessage({
            id: "cockpit.hub.error.title",
            defaultMessage: "Review data could not be loaded",
          })}
          description={formatMessage({
            id: "cockpit.hub.error.description",
            defaultMessage: "Refresh the workspace and try again.",
          })}
          // Without loaded work, the retry belongs in the empty error state.
          action={
            older?.onShowOlder ? <HubShowOlderButton older={older} label={olderLabel} /> : undefined
          }
        />
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
      <HubWorkbenchSkeletonRows count={5} variant="media-card" layout={cardLayout} />
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
          description={older ? olderNotLoaded : undefined}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {older ? <HubShowOlderButton older={older} label={olderLabel} /> : null}
              <Button type="button" emphasis="tertiary" size="compact" onClick={onClearSearch}>
                {formatMessage({
                  id: "cockpit.hub.clearSearch",
                  defaultMessage: "Clear Search",
                })}
              </Button>
            </div>
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
          title={formatMessage(
            older ? EMPTY_RECENT_SCOPE_TITLE[scope] : EMPTY_SCOPE_COPY[scope].title
          )}
          description={older ? olderNotLoaded : formatMessage(EMPTY_SCOPE_COPY[scope].description)}
          action={
            older?.onShowOlder ? <HubShowOlderButton older={older} label={olderLabel} /> : undefined
          }
        />
      </EmptyStateShell>
    );
  }

  return (
    <>
      <ul
        className={isPhone ? PHONE_LIST_CLASS : "hub-workbench-grid"}
        data-card-layout={cardLayout}
        // eslint-disable-next-line jsx-a11y/no-redundant-roles -- hub-workbench-grid sets list-style:none + display:grid, which drop implicit list semantics; the explicit role restores them
        role="list"
      >
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
                asRow={isPhone}
                reviewChip={reviewChipFor(reviewBatch, work.id, formatMessage)}
                onOpenWorkDetail={onOpenWorkDetail}
              />
            </li>
          );
        })}
      </ul>
      {older ? <HubShowOlder older={older} label={olderLabel} notLoaded={olderNotLoaded} /> : null}
    </>
  );
}
