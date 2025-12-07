import { DEFAULT_CHAIN_ID } from "@green-goods/shared";
import { useActions } from "@green-goods/shared/hooks";
import { RiAddLine, RiCalendarLine, RiEditLine, RiEyeLine } from "@remixicon/react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function Actions() {
  const { data: actions = [], isLoading } = useActions(DEFAULT_CHAIN_ID);

  const headerActions = (
    <Link
      to="/actions/create"
      className="inline-flex items-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
    >
      <RiAddLine className="mr-2 h-4 w-4" />
      Create Action
    </Link>
  );

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Actions" description="Loading actions..." actions={headerActions} />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 mt-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-stroke-soft bg-bg-white p-6"
            >
              <div className="h-40 bg-bg-soft rounded mb-4" />
              <div className="h-6 bg-bg-soft rounded mb-2" />
              <div className="h-4 bg-bg-soft rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Actions"
        description={`${actions.length} action${actions.length !== 1 ? "s" : ""} available`}
        actions={headerActions}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 mt-6">
        {actions.map((action) => (
          <Link
            key={action.id}
            to={`/actions/${action.id}`}
            className="group rounded-lg border border-stroke-soft bg-bg-white p-6 transition hover:border-green-500 hover:shadow-md"
          >
            {action.media[0] && (
              <img
                src={action.media[0]}
                alt={action.title}
                className="w-full h-40 object-cover rounded mb-4"
              />
            )}

            <h3 className="text-xl font-semibold text-text-strong mb-2 group-hover:text-green-600">
              {action.title}
            </h3>

            <p className="text-sm text-text-sub mb-4 line-clamp-2">
              {action.description || "No description"}
            </p>

            <div className="flex items-center justify-between text-xs text-text-soft">
              <div className="flex items-center gap-1">
                <RiCalendarLine className="h-4 w-4" />
                <span>
                  {new Date(action.startTime).toLocaleDateString()} -{" "}
                  {new Date(action.endTime).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <RiEyeLine className="h-4 w-4" />
                <RiEditLine className="h-4 w-4" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {actions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-text-sub mb-4">No actions yet</p>
          <Link
            to="/actions/create"
            className="inline-flex items-center text-green-600 hover:text-green-700"
          >
            <RiAddLine className="mr-1" />
            Create your first action
          </Link>
        </div>
      )}
    </div>
  );
}
