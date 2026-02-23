import { DEFAULT_CHAIN_ID, formatDate, useActions } from "@green-goods/shared";
import {
  RiAddLine,
  RiCalendarLine,
  RiEditLine,
  RiEyeLine,
  RiFileList3Line,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/Layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Actions() {
  const { formatMessage } = useIntl();
  const { data: actions = [], isLoading } = useActions(DEFAULT_CHAIN_ID);

  const headerActions = (
    <Button asChild>
      <Link to="/actions/create">
        <RiAddLine className="mr-2 h-4 w-4" />
        {formatMessage({ id: "app.actions.create" })}
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title={formatMessage({ id: "app.actions.title" })}
          description={formatMessage({ id: "app.actions.loading" })}
          actions={headerActions}
        />
        <div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 mt-6 px-4 sm:px-6"
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">Loading actions</span>
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="h-40 skeleton-shimmer" style={{ animationDelay: `${i * 0.05}s` }} />
              <div className="p-6">
                <div
                  className="h-6 skeleton-shimmer rounded mb-2"
                  style={{ animationDelay: `${i * 0.05 + 0.05}s` }}
                />
                <div
                  className="h-4 skeleton-shimmer rounded w-3/4"
                  style={{ animationDelay: `${i * 0.05 + 0.1}s` }}
                />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={formatMessage({ id: "app.actions.title" })}
        description={formatMessage({ id: "app.actions.count" }, { count: actions.length })}
        actions={headerActions}
      />

      <div className="stagger-children grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 mt-6 px-4 sm:px-6">
        {actions.map((action) => (
          <Link
            key={action.id}
            to={`/actions/${action.id}`}
            data-testid="action-card"
            className="group overflow-hidden rounded-lg border border-stroke-soft bg-bg-white transition hover:border-primary-base hover:shadow-md active:scale-[0.98]"
          >
            {action.media[0] && (
              <img src={action.media[0]} alt={action.title} className="w-full h-40 object-cover" />
            )}

            <div className="p-6">
              <h3 className="font-heading text-xl font-semibold text-text-strong mb-2 group-hover:text-primary-base">
                {action.title}
              </h3>

              <p className="text-sm text-text-sub mb-4 line-clamp-2">
                {action.description || formatMessage({ id: "app.actions.noDescription" })}
              </p>

              <div className="flex items-center justify-between text-xs text-text-soft">
                <div className="flex items-center gap-1">
                  <RiCalendarLine className="h-4 w-4" />
                  <span>
                    {formatDate(action.startTime)} - {formatDate(action.endTime)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <RiEyeLine className="h-4 w-4" />
                  <RiEditLine className="h-4 w-4" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {actions.length === 0 && (
        <EmptyState
          icon={<RiFileList3Line className="h-6 w-6" />}
          title={formatMessage({ id: "app.actions.empty" })}
          action={{
            label: formatMessage({ id: "app.actions.createFirst" }),
            onClick: () => {
              window.location.href = "/actions/create";
            },
          }}
        />
      )}
    </div>
  );
}
