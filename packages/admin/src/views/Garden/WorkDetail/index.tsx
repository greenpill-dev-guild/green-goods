import { Alert, adminRoutes, useResolvedWorkDetail } from "@green-goods/shared";
import { RiCheckboxCircleLine, RiCloseLine, RiTimeLine } from "@remixicon/react";
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

type WorkDetailLayout = "page" | "sheet";

function parseHubContext(search: string) {
  const params = new URLSearchParams(search);
  const view = params.get("view");
  const sort = params.get("sort");

  return {
    gardenAddress: params.get("gardenAddress") ?? undefined,
    view:
      view === "work" || view === "assess" || view === "certify" || view === "history"
        ? view
        : undefined,
    sort: sort === "newest" || sort === "oldest" ? sort : undefined,
  } as const;
}

function WorkDetailStatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
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

  const config = statusConfig[status];
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
  const { formatMessage } = useIntl();
  const resolved = useResolvedWorkDetail(workId);
  const { garden, work, action, canReview, canApproveOrReject, isReviewed, metadata } = resolved;

  if (resolved.isLoading) {
    if (layout === "sheet") {
      return (
        <div className="space-y-4 p-1" aria-busy="true">
          <div className="h-48 animate-pulse rounded-2xl bg-bg-soft" />
          <div className="h-40 animate-pulse rounded-2xl bg-bg-soft" />
          <div className="h-56 animate-pulse rounded-2xl bg-bg-soft" />
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

  if (!work || !garden) {
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

  const sheetTopline = (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <WorkDetailStatusBadge status={work.status} />
      <span className="text-xs text-text-soft">
        {action?.title ?? work.title ?? formatMessage({ id: "app.work.detail.title" })}
      </span>
    </div>
  );

  if (layout === "sheet") {
    return (
      <div className="flex flex-col gap-4 p-1">
        {sheetTopline}
        <section className="surface-inset sm:p-6">
          <MediaEvidence
            media={work.media}
            audioNoteCids={resolved.audioNoteCids}
            actionTitle={action?.title}
          />
        </section>
        <SubmissionDetails
          work={work}
          gardenName={garden.name}
          actionTitle={action?.title}
          actionSlug={action?.slug}
          metadata={metadata}
        />
        <ReviewForm
          work={work}
          gardenName={garden.name}
          actionSlug={action?.slug}
          actionEndTime={action?.endTime}
          canReview={canReview}
          canApproveOrReject={canApproveOrReject}
          isReviewed={isReviewed}
          layout="sheet"
          onSuccess={onSuccess}
        />
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
              actionTitle={action?.title}
            />
          </section>

          <SubmissionDetails
            work={work}
            gardenName={garden.name}
            actionTitle={action?.title}
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
          onSuccess={onSuccess}
        />
      </div>
    </CanvasRouteContent>
  );
}

export default function WorkDetail() {
  const { workId } = useParams<{ workId: string }>();
  const { formatMessage } = useIntl();
  const resolved = useResolvedWorkDetail(workId);
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
          resolved.action?.title ??
          resolved.work?.title ??
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
