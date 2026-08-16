import {
  ACTION_CAPITAL_LABEL_IDS,
  buildActionsHeaderStats,
  DOMAIN_CONFIG,
  DOMAIN_FILTER_OPTIONS,
  EmptyState,
  getActionLifecycleState,
  getWorkbenchTone,
  localizeAction,
  MetaStrip,
  useActionsController,
  useMediaQuery,
  useRefreshAction,
  WorkbenchCard,
} from "@green-goods/shared";
import { AdminCard } from "@/components/AdminCard";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminSortSelect } from "@/components/AdminSortSelect";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminViewActions } from "@/components/AdminViewActions";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";
import { RiFileListLine } from "@remixicon/react";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { ActionsSheetDescriptor } from "./ActionsSheetDescriptor";

export default function Actions() {
  const intl = useIntl();
  const actions = useActionsController();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { isRefreshing, refetch } = actions;

  const headerStats = useMemo(() => {
    if (actions.isLoading) return [];
    return buildActionsHeaderStats({
      totalCount: actions.actions.length,
      domainsCovered: new Set(
        actions.actions.map((action) => action.domain).filter((domain) => domain !== null)
      ).size,
      formatMessage: intl.formatMessage,
    });
  }, [actions.actions, actions.isLoading, intl.formatMessage]);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const mobileRefreshAction = useMemo(
    () => (!isDesktop ? { onRefresh: handleRefresh, isFetching: isRefreshing } : null),
    [handleRefresh, isDesktop, isRefreshing]
  );
  // Mobile/tablet: refresh elevates to the AppBar next to notifications.
  useRefreshAction(mobileRefreshAction);

  return (
    <CanvasRouteFrame data-component="ActionsWorkspace" data-region="workspace-actions">
      <ActionsSheetDescriptor
        routeState={actions.routeState}
        actions={actions.actions}
        isLoading={actions.isLoading}
        canManageActions={actions.canManageActions}
      />
      <CanvasRouteHeader
        title={intl.formatMessage({ id: "app.admin.nav.actions", defaultMessage: "Actions" })}
        description={intl.formatMessage({
          id: "cockpit.actions.description",
          defaultMessage:
            "Scan the registry, review lifecycle status, and maintain submission requirements.",
        })}
        metadata={
          headerStats.length > 0 ? <MetaStrip items={headerStats} density="inline" /> : undefined
        }
        variant="canvas"
        sticky
        actions={
          isDesktop && actions.desktopActions.length > 0 ? (
            <AdminViewActions items={actions.desktopActions} />
          ) : undefined
        }
        toolbar={
          actions.showToolbar ? (
            <AdminSearchToolbar
              search={actions.filters.search ?? ""}
              onSearchChange={(value) => actions.setFilter("search", value || undefined)}
              placeholder={intl.formatMessage({
                id: "admin.actions.searchPlaceholder",
                defaultMessage: "Search actions...",
              })}
            >
              <AdminSortSelect
                value={actions.filters.sort}
                onChange={(value) => actions.setFilter("sort", value)}
                options={actions.sortOptions}
              />
            </AdminSearchToolbar>
          ) : undefined
        }
      >
        {actions.showToolbar ? (
          <AdminTabRail
            ariaLabel={intl.formatMessage({
              id: "cockpit.actions.domainSwitcher",
              defaultMessage: "Filter actions by domain",
            })}
            activeId={actions.filters.domain === undefined ? "all" : String(actions.filters.domain)}
            onChange={(next) => actions.setFilter("domain", next === "all" ? undefined : next)}
            tabs={[
              {
                id: "all",
                label: intl.formatMessage({
                  id: "cockpit.actions.stage.all",
                  defaultMessage: "All",
                }),
                count: actions.domainCounts.all || undefined,
              },
              ...DOMAIN_FILTER_OPTIONS.map((option) => ({
                id: String(option.value),
                label: intl.formatMessage({ id: option.labelId }),
                count: actions.domainCounts[option.value] || undefined,
              })),
            ]}
          />
        ) : null}
      </CanvasRouteHeader>

      <CanvasRouteContent
        data-region="workspace-actions-content"
        className="flex flex-1 flex-col gap-3"
      >
        {actions.isLoading ? (
          <AdminCard className="space-y-3" role="status" aria-live="polite">
            <span className="sr-only">
              {intl.formatMessage({
                id: "admin.actions.loadingMessage",
                defaultMessage: "Loading actions...",
              })}
            </span>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`action-skeleton-${index}`} className="h-20 rounded-sm skeleton-shimmer" />
            ))}
          </AdminCard>
        ) : null}

        {!actions.isLoading && actions.actions.length === 0 ? (
          <AdminCard density="none">
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
              action={
                actions.canManageActions
                  ? {
                      label: intl.formatMessage({
                        id: "app.actions.createFirst",
                        defaultMessage: "Create your first action",
                      }),
                      onClick: actions.openCreateAction,
                    }
                  : undefined
              }
            />
          </AdminCard>
        ) : null}

        {!actions.isLoading &&
        actions.actions.length > 0 &&
        actions.stageFilteredActions.length === 0 ? (
          <AdminCard density="none">
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
                onClick: actions.resetFilters,
              }}
            />
          </AdminCard>
        ) : null}

        {!actions.isLoading && actions.stageFilteredActions.length > 0 ? (
          <div
            aria-label={intl.formatMessage({ id: "app.admin.nav.actions" })}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            {actions.stageFilteredActions.map((action) => {
              const stage = getActionLifecycleState(action);
              const displayAction = localizeAction(action, intl.locale);
              const domainConfig =
                action.domain !== null ? DOMAIN_CONFIG[action.domain] : undefined;
              const domainLabel = intl.formatMessage({
                id: domainConfig?.labelId ?? "app.domain.tab.unknown",
              });
              // Name the forms of capital (up to 3 + overflow) instead of an
              // abstract "{n} capital forms" count, so cards vary by content.
              const capitalNames = action.capitals
                .slice(0, 3)
                .map((capital) => intl.formatMessage({ id: ACTION_CAPITAL_LABEL_IDS[capital] }));
              const extraCapitals = action.capitals.length - capitalNames.length;
              const capitalsSummary =
                capitalNames.length === 0
                  ? ""
                  : extraCapitals > 0
                    ? `${capitalNames.join(" · ")} +${extraCapitals}`
                    : capitalNames.join(" · ");

              return (
                <WorkbenchCard
                  key={action.id}
                  eyebrow={domainLabel}
                  title={displayAction.title}
                  description={
                    displayAction.description ||
                    intl.formatMessage({
                      id: "admin.actions.noDescription",
                      defaultMessage: "No description",
                    })
                  }
                  meta={[
                    intl.formatMessage(
                      {
                        id: "cockpit.actions.inputsCount",
                        defaultMessage: "{count} {count, plural, one {field} other {fields}}",
                      },
                      { count: displayAction.inputs.length }
                    ),
                    capitalsSummary,
                  ].filter(Boolean)}
                  statusLabel={intl.formatMessage({
                    id: `cockpit.actions.status.${stage}`,
                    defaultMessage:
                      stage === "active"
                        ? "Active"
                        : stage === "upcoming"
                          ? "Upcoming"
                          : "Completed",
                  })}
                  statusTone={getWorkbenchTone(action)}
                  leadingIcon={domainConfig?.icon ?? RiFileListLine}
                  thumbnailSrc={action.media[0] ?? undefined}
                  onClick={() => actions.openActionDetail(action.id)}
                />
              );
            })}
          </div>
        ) : null}
      </CanvasRouteContent>
    </CanvasRouteFrame>
  );
}
