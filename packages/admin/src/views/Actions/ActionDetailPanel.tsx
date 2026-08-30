import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { DOMAIN_CONFIG } from "@green-goods/shared/config/domain";
import { ACTION_CAPITAL_LABEL_IDS } from "@green-goods/shared/hooks/admin-ui/actions/actions.utils";
import { deriveActionDetailModel } from "@green-goods/shared/hooks/admin-ui/actions/actions.workspaceModel";
import type { Action } from "@green-goods/shared/types/domain";
import { formatDateTime } from "@green-goods/shared/utils/time";
import { RiEditLine, RiFileListLine, RiImageLine } from "@remixicon/react";
import { type ReactNode } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { ActionDetailMediaTile } from "./ActionDetailPrimitives";

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="label-xs text-text-soft">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-text-strong">{children}</dd>
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
          <AdminButton size="sm" variant="outlined" onClick={onClose}>
            {formatMessage({ id: "app.actions.backToActions", defaultMessage: "Back to Actions" })}
          </AdminButton>
        </AdminCard>
      </div>
    );
  }

  const { displayAction, lifecycle, lifecycleVariant } = deriveActionDetailModel(
    action,
    intl.locale
  );
  const lifecycleLabel = formatMessage({
    id: `cockpit.actions.status.${lifecycle}`,
    defaultMessage:
      lifecycle === "active" ? "Active" : lifecycle === "upcoming" ? "Upcoming" : "Completed",
  });
  const domainConfig = action.domain !== null ? DOMAIN_CONFIG[action.domain] : undefined;
  const domainLabel = formatMessage({ id: domainConfig?.labelId ?? "app.domain.tab.unknown" });
  const DomainIcon = domainConfig?.icon;

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <StatusBadge variant={lifecycleVariant}>{lifecycleLabel}</StatusBadge>
        {canManageActions ? (
          <AdminButton
            size="sm"
            variant="outlined"
            leadingIcon={<RiEditLine className="h-4 w-4" />}
            onClick={onEdit}
          >
            {formatMessage({ id: "app.actions.edit" })}
          </AdminButton>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(15rem,1fr)]">
        <section className="space-y-3 xl:order-2">
          <div className="flex items-center gap-2">
            <RiImageLine className="h-4 w-4 text-text-soft" />
            <h3 className="text-sm font-semibold text-text-strong">
              {formatMessage({ id: "app.actions.detail.media" })}
            </h3>
          </div>
          {displayAction.media.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
              {displayAction.media.map((url, index) => (
                <ActionDetailMediaTile
                  key={`${url}-${index}`}
                  src={url}
                  alt={formatMessage(
                    { id: "app.actions.detail.mediaAlt", defaultMessage: "Action media {index}" },
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
        </section>

        <div className="space-y-5 xl:order-1">
          <p className="text-sm text-text-sub">
            {displayAction.description || formatMessage({ id: "admin.actions.noDescription" })}
          </p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <DetailField label={formatMessage({ id: "app.admin.actions.create.domainLabel" })}>
              <span className="inline-flex items-center gap-1.5">
                {DomainIcon ? <DomainIcon className="h-4 w-4 text-text-soft" /> : null}
                {domainLabel}
              </span>
            </DetailField>
            <DetailField
              label={formatMessage({
                id: "cockpit.actions.lifecycle",
                defaultMessage: "Lifecycle",
              })}
            >
              {lifecycleLabel}
            </DetailField>
            <DetailField label={formatMessage({ id: "app.actions.detail.startTime" })}>
              {formatDateTime(action.startTime)}
            </DetailField>
            <DetailField label={formatMessage({ id: "app.actions.detail.endTime" })}>
              {formatDateTime(action.endTime)}
            </DetailField>
            <div className="sm:col-span-2">
              <dt className="label-xs text-text-soft">
                {formatMessage({ id: "app.actions.detail.capitals" })}
              </dt>
              <dd className="mt-1.5">
                {action.capitals.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {action.capitals.map((capital) => (
                      <span
                        key={capital}
                        className="inline-flex items-center rounded-full bg-bg-soft px-2.5 py-1 text-body-sm font-medium text-text-sub"
                      >
                        {formatMessage({ id: ACTION_CAPITAL_LABEL_IDS[capital] })}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-text-sub">—</span>
                )}
              </dd>
            </div>
          </dl>

          <section className="space-y-2">
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
              <ul className="divide-y divide-stroke-soft overflow-hidden rounded-lg border border-stroke-soft">
                {displayAction.inputs.map((input) => (
                  <li
                    key={input.key}
                    className="flex items-center justify-between gap-2 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium text-text-strong">{input.title}</span>
                    <span className="text-xs text-text-soft">{input.type}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-sub">
                {formatMessage({
                  id: "cockpit.actions.noInputs",
                  defaultMessage: "No form fields configured",
                })}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
