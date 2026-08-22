import {
  type CommitmentReadModel,
  type PoolConsoleController,
  StatusBadge,
} from "@green-goods/shared";
import { RiArrowRightSLine, RiSeedlingLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import {
  commitmentStateChip,
  directionLabel,
  formatUnixDate,
  shortAddress,
} from "./poolPresentation";

export type PoolCommitmentScope = "open" | "confirmed" | "past";

export interface PoolCommitmentsCardProps {
  console: PoolConsoleController;
  scope: PoolCommitmentScope;
  onScopeChange: (scope: PoolCommitmentScope) => void;
  /** Only the past-due rows, the W7@due-live cast reached from the summary row. */
  dueOnly: boolean;
  onDueOnlyChange: (dueOnly: boolean) => void;
  onOpenCommitment: (commitment: CommitmentReadModel) => void;
  onSeed: () => void;
  canSeed: boolean;
}

/**
 * One commitments card for the whole pool (uiux-spec §6.2 section 3, 2026-07-18
 * addendum): search, the Open · Confirmed · Past chips, a Past due chip for
 * the live rows the chain would let anyone expire, and rows that open in the
 * left inspector. The row information contract: kind · lifecycle · at most one
 * attention chip; meta = who · how much · when. Creations still queued on this
 * device render above the indexed rows so a seeded commitment shows up before
 * the indexer has it.
 */
export function PoolCommitmentsCard({
  console: pool,
  scope,
  onScopeChange,
  dueOnly,
  onDueOnlyChange,
  onOpenCommitment,
  onSeed,
  canSeed,
}: PoolCommitmentsCardProps) {
  const { formatMessage, locale } = useIntl();
  const { model, titles, pendingCreates, isOnline, isActing, acts } = pool;
  const [search, setSearch] = useState("");
  const dueIds = useMemo(() => new Set(model.dueLive.map((row) => row.id)), [model.dueLive]);

  const titleOf = (commitment: CommitmentReadModel) =>
    (commitment.metadataCID && titles.get(commitment.metadataCID.trim())?.title) ??
    formatMessage(
      { id: "cockpit.garden.pool.row.untitled", defaultMessage: "Commitment {id}" },
      { id: commitment.commitmentId.toString() }
    );

  const rows = useMemo(() => {
    const base = dueOnly ? model.dueLive : model.groups[scope];
    const needle = search.trim().toLowerCase();
    if (!needle) return base;
    return base.filter((row) => titleOf(row).toLowerCase().includes(needle));
    // titleOf reads from `titles`, listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueOnly, model.dueLive, model.groups, scope, search, titles]);

  const actDisabled = !isOnline || isActing;
  const total = model.groups.open.length + model.groups.confirmed.length + model.groups.past.length;

  return (
    <AdminCard
      variant="elevated"
      data-component="PoolCommitmentsCard"
      data-testid="pool-commitments"
      id="pool-commitments"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="label-md text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.commitments.title",
            defaultMessage: "Commitments",
          })}
        </h3>
        <AdminButton
          type="button"
          variant="outlined"
          size="sm"
          leadingIcon={<RiSeedlingLine className="h-4 w-4" />}
          onClick={onSeed}
          disabled={!canSeed}
        >
          {formatMessage({ id: "cockpit.garden.pool.act.seed", defaultMessage: "Seed commitment" })}
        </AdminButton>
      </div>

      <AdminSearchToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder={formatMessage({
          id: "cockpit.garden.pool.commitments.search",
          defaultMessage: "Search commitments",
        })}
      >
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={formatMessage({
            id: "cockpit.garden.pool.commitments.scope",
            defaultMessage: "Commitment scope",
          })}
        >
          <AdminFilterChip
            label={formatMessage({
              id: "cockpit.garden.pool.commitments.open",
              defaultMessage: "Open",
            })}
            selected={scope === "open" && !dueOnly}
            onToggle={() => {
              onDueOnlyChange(false);
              onScopeChange("open");
            }}
          />
          <AdminFilterChip
            label={formatMessage({
              id: "cockpit.garden.pool.commitments.confirmed",
              defaultMessage: "Confirmed",
            })}
            selected={scope === "confirmed" && !dueOnly}
            onToggle={() => {
              onDueOnlyChange(false);
              onScopeChange("confirmed");
            }}
          />
          <AdminFilterChip
            label={formatMessage({
              id: "cockpit.garden.pool.commitments.past",
              defaultMessage: "Past",
            })}
            selected={scope === "past" && !dueOnly}
            onToggle={() => {
              onDueOnlyChange(false);
              onScopeChange("past");
            }}
          />
          {model.dueLive.length > 0 ? (
            <AdminFilterChip
              label={formatMessage(
                {
                  id: "cockpit.garden.pool.commitments.pastDue",
                  defaultMessage: "Past due ({count})",
                },
                { count: model.dueLive.length }
              )}
              selected={dueOnly}
              onToggle={() => onDueOnlyChange(!dueOnly)}
            />
          ) : null}
        </div>
      </AdminSearchToolbar>

      {pendingCreates.length > 0 && scope === "open" && !dueOnly ? (
        <ul className="divide-y divide-[rgb(var(--m3-outline-variant))]" data-testid="pool-queued">
          {pendingCreates.map((row) => (
            <li key={row.jobId} className="flex flex-wrap items-center gap-2 py-2">
              <span className="truncate text-body-md text-text-strong" title={row.title ?? ""}>
                {row.title ??
                  formatMessage({
                    id: "cockpit.garden.pool.queued.untitled",
                    defaultMessage: "New commitment",
                  })}
              </span>
              <StatusBadge variant={row.failed ? "error" : "info"} size="sm">
                {row.failed
                  ? formatMessage({
                      id: "cockpit.garden.pool.queued.failed",
                      defaultMessage: "Failed to send",
                    })
                  : row.waitingForMembership
                    ? formatMessage({
                        id: "cockpit.garden.pool.queued.waiting",
                        defaultMessage: "Waiting for membership",
                      })
                    : formatMessage({
                        id: "cockpit.garden.pool.queued.queued",
                        defaultMessage: "Queued",
                      })}
              </StatusBadge>
              <span className="text-xs text-text-soft">
                {`${row.targetUnits} ${row.unitLabel}`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {total === 0 && pendingCreates.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
          <RiSeedlingLine className="h-6 w-6 text-text-soft" aria-hidden />
          <p className="label-md text-text-strong">
            {formatMessage({
              id: "cockpit.garden.pool.commitments.emptyTitle",
              defaultMessage: "No commitments yet",
            })}
          </p>
          <p className="max-w-sm text-sm text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.commitments.emptyBody",
              defaultMessage:
                "Offers and requests between neighbours show up here. Seed the first one to begin.",
            })}
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="flex min-h-24 items-center justify-center text-center text-sm text-text-soft">
          {search.trim()
            ? formatMessage({
                id: "cockpit.garden.pool.commitments.noMatch",
                defaultMessage: "Nothing matches that search.",
              })
            : formatMessage({
                id: "cockpit.garden.pool.commitments.noneInScope",
                defaultMessage: "Nothing here right now.",
              })}
        </p>
      ) : (
        <ul className="divide-y divide-[rgb(var(--m3-outline-variant))]">
          {rows.map((commitment) => {
            const chip = commitmentStateChip(commitment, formatMessage);
            const title = titleOf(commitment);
            const isDue = dueIds.has(commitment.id);
            const who = commitment.counterparty
              ? `${shortAddress(commitment.creator)} → ${shortAddress(commitment.counterparty)}`
              : shortAddress(commitment.creator);
            const amount =
              `${commitment.targetUnits.toString()} ${commitment.unitLabel ?? ""}`.trim();
            const due = commitment.dueDate
              ? formatMessage(
                  { id: "cockpit.garden.pool.row.due", defaultMessage: "due {date}" },
                  { date: formatUnixDate(commitment.dueDate, locale, "—") }
                )
              : "";
            return (
              <li
                key={commitment.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
                data-testid={`pool-commitment-${commitment.commitmentId.toString()}`}
              >
                <button
                  type="button"
                  className="m3-state-layer flex min-w-0 flex-1 items-center gap-3 rounded-[var(--m3-shape-sm)] py-1 text-left [--state-layer-color:var(--m3-on-surface)]"
                  onClick={() => onOpenCommitment(commitment)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-body-md text-text-strong" title={title}>
                        {title}
                      </span>
                      <StatusBadge variant="info" size="sm">
                        {directionLabel(commitment.direction, formatMessage)}
                      </StatusBadge>
                      <StatusBadge variant={chip.variant} size="sm">
                        {chip.label}
                      </StatusBadge>
                      {isDue ? (
                        <StatusBadge variant="error" size="sm">
                          {formatMessage({
                            id: "cockpit.garden.pool.row.pastDue",
                            defaultMessage: "Past due",
                          })}
                        </StatusBadge>
                      ) : null}
                    </span>
                    <span className="block text-xs text-text-soft">
                      {[who, amount, due].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <RiArrowRightSLine className="h-4 w-4 shrink-0 text-text-soft" aria-hidden />
                </button>
                {isDue ? (
                  <AdminButton
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => void acts.expire(commitment.commitmentId)}
                    disabled={actDisabled}
                  >
                    {formatMessage({
                      id: "cockpit.garden.pool.row.act.expire",
                      defaultMessage: "Expire now",
                    })}
                  </AdminButton>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {dueOnly && rows.length > 0 ? (
        <p className="text-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.commitments.dueNote",
            defaultMessage:
              "Past due alone changes nothing. A row stays live until the expiry lands on chain; failure keeps it live.",
          })}
        </p>
      ) : null}
    </AdminCard>
  );
}
