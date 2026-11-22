import { Button } from "@green-goods/shared/components/Button";
import { CommitmentRow } from "@green-goods/shared/components/Cards/CommitmentRow/CommitmentRow";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type {
  PoolConsoleController,
  VoucherConsoleView,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type {
  IssuerSafeThreshold,
  VoucherBooking,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { RiCalendarCloseLine, RiFilterOffLine, RiSeedlingLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { PersonName } from "@/components/PersonName";
import { CommitmentExpireDialog } from "./CommitmentExpireDialog";
import { PoolGroupRow } from "./PoolGroupRow";
import { GardenPoolTarget } from "./PoolTarget";
import { PoolQueuedRows, isPastDeadline } from "./PoolQueuedRows";
import { VoucherProposeReturnDialog } from "./VoucherProposeReturnDialog";
import { VoucherRowAct } from "./VoucherRowAct";
import {
  type PoolCommitmentFocus,
  type PoolCommitmentGroup,
  type PoolCommitmentScope,
  selectPoolCommitmentRows,
  withVoucherRecovery,
} from "./poolCommitmentRows";
import { commitmentStateChip } from "./poolPresentation";
import { rowDueDetail } from "./poolTime";
import { voucherBookingOptionalAct, voucherOfferRow } from "./voucherPresentation";
import { isVoucherOffer, voucherOfferTakes } from "./voucherQueue";

export type { PoolCommitmentFocus, PoolCommitmentScope } from "./poolCommitmentRows";

export interface PoolCommitmentsCardProps {
  console: PoolConsoleController;
  /** The voucher bookings on the pool's offers, read for how their rows say where each stands. */
  vouchers: VoucherConsoleView;
  /** The issuer Safe's signature rule, read from the Safe, for an optional return's dialog. */
  safe?: IssuerSafeThreshold;
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
 * Offers and Asks, the card's title since DL-077.
 * One commitments card for the whole pool (uiux-spec §6.2 section 3, 2026-07-18
 * addendum): search, the Open · Confirmed · Past chips, a Past due chip for
 * the live rows the chain would let anyone expire, a Needs recovery chip for
 * those and the disputed ones, and rows that open in the left inspector. The row information contract: kind · lifecycle · at most one
 * attention chip; meta = who · how much · when. Creations still queued on this
 * device render above the indexed rows so a seeded commitment shows up before
 * the indexer has it. Copies made together are one group row (PRD-1022 D3),
 * and a group's copies still queued fold into it as "didn't send" with Finish
 * Creating, rather than as queued rows of their own.
 *
 * Each promise shows once (decision 2 of the 18 November 2026 hub-day review):
 * a booking's acts wait in Review Promises, so a voucher offer's row only says
 * where it stands, what one booking takes, and who booked it; a group of them
 * counts booked and open copies in the row's right slot. A return the issuer
 * may propose while a booking still runs waits on no one, so it stays an
 * outlined act on its row, which then gives the person's place to the line.
 */
export function PoolCommitmentsCard({
  console: pool,
  vouchers,
  safe,
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
  const { titles, isOnline, isActing, acts } = pool;
  const model = withVoucherRecovery(pool.model, pool.commitments, vouchers);
  const expireLabel = formatMessage({
    id: "hub.garden.pool.row.act.expire",
    defaultMessage: "Expire Now…",
  });
  const [search, setSearch] = useState("");
  const [expireTarget, setExpireTarget] = useState<CommitmentReadModel | null>(null);
  // An optional return's dialog follows its booking as the read has it now, and closes once the
  // booking leaves the read.
  const [proposing, setProposing] = useState<VoucherBooking | null>(null);
  const proposingNow = proposing ? vouchers.bookingFor(proposing.commitmentId) : undefined;
  if (proposing && !proposingNow) setProposing(null);

  const dueIds = useMemo(() => new Set(model.dueLive.map((row) => row.id)), [model.dueLive]);

  const titleOf = (commitment: CommitmentReadModel) =>
    (commitment.metadataCID && titles.get(commitment.metadataCID.trim())?.title) ??
    formatMessage(
      { id: "hub.garden.pool.row.untitled", defaultMessage: "Promise {id}" },
      { id: commitment.commitmentId.toString() }
    );
  const titleById = (commitmentId: bigint) => {
    const commitment = pool.commitments.find((row) => row.commitmentId === commitmentId);
    return commitment ? titleOf(commitment) : "";
  };

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
              id: "hub.garden.pool.promises.title",
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
              id: "hub.garden.pool.act.seedPromises",
              defaultMessage: "Seed Promises",
            })}
          </Button>
        </div>

        <AdminSearchToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder={formatMessage({
            id: "hub.garden.pool.promises.search",
            defaultMessage: "Search promises",
          })}
        >
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label={formatMessage({
              id: "hub.garden.pool.commitments.scope",
              defaultMessage: "Promise scope",
            })}
          >
            <AdminFilterChip
              label={formatMessage({
                id: "hub.garden.pool.commitments.open",
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
                id: "hub.garden.pool.commitments.confirmed",
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
                id: "hub.garden.pool.commitments.past",
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
                    id: "hub.garden.pool.commitments.pastDue",
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
                    id: "hub.garden.pool.commitments.needsRecovery",
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
          <PoolQueuedRows console={pool} rows={pendingCreates} now={now} />
        ) : null}

        {total === 0 && pendingCreates.length === 0 ? (
          <EmptyState
            icon={<RiSeedlingLine />}
            title={formatMessage({
              id: "hub.garden.pool.commitments.emptyTitle",
              defaultMessage: "No promises yet",
            })}
            description={formatMessage({
              id: "hub.garden.pool.commitments.emptyBody",
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
                    id: "hub.garden.pool.commitments.noMatch",
                    defaultMessage: "Nothing matches that search.",
                  })
                : formatMessage({
                    id: "hub.garden.pool.commitments.noneInScope",
                    defaultMessage: "Nothing here right now.",
                  })
            }
          />
        ) : (
          <ul className="@container flex flex-col gap-(--gg-list-gap)">
            {rows.map((entry) => {
              if (entry.kind === "group") {
                const ids = entry.children.map((child) => child.commitmentId);
                return (
                  <li key={entry.key} data-testid={`pool-group-${entry.displayGroupId}`}>
                    <PoolGroupRow
                      group={entry}
                      voucher={
                        isVoucherOffer(ids, vouchers)
                          ? { takes: voucherOfferTakes(ids, vouchers, formatMessage) }
                          : null
                      }
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
              const voucher = voucherOfferRow(commitment.commitmentId, vouchers, intl, now);
              // A return that didn't go through owes the holder vouchers: its retry keeps the
              // row past the due date, where expiring would fix nothing.
              const isDue = dueIds.has(commitment.id) && voucher?.act !== "retry";
              const optional =
                !isDue && voucher?.booking ? voucherBookingOptionalAct(voucher.booking) : null;
              // An act in the right slot keeps it, and the person moves to the line (DL-195).
              const slotTaken = isDue || optional !== null;
              const takes = voucher
                ? voucherOfferTakes([commitment.commitmentId], vouchers, formatMessage)
                : null;
              // A voucher offer says what one booking takes, after a booking's trouble or before
              // its day; the person who booked it takes the right slot.
              const row = (bookedBy: string | null) => (
                <CommitmentRow
                  direction={commitment.direction}
                  title={titleOf(commitment)}
                  // Past due replaces the state: it is what the steward can act on. A
                  // booking that needs someone says so in the state's place too.
                  status={
                    isDue
                      ? {
                          label: formatMessage({
                            id: "hub.garden.pool.row.pastDue",
                            defaultMessage: "Past due",
                          }),
                          tone: "error",
                        }
                      : (voucher?.status ?? { label: chip.label, tone: chip.variant })
                  }
                  note={takes ? undefined : voucher?.note}
                  service={
                    takes && voucher
                      ? {
                          takes,
                          booking: slotTaken && bookedBy ? bookedBy : voucher.note,
                          promisedBy: "",
                        }
                      : undefined
                  }
                  amount={
                    bookedBy && !slotTaken
                      ? {
                          value: bookedBy,
                          truncate: true,
                          caption: formatMessage({
                            id: "hub.garden.pool.voucher.row.holder",
                            defaultMessage: "booked",
                          }),
                        }
                      : undefined
                  }
                  due={rowDueDetail(intl, commitment.dueDate, now)}
                  party={{ commitment }}
                  onOpen={() => onOpenCommitment(commitment)}
                  action={
                    isDue ? (
                      // Outlined: the red is for the dialog's confirm, which names the blast radius first.
                      // Below 480px of row it is its icon, so the title, pill and date keep their room.
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
                    ) : optional && voucher?.booking ? (
                      <VoucherRowAct
                        variant="row"
                        booking={voucher.booking}
                        act={optional}
                        disabled={actDisabled}
                        onOpen={() => setProposing(voucher.booking)}
                        onRetry={vouchers.acts.retryTransfer}
                      />
                    ) : undefined
                  }
                />
              );
              const holder = voucher?.booking?.holder;
              return (
                <li
                  key={commitment.id}
                  data-testid={`pool-commitment-${commitment.commitmentId.toString()}`}
                >
                  {holder ? (
                    <PersonName address={holder}>{(name) => row(name)}</PersonName>
                  ) : (
                    row(null)
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {focus === "pastDue" && rows.length > 0 ? (
          <p className="type-meta text-text-soft">
            {formatMessage({
              id: "hub.garden.pool.commitments.dueNote",
              defaultMessage:
                "Past due alone changes nothing. A row stays live until its expiry goes through; a failed expiry keeps it live.",
            })}
          </p>
        ) : null}
      </AdminCard>

      <VoucherProposeReturnDialog
        booking={proposingNow ?? null}
        title={proposingNow ? titleById(proposingNow.commitmentId) : ""}
        safe={safe}
        disabled={actDisabled}
        tone={tone}
        onClose={() => setProposing(null)}
        onPropose={vouchers.acts.proposeReturn}
      />

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
