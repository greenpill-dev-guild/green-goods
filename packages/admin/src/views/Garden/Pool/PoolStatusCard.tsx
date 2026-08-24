import { Alert } from "@green-goods/shared/components/Alert";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { RiCheckLine, RiCloseLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { poolStatusChip } from "./poolPresentation";

export interface PoolStatusCardProps {
  console: PoolConsoleController;
  onEditSettings: () => void;
  onPause: () => void;
  onClosePool: () => void;
  onCompostPool: () => void;
  onReopenPool: () => void;
  onReviewLive: () => void;
}

function Checkline({ done, label }: { done: boolean; label: string }) {
  const Icon = done ? RiCheckLine : RiCloseLine;
  return (
    <li className="flex items-center gap-2 text-body-md text-[rgb(var(--m3-on-surface))]">
      <Icon
        className={
          done
            ? "h-4 w-4 shrink-0 text-[rgb(var(--tone-on-surface-accent))]"
            : "h-4 w-4 shrink-0 text-[rgb(var(--m3-on-surface-variant))]"
        }
        aria-hidden
      />
      <span>{label}</span>
    </li>
  );
}

/**
 * The pool is the container; this card is its one home in the rail: status,
 * the setup facts while a garden is being set up, the one rule a steward
 * consults once it runs (the commitment limit), the charter sentence, and the
 * lifecycle acts. The destructive exit is separated from the safe cluster.
 */
export function PoolStatusCard({
  console: pool,
  onEditSettings,
  onPause,
  onClosePool,
  onCompostPool,
  onReopenPool,
  onReviewLive,
}: PoolStatusCardProps) {
  const { formatMessage } = useIntl();
  const { model, isOnline, isActing, acts } = pool;
  const chip = poolStatusChip(model.status, model.season !== null, formatMessage);
  // Only a pool that has never been marked ready hands the charter and the cap
  // to the first-run flow. From Ready onward `setPoolCharter` and
  // `setProviderOpenCommitmentCap` carry no state guard (`PoolsLib`), and the
  // Start season flow asks for neither, so a steward who reopened an archived
  // pool or left setup half-way corrects them from here.
  const inSetup = model.status === "not-ready";
  const running = model.status === "open" || model.status === "paused";
  const offline = !isOnline;
  const cap = pool.pool?.providerOpenCommitmentCap ?? 0n;
  const offlineNote = formatMessage({
    id: "cockpit.garden.pool.offline",
    defaultMessage: "Needs a connection. Pool changes are sent straight to the chain.",
  });
  const actDisabled = offline || isActing;

  return (
    <AdminCard variant="elevated" data-component="PoolStatusCard" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="label-md text-text-strong">
            {formatMessage({
              id: "cockpit.garden.pool.status.title",
              defaultMessage: "Pool status",
            })}
          </h3>
          <p className="mt-1 text-xs text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.status.description",
              defaultMessage: "The container your seasons and campaigns run in.",
            })}
          </p>
        </div>
        <StatusBadge variant={chip.variant} size="sm">
          {chip.label}
        </StatusBadge>
      </div>

      {model.status === "not-ready" ? (
        <ul
          className="space-y-1.5"
          aria-label={formatMessage({
            id: "cockpit.garden.pool.setup.checklist",
            defaultMessage: "Setup checklist",
          })}
        >
          <Checkline
            done={model.readiness.charter}
            label={
              model.readiness.charter
                ? formatMessage({
                    id: "cockpit.garden.pool.setup.charterDone",
                    defaultMessage: "Agreement written",
                  })
                : formatMessage({
                    id: "cockpit.garden.pool.setup.charterMissing",
                    defaultMessage: "Agreement not written yet",
                  })
            }
          />
          <Checkline
            done={model.readiness.cap}
            label={
              model.readiness.cap
                ? formatMessage({
                    id: "cockpit.garden.pool.setup.capDone",
                    defaultMessage: "Commitment limit set",
                  })
                : formatMessage({
                    id: "cockpit.garden.pool.setup.capMissing",
                    defaultMessage: "Commitment limit not set",
                  })
            }
          />
        </ul>
      ) : (
        <dl className="space-y-2 text-body-md">
          {pool.charter.charter ? (
            <div>
              <dt className="label-xs text-text-soft">
                {formatMessage({
                  id: "cockpit.garden.pool.status.charter",
                  defaultMessage: "What this pool is for",
                })}
              </dt>
              <dd className="line-clamp-3 text-text-strong" title={pool.charter.charter.purpose}>
                {pool.charter.charter.purpose}
              </dd>
            </div>
          ) : pool.charter.isUnavailable ? (
            <div>
              <dt className="label-xs text-text-soft">
                {formatMessage({
                  id: "cockpit.garden.pool.status.charter",
                  defaultMessage: "What this pool is for",
                })}
              </dt>
              <dd className="text-text-soft">
                {formatMessage({
                  id: "cockpit.garden.pool.status.charterUnavailable",
                  defaultMessage: "The agreement could not be read right now.",
                })}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="label-xs text-text-soft">
              {formatMessage({
                id: "cockpit.garden.pool.status.cap",
                defaultMessage: "Commitment limit",
              })}
            </dt>
            <dd className="text-text-strong">
              {formatMessage(
                {
                  id: "cockpit.garden.pool.status.capValue",
                  defaultMessage: "{count} per person at once",
                },
                { count: cap.toString() }
              )}
            </dd>
          </div>
        </dl>
      )}

      {model.status === "not-ready" ? (
        <p className="text-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.setup.note",
            defaultMessage:
              "Setting up writes how this pool works and opens its first season. One pass, four short steps.",
          })}
        </p>
      ) : null}

      {model.status === "paused" ? (
        <Alert variant="warning">
          {pool.pauseReason.reason
            ? formatMessage(
                {
                  id: "cockpit.garden.pool.paused.withReason",
                  defaultMessage:
                    "Paused: “{reason}”. Members keep adding proof and recovering commitments; making, claiming, and confirming wait.",
                },
                { reason: pool.pauseReason.reason.reason }
              )
            : formatMessage({
                id: "cockpit.garden.pool.paused.noReason",
                defaultMessage:
                  "Paused. Members keep adding proof and recovering commitments; making, claiming, and confirming wait.",
              })}
        </Alert>
      ) : null}

      {running && !model.closure.allowed ? (
        <p className="text-xs text-text-soft" data-slot="close-blocked">
          {formatMessage(
            {
              id: "cockpit.garden.pool.close.blocked",
              defaultMessage:
                "{live, plural, one {# live commitment} other {# live commitments}} and {cycles, plural, one {# unfinished cycle} other {# unfinished cycles}} must be wound down before this pool can close.",
            },
            {
              live: (pool.pool?.liveCommitmentCount ?? 0n).toString(),
              cycles: (pool.pool?.nonTerminalCycleCount ?? 0n).toString(),
            }
          )}{" "}
          {(pool.pool?.liveCommitmentCount ?? 0n) > 0n ? (
            <AdminButton type="button" variant="text" size="sm" onClick={onReviewLive}>
              {formatMessage({
                id: "cockpit.garden.pool.close.reviewLive",
                defaultMessage: "Review live commitments",
              })}
            </AdminButton>
          ) : null}
        </p>
      ) : null}

      {offline && !inSetup ? (
        <p className="text-xs text-warning-dark" role="status">
          {offlineNote}
        </p>
      ) : null}

      {!inSetup && model.status !== "closed" && model.status !== "composted" ? (
        <div className="flex flex-wrap items-center gap-2">
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            onClick={onEditSettings}
            disabled={actDisabled}
          >
            {formatMessage({ id: "cockpit.garden.pool.act.editPool", defaultMessage: "Edit pool" })}
          </AdminButton>
          {model.status === "paused" ? (
            <AdminButton
              type="button"
              variant="filled"
              size="sm"
              onClick={() => void acts.resume()}
              disabled={actDisabled}
            >
              {formatMessage({
                id: "cockpit.garden.pool.act.resume",
                defaultMessage: "Resume pool",
              })}
            </AdminButton>
          ) : model.status === "open" ? (
            <AdminButton
              type="button"
              variant="outlined"
              size="sm"
              onClick={onPause}
              disabled={actDisabled}
            >
              {formatMessage({ id: "cockpit.garden.pool.act.pause", defaultMessage: "Pause…" })}
            </AdminButton>
          ) : null}
        </div>
      ) : null}

      {running && model.closure.allowed ? (
        <div className="flex flex-wrap items-center gap-2">
          <AdminButton
            type="button"
            variant="danger"
            size="sm"
            onClick={onClosePool}
            disabled={actDisabled}
          >
            {formatMessage({
              id: "cockpit.garden.pool.act.closePool",
              defaultMessage: "Close pool…",
            })}
          </AdminButton>
        </div>
      ) : null}

      {model.status === "closed" ? (
        <div className="space-y-3">
          <p className="text-body-md text-text-sub">
            {formatMessage({
              id: "cockpit.garden.pool.closed.note",
              defaultMessage:
                "The pool is closed. Its history stays with the garden. Archiving it keeps that history; reopening starts the next era.",
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton
              type="button"
              variant="outlined"
              size="sm"
              onClick={onCompostPool}
              disabled={actDisabled}
            >
              {formatMessage({
                id: "cockpit.garden.pool.act.compostPool",
                defaultMessage: "Archive pool…",
              })}
            </AdminButton>
          </div>
        </div>
      ) : null}

      {model.status === "composted" ? (
        <div className="space-y-3">
          <p className="text-body-md text-text-sub">
            {formatMessage({
              id: "cockpit.garden.pool.composted.note",
              defaultMessage:
                "This pool is archived. Reopening preserves its history; members can't take part again until a season opens.",
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton
              type="button"
              variant="filled"
              size="sm"
              onClick={onReopenPool}
              disabled={actDisabled}
            >
              {formatMessage({
                id: "cockpit.garden.pool.act.reopenPool",
                defaultMessage: "Reopen pool…",
              })}
            </AdminButton>
          </div>
        </div>
      ) : null}
    </AdminCard>
  );
}
