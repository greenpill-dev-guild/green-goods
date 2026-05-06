import {
  type AdminHubRouteContext,
  Card,
  cn,
  EmptyState,
  formatRelativeTime,
  useWorks,
  type Work,
} from "@green-goods/shared";
import {
  RiCheckboxCircleLine,
  RiCloseLine,
  RiFileList3Line,
  RiRefreshLine,
  RiTimeLine,
} from "@remixicon/react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { WorkCard } from "./WorkCard";

interface WorkSubmissionsViewProps {
  gardenId: string;
  canManage?: boolean;
  canReview?: boolean;
  works?: Work[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  lastUpdatedAt?: number;
  initialFilter?: FilterType;
  highlightWorkId?: string;
  hubContext?: AdminHubRouteContext;
}

type FilterType = "all" | "pending" | "approved" | "rejected";

export const WorkSubmissionsView: React.FC<WorkSubmissionsViewProps> = ({
  gardenId,
  canManage,
  canReview,
  works: worksProp,
  isLoading: isLoadingProp,
  isRefreshing: isRefreshingProp,
  onRefresh,
  lastUpdatedAt,
  initialFilter = "pending",
  highlightWorkId,
  hubContext,
}) => {
  const intl = useIntl();
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialFilter);
  const hasExternalDataControl =
    worksProp !== undefined ||
    isLoadingProp !== undefined ||
    isRefreshingProp !== undefined ||
    onRefresh !== undefined;

  const worksQuery = useWorks(hasExternalDataControl ? "" : gardenId);
  const works = worksProp ?? worksQuery.works;
  const isLoading = isLoadingProp ?? worksQuery.isLoading;
  const isRefreshing = isRefreshingProp ?? worksQuery.isFetching;

  useEffect(() => {
    setActiveFilter(initialFilter);
  }, [initialFilter]);

  const refreshSubmissions = () => {
    if (onRefresh) {
      onRefresh();
      return;
    }

    if (!hasExternalDataControl) {
      void worksQuery.refetch();
    }
  };

  const filteredWorks = works.filter((work) => {
    if (activeFilter === "all") return true;
    return work.status === activeFilter;
  });

  const filterButtons: Array<{ id: FilterType; label: string; icon: React.ReactNode }> = [
    {
      id: "all",
      label: intl.formatMessage({ id: "app.admin.work.filter.all" }),
      icon: <RiFileList3Line className="h-4 w-4" />,
    },
    {
      id: "pending",
      label: intl.formatMessage({ id: "app.admin.work.filter.pending" }),
      icon: <RiTimeLine className="h-4 w-4" />,
    },
    {
      id: "approved",
      label: intl.formatMessage({ id: "app.admin.work.filter.approved" }),
      icon: <RiCheckboxCircleLine className="h-4 w-4" />,
    },
    {
      id: "rejected",
      label: intl.formatMessage({ id: "app.admin.work.filter.rejected" }),
      icon: <RiCloseLine className="h-4 w-4" />,
    },
  ];

  return (
    <Card className="overflow-hidden min-h-[20rem]">
      <Card.Header className="flex-col items-start gap-3 sm:gap-4">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="label-md text-text-strong sm:text-lg">
              {intl.formatMessage({ id: "app.admin.work.submissions.title" })}
            </h3>
            <p className="mt-1 text-sm text-text-soft">
              {intl.formatMessage(
                { id: "app.admin.work.submissions.summary" },
                {
                  count: filteredWorks.length,
                  status:
                    activeFilter === "all"
                      ? intl.formatMessage({ id: "app.admin.work.filter.all" })
                      : intl.formatMessage({ id: `app.admin.work.filter.${activeFilter}` }),
                }
              )}
            </p>
            {lastUpdatedAt ? (
              <p className="mt-1 text-xs text-text-soft">
                {intl.formatMessage(
                  { id: "app.admin.work.submissions.lastUpdated" },
                  { when: formatRelativeTime(lastUpdatedAt) }
                )}
              </p>
            ) : null}
          </div>

          <ButtonRefresh
            canManage={canManage}
            isRefreshing={isRefreshing}
            onRefresh={refreshSubmissions}
            label={intl.formatMessage({ id: "app.garden.detail.action.refresh" })}
          />
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={intl.formatMessage({ id: "app.admin.work.filterGroup" })}
        >
          {filterButtons.map((filter) => (
            <AdminButton
              key={filter.id}
              type="button"
              variant={activeFilter === filter.id ? "tonal" : "text"}
              size="sm"
              onClick={() => setActiveFilter(filter.id)}
              className="min-h-[44px] sm:min-h-0"
              aria-label={intl.formatMessage(
                { id: "app.admin.work.filterBy" },
                { filter: filter.label }
              )}
              aria-pressed={activeFilter === filter.id}
              leadingIcon={filter.icon}
            >
              <span className="whitespace-nowrap">{filter.label}</span>
            </AdminButton>
          ))}
        </div>
      </Card.Header>

      <Card.Body>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2" role="status" aria-live="polite">
            <span className="sr-only">
              {intl.formatMessage({ id: "app.admin.work.submissions.title" })}
            </span>
            {[...Array(4)].map((_, i) => (
              <Card key={i} padding="compact">
                <div className="space-y-2">
                  <div
                    className="h-24 rounded-lg skeleton-shimmer"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  />
                  <div className="space-y-2">
                    <div
                      className="h-4 w-3/4 rounded skeleton-shimmer"
                      style={{ animationDelay: `${i * 0.08 + 0.04}s` }}
                    />
                    <div
                      className="h-3 w-1/2 rounded skeleton-shimmer"
                      style={{ animationDelay: `${i * 0.08 + 0.08}s` }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredWorks.length === 0 ? (
          <EmptyState
            icon={<RiFileList3Line className="h-6 w-6" />}
            title={intl.formatMessage({ id: "app.admin.work.submissions.empty" })}
            description={
              activeFilter === "all"
                ? intl.formatMessage({ id: "app.admin.work.submissions.empty.all" })
                : intl.formatMessage(
                    { id: "app.admin.work.submissions.empty.filtered" },
                    { filter: intl.formatMessage({ id: `app.admin.work.filter.${activeFilter}` }) }
                  )
            }
          />
        ) : (
          <div className="work-cards-grid grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredWorks.map((work) => (
              <div
                key={work.id}
                className={cn(
                  "rounded-lg transition-shadow",
                  highlightWorkId === work.id && "ring-1 ring-primary-base shadow-sm"
                )}
              >
                <WorkCard work={work} canReview={canReview} hubContext={hubContext} />
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

interface ButtonRefreshProps {
  canManage?: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  label: string;
}

function ButtonRefresh({ canManage, isRefreshing, onRefresh, label }: ButtonRefreshProps) {
  if (canManage === false) {
    return null;
  }

  return (
    <AdminButton
      type="button"
      variant="outlined"
      size="sm"
      onClick={onRefresh}
      disabled={isRefreshing}
      leadingIcon={<RiRefreshLine className={isRefreshing ? "animate-spin" : ""} />}
    >
      {label}
    </AdminButton>
  );
}
