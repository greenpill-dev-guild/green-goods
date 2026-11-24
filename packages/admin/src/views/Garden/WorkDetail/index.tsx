import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useResolvedWorkDetail } from "@green-goods/shared/hooks/admin-ui/garden/useResolvedWorkDetail";
import { trackWorkApprovalPresentationFailed } from "@green-goods/shared/modules/app/analytics-events";
import { logger } from "@green-goods/shared/modules/app/logger";
import type { Work, WorkDisplayStatus } from "@green-goods/shared/types/domain";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { toWorkDisplayTitle } from "@green-goods/shared/utils/work/workTitles";
import {
  RiCheckboxCircleLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiQuestionLine,
  RiSearchLine,
  RiTimeLine,
} from "@remixicon/react";
import { useCallback, useEffect, useRef } from "react";
import { useIntl } from "react-intl";
import { useLocation, useParams } from "react-router-dom";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";
import { CanvasRouteErrorState } from "@/components/Layout/CanvasRouteState";
import { MediaEvidence } from "@/views/Review/components/MediaEvidence";
import { ReviewForm } from "./ReviewForm";
import { SubmissionDetails } from "./SubmissionDetails";
import {
  localizeActionForDisplay,
  localizeCanonicalActionTitle,
} from "@/components/Action/actionDisplay";

type WorkDetailLayout = "page" | "sheet";

function parseReviewContext(search: string) {
  const params = new URLSearchParams(search);
  const view = params.get("view");
  const sort = params.get("sort");

  return {
    gardenId: params.get("gardenId") ?? params.get("gardenAddress") ?? undefined,
    view: view === "work" || view === "assess" || view === "certify" ? view : undefined,
    sort: sort === "newest" || sort === "oldest" ? sort : undefined,
  } as const;
}

function isDecided(work: Work) {
  return work.status === "approved" || work.status === "rejected";
}

