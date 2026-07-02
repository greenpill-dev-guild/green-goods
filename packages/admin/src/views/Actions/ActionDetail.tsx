import {
  ActionBannerFallback,
  Button,
  DEFAULT_CHAIN_ID,
  type Domain,
  type Action,
  type LifecycleStage,
  adminRoutes,
  getActionLifecycleState,
  getActionsListSearch,
  StatusBadge,
  formatDateTime,
  ImageWithFallback,
  localizeAction,
  useActions,
  useRole,
} from "@green-goods/shared";
import { RiEditLine, RiFileListLine, RiImageLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link, useLocation, useParams } from "react-router-dom";
import { AdminCard } from "@/components/AdminCard";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";
import { useMemo } from "react";

interface ActionDetailMediaTileProps {
  src?: string;
  alt: string;
  domain: Domain;
  title: string;
}

function getLifecycleVariant(lifecycle: Exclude<LifecycleStage, "all">) {
  if (lifecycle === "upcoming") return "warning" as const;
  if (lifecycle === "active") return "success" as const;
  return "neutral" as const;
}

function ActionDetailMediaTile({ src, alt, domain, title }: ActionDetailMediaTileProps) {
  return (
    <div className="relative h-40 overflow-hidden rounded-lg">
      <ImageWithFallback
        src={src || ""}
        alt={alt}
        className="h-40 w-full object-cover"
        fallbackClassName="h-40 w-full"
        backgroundFallback={
          <ActionBannerFallback domain={domain} title={title} className="rounded-lg" />
        }
      />
    </div>
  );
}

