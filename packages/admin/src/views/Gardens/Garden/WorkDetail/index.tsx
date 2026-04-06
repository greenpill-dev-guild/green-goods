import {
  DEFAULT_CHAIN_ID,
  useActions,
  useGardenPermissions,
  useGardens,
  useWorks,
} from "@green-goods/shared";
import { RiCheckboxCircleLine, RiCloseLine, RiTimeLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { MediaEvidence } from "@/components/Work/MediaEvidence";
import { parseWorkMetadata } from "./helpers";
import { ReviewForm } from "./ReviewForm";
import { SubmissionDetails } from "./SubmissionDetails";

// ─────────────────────────────────────────────────────────────
// View
// ─────────────────────────────────────────────────────────────

export default function WorkDetail() {
  const { id: gardenId, workId } = useParams<{ id: string; workId: string }>();
  const { formatMessage } = useIntl();
  const gardenPermissions = useGardenPermissions();

  // Fetch garden, work, and actions data
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((g) => g.id === gardenId);

  const { works, isLoading: worksLoading } = useWorks(gardenId ?? "");
  const work = works.find((w) => w.id === workId);

  const { data: actions = [] } = useActions(DEFAULT_CHAIN_ID);
  const action = useMemo(
    () => actions.find((a) => work && Number(a.id) === work.actionUID),
    [actions, work]
  );

  const canReview = garden ? gardenPermissions.canReviewGarden(garden) : false;
  const isReviewed = work?.status === "approved" || work?.status === "rejected";

  // Parse metadata for additional details
  const metadata = useMemo(
    () => (work?.metadata ? parseWorkMetadata(work.metadata) : null),
    [work?.metadata]
  );

  // Audio note CIDs from work metadata
  const audioNoteCids = metadata?.audioNoteCids;

  // ─────────────────────────────────────────────────────────────
  // Loading / Error states
  // ─────────────────────────────────────────────────────────────

  const isLoading = gardensLoading || worksLoading;

  const baseHeaderProps = {
    backLink: {
      to: `/gardens/${gardenId}`,
      label: formatMessage({ id: "app.garden.admin.backToGarden" }),
    },
    sticky: true,
  } as const;

  if (isLoading) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.work.detail.loading" })}
          description={formatMessage({ id: "app.work.detail.loadingDescription" })}
          {...baseHeaderProps}
        />
        <div className="mt-6 px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3 space-y-4">
              <div className="h-64 animate-pulse rounded-lg bg-bg-soft" />
              <div className="h-32 animate-pulse rounded-lg bg-bg-soft" />
            </div>
            <div className="lg:col-span-2">
              <div className="h-96 animate-pulse rounded-lg bg-bg-soft" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!work || !garden) {
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

  // ─────────────────────────────────────────────────────────────
  // Status badge
  // ─────────────────────────────────────────────────────────────

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
  };

  const status = statusConfig[work.status];
  const StatusIcon = status.icon;

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.work.detail.reviewTitle" })}
        description={action?.title ?? work.title}
        metadata={
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}
          >
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
        }
        {...baseHeaderProps}
      />

      <div className="mt-6 px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* ─── Left column: Evidence + Details (scrollable) ─── */}
          <div className="space-y-4 lg:col-span-3">
            {/* Media Evidence */}
            <section className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
              <MediaEvidence
                media={work.media}
                audioNoteCids={audioNoteCids}
                actionTitle={action?.title}
              />
            </section>

            {/* Submission Details */}
            <SubmissionDetails
              work={work}
              gardenName={garden.name}
              actionTitle={action?.title}
              actionSlug={action?.slug}
              metadata={metadata}
            />
          </div>

          {/* ─── Right column: Review Form (sticky on desktop) ─── */}
          <ReviewForm
            work={work}
            gardenId={gardenId!}
            gardenName={garden.name}
            actionSlug={action?.slug}
            canReview={canReview}
            isReviewed={isReviewed}
          />
        </div>
      </div>
    </div>
  );
}
