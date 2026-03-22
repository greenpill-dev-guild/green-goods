import {
  ActionBannerFallback,
  type ActionFiltersState,
  cn,
  DEFAULT_CHAIN_ID,
  Domain,
  formatDate,
  ImageWithFallback,
  useActions,
  useFilteredActions,
  useRole,
} from "@green-goods/shared";
import {
  RiAddLine,
  RiCalendarLine,
  RiEditLine,
  RiEyeLine,
  RiFileListLine,
  RiRefreshLine,
} from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { SortSelect } from "@/components/ui/SortSelect";

interface ActionCardMediaProps {
  src?: string;
  alt: string;
  domain: Domain;
  title: string;
}

function ActionCardMedia({ src, alt, domain, title }: ActionCardMediaProps) {
  return (
    <div className="relative h-40 w-full overflow-hidden">
      <ImageWithFallback
        src={src || ""}
        alt={alt}
        className="w-full h-40 object-cover"
        fallbackClassName="w-full h-40"
        backgroundFallback={<ActionBannerFallback domain={domain} title={title} />}
      />
    </div>
  );
}

const DOMAIN_TAGS: { value: Domain; labelId: string; activeClass: string }[] = [
  {
    value: Domain.SOLAR,
    labelId: "app.domain.tab.solar",
    activeClass: "bg-away-lighter text-away-dark border-away-light",
  },
  {
    value: Domain.AGRO,
    labelId: "app.domain.tab.agro",
    activeClass: "bg-success-lighter text-success-dark border-success-light",
  },
  {
    value: Domain.EDU,
    labelId: "app.domain.tab.education",
    activeClass: "bg-information-lighter text-information-dark border-information-light",
  },
  {
    value: Domain.WASTE,
    labelId: "app.domain.tab.waste",
    activeClass: "bg-warning-lighter text-warning-dark border-warning-light",
  },
];

export default function Actions() {
  const intl = useIntl();
  const { role } = useRole();
  const { data: actions = [], isLoading, isFetching, refetch } = useActions(DEFAULT_CHAIN_ID);
  const canManageActions = role === "deployer";
  const [filters, setFilters] = useState<ActionFiltersState>({ sort: "default" });
  const isRefreshing = isFetching && !isLoading;

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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={isRefreshing}
              onClick={() => {
                void refetch();
              }}
            >
              {!isRefreshing && <RiRefreshLine className="h-4 w-4" />}
              {intl.formatMessage({
                id: isRefreshing ? "app.common.refreshing" : "app.common.refresh",
              })}
            </Button>
            {canManageActions && (
              <Button size="sm" asChild>
                <Link to="/actions/create">
                  <RiAddLine className="mr-1.5 h-4 w-4" />
                  Create Action
                </Link>
              </Button>
            )}
          </div>
        }
        toolbar={
          showToolbar ? (
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
              <div
                className="flex flex-wrap items-center gap-1.5"
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
                      {intl.formatMessage({ id: tag.labelId })}
                    </button>
                  );
                })}
              </div>
            </ListToolbar>
          ) : undefined
        }
      />

      <div className="mt-6 space-y-6 px-4 sm:px-6">
        {isLoading && (
          <div role="status" aria-live="polite">
            <span className="sr-only">
              {intl.formatMessage({
                id: "admin.actions.loadingMessage",
                defaultMessage: "Loading actions...",
              })}
            </span>
            <SkeletonGrid count={6} columns={3} />
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
          <div className="stagger-children grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredActions.map((action) => (
              <Link
                key={action.id}
                to={`/actions/${action.id}`}
                data-testid="action-card"
                className="group overflow-hidden rounded-lg border border-stroke-soft bg-bg-white transition hover:border-primary-base hover:shadow-md"
              >
                <ActionCardMedia
                  src={action.media[0]}
                  alt={action.title}
                  domain={action.domain}
                  title={action.title}
                />

                <div className="p-6">
                  <h3
                    className="text-xl font-semibold text-text-strong mb-2 group-hover:text-primary-dark line-clamp-1"
                    title={action.title}
                  >
                    {action.title}
                  </h3>

                  <p
                    className="text-sm text-text-sub mb-4 line-clamp-2"
                    title={action.description || undefined}
                  >
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
                      {canManageActions && <RiEditLine className="h-4 w-4" />}
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
