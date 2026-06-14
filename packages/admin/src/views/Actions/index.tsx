import {
  Domain,
  DOMAIN_CONFIG,
  DOMAIN_FILTER_OPTIONS,
  EmptyState,
  formatDate,
  getActionLifecycleState,
  getWorkbenchTone,
  LIFECYCLE_TABS,
  localizeAction,
  NativeSelect,
  Surface,
  useActionsController,
  useMediaQuery,
  useRefreshAction,
  WorkbenchCard,
} from "@green-goods/shared";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminViewActions } from "@/components/AdminViewActions";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";
import { RiFileListLine } from "@remixicon/react";
import { useCallback } from "react";
import { useIntl } from "react-intl";
import { ActionsSheetDescriptor } from "./ActionsSheetDescriptor";

const ACTION_DOMAIN_CHIP_CLASSNAMES: Record<Domain, { selected: string; idle: string }> = {
  [Domain.SOLAR]: {
    selected:
      "border-domain-solar/30 bg-domain-solar-soft text-domain-solar [--state-layer-color:var(--domain-solar-rgb)]",
    idle: "border-domain-solar/30 text-domain-solar [--state-layer-color:var(--domain-solar-rgb)]",
  },
  [Domain.AGRO]: {
    selected:
      "border-domain-agro/30 bg-domain-agro-soft text-domain-agro [--state-layer-color:var(--domain-agro-rgb)]",
    idle: "border-domain-agro/30 text-domain-agro [--state-layer-color:var(--domain-agro-rgb)]",
  },
  [Domain.EDU]: {
    selected:
      "border-domain-education/30 bg-domain-education-soft text-domain-education [--state-layer-color:var(--domain-education-rgb)]",
    idle: "border-domain-education/30 text-domain-education [--state-layer-color:var(--domain-education-rgb)]",
  },
  [Domain.WASTE]: {
    selected:
      "border-domain-waste/30 bg-domain-waste-soft text-domain-waste [--state-layer-color:var(--domain-waste-rgb)]",
    idle: "border-domain-waste/30 text-domain-waste [--state-layer-color:var(--domain-waste-rgb)]",
  },
};

function getActionDomainChipClassName(domain: Domain, selected: boolean) {
  const styles = ACTION_DOMAIN_CHIP_CLASSNAMES[domain];
  return selected ? styles.selected : styles.idle;
}

export default function Actions() {
  const intl = useIntl();
  const actions = useActionsController();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const handleRefresh = useCallback(() => {
    void actions.refetch();
  }, [actions]);
  // Mobile/tablet: refresh elevates to the AppBar next to notifications.
  useRefreshAction(
    !isDesktop ? { onRefresh: handleRefresh, isFetching: actions.isRefreshing } : null
  );

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
        variant="canvas"
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
              <label className="flex h-10 shrink-0 items-center gap-2 rounded-[var(--m3-shape-full)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container))] pl-3 pr-2 text-body-md font-medium text-[rgb(var(--m3-on-surface-variant))]">
                <span className="whitespace-nowrap">
                  {intl.formatMessage({
                    id: "app.admin.sortSelect.sortBy",
                    defaultMessage: "Sort by",
                  })}
                </span>
                <NativeSelect
                  surface="admin"
                  controlSize="sm"
                  value={actions.filters.sort}
                  onChange={(event) => actions.setFilter("sort", event.target.value)}
                  aria-label={intl.formatMessage({
                    id: "app.admin.sortSelect.sortBy",
                    defaultMessage: "Sort by",
                  })}
                  className="h-8 min-h-8 rounded-full border-0 bg-transparent py-0 pl-1 pr-8 shadow-none"
                >
                  {actions.sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              {DOMAIN_FILTER_OPTIONS.map((tag) => {
                const selected = actions.filters.domain === tag.value;
                return (
                  <AdminFilterChip
                    key={tag.value}
                    label={intl.formatMessage({ id: tag.labelId })}
                    selected={selected}
                    onToggle={() => actions.toggleDomain(tag.value)}
                    className={getActionDomainChipClassName(tag.value, selected)}
                  />
                );
              })}
            </AdminSearchToolbar>
          ) : undefined
        }
      >
        {actions.showToolbar ? (
          <AdminTabRail
            ariaLabel={intl.formatMessage({
              id: "cockpit.actions.lifecycleSwitcher",
              defaultMessage: "Filter actions by lifecycle",
            })}
            activeId={actions.lifecycle}
            onChange={(next) => actions.setFilter("lifecycle", next === "all" ? undefined : next)}
            tabs={LIFECYCLE_TABS.map((tab) => ({
              id: tab.id,
              label: intl.formatMessage({
                id: tab.labelId,
                defaultMessage: tab.defaultLabel,
              }),
              count: actions.lifecycleCounts[tab.id] || undefined,
            }))}
          />
        ) : null}
      </CanvasRouteHeader>

      <CanvasRouteContent data-region="workspace-actions-content" className="flex flex-col gap-3">
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
              <div key={`action-skeleton-${index}`} className="h-20 rounded-sm skeleton-shimmer" />
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
                      onClick: actions.openCreateAction,
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
          <div
            aria-label={intl.formatMessage({ id: "app.admin.nav.actions" })}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            {actions.stageFilteredActions.map((action) => {
              const stage = getActionLifecycleState(action);
              const displayAction = localizeAction(action, intl.locale);
              const domainLabel = intl.formatMessage({
                id: DOMAIN_CONFIG[action.domain]?.labelId ?? "app.admin.nav.actions",
              });

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
                    `${formatDate(action.startTime)} - ${formatDate(action.endTime)}`,
                    intl.formatMessage(
                      {
                        id: "cockpit.actions.inputsCount",
                        defaultMessage: "{count} {count, plural, one {field} other {fields}}",
                      },
                      { count: displayAction.inputs.length }
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
