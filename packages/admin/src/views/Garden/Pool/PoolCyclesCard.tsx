import { Button } from "@green-goods/shared/components/Button";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { selectCycleEndAct } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { CommitmentCycleRecord } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { cycleName, cycleStateChip, formatUnixDate } from "./poolPresentation";

export interface PoolCyclesCardProps {
  console: PoolConsoleController;
  onStartSeason: () => void;
  onOpenSeason: (cycle: CommitmentCycleRecord) => void;
  onStartCampaign: () => void;
  onOpenCampaign: (cycle: CommitmentCycleRecord) => void;
  onCancelCycle: (cycle: CommitmentCycleRecord) => void;
  /** Reconcile an Open cycle whose commitments have all finished. */
  onEndCycle: (cycle: CommitmentCycleRecord) => void;
  /** Archive a Reconciled cycle, which is final. */
  onArchiveCycle: (cycle: CommitmentCycleRecord) => void;
}

/**
 * The cycles console (uiux-spec §6.2 section 2): one season slot, the
 * campaigns beside it as peers, and the finished cycles below. The card's
 * header is the season itself. Each cycle offers the next step in its life
 * (hub decision 29): a running cycle ends once nothing in it is live, and says
 * how many commitments still hold it open until then; a reconciled one can be
 * archived; an empty one can still be cancelled.
 */
