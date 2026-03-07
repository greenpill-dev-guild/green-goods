import { ErrorBoundary, type Work } from "@green-goods/shared";
import { useIntl } from "react-intl";

import { WorkReviewForm } from "@/components/Work/WorkReviewForm";
import { WorkReviewSummary } from "@/components/Work/WorkReviewSummary";

interface WorkReviewPanelProps {
  work: Work;
  gardenId: string;
  actionSlug?: string;
  canReview: boolean;
  isReviewed: boolean;
}

export function WorkReviewPanel({
  work,
  gardenId,
  actionSlug,
  canReview,
  isReviewed,
}: WorkReviewPanelProps): React.ReactNode {
  const { formatMessage } = useIntl();

  function renderContent(): React.ReactNode {
    if (isReviewed) {
      return <WorkReviewSummary work={work} />;
    }

    if (canReview) {
      return <WorkReviewForm work={work} gardenId={gardenId} actionSlug={actionSlug} />;
    }

    return (
      <p className="mt-4 text-sm text-text-soft">
        {formatMessage({ id: "app.work.detail.noPermission" })}
      </p>
    );
  }

  return (
    <div className="lg:col-span-2">
      <div className="lg:sticky lg:top-24">
        <ErrorBoundary context="WorkDetail.ReviewForm">
          <section className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
            <h3 className="text-base font-semibold text-text-strong">
              {isReviewed
                ? formatMessage({ id: "app.work.detail.reviewSummary" })
                : formatMessage({ id: "app.work.detail.operatorReview" })}
            </h3>
            {renderContent()}
          </section>
        </ErrorBoundary>
      </div>
    </div>
  );
}