interface ActionDetailPanelProps {
  actionId?: string;
  actions: Action[];
  isLoading: boolean;
  canManageActions: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export function ActionDetailPanel({
  actionId,
  actions,
  isLoading,
  canManageActions,
  onClose,
  onEdit,
}: ActionDetailPanelProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const action = actions.find((record) => record.id === actionId);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4" role="status" aria-live="polite">
        <span className="sr-only">{formatMessage({ id: "app.actions.loading" })}</span>
        <div className="h-20 rounded-[var(--radius-xl)] skeleton-shimmer" />
        <div className="h-64 rounded-[var(--radius-xl)] skeleton-shimmer" />
      </div>
    );
  }

  if (!action) {
    return (
      <div className="p-4">
        <AdminCard className="space-y-3 text-center">
          <p className="text-sm text-text-sub">{formatMessage({ id: "app.actions.notFound" })}</p>
          <Button size="sm" variant="secondary" onClick={onClose}>
            {formatMessage({
              id: "app.actions.backToActions",
              defaultMessage: "Back to actions",
            })}
          </Button>
        </AdminCard>
      </div>
    );
  }

  const displayAction = localizeAction(action, intl.locale);
  const lifecycle = getActionLifecycleState(action);
  const lifecycleLabel = formatMessage({
    id: `cockpit.actions.status.${lifecycle}`,
    defaultMessage:
      lifecycle === "active" ? "Active" : lifecycle === "upcoming" ? "Upcoming" : "Completed",
  });

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <StatusBadge variant={getLifecycleVariant(lifecycle)}>{lifecycleLabel}</StatusBadge>
            <p className="text-sm text-text-sub">
              {displayAction.description || formatMessage({ id: "admin.actions.noDescription" })}
            </p>
          </div>
          {canManageActions ? (
            <Button size="sm" onClick={onEdit}>
              <RiEditLine className="h-4 w-4" />
              {formatMessage({ id: "app.actions.edit" })}
            </Button>
          ) : null}
        </div>
      </div>

      <AdminCard className="space-y-6">
        <div className="space-y-4">
          <div>
            <h2 className="label-md text-text-strong sm:text-lg">
              {formatMessage({ id: "app.actions.detail.details" })}
            </h2>
            <p className="mt-1 text-sm text-text-sub">
              {formatMessage({
                id: "cockpit.actions.detailDescription",
                defaultMessage:
                  "Review lifecycle details and the submission requirements for this action.",
              })}
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AdminCard variant="outlined" className="px-4 py-3">
              <dt className="text-xs text-text-soft">
                {formatMessage({ id: "cockpit.actions.lifecycle", defaultMessage: "Lifecycle" })}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-text-strong">{lifecycleLabel}</dd>
            </AdminCard>
            <AdminCard variant="outlined" className="px-4 py-3">
              <dt className="text-xs text-text-soft">
                {formatMessage({ id: "app.actions.detail.capitals" })}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-text-strong">
                {formatMessage(
                  {
                    id: "app.actions.detail.capitalsForms",
                    defaultMessage: "{count} capital forms",
                  },
                  { count: action.capitals.length }
                )}
              </dd>
            </AdminCard>
            <AdminCard variant="outlined" className="px-4 py-3">
              <dt className="text-xs text-text-soft">
                {formatMessage({ id: "app.actions.detail.startTime" })}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-text-strong">
                {formatDateTime(action.startTime)}
              </dd>
            </AdminCard>
            <AdminCard variant="outlined" className="px-4 py-3">
              <dt className="text-xs text-text-soft">
                {formatMessage({ id: "app.actions.detail.endTime" })}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-text-strong">
                {formatDateTime(action.endTime)}
              </dd>
            </AdminCard>
          </dl>
        </div>
      </AdminCard>

      <AdminCard className="space-y-4">
        <div className="flex items-center gap-2">
          <RiFileListLine className="h-4 w-4 text-text-soft" />
          <h3 className="text-sm font-semibold text-text-strong">
            {formatMessage({
              id: "cockpit.actions.requirements",
              defaultMessage: "Submission requirements",
            })}
          </h3>
        </div>
        {displayAction.inputs.length > 0 ? (
          <div className="space-y-2">
            {displayAction.inputs.map((input) => (
              <AdminCard variant="outlined" key={input.key} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-text-strong">{input.title}</p>
                  <span className="text-xs text-text-soft">{input.type}</span>
                </div>
              </AdminCard>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.actions.noInputs",
              defaultMessage: "No form fields configured",
            })}
          </p>
        )}
      </AdminCard>

      <AdminCard className="space-y-4">
        <div className="flex items-center gap-2">
          <RiImageLine className="h-4 w-4 text-text-soft" />
          <h3 className="text-sm font-semibold text-text-strong">
            {formatMessage({ id: "app.actions.detail.media" })}
          </h3>
        </div>
        {displayAction.media.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {displayAction.media.map((url, index) => (
              <ActionDetailMediaTile
                key={`${url}-${index}`}
                src={url}
                alt={formatMessage(
                  {
                    id: "app.actions.detail.mediaAlt",
                    defaultMessage: "Action media {index}",
                  },
                  { index: index + 1 }
                )}
                domain={action.domain}
                title={displayAction.title}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.actions.noMedia",
              defaultMessage: "No media attached",
            })}
          </p>
        )}
      </AdminCard>
    </div>
  );
}

