import { useWorks } from "@green-goods/shared";
import { RiCheckboxCircleLine, RiCloseLine, RiFileList3Line, RiTimeLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { WorkCard } from "./WorkCard";

interface WorkSubmissionsViewProps {
  gardenId: string;
  canManage?: boolean;
}

type FilterType = "all" | "pending" | "approved" | "rejected";

export const WorkSubmissionsView: React.FC<WorkSubmissionsViewProps> = ({ gardenId }) => {
  const intl = useIntl();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const { works, isLoading } = useWorks(gardenId);

  // Filter works based on active filter
  // Status is now computed by useWorks hook from approvals
  const filteredWorks = works.filter((work) => {
    if (activeFilter === "all") return true;
    return work.status === activeFilter;
  });

  const filterButtons: Array<{ id: FilterType; label: string; icon: React.ReactNode }> = [
    {
      id: "all",
      label: intl.formatMessage({ id: "admin.work.filter.all", defaultMessage: "All" }),
      icon: <RiFileList3Line className="h-4 w-4" />,
    },
    {
      id: "pending",
      label: intl.formatMessage({ id: "admin.work.filter.pending", defaultMessage: "Pending" }),
      icon: <RiTimeLine className="h-4 w-4" />,
    },
    {
      id: "approved",
      label: intl.formatMessage({ id: "admin.work.filter.approved", defaultMessage: "Approved" }),
      icon: <RiCheckboxCircleLine className="h-4 w-4" />,
    },
    {
      id: "rejected",
      label: intl.formatMessage({ id: "admin.work.filter.rejected", defaultMessage: "Rejected" }),
      icon: <RiCloseLine className="h-4 w-4" />,
    },
  ];

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <Card.Header className="flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-medium text-text-strong sm:text-lg">
            {intl.formatMessage({
              id: "admin.work.submissions.title",
              defaultMessage: "Work Submissions",
            })}
          </h3>
          <p className="mt-1 text-sm text-text-soft">
            {filteredWorks.length} {activeFilter !== "all" ? activeFilter : ""} submission
            {filteredWorks.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {filterButtons.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition active:scale-95 sm:min-h-0 sm:px-3 sm:py-1.5 ${
                activeFilter === filter.id
                  ? "bg-primary-alpha-16 text-primary-darker"
                  : "bg-bg-soft text-text-sub hover:bg-bg-sub"
              }`}
              // eslint-disable-next-line jsx-a11y/aria-proptypes
              aria-label={`Filter by ${filter.label}`}
              aria-pressed={activeFilter === filter.id}
            >
              <span className="flex-shrink-0">{filter.icon}</span>
              <span className="whitespace-nowrap">{filter.label}</span>
            </button>
          ))}
        </div>
      </Card.Header>

      {/* Work Grid */}
      <Card.Body>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2" role="status" aria-live="polite">
            <span className="sr-only">
              {intl.formatMessage({
                id: "admin.work.submissions.title",
                defaultMessage: "Loading submissions",
              })}
            </span>
            {[...Array(4)].map((_, i) => (
              <Card key={i} padding="compact">
                <div className="flex items-start gap-3">
                  <div
                    className="h-10 w-10 rounded-lg skeleton-shimmer"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                  <div className="flex-1 space-y-2">
                    <div
                      className="h-4 w-3/4 rounded skeleton-shimmer"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                    <div
                      className="h-3 w-1/2 rounded skeleton-shimmer"
                      style={{ animationDelay: `${i * 0.1 + 0.05}s` }}
                    />
                    <div
                      className="h-3 w-1/3 rounded skeleton-shimmer"
                      style={{ animationDelay: `${i * 0.1 + 0.1}s` }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredWorks.length === 0 ? (
          <EmptyState
            icon={<RiFileList3Line className="h-6 w-6" />}
            title={intl.formatMessage({
              id: "admin.work.submissions.empty",
              defaultMessage: "No work submissions found",
            })}
            description={
              activeFilter === "all"
                ? intl.formatMessage({
                    id: "admin.work.submissions.empty.all",
                    defaultMessage:
                      "Work submissions will appear here once gardeners start contributing.",
                  })
                : intl.formatMessage(
                    {
                      id: "admin.work.submissions.empty.filtered",
                      defaultMessage: "No {filter} work submissions yet.",
                    },
                    { filter: activeFilter }
                  )
            }
          />
        ) : (
          <div className="work-cards-grid grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredWorks.map((work) => (
              <WorkCard key={work.id} work={work} />
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};
