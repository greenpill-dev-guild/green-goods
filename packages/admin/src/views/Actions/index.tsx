import {
  Button,
  Domain,
  DOMAIN_CONFIG,
  DOMAIN_FILTER_OPTIONS,
  EmptyState,
  formatDate,
  getActionLifecycleState,
  getWorkbenchTone,
  LIFECYCLE_TABS,
  NativeSelect,
  Surface,
  useActionsController,
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
import { ActionsSheetDescriptor } from "./ActionsSheetDescriptor";

const ACTION_DOMAIN_CHIP_CLASSNAMES: Record<Domain, { selected: string; idle: string }> = {
  [Domain.SOLAR]: {
    selected:
      "border-warning-light bg-warning-lighter text-warning-dark [--state-layer-color:var(--warning-dark)]",
    idle: "border-warning-light text-warning-dark [--state-layer-color:var(--warning-dark)]",
  },
  [Domain.AGRO]: {
    selected:
      "border-success-light bg-success-lighter text-success-dark [--state-layer-color:var(--success-dark)]",
    idle: "border-success-light text-success-dark [--state-layer-color:var(--success-dark)]",
  },
  [Domain.EDU]: {
    selected:
      "border-information-light bg-information-lighter text-information-dark [--state-layer-color:var(--information-dark)]",
    idle: "border-information-light text-information-dark [--state-layer-color:var(--information-dark)]",
  },
  [Domain.WASTE]: {
    selected:
      "border-warning-light bg-warning-lighter text-warning-dark [--state-layer-color:var(--warning-dark)]",
    idle: "border-warning-light text-warning-dark [--state-layer-color:var(--warning-dark)]",
  },
};

function getActionDomainChipClassName(domain: Domain, selected: boolean) {
  const styles = ACTION_DOMAIN_CHIP_CLASSNAMES[domain];
  return selected ? styles.selected : styles.idle;
}

export default function Actions() {
  const intl = useIntl();
  const actions = useActionsController();

  return (
    <CanvasRouteFrame data-component="ActionsWorkspace" data-region="workspace-actions">
      <ActionsSheetDescriptor
        routeState={actions.routeState}
        actions={actions.actions}
        isLoading={actions.isLoading}
        canManageActions={actions.canManageActions}
      />
      <CanvasRouteContent
        data-region="workspace-actions-content"
        maxWidthClassName="max-w-[1400px]"
        className="flex flex-col gap-4"
      >
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
              title={intl.formatMessage({
                id: actions.isRefreshing ? "app.common.refreshing" : "app.common.refresh",
              })}
              aria-label={intl.formatMessage({
                id: actions.isRefreshing ? "app.common.refreshing" : "app.common.refresh",
              })}
              className="h-10 min-h-10 w-10 rounded-full p-0"
            >
              {!actions.isRefreshing && <RiRefreshLine className="h-4 w-4" />}
            </Button>
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
                <label className="flex h-10 items-center gap-2 rounded-[var(--m3-shape-full)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container))] pl-3 pr-2 text-label-md font-medium text-[rgb(var(--m3-on-surface-variant))]">
                  <span>
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
        </PageHeader>

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
                  onClick={() => actions.openActionDetail(action.id)}
                />
              );
            })}
          </WorkbenchList>
        ) : null}
      </CanvasRouteContent>
    </CanvasRouteFrame>
  );
}
