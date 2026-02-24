import {
  DEFAULT_CHAIN_ID,
  Domain,
  formatDate,
  type ActionFiltersState,
  useFilteredActions,
} from "@green-goods/shared";
import { cn } from "@green-goods/shared/utils";
import { useActions } from "@green-goods/shared/hooks";
import { RiAddLine, RiCalendarLine, RiEditLine, RiEyeLine, RiFileListLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { SortSelect } from "@/components/ui/SortSelect";

const DOMAIN_TAGS: { value: Domain; label: string; activeClass: string }[] = [
  {
    value: Domain.SOLAR,
    label: "Solar",
    activeClass: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  {
    value: Domain.AGRO,
    label: "Agro",
    activeClass: "bg-green-100 text-green-800 border-green-300",
  },
  { value: Domain.EDU, label: "Edu", activeClass: "bg-blue-100 text-blue-800 border-blue-300" },
  {
    value: Domain.WASTE,
    label: "Waste",
    activeClass: "bg-orange-100 text-orange-800 border-orange-300",
  },
];

export default function Actions() {
  const intl = useIntl();
  const { data: actions = [], isLoading } = useActions(DEFAULT_CHAIN_ID);
  const [filters, setFilters] = useState<ActionFiltersState>({ sort: "default" });

  const { filteredActions } = useFilteredActions(actions, filters);

  const toggleDomain = (domain: Domain) => {
    setFilters((prev) => ({
      ...prev,
      domain: prev.domain === domain ? undefined : domain,
    }));
  };

  const resetFilters = () => setFilters({ sort: "default" });

  const sortOptions = [
    {
      value: "default" as const,
      label: intl.formatMessage({ id: "admin.actions.sort.default", defaultMessage: "Default" }),
    },
    {
      value: "title" as const,
      label: intl.formatMessage({ id: "admin.actions.sort.title", defaultMessage: "Title" }),
    },
    {
      value: "recent" as const,
      label: intl.formatMessage({ id: "admin.actions.sort.recent", defaultMessage: "Recent" }),
    },
  ];

  const showToolbar = !isLoading && actions.length > 0;

  const description = isLoading
    ? intl.formatMessage({ id: "admin.actions.loading" })
    : intl.formatMessage(
        {
          id: "admin.actions.description",
          defaultMessage: "{count} {count, plural, one {action} other {actions}} available",
        },
        { count: actions.length }
      );

  return (
    <div className="pb-6">
      <PageHeader
        title="Actions"
        description={description}
        sticky
        actions={
          <Button size="sm" asChild>
            <Link to="/actions/create">
              <RiAddLine className="mr-1.5 h-4 w-4" />
              Create Action
            </Link>
          </Button>
        }
        toolbar={
          showToolbar ? (
            <div className="space-y-3">
              <ListToolbar
                search={filters.search ?? ""}
                onSearchChange={(value) =>
                  setFilters((prev) => ({ ...prev, search: value || undefined }))
                }
                searchPlaceholder={intl.formatMessage({
                  id: "admin.actions.searchPlaceholder",
                  defaultMessage: "Search actions...",
                })}
              >
                <SortSelect
                  value={filters.sort}
                  onChange={(value) => setFilters((prev) => ({ ...prev, sort: value }))}
                  options={sortOptions}
                />
              </ListToolbar>

              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label={intl.formatMessage({
                  id: "admin.actions.filterByDomain",
                  defaultMessage: "Filter by domain",
                })}
              >
                {DOMAIN_TAGS.map((tag) => {
                  const isActive = filters.domain === tag.value;
                  return (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() => toggleDomain(tag.value)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        isActive
                          ? tag.activeClass
                          : "border-stroke-soft bg-bg-white text-text-sub hover:bg-bg-soft"
                      )}
                      aria-pressed={isActive}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : undefined
        }
      />

      <div className="mt-6 space-y-6 px-4 sm:px-6">
        {isLoading && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse overflow-hidden rounded-lg border border-stroke-soft bg-bg-white"
              >
                <div className="h-40 bg-bg-soft" />
                <div className="p-6">
                  <div className="h-6 bg-bg-soft rounded mb-2" />
                  <div className="h-4 bg-bg-soft rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && actions.length === 0 && (
          <EmptyState
            icon={<RiFileListLine className="h-6 w-6" />}
            title={intl.formatMessage({
              id: "admin.actions.noActions",
              defaultMessage: "No actions yet",
            })}
            description={intl.formatMessage({
              id: "admin.actions.noActionsDescription",
              defaultMessage: "Get started by creating your first action.",
            })}
          />
        )}

        {!isLoading && actions.length > 0 && filteredActions.length === 0 && (
          <EmptyState
            icon={<RiFileListLine className="h-6 w-6" />}
            title={intl.formatMessage({
              id: "admin.actions.noResults",
              defaultMessage: "No actions match your filters",
            })}
            action={{
              label: intl.formatMessage({
                id: "admin.actions.resetFilters",
                defaultMessage: "Reset filters",
              }),
              onClick: resetFilters,
            }}
          />
        )}

        {!isLoading && filteredActions.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredActions.map((action) => (
              <Link
                key={action.id}
                to={`/actions/${action.id}`}
                data-testid="action-card"
                className="group overflow-hidden rounded-lg border border-stroke-soft bg-bg-white transition hover:border-green-500 hover:shadow-md"
              >
                {action.media[0] && (
                  <img
                    src={action.media[0]}
                    alt={action.title}
                    className="w-full h-40 object-cover"
                  />
                )}

                <div className="p-6">
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
        )}
      </div>
    </div>
  );
}
