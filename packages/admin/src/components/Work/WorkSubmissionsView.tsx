import { getWorks } from "@green-goods/shared/modules";
import { RiCheckboxCircleLine, RiCloseLine, RiFileList3Line, RiTimeLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { WorkCard } from "./WorkCard";

interface WorkSubmissionsViewProps {
  gardenId: string;
  canManage?: boolean;
}

type FilterType = "all" | "pending" | "approved" | "rejected";

export const WorkSubmissionsView: React.FC<WorkSubmissionsViewProps> = ({ gardenId }) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const { data: works = [], isLoading } = useQuery({
    queryKey: ["works", gardenId],
    queryFn: () => getWorks(gardenId),
    staleTime: 30_000,
  });

  // Filter works based on active filter
  const filteredWorks = works.filter((work) => {
    if (activeFilter === "all") return true;
    return (work.status || "pending") === activeFilter;
  });

  const filterButtons: Array<{ id: FilterType; label: string; icon: React.ReactNode }> = [
    { id: "all", label: "All", icon: <RiFileList3Line className="h-4 w-4" /> },
    { id: "pending", label: "Pending", icon: <RiTimeLine className="h-4 w-4" /> },
    { id: "approved", label: "Approved", icon: <RiCheckboxCircleLine className="h-4 w-4" /> },
    { id: "rejected", label: "Rejected", icon: <RiCloseLine className="h-4 w-4" /> },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-stroke-soft bg-bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-stroke-soft p-4 sm:gap-4 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-medium text-text-strong sm:text-lg">Work Submissions</h3>
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
                  ? "bg-green-100 text-green-700"
                  : "bg-bg-soft text-text-sub hover:bg-bg-sub"
              }`}
              aria-label={`Filter by ${filter.label}`}
              aria-pressed={activeFilter === filter.id}
            >
              <span className="flex-shrink-0">{filter.icon}</span>
              <span className="whitespace-nowrap">{filter.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Work Grid */}
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg bg-bg-soft" />
            ))}
          </div>
        ) : filteredWorks.length === 0 ? (
          <div className="py-12 text-center">
            <RiFileList3Line className="mx-auto h-12 w-12 text-text-soft" />
            <h4 className="mt-4 text-sm font-medium text-text-strong">No work submissions found</h4>
            <p className="mt-1 text-sm text-text-soft">
              {activeFilter === "all"
                ? "Work submissions will appear here once gardeners start contributing."
                : `No ${activeFilter} work submissions yet.`}
            </p>
          </div>
        ) : (
          <div className="work-cards-grid grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredWorks.map((work) => (
              <WorkCard key={work.id} work={work} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
