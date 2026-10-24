import { Button } from "@green-goods/shared/components/Button";
import { CommitmentRow } from "@green-goods/shared/components/Cards/CommitmentRow/CommitmentRow";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import {
  RiCalendarCloseLine,
  RiDeleteBinLine,
  RiFilterOffLine,
  RiRefreshLine,
  RiSeedlingLine,
  RiSendPlaneLine,
} from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { ActPhaseLine, actPhaseText } from "@/components/ActPhaseLine";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { CommitmentExpireDialog } from "./CommitmentExpireDialog";
import { PoolGroupRow } from "./PoolGroupRow";
import { GardenPoolTarget } from "./PoolTarget";
import {
  type PoolCommitmentFocus,
  type PoolCommitmentGroup,
  type PoolCommitmentScope,
  selectPoolCommitmentRows,
} from "./poolCommitmentRows";
import { commitmentStateChip, queuedCreationPill } from "./poolPresentation";
import { rowDueDetail } from "./poolTime";

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
 * Offers and Requests, the card's title since DL-077.
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
  const expireLabel = formatMessage({
    id: "cockpit.garden.pool.row.act.expire",
    defaultMessage: "Expire Now…",
  });
  const discardLabel = formatMessage({
    id: "cockpit.garden.pool.queued.discard",
    defaultMessage: "Discard",
  });
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
      { id: "cockpit.garden.pool.row.untitled", defaultMessage: "Promise {id}" },
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
              defaultMessage: "Offers and Requests",
            })}
          </AdminCardTitle>
          <Button
            type="button"
            emphasis="secondary"
            size="compact"
            leadingIcon={<RiSeedlingLine className="h-4 w-4" aria-hidden="true" />}
            onClick={onSeed}
            disabled={!canSeed}
          >
            {formatMessage({
              id: "cockpit.garden.pool.act.seedPromises",
              defaultMessage: "Seed Promises",
            })}
          </Button>
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
              defaultMessage: "Promise scope",
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
          <ul className="@container flex flex-col gap-(--gg-list-gap)" data-testid="pool-queued">
            {pendingCreates.map((row) => {
              const phase = pool.queuedPhase(row.jobId);
              const pill = queuedCreationPill(row, phase.status, formatMessage);
              const expired =
                !row.hasRecordedSend &&
                isPastDeadline(row.groupDueDate ? BigInt(row.groupDueDate) : null, now);
              const sentLine = formatMessage({
                id: "cockpit.garden.pool.queued.sent",
                defaultMessage: "Sent. This row leaves once the index shows the promise.",
              });
              // What the row says first: the act in flight, then why it cannot go, else how
              // much it promises, since a promise not created yet has no dialog to tell it.
              const said =
                actPhaseText(intl, { phase, chainId: pool.chainId, confirmed: sentLine }) ??
                (expired
                  ? formatMessage({
                      id: "cockpit.garden.pool.add.expired",
                      defaultMessage:
                        "This group's deadline has passed, so nothing can join it. Start a new group instead.",
                    })
                  : row.settlementDeferred
                    ? formatMessage({ id: "app.pool.queued.settlementDeferredNote" })
                    : null);
              // A failed act says so in the error color, as its phase line did.
              const note =
                said && phase.status === "failed" ? { text: said, tone: "error" as const } : said;
              const units = note ? null : `${row.targetUnits} ${row.unitLabel}`.trim() || null;
              const sendLabel = row.failed
                ? formatMessage({
                    id: "cockpit.garden.pool.queued.retry",
                    defaultMessage: "Try Again",
                  })
                : formatMessage({
                    id: "cockpit.garden.pool.queued.sendNow",
                    defaultMessage: "Send Now",
                  });
              const SendGlyph = row.failed ? RiRefreshLine : RiSendPlaneLine;
              return (
                <li key={row.jobId}>
                  <CommitmentRow
                    data-component="PoolQueuedRow"
                    direction={row.direction}
                    title={
                      row.title ??
                      formatMessage({
                        id: "cockpit.garden.pool.queued.untitled",
                        defaultMessage: "New promise",
                      })
                    }
                    status={pill.status}
                    pending={pill.pending}
                    note={note}
                    units={units}
                    due={
                      row.groupDueDate ? rowDueDetail(intl, BigInt(row.groupDueDate), now) : null
                    }
                    action={
                      // Stacked below 480px of row, so two acts take one button's width; with
                      // no gap their 44px finger boxes fill the 88px row exactly.
                      <span className="flex flex-col items-center @[480px]:flex-row @[480px]:gap-1">
                        {row.discardable ? (
                          <IconButton
                            size="sm"
                            aria-label={discardLabel}
                            title={discardLabel}
                            disabled={busyJobId !== null}
                            onClick={() => void runQueued(row.jobId, acts.discardQueued)}
                            icon={<RiDeleteBinLine aria-hidden="true" />}
                          />
                        ) : null}
                        {/* A row that never tried has nothing to try again (A24). */}
                        <IconButton
                          emphasis="secondary"
                          size="sm"
                          aria-label={sendLabel}
                          title={sendLabel}
                          disabled={
                            row.settlementDeferred || !isOnline || busyJobId !== null || expired
                          }
                          loading={busyJobId === row.jobId}
                          onClick={() => void runQueued(row.jobId, acts.retryQueued)}
                          icon={<SendGlyph aria-hidden="true" />}
                        />
                      </span>
                    }
                  />
                  {/* The row leads with the phase's words; the line stays for screen
                      readers, so each change is still announced. */}
                  <ActPhaseLine
                    className="sr-only"
                    phase={phase}
                    chainId={pool.chainId}
                    confirmed={sentLine}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}

        {total === 0 && pendingCreates.length === 0 ? (
          <EmptyState
            icon={<RiSeedlingLine />}
            title={formatMessage({
              id: "cockpit.garden.pool.commitments.emptyTitle",
              defaultMessage: "No promises yet",
            })}
            description={formatMessage({
              id: "cockpit.garden.pool.commitments.emptyBody",
              defaultMessage:
                "Offers and requests between neighbors show up here. Seed the first one to begin.",
            })}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<RiFilterOffLine />}
            title={
              search.trim()
                ? formatMessage({
                    id: "cockpit.garden.pool.commitments.noMatch",
                    defaultMessage: "Nothing matches that search.",
                  })
                : formatMessage({
                    id: "cockpit.garden.pool.commitments.noneInScope",
                    defaultMessage: "Nothing here right now.",
                  })
            }
          />
        ) : (
          <ul className="@container flex flex-col gap-(--gg-list-gap)">
            {rows.map((entry) => {
              if (entry.kind === "group") {
                return (
                  <li key={entry.key} data-testid={`pool-group-${entry.displayGroupId}`}>
                    <PoolGroupRow
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
                  </li>
                );
              }
              const commitment = entry.record;
              const chip = commitmentStateChip(commitment, formatMessage);
              const isDue = dueIds.has(commitment.id);
              return (
                <li
                  key={commitment.id}
                  data-testid={`pool-commitment-${commitment.commitmentId.toString()}`}
                >
                  <CommitmentRow
                    direction={commitment.direction}
                    title={titleOf(commitment)}
                    // Past due replaces the state: it is what the steward can act on.
                    status={
                      isDue
                        ? {
                            label: formatMessage({
                              id: "cockpit.garden.pool.row.pastDue",
                              defaultMessage: "Past due",
                            }),
                            tone: "error",
                          }
                        : { label: chip.label, tone: chip.variant }
                    }
                    due={rowDueDetail(intl, commitment.dueDate, now)}
                    party={{ commitment }}
                    onOpen={() => onOpenCommitment(commitment)}
                    action={
                      isDue ? (
                        // Outlined where it sits: the red is for the confirm inside the
                        // dialog, which names the blast radius first. Below 480px of row it
                        // is its icon, so the title, pill and date keep their room.
                        <>
                          <IconButton
                            emphasis="secondary"
                            size="sm"
                            className="@[480px]:hidden"
                            aria-label={expireLabel}
                            title={expireLabel}
                            onClick={() => setExpireTarget(commitment)}
                            disabled={actDisabled}
                            icon={<RiCalendarCloseLine aria-hidden="true" />}
                          />
                          <Button
                            type="button"
                            emphasis="secondary"
                            size="compact"
                            className="hidden @[480px]:inline-flex"
                            onClick={() => setExpireTarget(commitment)}
                            disabled={actDisabled}
                          >
                            {expireLabel}
                          </Button>
                        </>
                      ) : undefined
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}

        {focus === "pastDue" && rows.length > 0 ? (
          <p className="type-meta text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.commitments.dueNote",
              defaultMessage:
                "Past due alone changes nothing. A row stays live until its expiry goes through; a failed expiry keeps it live.",
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
