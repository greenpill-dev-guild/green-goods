import { resolveIPFSUrl } from "@green-goods/shared/modules";
import { StatusBadge } from "@green-goods/shared/components";
import { formatRelativeTime } from "@green-goods/shared/utils";
import { RiImageLine, RiTimeLine, RiUserLine } from "@remixicon/react";
import { Link } from "react-router-dom";
import { AddressDisplay } from "@/components/UI/AddressDisplay";

interface WorkCardProps {
  work: Work;
}

export const WorkCard: React.FC<WorkCardProps> = ({ work }) => {
  return (
    <div className="work-card rounded-lg border border-stroke-soft bg-bg-weak p-3 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-4">
      <style>
        {`
          .work-card {
            display: grid;
            gap: 0.75rem;
            grid-template-areas:
              "thumbnail content"
              "actions actions";
            grid-template-columns: 3.5rem 1fr;
            grid-template-rows: auto auto;
          }
          
          @media (min-width: 640px) {
            .work-card {
              grid-template-columns: 4rem 1fr;
            }
          }
          
          .work-thumbnail { grid-area: thumbnail; }
          .work-content { grid-area: content; }
          .work-actions { grid-area: actions; }
        `}
      </style>

      {/* Thumbnail */}
      <div className="work-thumbnail h-14 w-14 overflow-hidden rounded-md bg-bg-soft sm:h-16 sm:w-16">
        {work.media?.[0] ? (
          <img
            src={resolveIPFSUrl(work.media[0])}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className={`flex h-full w-full items-center justify-center ${work.media?.[0] ? "hidden" : ""}`}
        >
          <RiImageLine className="h-6 w-6 text-text-disabled" />
        </div>
      </div>

      {/* Content */}
      <div className="work-content min-w-0">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h4 className="truncate text-sm font-medium text-text-strong">
            {work.title || "Untitled Work"}
          </h4>
          <StatusBadge status={work.status || "pending"} variant="semantic" />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-text-soft">
          <div className="flex items-center gap-1">
            <RiUserLine className="h-3 w-3" />
            <AddressDisplay address={work.gardenerAddress} showCopyButton={false} />
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <RiTimeLine className="h-3 w-3" />
            <span>{formatRelativeTime(work.createdAt)}</span>
          </div>
        </div>

        {work.metadata && (
          <p className="mt-2 line-clamp-2 text-xs text-text-sub">{work.metadata}</p>
        )}
      </div>

      {/* Actions */}
      <div className="work-actions flex items-center justify-between gap-2 border-t border-stroke-soft pt-3">
        <div className="flex items-center gap-2">
          {work.media && work.media.length > 1 && (
            <span className="text-xs text-text-soft">
              <RiImageLine className="inline h-3 w-3" /> {work.media.length}
            </span>
          )}
        </div>
        <Link
          to={`/gardens/${work.gardenAddress}/work/${work.id}`}
          className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium text-green-600 transition hover:bg-green-50 active:scale-95 sm:min-h-0 sm:px-0 sm:py-0 sm:hover:bg-transparent"
          aria-label={`View details for ${work.title || "work submission"}`}
        >
          <span className="sm:inline">View Details</span>
          <span className="ml-1" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </div>
  );
};
