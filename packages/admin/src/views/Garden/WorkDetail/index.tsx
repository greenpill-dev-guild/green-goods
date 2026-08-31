import { Alert } from "@green-goods/shared/components/Alert";
import { useResolvedWorkDetail } from "@green-goods/shared/hooks/admin-ui/garden/useResolvedWorkDetail";
import { trackWorkApprovalPresentationFailed } from "@green-goods/shared/modules/app/analytics-events";
import { logger } from "@green-goods/shared/modules/app/logger";
import type { WorkDisplayStatus } from "@green-goods/shared/types/domain";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiCheckboxCircleLine, RiCloseLine, RiTimeLine } from "@remixicon/react";
import { useCallback, useEffect, useRef } from "react";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";
import { CanvasRouteErrorState } from "@/components/Layout/CanvasRouteState";
import { MediaEvidence } from "@/views/Hub/components/MediaEvidence";
import { ReviewForm } from "./ReviewForm";
import { SubmissionDetails } from "./SubmissionDetails";
import { localizeActionForDisplay, localizeCanonicalActionTitle } from "@/views/Hub/actionDisplay";

type WorkDetailLayout = "page" | "sheet";

function parseHubContext(search: string) {
  const params = new URLSearchParams(search);
  const view = params.get("view");
  const sort = params.get("sort");

  return {
    gardenId: params.get("gardenId") ?? params.get("gardenAddress") ?? undefined,
    view: view === "work" || view === "assess" || view === "certify" ? view : undefined,
    sort: sort === "newest" || sort === "oldest" ? sort : undefined,
  } as const;
}

function WorkDetailStatusBadge({ status }: { status: WorkDisplayStatus }) {
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
  } as const;

  const displayStatus = status === "approved" || status === "rejected" ? status : "pending";
  const config = statusConfig[displayStatus];
  const StatusIcon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}
    >
      <StatusIcon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export interface WorkDetailPanelProps {
  workId: string;
  layout?: WorkDetailLayout;
  onSuccess?: () => void;
}

export function WorkDetailPanel({ workId, layout = "page", onSuccess }: WorkDetailPanelProps) {
  const { formatMessage, locale } = useIntl();
  const resolved = useResolvedWorkDetail(workId);
  const { garden, work, action, canReview, canApproveOrReject, isReviewed, metadata } = resolved;
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

  if (resolved.isError) {
    const message = formatMessage({ id: "app.work.detail.loadError" });
    if (layout === "sheet") {
      return (
        <div className="p-1">
          <Alert variant="error">{message}</Alert>
        </div>
      );
    }

    return (
      <CanvasRouteContent maxWidthClassName="max-w-6xl" className="mt-6">
        <Alert variant="error">{message}</Alert>
      </CanvasRouteContent>
    );
  }

  if (resolved.isNotFound || !work || !garden) {
    if (layout === "sheet") {
      return (
        <div className="p-1">
          <Alert variant="error">{formatMessage({ id: "app.work.detail.notFound" })}</Alert>
        </div>
      );
    }

    return (
      <CanvasRouteContent maxWidthClassName="max-w-6xl" className="mt-6">
        <Alert variant="error">{formatMessage({ id: "app.work.detail.notFound" })}</Alert>
      </CanvasRouteContent>
    );
  }

  const displayAction = action
    ? localizeActionForDisplay(action, { formatMessage, locale })
    : undefined;
  const localizedActionTitle = displayAction?.title;
  const localizedWorkTitle = work.title
    ? localizeCanonicalActionTitle(work.title, formatMessage)
    : undefined;

  const sheetTopline = (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <WorkDetailStatusBadge status={work.status} />
      <span className="text-xs text-text-soft">
        {localizedActionTitle ??
          localizedWorkTitle ??
          formatMessage({ id: "app.work.detail.title" })}
      </span>
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
          layout="page"
          onSuccess={handleReviewSuccess}
        />
      </div>
    </CanvasRouteContent>
  );
}

export default function WorkDetail() {
  const { workId } = useParams<{ workId: string }>();
  const { formatMessage, locale } = useIntl();
  const resolved = useResolvedWorkDetail(workId);
  const displayAction = resolved.action
    ? localizeActionForDisplay(resolved.action, { formatMessage, locale })
    : undefined;
  const localizedActionTitle = displayAction?.title;
  const localizedWorkTitle = resolved.work?.title
    ? localizeCanonicalActionTitle(resolved.work.title, formatMessage)
    : undefined;
  const hubContext =
    typeof window === "undefined" ? undefined : parseHubContext(window.location.search);

  const baseHeaderProps = {
    backLink: {
      to: adminRoutes.hub(hubContext),
      label: formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" }),
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
          resolved.work ? <WorkDetailStatusBadge status={resolved.work.status} /> : undefined
        }
        {...baseHeaderProps}
      />
      <WorkDetailPanel workId={workId} layout="page" />
    </CanvasRouteFrame>
  );
}
