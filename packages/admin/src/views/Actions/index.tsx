import {
  adminRoutes,
  Button,
  DOMAIN_CONFIG,
  EmptyState,
  formatDate,
  Surface,
  WorkbenchList,
  WorkbenchRow,
} from "@green-goods/shared";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminTabRail } from "@/components/AdminTabRail";
import { CanvasRouteContent, CanvasRouteFrame } from "@/components/Layout/CanvasRouteFrame";
import { PageHeader } from "@/components/Layout/PageHeader";
import { RiFileListLine, RiRefreshLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import {
  DOMAIN_FILTER_OPTIONS,
  getActionLifecycleState,
  getWorkbenchTone,
  LIFECYCLE_TABS,
} from "./actions.utils";
import { useActionsController } from "./useActionsController";

export default function Actions() {
  const intl = useIntl();
  const actions = useActionsController();

  return (
    <CanvasRouteFrame>
      <CanvasRouteContent maxWidthClassName="max-w-[1400px]" className="flex flex-col gap-4">
        <PageHeader
          title={intl.formatMessage({ id: "app.admin.nav.actions", defaultMessage: "Actions" })}
          description={intl.formatMessage({
            id: "cockpit.actions.description",
            defaultMessage:
              "Scan the registry, review lifecycle status, and maintain submission requirements.",
          })}
          variant="canvas"
          sticky
          actions={
            <Button
              size="sm"
              variant="secondary"
              loading={actions.isRefreshing}
              onClick={() => {
                void actions.refetch();
              }}
            >
              {!actions.isRefreshing && <RiRefreshLine className="h-4 w-4" />}
              {intl.formatMessage({
                id: actions.isRefreshing ? "app.common.refreshing" : "app.common.refresh",
              })}
            </Button>
          }
          toolbar={
            actions.showToolbar ? (
              <div className="flex flex-col gap-3">
                <AdminTabRail
                  ariaLabel={intl.formatMessage({
                    id: "cockpit.actions.lifecycleSwitcher",
                    defaultMessage: "Filter actions by lifecycle",
                  })}
                  activeId={actions.lifecycle}
                  onChange={(next) =>
                    actions.setFilter("lifecycle", next === "all" ? undefined : next)
                  }
                  tabs={LIFECYCLE_TABS.map((tab) => ({
                    id: tab.id,
                    label: intl.formatMessage({
                      id: tab.labelId,
                      defaultMessage: tab.defaultLabel,
                    }),
                    count: actions.lifecycleCounts[tab.id] || undefined,
                  }))}
                />
                <AdminSearchToolbar
                  search={actions.filters.search ?? ""}
                  onSearchChange={(value) => actions.setFilter("search", value || undefined)}
                  placeholder={intl.formatMessage({
                    id: "admin.actions.searchPlaceholder",
                    defaultMessage: "Search actions...",
                  })}
                >
                  {actions.sortOptions.map((option) => (
                    <AdminFilterChip
                      key={option.value}
                      label={option.label}
                      selected={actions.filters.sort === option.value}
                      onToggle={() => actions.setFilter("sort", option.value)}
                    />
                  ))}
                  {DOMAIN_FILTER_OPTIONS.map((tag) => (
                    <AdminFilterChip
                      key={tag.value}
                      label={intl.formatMessage({ id: tag.labelId })}
                      selected={actions.filters.domain === tag.value}
                      onToggle={() => actions.toggleDomain(tag.value)}
                    />
                  ))}
                </AdminSearchToolbar>
              </div>
            ) : undefined
          }
        />

        {actions.isLoading ? (
          <Surface
            elevation="solid-raised"
            padding="none"
            className="space-y-3 p-4 sm:p-5"
            role="status"
            aria-live="polite"
          >
            <span className="sr-only">
              {intl.formatMessage({
                id: "admin.actions.loadingMessage",
                defaultMessage: "Loading actions...",
              })}
            </span>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`action-skeleton-${index}`}
                className="h-20 rounded-sm skeleton-shimmer"
                style={{ animationDelay: `${index * 0.05}s` }}
              />
            ))}
          </Surface>
        ) : null}

        {!actions.isLoading && actions.actions.length === 0 ? (
          <Surface elevation="solid-raised" padding="none">
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
                      onClick: () => actions.navigate(adminRoutes.actionCreate()),
                    }
                  : undefined
              }
            />
          </Surface>
        ) : null}

        {!actions.isLoading &&
        actions.actions.length > 0 &&
        actions.stageFilteredActions.length === 0 ? (
          <Surface elevation="solid-raised" padding="none">
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
          </Surface>
        ) : null}

        {!actions.isLoading && actions.stageFilteredActions.length > 0 ? (
          <WorkbenchList aria-label={intl.formatMessage({ id: "app.admin.nav.actions" })}>
            {actions.stageFilteredActions.map((action) => {
              const stage = getActionLifecycleState(action);
              const domainLabel = intl.formatMessage({
                id: DOMAIN_CONFIG[action.domain]?.labelId ?? "app.admin.nav.actions",
              });

              return (
                <WorkbenchRow
                  key={action.id}
                  eyebrow={domainLabel}
                  title={action.title}
                  description={
                    action.description ||
                    intl.formatMessage({
                      id: "admin.actions.noDescription",
                      defaultMessage: "No description",
                    })
                  }
                  meta={[
                    `${formatDate(action.startTime)} - ${formatDate(action.endTime)}`,
                    intl.formatMessage(
                      {
                        id: "cockpit.actions.inputsCount",
                        defaultMessage: "{count} {count, plural, one {field} other {fields}}",
                      },
                      { count: action.inputs.length }
                    ),
                    intl.formatMessage(
                      {
                        id: "app.actions.detail.capitalsForms",
                        defaultMessage: "{count} capital forms",
                      },
                      { count: action.capitals.length }
                    ),
                  ]}
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
                  leadingIcon={RiFileListLine}
                  thumbnailSrc={action.media[0] ?? undefined}
                  onClick={() => actions.navigate(adminRoutes.actionDetail(action.id))}
                />
              );
            })}
          </WorkbenchList>
        ) : null}
      </CanvasRouteContent>
    </CanvasRouteFrame>
  );
}