export function PoolCyclesCard({
  console: pool,
  onStartSeason,
  onOpenSeason,
  onStartCampaign,
  onOpenCampaign,
  onCancelCycle,
  onEndCycle,
  onArchiveCycle,
}: PoolCyclesCardProps) {
  const { formatMessage, locale } = useIntl();
  const { model, cycleNames, isOnline, isActing } = pool;
  const season = model.season;
  const actDisabled = !isOnline || isActing;
  const canOpenCycle = model.status === "open" || model.status === "ready";

  const cycleMeta = (cycle: CommitmentCycleRecord) =>
    formatMessage(
      {
        id: "cockpit.garden.pool.cycle.meta",
        defaultMessage:
          "{made, plural, one {# promise} other {# promises}} · {kept} kept · runs through {end}",
      },
      {
        // `commitmentsAccepted` is the lifetime milestone: every commitment
        // ever accepted in this cycle, the kept ones included. Adding the
        // fulfilled count on top would count each kept promise twice.
        made: cycle.commitmentsAccepted.toString(),
        kept: cycle.commitmentsFulfilled.toString(),
        end: formatUnixDate(cycle.endTime, locale, "—"),
      }
    );

  // Why a running cycle cannot end yet, with the count that holds it open.
  const endBlockedNote = (cycle: CommitmentCycleRecord) => {
    const act = selectCycleEndAct(cycle);
    if (act?.kind !== "end-blocked") return null;
    return (
      <p className="type-meta text-text-soft">
        {formatMessage(
          {
            id: "cockpit.garden.pool.cycle.endBlocked",
            defaultMessage:
              "{count, plural, one {# promise is still live.} other {# promises are still live.}} It can end once each is kept, canceled or expired.",
          },
          { count: act.liveCommitments.toString() }
        )}
      </p>
    );
  };
  const endButton = (cycle: CommitmentCycleRecord) =>
    selectCycleEndAct(cycle)?.kind === "end" ? (
      <Button
        type="button"
        emphasis="secondary"
        size="compact"
        onClick={() => onEndCycle(cycle)}
        disabled={actDisabled}
        aria-labelledby={
          cycle.cycleType === "CAMPAIGN"
            ? `pool-cycle-end-${cycle.cycleId.toString()} pool-cycle-name-${cycle.cycleId.toString()}`
            : undefined
        }
      >
        <span id={`pool-cycle-end-${cycle.cycleId.toString()}`}>
          {cycle.cycleType === "CAMPAIGN"
            ? formatMessage({
                id: "cockpit.garden.pool.cycle.act.end",
                defaultMessage: "End Campaign…",
              })
            : formatMessage({
                id: "cockpit.garden.pool.cycle.act.endSeason",
                defaultMessage: "End Season…",
              })}
        </span>
      </Button>
    ) : null;

  const cycleRow = (cycle: CommitmentCycleRecord) => {
    const chip = cycleStateChip(cycle, model.isPaused, formatMessage);
    const name = cycleName(cycle, cycleNames, formatMessage);
    const canCancel =
      (cycle.state === "SEEDED" || cycle.state === "OPEN") && cycle.liveCommitmentCount === 0n;
    return (
      <li
        key={cycle.id}
        className="flex flex-wrap items-center justify-between gap-2 py-2"
        data-testid={`pool-cycle-${cycle.cycleId.toString()}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              id={`pool-cycle-name-${cycle.cycleId.toString()}`}
              className="truncate type-body text-text-strong"
              title={name}
            >
              {name}
            </span>
            <StatusBadge variant="neutral" size="sm">
              {formatMessage({
                id: "cockpit.garden.pool.cycle.campaign",
                defaultMessage: "Campaign",
              })}
            </StatusBadge>
            <StatusBadge variant={chip.variant} size="sm">
              {chip.label}
            </StatusBadge>
          </div>
          <p className="type-meta text-text-soft">{cycleMeta(cycle)}</p>
          {endBlockedNote(cycle)}
        </div>
        <div className="flex items-center gap-2">
          {endButton(cycle)}
          {cycle.state === "SEEDED" ? (
            <Button
              type="button"
              emphasis="secondary"
              size="compact"
              onClick={() => onOpenCampaign(cycle)}
              disabled={actDisabled || model.status !== "open"}
            >
              {formatMessage({
                id: "cockpit.garden.pool.cycle.act.open",
                defaultMessage: "Open Campaign",
              })}
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              emphasis="tertiary"
              size="compact"
              onClick={() => onCancelCycle(cycle)}
              disabled={actDisabled}
            >
              {formatMessage({
                id: "cockpit.garden.pool.cycle.act.cancel",
                defaultMessage: "Cancel Campaign…",
              })}
            </Button>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <AdminCard variant="elevated" data-component="PoolCyclesCard" className="space-y-4">
      {season ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <AdminCardTitle
                className="truncate"
                title={cycleName(season, cycleNames, formatMessage)}
              >
                {cycleName(season, cycleNames, formatMessage)}
              </AdminCardTitle>
              <StatusBadge variant="neutral" size="sm">
                {formatMessage({
                  id: "cockpit.garden.pool.cycle.season",
                  defaultMessage: "Season",
                })}
              </StatusBadge>
              <StatusBadge
                variant={cycleStateChip(season, model.isPaused, formatMessage).variant}
                size="sm"
              >
                {cycleStateChip(season, model.isPaused, formatMessage).label}
              </StatusBadge>
            </div>
            <p className="mt-1 type-meta text-text-soft">
              {season.state === "SEEDED"
                ? formatMessage(
                    {
                      id: "cockpit.garden.pool.cycle.seededMeta",
                      defaultMessage:
                        "Runs {start} – {end} · terms written · nobody can commit yet",
                    },
                    {
                      start: formatUnixDate(season.startTime, locale, "—"),
                      end: formatUnixDate(season.endTime, locale, "—"),
                    }
                  )
                : cycleMeta(season)}
            </p>
            {endBlockedNote(season)}
          </div>
          <div className="flex items-center gap-2">
            {endButton(season)}
            {season.state === "SEEDED" ? (
              <Button
                type="button"
                emphasis="primary"
                size="compact"
                onClick={() => onOpenSeason(season)}
                disabled={actDisabled || !canOpenCycle}
              >
                {formatMessage({
                  id: "cockpit.garden.pool.cycle.act.openSeason",
                  defaultMessage: "Open to the Garden",
                })}
              </Button>
            ) : null}
            {(season.state === "SEEDED" || season.state === "OPEN") &&
            season.liveCommitmentCount === 0n ? (
              <Button
                type="button"
                emphasis="tertiary"
                size="compact"
                onClick={() => onCancelCycle(season)}
                disabled={actDisabled}
              >
                {formatMessage({
                  id: "cockpit.garden.pool.cycle.act.cancelSeason",
                  defaultMessage: "Cancel Season…",
                })}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <AdminCardTitle>
                {formatMessage({
                  id: "cockpit.garden.pool.cycle.noSeason",
                  defaultMessage: "No season running",
                })}
              </AdminCardTitle>
              <StatusBadge variant="neutral" size="sm">
                {formatMessage({
                  id: "cockpit.garden.pool.cycle.season",
                  defaultMessage: "Season",
                })}
              </StatusBadge>
            </div>
            <p className="mt-1 type-meta text-text-soft">
              {formatMessage({
                id: "cockpit.garden.pool.cycle.noSeasonMeta",
                defaultMessage:
                  "A season is the pool's main rhythm: one at a time, with campaigns beside it.",
              })}
            </p>
          </div>
          <Button
            type="button"
            emphasis="primary"
            size="compact"
            onClick={onStartSeason}
            disabled={actDisabled || !model.canSeedSeason}
          >
            {formatMessage({
              id: "cockpit.garden.pool.cycle.act.startSeason",
              defaultMessage: "Start Season",
            })}
          </Button>
        </div>
      )}

      {season?.state === "SEEDED" ? (
        <p className="type-meta text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.cycle.seededNote",
            defaultMessage:
              "Opening tells everyone the season has begun, and is the moment neighbors can start offering help and asking for it. Until then this season is only written down.",
          })}
        </p>
      ) : null}

      <div className="border-t border-stroke-soft pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="type-label-sm text-text-soft">
            {model.campaigns.length === 0
              ? formatMessage({
                  id: "cockpit.garden.pool.cycle.campaignsNone",
                  defaultMessage: "Campaigns · none yet",
                })
              : formatMessage(
                  {
                    id: "cockpit.garden.pool.cycle.campaignsCount",
                    defaultMessage: "Campaigns · {open} open · {waiting} waiting to open",
                  },
                  {
                    open: model.campaigns.filter((row) => row.state === "OPEN").length,
                    waiting: model.campaigns.filter((row) => row.state === "SEEDED").length,
                  }
                )}
          </p>
          <Button
            type="button"
            emphasis="secondary"
            size="compact"
            onClick={onStartCampaign}
            disabled={actDisabled || !model.canStartCampaign}
          >
            {formatMessage({
              id: "cockpit.garden.pool.cycle.act.startCampaign",
              defaultMessage: "Start Campaign",
            })}
          </Button>
        </div>
        {model.campaigns.length > 0 ? (
          <ul className="mt-1 divide-y divide-stroke-soft">{model.campaigns.map(cycleRow)}</ul>
        ) : (
          <p className="mt-1 type-meta text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.cycle.campaignsNote",
              defaultMessage:
                "Campaigns are shorter pushes that can run beside a season, or on their own.",
            })}
          </p>
        )}
      </div>

      {model.finishedCycles.length > 0 ? (
        <div className="border-t border-stroke-soft pt-3">
          <p className="type-label-sm text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.cycle.finished",
              defaultMessage: "Finished",
            })}
          </p>
          <ul className="mt-1 divide-y divide-stroke-soft">
            {model.finishedCycles.map((cycle) => {
              const chip = cycleStateChip(cycle, false, formatMessage);
              const name = cycleName(cycle, cycleNames, formatMessage);
              return (
                <li
                  key={cycle.id}
                  className="flex flex-wrap items-center gap-2 py-2"
                  data-testid={`pool-cycle-${cycle.cycleId.toString()}`}
                >
                  <span
                    id={`pool-cycle-name-${cycle.cycleId.toString()}`}
                    className="truncate type-body text-text-strong"
                    title={name}
                  >
                    {name}
                  </span>
                  <StatusBadge variant="neutral" size="sm">
                    {cycle.cycleType === "CAMPAIGN"
                      ? formatMessage({
                          id: "cockpit.garden.pool.cycle.campaign",
                          defaultMessage: "Campaign",
                        })
                      : formatMessage({
                          id: "cockpit.garden.pool.cycle.season",
                          defaultMessage: "Season",
                        })}
                  </StatusBadge>
                  <StatusBadge variant={chip.variant} size="sm">
                    {chip.label}
                  </StatusBadge>
                  {selectCycleEndAct(cycle)?.kind === "archive" ? (
                    <Button
                      type="button"
                      emphasis="tertiary"
                      size="compact"
                      className="ml-auto"
                      onClick={() => onArchiveCycle(cycle)}
                      disabled={actDisabled}
                      aria-labelledby={`pool-cycle-archive-${cycle.cycleId.toString()} pool-cycle-name-${cycle.cycleId.toString()}`}
                    >
                      <span id={`pool-cycle-archive-${cycle.cycleId.toString()}`}>
                        {formatMessage({
                          id: "cockpit.garden.pool.cycle.act.archive",
                          defaultMessage: "Archive…",
                        })}
                      </span>
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </AdminCard>
  );
}
