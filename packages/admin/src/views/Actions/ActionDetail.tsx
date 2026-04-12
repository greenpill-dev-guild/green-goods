import {
  ActionBannerFallback,
  Button,
  DEFAULT_CHAIN_ID,
  type Domain,
  StatusBadge,
  Surface,
  formatDateTime,
  ImageWithFallback,
  useActions,
  useRole,
} from "@green-goods/shared";
import { RiEditLine, RiFileListLine, RiImageLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";

interface ActionDetailMediaTileProps {
  src?: string;
  alt: string;
  domain: Domain;
  title: string;
}

function normalizeTimestamp(value: number): number {
  return value > 10_000_000_000 ? value : value * 1000;
}

function getActionLifecycleState(startTime: number, endTime: number) {
  const now = Date.now();
  const start = normalizeTimestamp(startTime);
  const end = normalizeTimestamp(endTime);

  if (now < start) {
    return "upcoming" as const;
  }

  if (now > end) {
    return "completed" as const;
  }

  return "active" as const;
}

function getLifecycleVariant(lifecycle: "upcoming" | "active" | "completed") {
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

export default function ActionDetail() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const { role } = useRole();
  const { data: actions = [], isLoading } = useActions(DEFAULT_CHAIN_ID);
  const canManageActions = role === "deployer" || role === "operator";
  const action = actions.find((record) => record.id === id);

  if (isLoading) {
    return (
      <div className="pb-6">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 sm:px-6">
          <PageHeader
            title={formatMessage({ id: "app.admin.nav.actions", defaultMessage: "Actions" })}
            description={formatMessage({
              id: "cockpit.actions.detailDescription",
              defaultMessage: "Review lifecycle details and the submission requirements for this action.",
            })}
            variant="canvas"
            sticky
          />
          <div className="space-y-4" role="status" aria-live="polite">
            <span className="sr-only">{formatMessage({ id: "app.actions.loading" })}</span>
            <div className="h-28 rounded-[1.4rem] skeleton-shimmer" />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
              <div className="h-80 rounded-[1.4rem] skeleton-shimmer" />
              <div className="h-80 rounded-[1.4rem] skeleton-shimmer" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!action) {
    return (
      <div className="pb-6">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 sm:px-6">
          <PageHeader
            title={formatMessage({ id: "app.actions.notFound" })}
            description={formatMessage({
              id: "cockpit.actions.detailDescription",
              defaultMessage: "Review lifecycle details and the submission requirements for this action.",
            })}
            variant="canvas"
            backLink={{
              to: "/actions",
              label: formatMessage({
                id: "app.actions.backToActions",
                defaultMessage: "Back to actions",
              }),
            }}
            sticky
          />
          <Surface elevation="raised" padding="default" className="text-center">
            <p className="text-sm text-text-sub">{formatMessage({ id: "app.actions.notFound" })}</p>
          </Surface>
        </div>
      </div>
    );
  }

  const lifecycle = getActionLifecycleState(action.startTime, action.endTime);
  const lifecycleLabel = formatMessage({
    id: `cockpit.actions.status.${lifecycle}`,
    defaultMessage:
      lifecycle === "active" ? "Active" : lifecycle === "upcoming" ? "Upcoming" : "Completed",
  });

  return (
    <div className="pb-6">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 sm:px-6">
        <PageHeader
          title={action.title}
          description={action.description || formatMessage({ id: "admin.actions.noDescription" })}
          variant="canvas"
          backLink={{
            to: "/actions",
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
                <Link to={`/actions/${id}/edit`}>
                  <RiEditLine className="h-4 w-4" />
                  {formatMessage({ id: "app.actions.edit" })}
                </Link>
              </Button>
            ) : undefined
          }
          sticky
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <Surface elevation="raised" padding="default" className="space-y-6">
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
                  <div className="rounded-lg border border-stroke-soft bg-bg-weak px-4 py-3">
                    <dt className="text-xs text-text-soft">
                      {formatMessage({ id: "cockpit.actions.lifecycle", defaultMessage: "Lifecycle" })}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-text-strong">{lifecycleLabel}</dd>
                  </div>
                  <div className="rounded-lg border border-stroke-soft bg-bg-weak px-4 py-3">
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
                  </div>
                  <div className="rounded-lg border border-stroke-soft bg-bg-weak px-4 py-3">
                    <dt className="text-xs text-text-soft">
                      {formatMessage({ id: "app.actions.detail.startTime" })}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-text-strong">
                      {formatDateTime(action.startTime)}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-stroke-soft bg-bg-weak px-4 py-3">
                    <dt className="text-xs text-text-soft">
                      {formatMessage({ id: "app.actions.detail.endTime" })}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-text-strong">
                      {formatDateTime(action.endTime)}
                    </dd>
                  </div>
                </dl>
              </div>

              <Surface elevation="ground" padding="default" className="space-y-3">
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
                  {action.inputs.length > 0 ? (
                    action.inputs.map((input) => (
                      <div
                        key={input.key}
                        className="rounded-lg border border-stroke-soft bg-bg-white px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-text-strong">{input.title}</p>
                          <span className="text-xs text-text-soft">{input.type}</span>
                        </div>
                        {input.required ? (
                          <p className="mt-1 text-xs text-text-soft">
                            {formatMessage({ id: "app.admin.actions.detailsConfig.requiredField" })}
                          </p>
                        ) : null}
                      </div>
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
              </Surface>
            </div>
          </Surface>

          <div className="space-y-4">
            <Surface elevation="raised" padding="default" className="space-y-4">
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

              {action.media.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {action.media.map((url, index) => (
                    <ActionDetailMediaTile
                      key={`${url}-${index}`}
                      src={url}
                      alt={formatMessage(
                        { id: "app.actions.detail.mediaAlt", defaultMessage: "Action media {index}" },
                        { index: index + 1 }
                      )}
                      domain={action.domain}
                      title={action.title}
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
            </Surface>
          </div>
        </div>
      </div>
    </div>
  );
}
