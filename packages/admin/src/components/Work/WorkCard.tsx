import {
  type EASWork,
  formatAddress,
  resolveIPFSUrl,
  WorkCardComponent as SharedWorkCard,
  type WorkCardData,
} from "@green-goods/shared";
import { RiCheckboxCircleLine, RiCloseLine } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

interface WorkCardProps {
  work: EASWork & { status?: "pending" | "approved" | "rejected" };
  canReview?: boolean;
}

export const WorkCard: React.FC<WorkCardProps> = ({ work, canReview }) => {
  const intl = useIntl();

  // Transform EASWork to WorkCardData for the shared component
  const workData: WorkCardData = {
    id: work.id,
    title:
      work.title ||
      intl.formatMessage({ id: "app.admin.work.untitledWork", defaultMessage: "Untitled Work" }),
    status: work.status || "pending",
    createdAt: work.createdAt,
    mediaPreview: work.media?.map((m) => resolveIPFSUrl(m)),
    gardenerAddress: work.gardenerAddress,
    gardenerDisplayName: formatAddress(work.gardenerAddress, { variant: "card" }),
    gardenAddress: work.gardenAddress,
    imageCount: work.media?.length,
    feedback: work.feedback,
  };

  return (
    <SharedWorkCard
      work={workData}
      variant="detailed"
      interactive={false}
      showGardener
      showMediaCount
      showFeedbackBadge
      labels={{
        untitledWork: intl.formatMessage({ id: "app.admin.work.untitledWork" }),
        error: intl.formatMessage({ id: "app.workCard.error" }),
        feedback: intl.formatMessage({ id: "app.workCard.feedback" }),
        status: {
          approved: intl.formatMessage({ id: "app.admin.work.filter.approved" }),
          rejected: intl.formatMessage({ id: "app.admin.work.filter.rejected" }),
          pending: intl.formatMessage({ id: "app.admin.work.filter.pending" }),
        },
        mediaPreviewAlt: intl.formatMessage({ id: "app.admin.work.mediaPreview" }),
        closePreview: intl.formatMessage({ id: "app.admin.work.closePreview" }),
      }}
      renderActions={() => (
        <div className="flex items-center gap-1.5">
          {work.status === "pending" && canReview && (
            <>
              <Link
                to={`/gardens/${work.gardenAddress}/work/${work.id}?action=approve`}
                className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-medium text-success-dark bg-success-lighter hover:bg-success-light transition-colors"
                aria-label={intl.formatMessage({
                  id: "app.admin.work.quickApprove",
                  defaultMessage: "Quick approve",
                })}
                onClick={(e) => e.stopPropagation()}
              >
                <RiCheckboxCircleLine className="h-3.5 w-3.5" />
              </Link>
              <Link
                to={`/gardens/${work.gardenAddress}/work/${work.id}?action=reject`}
                className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-medium text-error-dark bg-error-lighter hover:bg-error-light transition-colors"
                aria-label={intl.formatMessage({
                  id: "app.admin.work.quickReject",
                  defaultMessage: "Quick reject",
                })}
                onClick={(e) => e.stopPropagation()}
              >
                <RiCloseLine className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
          <Link
            to={`/gardens/${work.gardenAddress}/work/${work.id}`}
            className="inline-flex items-center text-xs font-medium text-primary-base hover:text-primary-darker transition-colors ml-auto"
          >
            {intl.formatMessage({
              id: "app.admin.work.viewDetails",
              defaultMessage: "View Details",
            })}
            <span className="ml-1" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      )}
    />
  );
};