function WorkDetailStatusBadge({
  status,
  statusUnread = false,
}: {
  status: WorkDisplayStatus;
  /** Its decisions could not be read: it says so, never Pending. */
  statusUnread?: boolean;
}) {
  const { formatMessage } = useIntl();

  const statusConfig = {
    pending: {
      label: formatMessage({ id: "app.work.status.pending" }),
      color: "bg-warning-lighter text-warning-dark",
      icon: RiTimeLine,
    },
    approved: {
      label: formatMessage({ id: "app.work.status.approved" }),
      color: "bg-success-lighter text-success-dark",
      icon: RiCheckboxCircleLine,
    },
    rejected: {
      label: formatMessage({ id: "app.work.status.rejected" }),
      color: "bg-error-lighter text-error-dark",
      icon: RiCloseLine,
    },
    unread: {
      label: formatMessage({
        id: "hub.garden.calendar.status.unknown",
        defaultMessage: "Status unread",
      }),
      color: "bg-bg-weak text-text-sub",
      icon: RiQuestionLine,
    },
  } as const;

  const displayStatus =
    status === "approved" || status === "rejected" ? status : statusUnread ? "unread" : "pending";
  const config = statusConfig[displayStatus];
  const StatusIcon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 type-label-sm ${config.color}`}
    >
      <StatusIcon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export interface WorkDetailPanelProps {
  workId: string;
  /**
   * Opened from a Review day whose read could not say this work's status, or has not yet. The
   * garden's own read can say so too; either holds the decision.
   */
  statusUnread?: boolean;
  /**
   * The work as a fresher read has it decided, such as the Review day it was opened from: it
   * outranks a garden copy that still says pending, so a decided work is never offered again.
   */
  decidedWork?: Work;
  layout?: WorkDetailLayout;
  onSuccess?: () => void;
}

export function WorkDetailPanel({
  workId,
  statusUnread: openedUnread = false,
  decidedWork,
  layout = "page",
  onSuccess,
}: WorkDetailPanelProps) {
  const { formatMessage, locale } = useIntl();
  const resolved = useResolvedWorkDetail(workId);
  const { garden, action, canReview, canApproveOrReject, metadata } = resolved;
  const decided =
    decidedWork && decidedWork.id === resolved.work?.id && isDecided(decidedWork)
      ? decidedWork
      : undefined;
  const work = decided ?? resolved.work;
  const isReviewed = Boolean(decided) || resolved.isReviewed;
  // Unread where it was opened (a day still being read), or in the garden's own read.
  const statusUnread = openedUnread || resolved.statusUnread;
  // The voice notes and documents come from the metadata file, read after the work itself.
  // Offline, the read waits for the connection and a retry cannot run, so it is not a failure.
  const evidenceState =
    resolved.metadataStatus === "loading"
      ? "loading"
      : resolved.metadataStatus === "unavailable"
        ? "offline"
        : resolved.metadataStatus === "error"
          ? "failed"
          : undefined;
  const resolutionStatusRef = useRef(resolved.resolutionStatus);
  useEffect(() => {
    resolutionStatusRef.current = resolved.resolutionStatus;
  }, [resolved.resolutionStatus]);

  const handleReviewSuccess = useCallback(
    (approved: boolean) => {
      const resolutionStatus = resolutionStatusRef.current;
      if (
        resolutionStatus === "loading" ||
        resolutionStatus === "not-found" ||
        resolutionStatus === "error"
      ) {
        trackWorkApprovalPresentationFailed({
          approved,
          failureReason: "detail-resolution",
          resolutionStatus,
        });
      }

      try {
        onSuccess?.();
      } catch (error) {
        logger.error("Post-success work inspector close failed", {
          errorName: error instanceof Error ? error.name : "UnknownError",
          source: "WorkDetail",
        });
        trackWorkApprovalPresentationFailed({
          approved,
          failureReason: "inspector-close",
          resolutionStatus,
        });
      }
    },
    [onSuccess]
  );

  if (resolved.isLoading) {
    if (layout === "sheet") {
      // Mirrors the loaded two-column structure so content lands in place.
      return (
        <div className="space-y-4 p-1" aria-busy="true" role="status">
          <span className="sr-only">{formatMessage({ id: "app.work.detail.loading" })}</span>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-3">
              <div className="h-48 animate-pulse rounded-2xl bg-bg-soft" />
              <div className="h-40 animate-pulse rounded-2xl bg-bg-soft" />
            </div>
            <div className="lg:col-span-2">
              <div className="h-72 animate-pulse rounded-2xl bg-bg-soft" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <CanvasRouteContent maxWidthClassName="max-w-6xl" className="mt-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <div className="h-64 animate-pulse rounded-lg bg-bg-soft" />
            <div className="h-32 animate-pulse rounded-lg bg-bg-soft" />
          </div>
          <div className="lg:col-span-2">
            <div className="h-96 animate-pulse rounded-lg bg-bg-soft" />
          </div>
        </div>
      </CanvasRouteContent>
    );
  }

  if (resolved.isError || resolved.isNotFound || !work || !garden) {
    // A missing work is announced as a failure too: the link named a work that is not there.
    const state = resolved.isError ? (
      <EmptyState
        tone="error"
        icon={<RiErrorWarningLine />}
        title={formatMessage({ id: "app.work.detail.loadError.title" })}
        description={formatMessage({ id: "app.work.detail.loadError.description" })}
      />
    ) : (
      <EmptyState
        tone="error"
        icon={<RiSearchLine />}
        title={formatMessage({ id: "app.work.detail.notFound" })}
      />
    );
    if (layout === "sheet") {
      return <div className="p-1">{state}</div>;
    }

    return (
      <CanvasRouteContent maxWidthClassName="max-w-6xl" className="mt-6">
        {state}
      </CanvasRouteContent>
    );
  }

  const displayAction = action
    ? localizeActionForDisplay(action, { formatMessage, locale })
    : undefined;
  // Action titles can carry generated stamps; show them without.
  const localizedActionTitle = toWorkDisplayTitle(displayAction?.title, "") || undefined;

  // The dialog title already names the work, so the topline carries only its status.
  const sheetTopline = (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <WorkDetailStatusBadge status={work.status} statusUnread={statusUnread} />
    </div>
  );

  if (layout === "sheet") {
    // Two-column inside the lg review dialog: evidence + submission facts on
    // the left, the decision form pinned in view on the right (mirrors the
    // page layout; stacks below lg — the dialog body is the scroll container,
    // so sticky offsets against it).
    return (
      <div className="flex flex-col gap-4 p-1">
        {sheetTopline}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-start">
          <div className="space-y-4 lg:col-span-3">
            <section className="surface-inset sm:p-6">
              <MediaEvidence
                media={work.media}
                audioNoteCids={resolved.audioNoteCids}
                documents={resolved.documents}
                evidenceState={evidenceState}
                onRetryEvidence={resolved.retryMetadata}
                actionTitle={localizedActionTitle}
              />
            </section>
            <SubmissionDetails
              work={work}
              gardenName={garden.name}
              actionTitle={localizedActionTitle}
              actionSlug={action?.slug}
              metadata={metadata}
            />
          </div>
          <div className="lg:sticky lg:top-0 lg:col-span-2">
            <ReviewForm
              work={work}
              gardenName={garden.name}
              actionSlug={action?.slug}
              actionEndTime={action?.endTime}
              canReview={canReview}
              canApproveOrReject={canApproveOrReject}
              isReviewed={isReviewed}
              statusUnread={statusUnread}
              layout="sheet"
              onSuccess={handleReviewSuccess}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <CanvasRouteContent maxWidthClassName="max-w-6xl" className="mt-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <section className="surface-inset sm:p-6">
            <MediaEvidence
              media={work.media}
              audioNoteCids={resolved.audioNoteCids}
              documents={resolved.documents}
              evidenceState={evidenceState}
              onRetryEvidence={resolved.retryMetadata}
              actionTitle={localizedActionTitle}
            />
          </section>

          <SubmissionDetails
            work={work}
            gardenName={garden.name}
            actionTitle={localizedActionTitle}
            actionSlug={action?.slug}
            metadata={metadata}
          />
        </div>

        <ReviewForm
          work={work}
          gardenName={garden.name}
          actionSlug={action?.slug}
          actionEndTime={action?.endTime}
          canReview={canReview}
          canApproveOrReject={canApproveOrReject}
          isReviewed={isReviewed}
          statusUnread={statusUnread}
          layout="page"
          onSuccess={handleReviewSuccess}
        />
      </div>
    </CanvasRouteContent>
  );
}

export default function WorkDetail() {
  const { workId } = useParams<{ workId: string }>();
  const { search } = useLocation();
  const { formatMessage, locale } = useIntl();
  const resolved = useResolvedWorkDetail(workId);
  const displayAction = resolved.action
    ? localizeActionForDisplay(resolved.action, { formatMessage, locale })
    : undefined;
  // Action titles can carry generated stamps; show them without.
  const localizedActionTitle = toWorkDisplayTitle(displayAction?.title, "") || undefined;
  const workTitle = toWorkDisplayTitle(resolved.work?.title, "");
  const localizedWorkTitle = workTitle
    ? localizeCanonicalActionTitle(workTitle, formatMessage)
    : undefined;
  // Review's filters come from the router, which says when they change. Read from
  // window.location while rendering they name no reactive value, so the compiled app would keep
  // the first work's filters for as long as this view stays mounted.
  const reviewContext = parseReviewContext(search);

  const baseHeaderProps = {
    backLink: {
      to: adminRoutes.review(reviewContext),
      label: formatMessage({ id: "hub.nav.review", defaultMessage: "Review" }),
    },
    sticky: true,
  } as const;

  if (!workId) {
    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          maxWidthClassName="max-w-6xl"
          title={formatMessage({ id: "app.work.detail.title" })}
          description={formatMessage({ id: "app.work.detail.notFoundDescription" })}
          {...baseHeaderProps}
        />
        <CanvasRouteErrorState
          message={formatMessage({ id: "app.work.detail.notFound" })}
          maxWidthClassName="max-w-6xl"
        />
      </CanvasRouteFrame>
    );
  }

  return (
    <CanvasRouteFrame>
      <CanvasRouteHeader
        maxWidthClassName="max-w-6xl"
        title={formatMessage({ id: "app.work.detail.reviewTitle" })}
        description={
          localizedActionTitle ??
          localizedWorkTitle ??
          formatMessage({ id: "app.work.detail.loadingDescription" })
        }
        metadata={
          resolved.work ? (
            <WorkDetailStatusBadge
              status={resolved.work.status}
              statusUnread={resolved.statusUnread}
            />
          ) : undefined
        }
        {...baseHeaderProps}
      />
      <WorkDetailPanel workId={workId} layout="page" />
    </CanvasRouteFrame>
  );
}
