import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { RiArrowRightSLine, RiSeedlingLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { ActPhaseLine } from "@/components/ActPhaseLine";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { CommitmentPeople } from "./CommitmentPeople";
import { CommitmentExpireDialog } from "./CommitmentExpireDialog";
import { PoolGroupRow } from "./PoolGroupRow";
import { GardenPoolTarget } from "./PoolTarget";
import {
  type PoolCommitmentFocus,
  type PoolCommitmentGroup,
  type PoolCommitmentScope,
  selectPoolCommitmentRows,
} from "./poolCommitmentRows";
import { commitmentStateChip, directionEdgeClass, directionLabel } from "./poolPresentation";
import { dueDateText } from "./poolTime";

export type { PoolCommitmentFocus, PoolCommitmentScope } from "./poolCommitmentRows";

export interface PoolCommitmentsCardProps {
  console: PoolConsoleController;
  scope: PoolCommitmentScope;
  onScopeChange: (scope: PoolCommitmentScope) => void;
  focus: PoolCommitmentFocus;
  onFocusChange: (focus: PoolCommitmentFocus) => void;
  onOpenCommitment: (commitment: CommitmentReadModel) => void;
  /** Open a group of copies made together in its inspector. */
  onOpenGroup: (group: PoolCommitmentGroup) => void;
  onSeed: () => void;
  canSeed: boolean;
  /** Workspace tone for the expire confirmation this card can open. */
  tone?: "garden" | "community";
}

/**
 * One commitments card for the whole pool (uiux-spec §6.2 section 3, 2026-07-18
 * addendum): search, the Open · Confirmed · Past chips, a Past due chip for
 * the live rows the chain would let anyone expire, a Needs recovery chip for
 * those and the disputed ones, and rows that open in the left inspector. The row information contract: kind · lifecycle · at most one
 * attention chip; meta = who · how much · when. Creations still queued on this
 * device render above the indexed rows so a seeded commitment shows up before
 * the indexer has it. Copies made together are one group row (PRD-1022 D3),
 * and a group's copies still queued fold into it as "didn't send" with Finish
 * Creating, rather than as queued rows of their own.
 */
/** A group past its deadline can't be finished; one with none never lapses. */
function isPastDeadline(dueDate: bigint | null | undefined, now: number): boolean {
  return Boolean(dueDate) && Number(dueDate) * 1000 <= now;
}

export function PoolCommitmentsCard({
  console: pool,
  scope,
  onScopeChange,
  focus,
  onFocusChange,
  onOpenCommitment,
  onOpenGroup,
  onSeed,
  canSeed,
  tone,
}: PoolCommitmentsCardProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const now = Date.now();
  const { model, titles, isOnline, isActing, acts } = pool;
  const [search, setSearch] = useState("");
  const [expireTarget, setExpireTarget] = useState<CommitmentReadModel | null>(null);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  // Nothing in the admin sends a queued creation on its own, so each row that is
  // still here offers the send and, where the queue allows it, the way out.
  const runQueued = async (jobId: string, act: (jobId: string) => Promise<void>) => {
    setBusyJobId(jobId);
    try {
      await act(jobId);
    } finally {
      setBusyJobId(null);
    }
  };
  const dueIds = useMemo(() => new Set(model.dueLive.map((row) => row.id)), [model.dueLive]);

  const titleOf = (commitment: CommitmentReadModel) =>
    (commitment.metadataCID && titles.get(commitment.metadataCID.trim())?.title) ??
    formatMessage(
      { id: "cockpit.garden.pool.row.untitled", defaultMessage: "Commitment {id}" },
      { id: commitment.commitmentId.toString() }
    );

  const rows = selectPoolCommitmentRows({
    model,
    commitments: pool.commitments,
    metadataByCID: titles,
    scope,
    focus,
    search,
    titleOf,
  });
  // A group's queued copies are counted on its row, so they leave the queued
  // list, while it can still finish them. Past its deadline they stay listed on
  // their own, where Discard clears them.
  const shownGroups = new Set(
    rows.flatMap((entry) =>
      entry.kind === "group" && !isPastDeadline(entry.children[0]?.dueDate, now)
        ? [entry.displayGroupId]
        : []
    )
  );
  const foldedJobs = new Set(
    [...pool.queuedGroupCopies]
      .filter(([groupId]) => shownGroups.has(groupId))
      .flatMap(([, jobIds]) => jobIds)
  );
  const pendingCreates = pool.pendingCreates.filter((row) => !foldedJobs.has(row.jobId));

  const actDisabled = !isOnline || isActing;
  const total = model.groups.open.length + model.groups.confirmed.length + model.groups.past.length;

  return (
    <>
      <AdminCard
        variant="elevated"
        data-component="PoolCommitmentsCard"
        data-testid="pool-commitments"
        id="pool-commitments"
        className="space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AdminCardTitle>
            {formatMessage({
              id: "cockpit.garden.pool.promises.title",
              defaultMessage: "Promises",
            })}
          </AdminCardTitle>
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            leadingIcon={<RiSeedlingLine className="h-4 w-4" />}
            onClick={onSeed}
            disabled={!canSeed}
          >
            {formatMessage({
              id: "cockpit.garden.pool.act.seedPromises",
              defaultMessage: "Seed Promises",
            })}
          </AdminButton>
        </div>

        <AdminSearchToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder={formatMessage({
            id: "cockpit.garden.pool.promises.search",
            defaultMessage: "Search promises",
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
              selected={scope === "open" && focus === null}
              onToggle={() => {
                onFocusChange(null);
                onScopeChange("open");
              }}
            />
            <AdminFilterChip
              label={formatMessage({
                id: "cockpit.garden.pool.commitments.confirmed",
                defaultMessage: "Confirmed",
              })}
              selected={scope === "confirmed" && focus === null}
              onToggle={() => {
                onFocusChange(null);
                onScopeChange("confirmed");
              }}
            />
            <AdminFilterChip
              label={formatMessage({
                id: "cockpit.garden.pool.commitments.past",
                defaultMessage: "Past",
              })}
              selected={scope === "past" && focus === null}
              onToggle={() => {
                onFocusChange(null);
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
                selected={focus === "pastDue"}
                onToggle={() => onFocusChange(focus === "pastDue" ? null : "pastDue")}
              />
            ) : null}
            {model.needsRecovery.length > 0 ? (
              <AdminFilterChip
                label={formatMessage(
                  {
                    id: "cockpit.garden.pool.commitments.needsRecovery",
                    defaultMessage: "Needs recovery ({count})",
                  },
                  { count: model.needsRecovery.length }
                )}
                selected={focus === "recovery"}
                onToggle={() => onFocusChange(focus === "recovery" ? null : "recovery")}
              />
            ) : null}
          </div>
        </AdminSearchToolbar>

        {pendingCreates.length > 0 && scope === "open" && focus === null ? (
          <ul className="divide-y divide-stroke-soft" data-testid="pool-queued">
            {pendingCreates.map((row) => (
              <li
                key={row.jobId}
                className={`flex flex-wrap items-center gap-2 py-2 ps-3 ${directionEdgeClass(row.direction)}`}
              >
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
                <span className="body-xs text-text-soft">
                  {`${row.targetUnits} ${row.unitLabel}`}
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  {row.discardable ? (
                    <AdminButton
                      type="button"
                      variant="text"
                      size="sm"
                      disabled={busyJobId !== null}
                      onClick={() => void runQueued(row.jobId, acts.discardQueued)}
                    >
                      {formatMessage({
                        id: "cockpit.garden.pool.queued.discard",
                        defaultMessage: "Discard",
                      })}
                    </AdminButton>
                  ) : null}
                  <AdminButton
                    type="button"
                    variant="outlined"
                    size="sm"
                    disabled={!isOnline || busyJobId !== null}
                    loading={busyJobId === row.jobId}
                    onClick={() => void runQueued(row.jobId, acts.retryQueued)}
                  >
                    {/* A row that never tried has nothing to try again (A24). */}
                    {row.failed
                      ? formatMessage({
                          id: "cockpit.garden.pool.queued.retry",
                          defaultMessage: "Try Again",
                        })
                      : formatMessage({
                          id: "cockpit.garden.pool.queued.sendNow",
                          defaultMessage: "Send Now",
                        })}
                  </AdminButton>
                </span>
                <div className="basis-full">
                  <ActPhaseLine
                    phase={pool.queuedPhase(row.jobId)}
                    chainId={pool.chainId}
                    confirmed={formatMessage({
                      id: "cockpit.garden.pool.queued.sent",
                      defaultMessage: "Sent. This row leaves once the index shows the commitment.",
                    })}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {total === 0 && pendingCreates.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
            <RiSeedlingLine className="h-6 w-6 text-text-soft" aria-hidden />
            <AdminCardTitle>
              {formatMessage({
                id: "cockpit.garden.pool.commitments.emptyTitle",
                defaultMessage: "No commitments yet",
              })}
            </AdminCardTitle>
            <p className="max-w-sm body-sm text-text-soft">
              {formatMessage({
                id: "cockpit.garden.pool.commitments.emptyBody",
                defaultMessage:
                  "Offers and requests between neighbours show up here. Seed the first one to begin.",
              })}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <p className="flex min-h-24 items-center justify-center text-center body-sm text-text-soft">
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
          <ul className="divide-y divide-stroke-soft">
            {rows.map((entry) => {
              if (entry.kind === "group") {
                return (
                  <PoolGroupRow
                    key={entry.key}
                    group={entry}
                    title={titleOf(entry.children[0] as CommitmentReadModel)}
                    unsent={
                      shownGroups.has(entry.displayGroupId)
                        ? (pool.queuedGroupCopies.get(entry.displayGroupId)?.length ?? 0)
                        : 0
                    }
                    finishing={pool.finishingGroupId === entry.displayGroupId}
                    finishDisabled={!isOnline || pool.finishingGroupId !== null}
                    onOpen={() => onOpenGroup(entry)}
                    onFinish={() => void acts.finishCreating(entry.displayGroupId)}
                  />
                );
              }
              const commitment = entry.record;
              const chip = commitmentStateChip(commitment, formatMessage);
              const title = titleOf(commitment);
              const isDue = dueIds.has(commitment.id);
              const amount =
                `${commitment.targetUnits.toString()} ${commitment.unitLabel ?? ""}`.trim();
              const due = commitment.dueDate
                ? formatMessage(
                    { id: "cockpit.garden.pool.row.due", defaultMessage: "due {date}" },
                    { date: dueDateText(intl, Number(commitment.dueDate) * 1000, now) }
                  )
                : "";
              return (
                <li
                  key={commitment.id}
                  className={`flex flex-wrap items-center justify-between gap-2 py-2 ps-3 ${directionEdgeClass(commitment.direction)}`}
                  data-testid={`pool-commitment-${commitment.commitmentId.toString()}`}
                >
                  {/* As in the group row: a 240px basis, so Expire Now… wraps
                      under the text on a narrow card. */}
                  <button
                    type="button"
                    className="m3-state-layer flex min-w-0 grow basis-60 items-center gap-3 rounded-[var(--m3-shape-sm)] py-1 text-left [--state-layer-color:var(--text-strong-950)]"
                    onClick={() => onOpenCommitment(commitment)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="whitespace-nowrap body-xs text-text-soft">
                          {directionLabel(commitment.direction, formatMessage)}
                        </span>
                        <span className="truncate text-body-md text-text-strong" title={title}>
                          {title}
                        </span>
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
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 body-xs text-text-soft">
                        {/* The "who" leg reads as people, not infrastructure. */}
                        <CommitmentPeople commitment={commitment} />
                        <span>· {amount}</span>
                        {due ? <span>· {due}</span> : null}
                      </span>
                    </span>
                    <RiArrowRightSLine className="h-4 w-4 shrink-0 text-text-soft" aria-hidden />
                  </button>
                  {isDue ? (
                    // Outlined where it sits: the red is for the confirm inside
                    // the dialog, which names the blast radius first.
                    <AdminButton
                      type="button"
                      variant="outlined"
                      size="sm"
                      className="ms-auto"
                      onClick={() => setExpireTarget(commitment)}
                      disabled={actDisabled}
                    >
                      {formatMessage({
                        id: "cockpit.garden.pool.row.act.expire",
                        defaultMessage: "Expire Now…",
                      })}
                    </AdminButton>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {focus === "pastDue" && rows.length > 0 ? (
          <p className="body-xs text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.commitments.dueNote",
              defaultMessage:
                "Past due alone changes nothing. A row stays live until the expiry lands on chain; failure keeps it live.",
            })}
          </p>
        ) : null}
      </AdminCard>

      <CommitmentExpireDialog
        isOpen={expireTarget !== null}
        onClose={() => setExpireTarget(null)}
        title={expireTarget ? titleOf(expireTarget) : ""}
        target={
          expireTarget ? (
            <GardenPoolTarget
              chainId={pool.chainId}
              garden={pool.garden}
              isProtocol={pool.pool?.poolType === "PROTOCOL"}
              record={titleOf(expireTarget)}
            />
          ) : undefined
        }
        tone={tone}
        isLoading={isActing}
        onConfirm={async () => {
          if (!expireTarget) return;
          await acts.expire(expireTarget.commitmentId);
          setExpireTarget(null);
        }}
      />
    </>
  );
}