export default function ActionDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const intl = useIntl();
  const { formatMessage } = intl;
  const { role } = useRole();
  const { data: actions = [], isLoading } = useActions(DEFAULT_CHAIN_ID);
  const canManageActions = role === "deployer" || role === "operator";
  const action = actions.find((record) => record.id === id);
  const listSearch = useMemo(
    () => getActionsListSearch(new URLSearchParams(location.search)),
    [location.search]
  );
  const actionsListHref = useMemo(() => adminRoutes.actions(listSearch), [listSearch]);
  const actionEditHref = id ? adminRoutes.actionEdit(id, listSearch) : actionsListHref;

  if (isLoading) {
    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          maxWidthClassName="max-w-[1200px]"
          title={formatMessage({ id: "app.admin.nav.actions", defaultMessage: "Actions" })}
          description={formatMessage({
            id: "cockpit.actions.detailDescription",
            defaultMessage:
              "Review lifecycle details and the submission requirements for this action.",
          })}
          variant="canvas"
          sticky
        />
        <CanvasRouteContent maxWidthClassName="max-w-[1200px]" className="mt-4">
          <div className="space-y-4" role="status" aria-live="polite">
            <span className="sr-only">{formatMessage({ id: "app.actions.loading" })}</span>
            <div className="h-28 rounded-[1.4rem] skeleton-shimmer" />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
              <div className="h-80 rounded-[1.4rem] skeleton-shimmer" />
              <div className="h-80 rounded-[1.4rem] skeleton-shimmer" />
            </div>
          </div>
        </CanvasRouteContent>
      </CanvasRouteFrame>
    );
  }

  if (!action) {
    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          maxWidthClassName="max-w-[960px]"
          title={formatMessage({ id: "app.actions.notFound" })}
          description={formatMessage({
            id: "cockpit.actions.detailDescription",
            defaultMessage:
              "Review lifecycle details and the submission requirements for this action.",
          })}
          variant="canvas"
          backLink={{
            to: actionsListHref,
            label: formatMessage({
              id: "app.actions.backToActions",
              defaultMessage: "Back to actions",
            }),
          }}
          sticky
        />
        <CanvasRouteContent maxWidthClassName="max-w-[960px]" className="mt-4">
          <AdminCard className="text-center">
            <p className="text-sm text-text-sub">{formatMessage({ id: "app.actions.notFound" })}</p>
          </AdminCard>
        </CanvasRouteContent>
      </CanvasRouteFrame>
    );
  }

  const lifecycle = getActionLifecycleState(action);
  const displayAction = localizeAction(action, intl.locale);
  const lifecycleLabel = formatMessage({
    id: `cockpit.actions.status.${lifecycle}`,
    defaultMessage:
      lifecycle === "active" ? "Active" : lifecycle === "upcoming" ? "Upcoming" : "Completed",
  });

  return (
    <CanvasRouteFrame>
      <CanvasRouteHeader
        maxWidthClassName="max-w-[1200px]"
        title={displayAction.title}
        description={
          displayAction.description || formatMessage({ id: "admin.actions.noDescription" })
        }
        variant="canvas"
        backLink={{
          to: actionsListHref,
          label: formatMessage({
            id: "app.actions.backToActions",
            defaultMessage: "Back to actions",
          }),
        }}
        metadata={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge variant={getLifecycleVariant(lifecycle)}>{lifecycleLabel}</StatusBadge>
            <span className="text-xs text-text-soft">
              {formatMessage({ id: "cockpit.actions.lifecycle", defaultMessage: "Lifecycle" })}
            </span>
          </div>
        }
        actions={
          canManageActions ? (
            <Button size="sm" asChild>
              <Link to={actionEditHref}>
                <RiEditLine className="h-4 w-4" />
                {formatMessage({ id: "app.actions.edit" })}
              </Link>
            </Button>
          ) : undefined
        }
        sticky
      />

      <CanvasRouteContent maxWidthClassName="max-w-[1200px]" className="mt-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <AdminCard className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
              <div className="space-y-4">
                <div>
                  <h2 className="label-md text-text-strong sm:text-lg">
                    {formatMessage({ id: "app.actions.detail.details" })}
                  </h2>
                  <p className="mt-1 text-sm text-text-sub">
                    {formatMessage({
                      id: "cockpit.actions.detailDescription",
                      defaultMessage:
                        "Review lifecycle details and the submission requirements for this action.",
                    })}
                  </p>
                </div>

                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <AdminCard variant="outlined" className="px-4 py-3">
                    <dt className="text-xs text-text-soft">
                      {formatMessage({
                        id: "cockpit.actions.lifecycle",
                        defaultMessage: "Lifecycle",
                      })}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-text-strong">
                      {lifecycleLabel}
                    </dd>
                  </AdminCard>
                  <AdminCard variant="outlined" className="px-4 py-3">
                    <dt className="text-xs text-text-soft">
                      {formatMessage({ id: "app.actions.detail.capitals" })}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-text-strong">
                      {formatMessage(
                        {
                          id: "app.actions.detail.capitalsForms",
                          defaultMessage: "{count} capital forms",
                        },
                        { count: displayAction.capitals.length }
                      )}
                    </dd>
                  </AdminCard>
                  <AdminCard variant="outlined" className="px-4 py-3">
                    <dt className="text-xs text-text-soft">
                      {formatMessage({ id: "app.actions.detail.startTime" })}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-text-strong">
                      {formatDateTime(action.startTime)}
                    </dd>
                  </AdminCard>
                  <AdminCard variant="outlined" className="px-4 py-3">
                    <dt className="text-xs text-text-soft">
                      {formatMessage({ id: "app.actions.detail.endTime" })}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-text-strong">
                      {formatDateTime(action.endTime)}
                    </dd>
                  </AdminCard>
                </dl>
              </div>

              <AdminCard variant="filled" className="space-y-3">
                <div className="flex items-center gap-2">
                  <RiFileListLine className="h-4 w-4 text-text-soft" />
                  <h3 className="text-sm font-semibold text-text-strong">
                    {formatMessage({
                      id: "cockpit.actions.requirements",
                      defaultMessage: "Submission requirements",
                    })}
                  </h3>
                </div>
                <p className="text-sm text-text-sub">
                  {formatMessage({
                    id: "cockpit.actions.requirementsDescription",
                    defaultMessage:
                      "Fields, media guidance, and review structure for operators and gardeners.",
                  })}
                </p>
                <div className="space-y-2">
                  {displayAction.inputs.length > 0 ? (
                    displayAction.inputs.map((input) => (
                      <AdminCard variant="outlined" key={input.key} className="px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-text-strong">{input.title}</p>
                          <span className="text-xs text-text-soft">{input.type}</span>
                        </div>
                        {input.required ? (
                          <p className="mt-1 text-xs text-text-soft">
                            {formatMessage({ id: "app.admin.actions.detailsConfig.requiredField" })}
                          </p>
                        ) : null}
                      </AdminCard>
                    ))
                  ) : (
                    <p className="text-sm text-text-sub">
                      {formatMessage({
                        id: "cockpit.actions.noInputs",
                        defaultMessage: "No form fields configured",
                      })}
                    </p>
                  )}
                </div>
              </AdminCard>
            </div>
          </AdminCard>

          <div className="space-y-4">
            <AdminCard className="space-y-4">
              <div className="flex items-center gap-2">
                <RiImageLine className="h-4 w-4 text-text-soft" />
                <div>
                  <h3 className="text-sm font-semibold text-text-strong">
                    {formatMessage({ id: "app.actions.detail.media" })}
                  </h3>
                  <p className="mt-1 text-sm text-text-sub">
                    {formatMessage({
                      id: "cockpit.actions.mediaDescription",
                      defaultMessage: "Reference media and banner assets attached to this action.",
                    })}
                  </p>
                </div>
              </div>

              {displayAction.media.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {displayAction.media.map((url, index) => (
                    <ActionDetailMediaTile
                      key={`${url}-${index}`}
                      src={url}
                      alt={formatMessage(
                        {
                          id: "app.actions.detail.mediaAlt",
                          defaultMessage: "Action media {index}",
                        },
                        { index: index + 1 }
                      )}
                      domain={action.domain}
                      title={displayAction.title}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-sub">
                  {formatMessage({
                    id: "cockpit.actions.noMedia",
                    defaultMessage: "No media attached",
                  })}
                </p>
              )}
            </AdminCard>
          </div>
        </div>
      </CanvasRouteContent>
    </CanvasRouteFrame>
  );
}
