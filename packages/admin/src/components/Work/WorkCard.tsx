import { WorkCard as SharedWorkCard, type WorkCardData } from "@green-goods/shared/components";
import { resolveIPFSUrl } from "@green-goods/shared/modules";
import { formatAddress } from "@green-goods/shared/utils";
import { Link } from "react-router-dom";

interface WorkCardProps {
  work: EASWork & { status?: "pending" | "approved" | "rejected" };
}

export const WorkCard: React.FC<WorkCardProps> = ({ work }) => {
  // Transform EASWork to WorkCardData for the shared component
  const workData: WorkCardData = {
    id: work.id,
    title: work.title || "Untitled Work",
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
          className="inline-flex items-center text-xs font-medium text-green-600 hover:text-green-700 transition-colors ml-auto"
        >
          View Details
          <span className="ml-1" aria-hidden="true">
            →
          </span>
        </Link>
      )}
    />
  );
};
