import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { DOMAIN_CONFIG } from "@green-goods/shared/config/domain";
import { ACTION_CAPITAL_LABEL_IDS } from "@green-goods/shared/hooks/admin-ui/actions/actions.utils";
import { deriveActionDetailModel } from "@green-goods/shared/hooks/admin-ui/actions/actions.workspaceModel";
import type { Action } from "@green-goods/shared/types/domain";
import { formatDateTime } from "@green-goods/shared/utils/time";
import { RiEditLine, RiFileListLine, RiImageLine, RiSearchLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { ActionDetailMediaTile } from "./ActionDetailPrimitives";

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
        <EmptyState
          icon={<RiSearchLine />}
          title={formatMessage({ id: "app.actions.notFound" })}
          action={
            <AdminButton size="sm" variant="outlined" onClick={onClose}>
              {formatMessage({
                id: "app.actions.backToActions",
                defaultMessage: "Back to Actions",
              })}
            </AdminButton>
          }
        />
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
            <h3 className="type-body font-semibold text-text-strong">
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
            <p className="type-body text-text-sub">
              {formatMessage({
                id: "cockpit.actions.noMedia",
                defaultMessage: "No media attached",
              })}
            </p>
          )}
        </section>

        <div className="space-y-5 xl:order-1">
          <p className="type-body text-text-sub">
            {displayAction.description || formatMessage({ id: "admin.actions.noDescription" })}
          </p>
          <FactList frame="inset">
            <FactRow
              label={formatMessage({ id: "app.admin.actions.create.domainLabel" })}
              value={
                <span className="inline-flex items-center gap-1.5">
                  {DomainIcon ? <DomainIcon className="h-4 w-4 text-text-soft" /> : null}
                  {domainLabel}
                </span>
              }
            />
            <FactRow
              label={formatMessage({
                id: "cockpit.actions.lifecycle",
                defaultMessage: "Lifecycle",
              })}
              value={lifecycleLabel}
            />
            <FactRow
              label={formatMessage({ id: "app.actions.detail.startTime" })}
              value={formatDateTime(action.startTime)}
            />
            <FactRow
              label={formatMessage({ id: "app.actions.detail.endTime" })}
              value={formatDateTime(action.endTime)}
            />
            <FactRow
              label={formatMessage({ id: "app.actions.detail.capitals" })}
              value={
                action.capitals.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {action.capitals.map((capital) => (
                      <span
                        key={capital}
                        className="inline-flex items-center rounded-full bg-bg-soft px-2.5 py-1 type-meta font-medium text-text-sub"
                      >
                        {formatMessage({ id: ACTION_CAPITAL_LABEL_IDS[capital] })}
                      </span>
                    ))}
                  </span>
                ) : (
                  "—"
                )
              }
            />
          </FactList>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <RiFileListLine className="h-4 w-4 text-text-soft" />
              <h3 className="type-body font-semibold text-text-strong">
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
                    <span className="type-body font-medium text-text-strong">{input.title}</span>
                    <span className="type-meta-sm text-text-soft">{input.type}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="type-body text-text-sub">
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
