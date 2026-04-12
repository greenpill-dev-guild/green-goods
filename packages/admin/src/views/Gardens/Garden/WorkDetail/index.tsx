import {
  Alert,
  DEFAULT_CHAIN_ID,
  adminRoutes,
  useAdminStore,
  useActions,
  useGardenPermissions,
  useGardens,
  useWorks,
} from "@green-goods/shared";
import { RiCheckboxCircleLine, RiCloseLine, RiTimeLine } from "@remixicon/react";
import { useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";
import { MediaEvidence } from "@/views/Hub/components/MediaEvidence";
import { parseWorkMetadata } from "./helpers";
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

function useResolvedWorkDetail(workId: string | undefined) {
  const gardenPermissions = useGardenPermissions();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const setSelectedGarden = useAdminStore((state) => state.setSelectedGarden);
  const selectedGardenId = selectedGarden?.id ?? null;

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const matchedGarden = useMemo(
    () =>
      workId
        ? (gardens.find((garden) =>
            garden.works?.some((candidateWork) => candidateWork.id === workId)
          ) ?? null)
        : null,
    [gardens, workId]
  );
  const gardenId = matchedGarden?.id ?? selectedGardenId;
  const garden =
    gardens.find((candidateGarden) => candidateGarden.id === gardenId) ?? matchedGarden;

  const { works, isLoading: worksLoading } = useWorks(gardenId ?? "");
  const work =
    works.find((candidateWork) => candidateWork.id === workId) ??
    matchedGarden?.works?.find((candidateWork) => candidateWork.id === workId);

  const { data: actions = [] } = useActions(DEFAULT_CHAIN_ID);
  const action = useMemo(
    () => actions.find((candidateAction) => work && Number(candidateAction.id) === work.actionUID),
    [actions, work]
  );

  const canReview = garden ? gardenPermissions.canReviewGarden(garden) : false;
  const canApproveOrReject = garden
    ? gardenPermissions.isOperatorOfGarden(garden) || gardenPermissions.isOwnerOfGarden(garden)
    : false;
  const isReviewed = work?.status === "approved" || work?.status === "rejected";

  useEffect(() => {
    if (matchedGarden && matchedGarden.id !== selectedGardenId) {
      setSelectedGarden(matchedGarden);
    }
  }, [matchedGarden, selectedGardenId, setSelectedGarden]);

  const metadata = useMemo(
    () => (work?.metadata ? parseWorkMetadata(work.metadata) : null),
    [work?.metadata]
  );

  return {
    garden,
    gardenId,
    work,
    action,
    canReview,
    canApproveOrReject,
    isReviewed,
    metadata,
    audioNoteCids: metadata?.audioNoteCids,
    isLoading: gardensLoading || (gardenId ? worksLoading : false),
  };
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
      <div className="mt-6 px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <div className="h-64 animate-pulse rounded-lg bg-bg-soft" />
            <div className="h-32 animate-pulse rounded-lg bg-bg-soft" />
          </div>
          <div className="lg:col-span-2">
            <div className="h-96 animate-pulse rounded-lg bg-bg-soft" />
          </div>
        </div>
      </div>
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
      <div className="mt-6 px-4 sm:px-6">
        <Alert variant="error">{formatMessage({ id: "app.work.detail.notFound" })}</Alert>
      </div>
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
    <div className="mt-6 px-4 sm:px-6">
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
    </div>
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
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.work.detail.title" })}
          description={formatMessage({ id: "app.work.detail.notFoundDescription" })}
          {...baseHeaderProps}
        />
        <div className="mt-6 px-4 sm:px-6">
          <Alert variant="error">{formatMessage({ id: "app.work.detail.notFound" })}</Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <PageHeader
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
    </div>
  );
}
