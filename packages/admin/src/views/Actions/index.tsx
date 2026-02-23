import { DEFAULT_CHAIN_ID, formatDate, useActions } from "@green-goods/shared";
import { RiAddLine, RiCalendarLine, RiEditLine, RiEyeLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function Actions() {
  const { formatMessage } = useIntl();
  const { data: actions = [], isLoading } = useActions(DEFAULT_CHAIN_ID);

  const headerActions = (
    <Link
      to="/actions/create"
      className="inline-flex items-center rounded-md border border-transparent bg-primary-base px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary-base focus:ring-offset-2"
    >
      <RiAddLine className="mr-2 h-4 w-4" />
      {formatMessage({ id: "app.actions.create" })}
    </Link>
  );

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title={formatMessage({ id: "app.actions.title" })}
          description={formatMessage({ id: "app.actions.loading" })}
          actions={headerActions}
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 mt-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-stroke-soft bg-bg-white"
            >
              <div className="h-40 skeleton-shimmer" />
              <div className="p-6">
                <div className="h-6 skeleton-shimmer rounded mb-2" />
                <div className="h-4 skeleton-shimmer rounded w-3/4" />
              </div>
            </div>
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 mt-6">
        {actions.map((action, index) => (
          <Link
            key={action.id}
            to={`/actions/${action.id}`}
            data-testid="action-card"
            className="group overflow-hidden rounded-lg border border-stroke-soft bg-bg-white transition hover:border-primary-base hover:shadow-md opacity-0 animate-fade-in-up active:scale-[0.98]"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {action.media[0] && (
              <img src={action.media[0]} alt={action.title} className="w-full h-40 object-cover" />
            )}

            <div className="p-6">
              <h3 className="text-xl font-semibold text-text-strong mb-2 group-hover:text-primary-base">
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
        <div className="text-center py-12" role="status">
          <p className="text-text-sub mb-4">{formatMessage({ id: "app.actions.empty" })}</p>
          <Link
            to="/actions/create"
            className="inline-flex items-center text-primary-base hover:text-primary-darker"
          >
            <RiAddLine className="mr-1" />
            {formatMessage({ id: "app.actions.createFirst" })}
          </Link>
        </div>
      )}
    </div>
  );
}
