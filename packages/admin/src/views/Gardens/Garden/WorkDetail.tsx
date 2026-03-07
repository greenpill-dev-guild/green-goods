import {
  DEFAULT_CHAIN_ID,
  useActions,
  useGardenPermissions,
  useGardens,
  useWorks,
  type WorkMetadata,
} from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";

import { PageHeader } from "@/components/Layout/PageHeader";
import { MediaEvidence } from "@/components/Work/MediaEvidence";
import { WorkReviewPanel } from "@/components/Work/WorkReviewPanel";
import { WorkStatusBadge } from "@/components/Work/WorkStatusBadge";
import { WorkSubmissionDetails } from "@/components/Work/WorkSubmissionDetails";

type ReviewBlockReason = "operator" | "expired" | null;

function parseWorkMetadata(metadataStr: string): Partial<WorkMetadata> | null {
  try {
    return JSON.parse(metadataStr);
  } catch {
    return null;
  }
}

function getReviewBlockReason(params: {
  isReviewed: boolean;
  canReview: boolean;
  actionEndTime?: number;
  nowMs?: number;
}): ReviewBlockReason {
  const { isReviewed, canReview, actionEndTime, nowMs = Date.now() } = params;

  if (isReviewed) {
    return null;
  }

  if (!canReview) {
    return "operator";
  }

  if (typeof actionEndTime === "number" && actionEndTime <= nowMs) {
    return "expired";
  }

  return null;
}

export default function WorkDetail() {
  const { id: gardenId, workId } = useParams<{ id: string; workId: string }>();
  const { formatMessage } = useIntl();
  const gardenPermissions = useGardenPermissions();

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
  const reviewBlockReason = getReviewBlockReason({
    isReviewed,
    canReview,
    actionEndTime: action?.endTime,
  });

  const metadata = useMemo(
    () => (work?.metadata ? parseWorkMetadata(work.metadata) : null),
    [work?.metadata]
  );

  const audioNoteCids = metadata?.audioNoteCids;

  const baseHeaderProps = {
    backLink: {
      to: `/gardens/${gardenId}`,
      label: formatMessage({ id: "app.garden.admin.backToGarden" }),
    },
    sticky: true,
  } as const;

  const isLoading = gardensLoading || worksLoading;

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
          <div className="rounded-md border border-error-light bg-error-lighter p-4" role="alert">
            <p className="text-sm text-error-dark">
              {formatMessage({ id: "app.work.detail.notFound" })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.work.detail.reviewTitle" })}
        description={action?.title ?? work.title}
        metadata={<WorkStatusBadge status={work.status} />}
        {...baseHeaderProps}
      />

      <div className="mt-6 px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <section className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
              <MediaEvidence
                media={work.media}
                audioNoteCids={audioNoteCids}
                actionTitle={action?.title}
              />
            </section>

            <WorkSubmissionDetails
              work={work}
              garden={garden}
              action={action}
              metadata={metadata}
            />
          </div>

          {reviewBlockReason ? (
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-24">
                <section className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
                  <h3 className="text-base font-semibold text-text-strong">
                    {formatMessage({ id: "app.work.detail.operatorReview" })}
                  </h3>
                  <div
                    className="mt-4 rounded-lg border border-warning-light bg-warning-lighter p-4"
                    role="alert"
                  >
                    <p className="text-sm font-medium text-warning-dark">
                      {reviewBlockReason === "operator"
                        ? formatMessage({ id: "app.work.detail.reviewBlocked.operatorTitle" })
                        : formatMessage({ id: "app.work.detail.reviewBlocked.expiredTitle" })}
                    </p>
                    <p className="mt-1 text-sm text-warning-dark">
                      {reviewBlockReason === "operator"
                        ? formatMessage({ id: "app.work.detail.reviewBlocked.operatorMessage" })
                        : formatMessage({ id: "app.work.detail.reviewBlocked.expiredMessage" })}
                    </p>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <WorkReviewPanel
              work={work}
              gardenId={gardenId!}
              actionSlug={action?.slug}
              canReview={canReview}
              isReviewed={isReviewed}
            />
          )}
        </div>
      </div>
    </div>
  );
}
