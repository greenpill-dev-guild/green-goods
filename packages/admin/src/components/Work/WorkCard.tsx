import {
  WorkCardComponent as SharedWorkCard,
  type WorkCardData,
  type EASWork,
  resolveIPFSUrl,
  formatAddress,
} from "@green-goods/shared";
import type React from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

interface WorkCardProps {
  work: EASWork & { status?: "pending" | "approved" | "rejected" };
}

export const WorkCard: React.FC<WorkCardProps> = ({ work }) => {
  const intl = useIntl();

  // Transform EASWork to WorkCardData for the shared component
  const workData: WorkCardData = {
    id: work.id,
    title: work.title || intl.formatMessage({ id: "app.admin.work.untitledWork", defaultMessage: "Untitled Work" }),
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
      renderActions={() => (
        <Link
          to={`/gardens/${work.gardenAddress}/work/${work.id}`}
          className="inline-flex items-center text-xs font-medium text-primary-base hover:text-primary-darker transition-colors ml-auto"
        >
          {intl.formatMessage({ id: "app.admin.work.viewDetails", defaultMessage: "View Details" })}
          <span className="ml-1" aria-hidden="true">
            →
          </span>
        </Link>
      )}
    />
  );
};
